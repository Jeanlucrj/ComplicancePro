/**
 * scripts/stream-risco-anvisa.js
 *
 * Streaming ETL: baixa TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV da ANVISA
 * linha a linha (sem salvar em disco), filtra "Em exigência" e insere no Supabase.
 *
 * Uso: node scripts/stream-risco-anvisa.js
 */

require('dotenv').config({ path: '.env.local' });

const https = require('https');
const { Client } = require('pg');
const { StringDecoder } = require('string_decoder');

const CSV_URL = 'https://dados.anvisa.gov.br/dados/CONSULTAS/DOCUMENTOS/TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV';

const DB = {
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const SITUACOES_RISCO = ['em exigência', 'em exigência da inspeção', 'em exigência prorrogada'];

function classificarRisco(situacao) {
  const s = situacao.toLowerCase().trim();
  for (const key of SITUACOES_RISCO) {
    if (s.includes(key)) return 'MEDIO';
  }
  return null;
}

function parseLinha(line) {
  return line.split(';').map(v => v.replace(/^"|"$/g, '').trim());
}

const BATCH_SIZE = 200;

async function main() {
  const pg = new Client(DB);
  await pg.connect();
  console.log('✅ Conectado ao Supabase (Postgres)');

  // Limpa registros antigos antes de re-importar
  await pg.query('TRUNCATE TABLE public.anvisa_risco RESTART IDENTITY');
  console.log('🗑️  Tabela limpa, iniciando import...');

  let lidas = 0, criticas = 0, inseridas = 0, erros = 0;
  let batch = [];
  const start = Date.now();

  // Buffer para reconstituir linhas do stream
  let buffer = '';
  let isFirst = true; // pula header

  // Converte latin1 → utf8 via iconv-lite se disponível, senão usa workaround
  let iconv;
  try { iconv = require('iconv-lite'); } catch (_) { iconv = null; }

  const upsertBatch = async (rows) => {
    if (rows.length === 0) return;
    // deduplica por expediente dentro do batch (último ganha)
    const seen = new Map();
    for (const r of rows) seen.set(r.expediente, r);
    rows = [...seen.values()];
    const placeholders = rows.map((_, i) => {
      const base = i * 11;
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11})`;
    }).join(',');
    const values = rows.flatMap(r => [
      r.expediente, r.cnpj, r.razao_social, r.cod_processo, r.tipo_processo,
      r.num_registro, r.data_protocolo, r.situacao, r.nivel_risco,
      r.data_situacao, r.data_vencimento
    ]);
    try {
      await pg.query(
        `INSERT INTO public.anvisa_risco
          (expediente,cnpj,razao_social,cod_processo,tipo_processo,num_registro,data_protocolo,situacao,nivel_risco,data_situacao,data_vencimento)
         VALUES ${placeholders}
         ON CONFLICT (expediente) DO UPDATE SET
           situacao=EXCLUDED.situacao, nivel_risco=EXCLUDED.nivel_risco,
           data_situacao=EXCLUDED.data_situacao`,
        values
      );
      inseridas += rows.length;
    } catch (e) {
      erros += rows.length;
      console.error('Batch erro:', e.message);
    }
  };

  const agent = new https.Agent({ rejectUnauthorized: false });

  await new Promise((resolve, reject) => {
    https.get(CSV_URL, { agent }, (res) => {
      console.log(`📡 Conectado ao portal ANVISA (HTTP ${res.statusCode}), iniciando stream...`);

      res.on('data', (chunk) => {
        // Converte latin1 para string
        let text;
        if (iconv) {
          text = iconv.decode(chunk, 'latin1');
        } else {
          text = chunk.toString('latin1');
        }

        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // última linha incompleta fica no buffer

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          lidas++;

          if (isFirst) { isFirst = false; continue; } // pula header

          const cols = parseLinha(line);
          if (cols.length < 10) continue;

          const situacao = cols[9] || '';
          const nivel = classificarRisco(situacao);
          if (!nivel) continue;

          const cnpj = (cols[2] || '').replace(/\D/g, '').substring(0, 14);
          if (!cnpj || cnpj.length < 11) continue;

          criticas++;

          const expediente = (cols[0] || '').substring(0, 50) || `${cnpj}-${criticas}`;

          batch.push({
            expediente,
            cnpj,
            razao_social: (cols[3] || '').substring(0, 255),
            cod_processo: (cols[4] || '').substring(0, 20),
            tipo_processo: (cols[5] || '').substring(0, 500),
            num_registro: (cols[6] || '').substring(0, 50),
            data_protocolo: (cols[7] || '').substring(0, 30),
            situacao: situacao.substring(0, 200),
            nivel_risco: nivel,
            data_situacao: (cols[10] || '').substring(0, 30),
            data_vencimento: (cols[20] || '').substring(0, 30),
          });

          if (batch.length >= BATCH_SIZE) {
            const toInsert = batch.splice(0, BATCH_SIZE);
            res.pause();
            upsertBatch(toInsert).then(() => res.resume()).catch(e => { erros++; res.resume(); });
          }

          if (lidas % 500000 === 0) {
            const elapsed = Math.round((Date.now() - start) / 1000);
            console.log(`  📊 ${(lidas/1000000).toFixed(1)}M lidas | ${criticas.toLocaleString('pt-BR')} críticos | ${inseridas.toLocaleString('pt-BR')} salvos | ${elapsed}s`);
          }
        }
      });

      res.on('end', async () => {
        // processa linha restante no buffer
        if (buffer.trim()) {
          const cols = parseLinha(buffer.trim());
          if (cols.length >= 10) {
            const situacao = cols[9] || '';
            const nivel = classificarRisco(situacao);
            if (nivel) {
              const cnpj = (cols[2] || '').replace(/\D/g, '').substring(0, 14);
              if (cnpj && cnpj.length >= 11) {
                criticas++;
                batch.push({
                  expediente: (cols[0] || '').substring(0, 50) || `${cnpj}-${criticas}`,
                  cnpj, razao_social: (cols[3] || '').substring(0, 255),
                  cod_processo: (cols[4] || '').substring(0, 20),
                  tipo_processo: (cols[5] || '').substring(0, 500),
                  num_registro: (cols[6] || '').substring(0, 50),
                  data_protocolo: (cols[7] || '').substring(0, 30),
                  situacao: situacao.substring(0, 200), nivel_risco: nivel,
                  data_situacao: (cols[10] || '').substring(0, 30),
                  data_vencimento: (cols[20] || '').substring(0, 30),
                });
              }
            }
          }
        }
        // flush batch final
        await upsertBatch(batch);
        batch = [];
        resolve();
      });

      res.on('error', reject);
    }).on('error', reject);
  });

  const dur = Math.round((Date.now() - start) / 1000);
  const min = Math.floor(dur / 60);
  const seg = dur % 60;
  console.log(`\n✅ Concluído em ${min}m${seg}s`);
  console.log(`   Linhas lidas:         ${lidas.toLocaleString('pt-BR')}`);
  console.log(`   Críticos filtrados:   ${criticas.toLocaleString('pt-BR')}`);
  console.log(`   Salvos no Supabase:   ${inseridas.toLocaleString('pt-BR')}`);
  console.log(`   Erros:                ${erros}`);

  await pg.end();
}

main().catch(e => { console.error('❌ Erro fatal:', e.message); process.exit(1); });
