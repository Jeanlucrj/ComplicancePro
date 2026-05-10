import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load from .env and .env.local
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERRO: DATABASE_URL não encontrada no .env ou .env.local!");
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Conectado ao Supabase via Postgres Driver (PG)!");

    const sqlPath = path.join(process.cwd(), 'scripts', 'create-remaining-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executando DDL Migration...");
    await client.query(sql);

    console.log("Tabelas criadas com sucesso! Migração concluída.");
  } catch (err) {
    console.error("Falha ao rodar SQL:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
