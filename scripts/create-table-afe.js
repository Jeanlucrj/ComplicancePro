/**
 * scripts/create-table-afe.js
 * Cria a tabela anvisa_afe no Supabase via conexão direta pg.
 * Uso: node scripts/create-table-afe.js
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DB = {
  host: 'db.agcdyfnxwxlwwakvusov.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: 'Mf@06296009', ssl: { rejectUnauthorized: false },
};

async function main() {
  const pg = new Client(DB);
  await pg.connect();
  console.log('✅ Conectado ao Supabase');

  await pg.query(`
    CREATE TABLE IF NOT EXISTS anvisa_afe (
      id                  SERIAL PRIMARY KEY,
      cnpj                VARCHAR(14)  NOT NULL,
      razao_social        VARCHAR(500),
      nome_fantasia       VARCHAR(500),
      tipo_autorizacao    VARCHAR(10),   -- 'AFE' ou 'AE'
      numero_autorizacao  VARCHAR(50),
      situacao            VARCHAR(100),  -- 'Ativa', 'Cancelada', 'Vencida', etc.
      data_concessao      VARCHAR(20),
      data_vencimento     VARCHAR(20),
      atividades          TEXT,          -- atividades autorizadas separadas por ';'
      municipio           VARCHAR(200),
      uf                  VARCHAR(2),
      created_at          TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Tabela anvisa_afe criada');

  await pg.query(`CREATE INDEX IF NOT EXISTS idx_anvisa_afe_cnpj ON anvisa_afe(cnpj);`);
  await pg.query(`CREATE INDEX IF NOT EXISTS idx_anvisa_afe_situacao ON anvisa_afe(situacao);`);
  console.log('✅ Índices criados');

  await pg.end();
  console.log('✅ Concluído');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
