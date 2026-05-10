/**
 * scripts/import-parecer-medicamentos.js
 *
 * Importa TA_CONSULTA_PARECER_AVAL_MEDICAMENTOS.CSV para dou_feed no Supabase.
 * Categoria sempre = 'Medicamento' — compatível com filtro por tipo_anvisa existente.
 *
 * Uso: node scripts/import-parecer-medicamentos.js
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { randomUUID } = require('crypto');

const CSV_PATH = path.join(process.cwd(), 'Arquivos CSV', 'TA_CONSULTA_PARECER_AVAL_MEDICAMENTOS.CSV');

const DB = {
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

// Mapeamento col[19] → tipo_evento
function mapTipoEvento(situacao) {
  const s = (situacao || '').toLowerCase();
  if (s.includes('deferimento') && !s.includes('inde')) return 'REGISTRO_DEFERIDO';
  if (s.includes('indeferimento')) return 'REGISTRO_INDEFERIDO';
  return 'DESPACHO_ANVISA';
}

function mapPriority(tipoEvento) {
  if (tipoEvento === 'REGISTRO_DEFERIDO') return 'alta';
  if (tipoEvento === 'REGISTRO_INDEFERIDO') return 'media';
  return 'baixa';
}

function gerarInsight(nomeProduto, principioAtivo, tipoEvento, tipoRegistro) {
  if (tipoEvento === 'REGISTRO_DEFERIDO') {
    return `Novo medicamento "${nomeProduto}" deferido pela ANVISA — oportunidade no segmento de ${tipoRegistro || 'medicamentos'}.`;
  }
  if (tipoEvento === 'REGISTRO_INDEFERIDO') {
    return `Registro de "${nomeProduto}" indeferido pela ANVISA. Principio ativo: ${principioAtivo}.`;
  }
  return `Despacho ANVISA para "${nomeProduto}". Principio ativo: ${principioAtivo}.`;
}

function parseLinha(line) {
  return line.split(';').map(v => v.replace(/^"|"$/g, '').trim());
}

function parseTimestamp(str) {
  if (!str || !str.trim()) return null;
  // Formato: MM/DD/YYYY HH:MM:SS
  const m = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}:${m[6]}`);
}

const BATCH_SIZE = 100;

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ Arquivo não encontrado:', CSV_PATH);
    process.exit(1);
  }

  const pg = new Client(DB);
  await pg.connect();
  console.log('✅ Conectado ao Supabase');

  const content = fs.readFileSync(CSV_PATH, 'latin1');
  const lines = content.split('\n').filter(l => l.trim());

  console.log(`📄 ${lines.length} linhas encontradas`);

  let inseridas = 0, ignoradas = 0, erros = 0;
  let batch = [];
  const start = Date.now();

  const flush = async () => {
    if (batch.length === 0) return;
    // deduplica por appwrite_id dentro do batch (último ganha)
    const seen = new Map();
    for (const r of batch) seen.set(r.appwrite_id, r);
    batch = [...seen.values()];
    const placeholders = batch.map((_, i) => {
      const b = i * 12;
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12})`;
    }).join(',');
    const values = batch.flatMap(r => [
      r.id, r.appwrite_id, r.tipo_evento, r.priority, r.categoria,
      r.empresa, r.produto, r.ativos, r.technical_info,
      r.impacto_negocios, r.numero_registro, r.timestamp
    ]);

    try {
      await pg.query(
        `INSERT INTO public.dou_feed
          (id, appwrite_id, tipo_evento, priority, categoria, empresa, produto, ativos, technical_info, impacto_negocios, numero_registro, timestamp)
         VALUES ${placeholders}
         ON CONFLICT (appwrite_id) DO UPDATE SET
           tipo_evento=EXCLUDED.tipo_evento,
           priority=EXCLUDED.priority,
           empresa=EXCLUDED.empresa,
           produto=EXCLUDED.produto,
           ativos=EXCLUDED.ativos,
           technical_info=EXCLUDED.technical_info,
           impacto_negocios=EXCLUDED.impacto_negocios,
           numero_registro=EXCLUDED.numero_registro,
           timestamp=EXCLUDED.timestamp`,
        values
      );
      inseridas += batch.length;
    } catch (e) {
      erros += batch.length;
      console.error('Batch erro:', e.message);
    }
    batch = [];
  };

  for (const line of lines) {
    const cols = parseLinha(line);
    if (cols.length < 20) { ignoradas++; continue; }

    const expediente    = (cols[3] || '').substring(0, 100);
    const empresa       = (cols[6] || '').substring(0, 255);
    const cnpj          = (cols[7] || '').replace(/\D/g, '').substring(0, 14);
    const principioAtivo = (cols[8] || '').substring(0, 255);
    const nomeProduto   = (cols[9] || '').substring(0, 500);
    const dataSituacao  = parseTimestamp(cols[11]);
    const numRegistro   = (cols[15] || '').substring(0, 50);
    const formaFarm     = (cols[18] || '').substring(0, 255);
    const situacao      = (cols[19] || '').trim();
    const tipoRegistro  = (cols[20] || '').substring(0, 255);

    if (!expediente) { ignoradas++; continue; }

    const tipoEvento = mapTipoEvento(situacao);
    const priority   = mapPriority(tipoEvento);

    // produto exibido: nome + forma farmacêutica
    const produtoDisplay = [nomeProduto, formaFarm].filter(Boolean).join(' — ');

    // empresa exibida: razão social + CNPJ formatado
    const cnpjFmt = cnpj.length === 14
      ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      : cnpj;
    const empresaDisplay = [empresa, cnpjFmt].filter(Boolean).join(' | ');

    batch.push({
      id:              randomUUID(),
      appwrite_id:     `parecer-${expediente}`,
      tipo_evento:     tipoEvento,
      priority,
      categoria:       'Medicamento',
      empresa:         empresaDisplay.substring(0, 500),
      produto:         produtoDisplay.substring(0, 500),
      ativos:          `{${principioAtivo.replace(/,/g, ';')}}`,
      technical_info:  tipoRegistro,
      impacto_negocios: gerarInsight(nomeProduto, principioAtivo, tipoEvento, tipoRegistro).substring(0, 1000),
      numero_registro: numRegistro,
      timestamp:       dataSituacao || new Date(),
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }

  await flush();

  const dur = Math.round((Date.now() - start) / 1000);
  console.log(`\n✅ Concluído em ${dur}s`);
  console.log(`   Inseridos/atualizados: ${inseridas}`);
  console.log(`   Ignorados:             ${ignoradas}`);
  console.log(`   Erros:                 ${erros}`);

  await pg.end();
}

main().catch(e => { console.error('❌ Erro fatal:', e.message); process.exit(1); });
