import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { parse } from 'csv-parse';
import iconv from 'iconv-lite';
import crypto from 'crypto';

import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const URL_MED = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv';
const URL_COSM = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_COSMETICO.csv';

// Caminhos locais — coloque os CSVs na pasta "Arquivos CSV/" para usar sem download
const LOCAL_PATH_MED = path.join(process.cwd(), 'Arquivos CSV', 'DADOS_ABERTOS_MEDICAMENTOS.csv');
const LOCAL_PATH_COSM = path.join(process.cwd(), 'Arquivos CSV', 'DADOS_ABERTOS_COSMETICO.csv');

// Converte CNPJ bagunçado para formato contínuo "00000000000000"
function cleanCnpj(cnpj?: string) {
  if (!cnpj) return null;
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14) return null;
  return c;
}

// Gera um UUID determinístico a partir de uma string (SHA-1)
// Necessário para que o Supabase aceite como ID (UUID) e permita o Upsert (deduplicação)
function deterministicUUID(input: string) {
  const hash = crypto.createHash('sha1').update(input).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-5${hash.substring(13, 16)}-8${hash.substring(16, 19)}-${hash.substring(20, 32)}`;
}

const BATCH_SIZE = 1500; // Chunk seguro para o Supabase

/**
 * Mapeador e Uploader genérico para ambos os arquivos
 */
async function processOpenData(
  source: string, // URL ou Caminho Local
  tableName: string, 
  mapper: (row: any) => any,
  conflictCol: string
) {
  const isLocal = fs.existsSync(source);
  
  console.log(`\n==========================================`);
  console.log(`Iniciando Sincronização: ${tableName}`);
  console.log(`Fonte: ${isLocal ? 'LOCAL (Arquivo)' : 'REMOTA (URL)'}`);
  console.log(`Path/URL: ${source}`);
  console.log(`==========================================`);

  return new Promise<void>((resolve, reject) => {
    const pipeStream = (stream: any) => {
      let batch: any[] = [];
      let totalProcessed = 0;
      let totalUpserted = 0;

      const parser = parse({
        delimiter: ';',
        columns: true, // sempre usa a primeira linha como header
        relax_quotes: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });

      stream.pipe(iconv.decodeStream('win1252')).pipe(parser);

      const flushBatch = async () => {
        if (batch.length === 0) return;
        
        // DEDUPLICAÇÃO: Evita erro "ON CONFLICT DO UPDATE command cannot affect row a second time"
        // que ocorre quando o arquivo CSV tem o mesmo processo/cnpj em linhas diferentes (apresentações variadas)
        const dedupMap = new Map();
        [...batch].forEach(item => dedupMap.set(item.id, item));
        const currentBatch = Array.from(dedupMap.values());
        
        batch = [];
        
        try {
          const { error } = await supabase
            .from(tableName)
            .upsert(currentBatch, { onConflict: conflictCol, ignoreDuplicates: false });
            
          if (error) {
            console.error(`\n[${tableName}] Erro ao upsert lote:`, error.message);
          } else {
            totalUpserted += currentBatch.length;
            process.stdout.write(`\r[${tableName}] Sincronizados: ${totalUpserted} registros...`);
          }
        } catch (e: any) {
          console.error(`\n[${tableName}] Try/Catch Erro no upsert:`, e.message);
        }
      };

      parser.on('readable', async () => {
        let record;
        while ((record = parser.read()) !== null) {
          totalProcessed++;
          const mapped = mapper(record);
          if (mapped) batch.push(mapped);
          if (batch.length >= BATCH_SIZE) {
            parser.pause();
            await flushBatch();
            parser.resume();
          }
        }
      });

      parser.on('error', (err) => {
        console.error(`\n[${tableName}] Erro de Parser:`, err.message);
        reject(err);
      });

      parser.on('end', async () => {
        console.log(`\n[${tableName}] Fim do Arquivo Atingido.`);
        if (batch.length > 0) await flushBatch();
        console.log(`[${tableName}] ✅ Sincronização Concluída! (${totalUpserted} inseridos)`);
        resolve();
      });
    };

    if (isLocal) {
      const readStream = fs.createReadStream(source);
      pipeStream(readStream);
    } else {
      const agent = new https.Agent({ rejectUnauthorized: false });
      https.get(source, { agent }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`Falha HTTP: ${res.statusCode}`));
        pipeStream(res);
      }).on('error', (err) => reject(err));
    }
  });
}


async function run() {
  console.log(`🚀 Iniciando Bot de Ingestão de Dados Abertos (ANVISA)`);

  // Define fontes baseadas na existência local
  const medSource = fs.existsSync(LOCAL_PATH_MED) ? LOCAL_PATH_MED : URL_MED;
  const cosmSource = fs.existsSync(LOCAL_PATH_COSM) ? LOCAL_PATH_COSM : URL_COSM;

  // MEDICAMENTOS
  await processOpenData(medSource, 'anvisa_medicamentos', (row) => {
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        if (row[k] !== undefined) return row[k];
      }
      return '';
    };

    let cnpjRaw = getVal('EMPRESA_DETENTORA_REGISTRO', 'CNPJ_EMPRESA', 'CNPJ_DETENTOR_REGISTRO', 'CNPJ');
    if (cnpjRaw.includes(' - ')) cnpjRaw = cnpjRaw.split(' - ')[0];
    const cnpj = cleanCnpj(cnpjRaw);
    if (!cnpj) return null;

    const processo = getVal('NUMERO_PROCESSO', 'NU_PROCESSO', 'processo').substring(0, 50);

    // Vencimento: formato 6 dígitos "MMYYYY" → "01/MM/YYYY", ou DD/MM/YYYY direto
    const vencRaw = getVal('DATA_VENCIMENTO_REGISTRO', 'DT_VENCIMENTO_REGISTRO').trim();
    let vencimento = '';
    if (/^\d{6}$/.test(vencRaw)) {
      vencimento = `01/${vencRaw.substring(0, 2)}/${vencRaw.substring(2)}`;
    } else if (/^\d{2}\/\d{2}\/\d{4}/.test(vencRaw)) {
      vencimento = vencRaw;
    }

    // Calcula seguro_compra com base na situação e no vencimento
    const situacao = getVal('SITUACAO_REGISTRO', 'ST_SITUACAO_REGISTRO').toUpperCase();
    let seguro_compra = situacao === 'ATIVO' || situacao === 'ATIVA';
    if (vencimento) {
      const parts = vencimento.split('/');
      if (parts.length === 3) {
        const dataVal = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(dataVal.getTime()) && dataVal < new Date()) seguro_compra = false;
      }
    }

    const empresaRaw = getVal('EMPRESA_DETENTORA_REGISTRO', 'RAZAO_SOCIAL_DETENTOR_REGISTRO', 'RAZAO_SOCIAL');
    const razao_social = empresaRaw.includes(' - ')
      ? empresaRaw.split(' - ').slice(1).join(' - ').trim()
      : empresaRaw;

    return {
      id: deterministicUUID(processo + "_" + cnpj),
      cnpj,
      razao_social: razao_social.substring(0, 255),
      nome_produto: getVal('NOME_PRODUTO', 'NO_PRODUTO', 'NOME_COMERCIAL_PRODUTO').substring(0, 255),
      processo,
      registro: getVal('NUMERO_REGISTRO_PRODUTO', 'NU_REGISTRO_PRODUTO', 'registro').substring(0, 50),
      principio_ativo: getVal('PRINCIPIO_ATIVO', 'NO_PRINCIPIO_ATIVO').substring(0, 500) || null,
      vencimento: vencimento.substring(0, 20) || null,
      vencimento_limpo: vencimento || null,
      seguro_compra,
      created_at: new Date().toISOString()
    };
  }, 'id'); // Assumindo alteração para ter constraint de PK 'id' = processo_cnpj
  
  // ==========================================
  // PARTE 2: COSMÉTICOS
  // ==========================================
  // CSV Headers parecidos, mas com foco em Situação
  await processOpenData(cosmSource, 'anvisa_cosmeticos', (row) => {
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        if (row[k] !== undefined) return row[k];
      }
      return '';
    };

    const cnpj = cleanCnpj(getVal('CNPJ_EMPRESA', 'NU_CNPJ_EMPRESA', 'CNPJ'));
    if (!cnpj) return null;

    const processo = getVal('NU_PROCESSO', 'processo').substring(0, 50);

    return {
      id: deterministicUUID(processo + "_" + cnpj), 
      cnpj,
      razao_social: getVal('NO_RAZAO_SOCIAL_EMPRESA', 'RAZAO_SOCIAL_EMPRESA').substring(0, 255),
      nome_produto: getVal('NO_PRODUTO', 'NOME_PRODUTO').substring(0, 255),
      processo,
      situacao: getVal('ST_SITUACAO_REGISTRO', 'SITUACAO').substring(0, 50) || 'ATIVO', 
      vencimento: getVal('DT_VENCIMENTO_REGISTRO', 'vencimento').substring(0, 20) || null,
      vencimento_limpo: null,
      seguro_compra: true,
      created_at: new Date().toISOString()
    };
  }, 'id');

  console.log(`\n🎉 Sincronização Total Concluída com Sucesso!`);
}

run().catch(err => {
  console.error("FATAL ERROR NO ETL:", err);
  process.exit(1);
});
