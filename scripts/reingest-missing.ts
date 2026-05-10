import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BATCH_SIZE = 300;

function parseCSV(content: string): Array<Record<string, string>> {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ';' && !inQuotes) {
      row.push(cell.trim()); cell = '';
    } else if (c === '\n' && !inQuotes) {
      row.push(cell.trim());
      if (row.some(x => x !== '')) records.push(row);
      row = []; cell = '';
    } else if (c === '\r') {
      // ignora
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell.trim()); if (row.some(x => x !== '')) records.push(row); }

  const headers = records[0].map(h => h.replace(/"/g, '').trim().toLowerCase());
  return records.slice(1).map(cols => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      let v = cols[i] || '';
      if (v && v.includes('/') && h.startsWith('dt_')) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) v = d.toISOString();
      }
      obj[h] = v;
    });
    return obj;
  });
}

async function insertBatch(table: string, rows: any[], attempt = 1): Promise<number> {
  const { error } = await supabase.from(table).insert(rows);
  if (!error) return rows.length;
  if (attempt < 3) {
    console.error(`  Retentando lote (tentativa ${attempt}): ${error.message}`);
    await new Promise(r => setTimeout(r, 1000 * attempt));
    return insertBatch(table, rows, attempt + 1);
  }
  console.error(`  ✗ Lote descartado: ${error.message}`);
  return 0;
}

async function reingestTable(filePath: string, tableName: string, conflictKey: string) {
  console.log(`\n--- Reinjetando: ${tableName} ---`);

  console.log(`  Lendo arquivo...`);
  const content = fs.readFileSync(filePath, { encoding: 'latin1' });
  console.log(`  Arquivo: ${(content.length / 1024 / 1024).toFixed(1)} MB`);

  console.log(`  Parseando CSV...`);
  const rows = parseCSV(content);
  console.log(`  Registros parsados: ${rows.length}`);

  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // Upsert com a chave única real da tabela
    const { error } = await supabase.from(tableName).upsert(batch, { onConflict: conflictKey, ignoreDuplicates: false });
    if (!error) {
      inserted += batch.length;
    } else {
      // fallback: tentar insert ignorando duplicatas individualmente
      for (const row of batch) {
        const { error: e2 } = await supabase.from(tableName).upsert([row], { onConflict: conflictKey, ignoreDuplicates: true });
        if (!e2) inserted++;
        else errors++;
      }
    }
    process.stdout.write(`\r  Processados: ${inserted + errors} | Inseridos/Atualizados: ${inserted} | Erros: ${errors}`);
  }

  const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
  console.log(`\n  ✓ Validado no banco: ${count} registros (de ${rows.length} no CSV)`);
  return inserted;
}

async function run() {
  const CSV_DIR = path.join(process.cwd(), 'Arquivos CSV');

  const tasks = [
    { 
      file: `${CSV_DIR}/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_INTERNACIONAL.CSV`,
      table: 'anvisa_funcionamento_internacional',
      conflictKey: 'co_seq_empresa_internacional'
    }
  ];

  for (const t of tasks) {
    if (!fs.existsSync(t.file)) { console.error('Arquivo não encontrado:', t.file); continue; }
    await reingestTable(t.file, t.table, t.conflictKey);
  }

  console.log('\n=== Ingestão concluída! ===');
}

run().catch(e => { console.error(e); process.exit(1); });
