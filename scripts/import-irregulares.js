/**
 * scripts/import-irregulares.js
 * Importa TA_CONSULTA_PRODUTOS_IRREGULARES_RESULTADO.CSV → anvisa_irregulares
 * Filtra apenas DS_TIPO_PRODUTO = "Cosmético" e "Medicamento"
 */

require('dotenv').config({ path: '.env.local' });
const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

const CSV_PATH = path.join(process.cwd(), 'Arquivos CSV', 'TA_CONSULTA_PRODUTOS_IRREGULARES_RESULTADO.CSV');

const DB = {
  host: process.env.SUPABASE_DB_HOST,
  port: 5432, database: 'postgres', user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false },
};

function parseTs(str) {
  if (!str || !str.trim()) return null;
  const m = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[1]}-${m[2]}`);
}

const BATCH = 300;

async function main() {
  const pg = new Client(DB);
  await pg.connect();
  console.log('✅ Conectado');

  // Sem truncate — upsert inteligente: insere novos, atualiza modificados, mantém histórico

  const content = fs.readFileSync(CSV_PATH, 'latin1');
  const lines   = content.split('\n').filter(l => l.trim());
  const header  = lines[0].split(';');

  const idx = (name) => header.indexOf(name);
  const I = {
    seq:        idx('CO_SEQ_DOSSIE_INVESTIG_MED'),
    processo:   idx('NU_PROCESSO'),
    cnpjFab:    idx('NU_CNPJ'),
    razao:      idx('NO_RAZAO_SOCIAL'),
    tipo:       idx('DS_TIPO_PRODUTO'),
    risco:      idx('DS_RISCO_PRODUTO'),
    empresa:    idx('NO_EMPRESA_INVESTIGADA'),
    cnpjInv:    idx('NU_CNPJ_EMPRESA_INVESTIGADA'),
    dtPub:      idx('DT_PUBLICACAO'),
    produtos:   idx('PRODUTOS_CONCATENADOS'),
    acao:       idx('DS_ACAO_FISCALIZACAO'),
    atividade:  idx('DS_ATIVIDADE_FISCALIZACAO'),
    acaoAtiv:   idx('ACAO_ATIVIDADE'),
    produto:    idx('PRODUTO'),
    registro:   idx('REGISTRO'),
  };

  let batch = [], inseridas = 0, ignoradas = 0, erros = 0;
  const seen = new Set();

  const flush = async () => {
    if (!batch.length) return;
    // dedup
    const dedup = new Map();
    for (const r of batch) dedup.set(r.seq_dossie, r);
    const rows = [...dedup.values()];
    const ph = rows.map((_, i) => {
      const b = i * 15;
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15})`;
    }).join(',');
    const vals = rows.flatMap(r => [
      r.seq_dossie, r.nu_processo, r.cnpj_fabricante, r.razao_social,
      r.tipo_produto, r.nivel_risco, r.empresa_investigada, r.cnpj_investigada,
      r.dt_publicacao, r.produtos, r.acao, r.atividade, r.acao_atividade,
      r.produto, r.registro
    ]);
    try {
      await pg.query(
        `INSERT INTO public.anvisa_irregulares
          (seq_dossie,nu_processo,cnpj_fabricante,razao_social,tipo_produto,nivel_risco,
           empresa_investigada,cnpj_investigada,dt_publicacao,produtos,acao,atividade,
           acao_atividade,produto,registro)
         VALUES ${ph}
         ON CONFLICT (seq_dossie) DO UPDATE SET
           acao=EXCLUDED.acao, atividade=EXCLUDED.atividade,
           dt_publicacao=EXCLUDED.dt_publicacao, produtos=EXCLUDED.produtos`,
        vals
      );
      inseridas += rows.length;
    } catch(e) { erros += rows.length; console.error('Batch erro:', e.message); }
    batch = [];
  };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(v => v.replace(/^"|"$/g,'').trim());
    const tipo = cols[I.tipo] || '';
    if (tipo !== 'Cosmético' && tipo !== 'Medicamento') { ignoradas++; continue; }

    const seq = (cols[I.seq] || '').substring(0, 50);
    if (!seq) { ignoradas++; continue; }

    batch.push({
      seq_dossie:         seq,
      nu_processo:        (cols[I.processo] || '').substring(0, 50),
      cnpj_fabricante:    (cols[I.cnpjFab] || '').replace(/\D/g,'').substring(0, 14),
      razao_social:       (cols[I.razao] || '').substring(0, 255),
      tipo_produto:       tipo,
      nivel_risco:        (cols[I.risco] || '').substring(0, 50),
      empresa_investigada:(cols[I.empresa] || '').substring(0, 255),
      cnpj_investigada:   (cols[I.cnpjInv] || '').replace(/\D/g,'').substring(0, 14),
      dt_publicacao:      parseTs(cols[I.dtPub]),
      produtos:           (cols[I.produtos] || '').substring(0, 2000),
      acao:               (cols[I.acao] || '').substring(0, 100),
      atividade:          (cols[I.atividade] || '').substring(0, 100),
      acao_atividade:     (cols[I.acaoAtiv] || '').substring(0, 1000),
      produto:            (cols[I.produto] || '').substring(0, 500),
      registro:           (cols[I.registro] || '').substring(0, 50),
    });

    if (batch.length >= BATCH) await flush();
  }
  await flush();

  const total = inseridas + ignoradas + erros;
  console.log(`\n✅ Concluído`);
  console.log(`   Total linhas:   ${total}`);
  console.log(`   Inseridas:      ${inseridas}`);
  console.log(`   Ignoradas:      ${ignoradas} (outros tipos)`);
  console.log(`   Erros:          ${erros}`);
  await pg.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
