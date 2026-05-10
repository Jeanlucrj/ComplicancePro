/**
 * scripts/enrich-irregulares-cnpj.js
 *
 * Para cada registro em anvisa_irregulares onde empresa_investigada está vazia/DESCONHECIDA,
 * consulta a BrasilAPI com cnpj_investigada (ou cnpj_fabricante como fallback)
 * e atualiza empresa_investigada + cnpj_investigada.
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const https = require('https');

const DB = {
  host: 'db.agcdyfnxwxlwwakvusov.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: 'Mf@06296009', ssl: { rejectUnauthorized: false },
};

function isValidCnpj(cnpj) {
  if (!cnpj) return false;
  const c = cnpj.replace(/\D/g,'');
  return c.length === 14 && c !== '00000000000000';
}

function brasilApi(cnpj) {
  return new Promise((resolve) => {
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'BeautyProcure/1.0' },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) resolve(JSON.parse(data));
          else resolve(null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const pg = new Client(DB);
  await pg.connect();
  console.log('✅ Conectado ao Supabase');

  // Busca registros sem razão social com CNPJ válido
  const { rows } = await pg.query(`
    SELECT id, cnpj_investigada, cnpj_fabricante, empresa_investigada
    FROM anvisa_irregulares
    WHERE (empresa_investigada IS NULL OR empresa_investigada = '' OR empresa_investigada ILIKE 'DESCONHECIDA')
    ORDER BY id
  `);

  // Resolve qual CNPJ usar por registro
  const toEnrich = rows
    .map(r => ({
      id: r.id,
      cnpj: isValidCnpj(r.cnpj_investigada) ? r.cnpj_investigada
          : isValidCnpj(r.cnpj_fabricante)  ? r.cnpj_fabricante
          : null,
    }))
    .filter(r => r.cnpj);

  // Deduplica por CNPJ — consulta uma vez, aplica em todos os registros com mesmo CNPJ
  const cnpjMap = new Map();
  for (const r of toEnrich) {
    if (!cnpjMap.has(r.cnpj)) cnpjMap.set(r.cnpj, []);
    cnpjMap.get(r.cnpj).push(r.id);
  }

  console.log(`📋 ${rows.length} registros sem razão social`);
  console.log(`🔍 ${cnpjMap.size} CNPJs únicos para consultar na Receita Federal`);

  let ok = 0, nf = 0, erros = 0;
  let i = 0;

  for (const [cnpj, ids] of cnpjMap) {
    i++;
    process.stdout.write(`\r[${i}/${cnpjMap.size}] Consultando ${cnpj}...          `);

    const data = await brasilApi(cnpj);

    if (data?.razao_social) {
      const razao = data.razao_social.substring(0, 255);
      await pg.query(
        `UPDATE anvisa_irregulares
         SET empresa_investigada = $1,
             cnpj_investigada    = $2
         WHERE id = ANY($3)`,
        [razao, cnpj, ids]
      );
      ok += ids.length;
    } else {
      nf += ids.length;
    }

    // Respeita rate limit da BrasilAPI (~2 req/s)
    await sleep(600);
  }

  console.log(`\n\n✅ Concluído`);
  console.log(`   Atualizados: ${ok}`);
  console.log(`   Não encontrados: ${nf}`);
  console.log(`   Erros: ${erros}`);

  await pg.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
