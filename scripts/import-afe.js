/**
 * scripts/import-afe.js
 *
 * Importa dados de AFE (Autorização de Funcionamento de Empresa)
 * dos arquivos CSV da ANVISA para a tabela anvisa_afe.
 *
 * Arquivos esperados:
 *   TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV
 *   TA_CONSULTA_FUNCIONAMENTO_EMPRESA_INTERNACIONAL.CSV
 *
 * Uso:
 *   node scripts/import-afe.js --tipo=NACIONAL --file=C:/Users/User/Downloads/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV
 *   node scripts/import-afe.js --tipo=INTERNACIONAL --file=C:/Users/User/Downloads/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_INTERNACIONAL.CSV
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const { StringDecoder } = require('string_decoder');

const DB = {
  host: 'db.agcdyfnxwxlwwakvusov.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: 'Mf@06296009', ssl: { rejectUnauthorized: false },
};

// Parse args
const args = process.argv.slice(2);
const tipoArg = (args.find(a => a.startsWith('--tipo=')) || '--tipo=NACIONAL').split('=')[1].toUpperCase();
const fileArg = (args.find(a => a.startsWith('--file=')) || '').split('=').slice(1).join('=');

const BATCH_SIZE = 500;

function parseLine(line, headers) {
  const cols = line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
  const row = {};
  headers.forEach((h, i) => { row[h] = cols[i] !== undefined ? cols[i] : ''; });
  return row;
}

function normalizarCnpj(raw) {
  return (raw || '').replace(/\D/g, '').padStart(14, '0').slice(0, 14);
}

function normalizarSituacaoAtivo(raw) {
  const s = (raw || '').trim().toUpperCase();
  if (s === 'SIM' || s === 'S' || s === '1' || s === 'ATIVO' || s === 'ATIVA') return 'Ativa';
  if (s === 'NAO' || s === 'NÃO' || s === 'N' || s === '0') return 'Inativa';
  // fallback: parse legacy situacao field
  if (s.includes('ATIV')) return 'Ativa';
  if (s.includes('CANCEL')) return 'Cancelada';
  if (s.includes('VENC') || s.includes('CADUÇ')) return 'Vencida';
  if (s.includes('SUSPENS')) return 'Suspensa';
  return raw.trim() || 'Desconhecida';
}

/**
 * Mapeia uma linha CSV para um objeto normalizado conforme o tipo de arquivo.
 */
function mapRow(row, tipo) {
  if (tipo === 'NACIONAL') {
    const cnpj = normalizarCnpj(row['NU_CNPJ']);
    if (!cnpj || cnpj === '00000000000000') return null;

    return {
      cnpj,
      razao_social:       (row['NO_RAZAO_SOCIAL'] || '').substring(0, 500),
      nome_fantasia:      (row['NO_FANTASIA'] || '').substring(0, 500),
      tipo_autorizacao:   'AFE',
      numero_autorizacao: (row['NU_AUTORIZACAO'] || row['NU_AUTORIZACAO_NOVO'] || '').substring(0, 50),
      situacao:           normalizarSituacaoAtivo(row['ATIVO']),
      data_concessao:     (row['DT_AUTORIZACAO'] || '').substring(0, 20),
      data_vencimento:    (row['DT_CANCELAMENTO'] || '').substring(0, 20),
      atividades:         (row['ATIVIDADES'] || row['CO_TIPO_ATIVIDADES'] || '').substring(0, 2000),
      municipio:          (row['CIDADE'] || '').substring(0, 200),
      uf:                 (row['UF'] || '').substring(0, 2),
    };
  }

  if (tipo === 'INTERNACIONAL') {
    // Internacional não tem CNPJ brasileiro — usa código seq como identificador
    const codigoSeq = (row['CO_SEQ_EMPRESA_INTERNACIONAL'] || '').trim();
    if (!codigoSeq) return null;

    return {
      cnpj:               codigoSeq.padStart(14, '0').slice(0, 14),
      razao_social:       (row['NO_RAZAO_SOCIAL'] || '').substring(0, 500),
      nome_fantasia:      '',
      tipo_autorizacao:   'AE',
      numero_autorizacao: (row['DS_CODIGO_GGINP'] || '').substring(0, 50),
      situacao:           normalizarSituacaoAtivo(row['ST_REGISTRO_ATIVO']),
      data_concessao:     '',
      data_vencimento:    '',
      atividades:         '',
      municipio:          '',
      uf:                 '',
    };
  }

  return null;
}

async function flush(pg, batch) {
  if (batch.length === 0) return;

  const cols = ['cnpj','razao_social','nome_fantasia','tipo_autorizacao','numero_autorizacao',
                 'situacao','data_concessao','data_vencimento','atividades','municipio','uf'];
  const placeholders = batch.map((_, i) => {
    const base = i * cols.length;
    return `(${cols.map((__, j) => `$${base + j + 1}`).join(',')})`;
  }).join(',');

  const values = batch.flatMap(r => [
    r.cnpj, r.razao_social, r.nome_fantasia, r.tipo_autorizacao,
    r.numero_autorizacao, r.situacao, r.data_concessao, r.data_vencimento,
    r.atividades, r.municipio, r.uf,
  ]);

  await pg.query(`
    INSERT INTO anvisa_afe (${cols.join(',')})
    VALUES ${placeholders}
    ON CONFLICT DO NOTHING
  `, values);
}

async function main() {
  const CSV_DIR = path.join(process.cwd(), 'Arquivos CSV');
  const defaultFile = tipoArg === 'NACIONAL'
    ? path.join(CSV_DIR, 'TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV')
    : path.join(CSV_DIR, 'TA_CONSULTA_FUNCIONAMENTO_EMPRESA_INTERNACIONAL.CSV');
  const resolvedFile = fileArg || defaultFile;

  if (!fs.existsSync(resolvedFile)) {
    console.error(`❌ Arquivo não encontrado: "${resolvedFile}"`);
    console.error(`Coloque o CSV na pasta "Arquivos CSV/" ou use --file=caminho`);
    process.exit(1);
  }

  const tipoLabel = tipoArg === 'NACIONAL' ? 'AFE' : 'AE';

  const pg = new Client(DB);
  await pg.connect();
  console.log('✅ Conectado ao Supabase');

  // Limpa registros do tipo que vai importar
  await pg.query(`DELETE FROM anvisa_afe WHERE tipo_autorizacao = $1`, [tipoLabel]);
  console.log(`🗑️  Registros ${tipoLabel} anteriores removidos`);

  console.log(`📂 Lendo arquivo: ${resolvedFile}`);
  const stream = fs.createReadStream(resolvedFile);
  const decoder = new StringDecoder('latin1');

  let headers = null;
  let buffer = '';
  let total = 0;
  let skipped = 0;
  let batch = [];

  await new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      buffer += decoder.write(chunk);
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '').trim();
        if (!line) continue;

        if (!headers) {
          headers = line.split(';').map(h => h.trim().replace(/^"|"$/g, '').toUpperCase());
          console.log(`📋 Colunas detectadas: ${headers.join(' | ')}`);
          continue;
        }

        const row = parseLine(line, headers);
        const mapped = mapRow(row, tipoArg);

        if (!mapped) { skipped++; continue; }

        batch.push(mapped);

        if (batch.length >= BATCH_SIZE) {
          stream.pause();
          const batchToFlush = batch;
          batch = [];
          flush(pg, batchToFlush)
            .then(() => {
              total += batchToFlush.length;
              process.stdout.write(`\r📥 ${total.toLocaleString()} importados, ${skipped.toLocaleString()} ignorados...`);
              stream.resume();
            })
            .catch(reject);
        }
      }
    });

    stream.on('end', async () => {
      try {
        await flush(pg, batch);
        total += batch.length;
        resolve(null);
      } catch (e) { reject(e); }
    });

    stream.on('error', reject);
  });

  console.log(`\n\n✅ Importação ${tipoArg} concluída: ${total.toLocaleString()} registros (${skipped.toLocaleString()} ignorados)`);

  const { rows } = await pg.query(
    `SELECT situacao, count(*) FROM anvisa_afe WHERE tipo_autorizacao = $1 GROUP BY situacao ORDER BY count DESC`,
    [tipoLabel]
  );
  console.log('\nDistribuição por situação:');
  rows.forEach(r => console.log(`  ${r.situacao}: ${Number(r.count).toLocaleString()}`));

  await pg.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
