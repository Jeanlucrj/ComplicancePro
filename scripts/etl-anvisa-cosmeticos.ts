import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('🚨 Erro: Credenciais do Supabase não encontradas no arquivo .env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Função utilitária para delay (sleep).
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Função principal do processo ETL usando Playwright para bypassar o Cloudflare
 */
async function runEtl() {
  console.log('🚀 Iniciando ETL de Cosméticos Regularizados da Anvisa...');
  console.log('📍 Conectando usando um navegador real (Playwright) para burlar bloqueios...');

  // Inicializa o browser Playwright
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });
  
  const page = await context.newPage();

  // Entramos na página inicial neutra apenas para gerar os cookies/fingerprints do Cloudflare da sessão
  console.log('⏳ Gerando tokens e validando acesso contra o provedor (WAF)...');
  await page.goto('https://consultas.anvisa.gov.br/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  let pageNum = 1;
  let isLast = false;
  let totalProcessados = 0;

  try {
    while (!isLast) {
      process.stdout.write(`📄 Buscando página API REST iterativamente (página ${pageNum})... `);
      
      const apiUrl = `https://consultas.anvisa.gov.br/api/consulta/cosmeticos/regularizados?count=100&filter[situacao]=1&page=${pageNum}`;
      
      const responseInfo = await page.evaluate(async (url: string) => {
        const res = await fetch(url, {
          headers: {
            'Authorization': 'Guest',
            'Accept': 'application/json, text/plain, */*',
          }
        });
        
        return {
          status: res.status,
          body: await res.text()
        };
      }, apiUrl);

      if (responseInfo.status !== 200) {
        console.error(`\n❌ Falha irrecuperável: O servidor da Anvisa retornou Status HTTP ${responseInfo.status}\nCorpo: ${responseInfo.body}`);
        break; // Quebra o loop
      }

      // Converte a string pra JSON real
      const data = JSON.parse(responseInfo.body);
      const content = data.content || [];
      isLast = data.last; // Determina se devemos parar paginação

      if (content.length === 0) {
        console.log('Vazio. (Nenhum produto retornado).');
      } else {
        // Mapeamento de Dados para envio ao Supabase
        const produtosFormatados = content.map((item: any) => {
          let dataFormatada = null;
          if (item.dataVencimento) {
            try { dataFormatada = new Date(item.dataVencimento).toISOString(); } 
            catch (e) { dataFormatada = item.dataVencimento; }
          }

          return {
            processo: item.processo,        // Usado como ID único exigido pela Spec
            nome_produto: item.nomeProduto,
            cnpj: item.cnpj,
            data_vencimento: dataFormatada,
            atualizado_em: new Date().toISOString()
          };
        });

        // 3. Upsert no Supabase
        const { error } = await supabase
          .from('cosmeticos_regularizados')
          .upsert(produtosFormatados, {
            onConflict: 'processo', 
            ignoreDuplicates: false // false para sempre atualizar os antigos!
          });

        if (error) {
           console.error(`\n❌ Erro ao fazer upsert na página ${pageNum}:`, error.message);
        } else {
           totalProcessados += produtosFormatados.length;
           console.log(`✅ Sucesso! Lote Upsertado (${produtosFormatados.length} itens).`);
        }
      }

      // Tratamento de resiliência (delay exigido para não levar ban por rate-limit na sessão)
      if (!isLast) {
        pageNum++;
        await delay(1500); // Exigência técnica de 1.5s
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Ocorreu um erro crítico generalizado no Loop:`, error.message);
  } finally {
    // É imprescindível fechar o navegador pra não deixar uso de memória travado
    await browser.close();
  }

  console.log(`\n🎉 Processo ETL finalizado via Playwright Tunnel!`);
  console.log(`📊 Total de registros salvos no banco Supabase: ${totalProcessados}`);
}

runEtl();
