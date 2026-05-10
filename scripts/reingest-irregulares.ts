import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BATCH_SIZE = 200;

// Parser léxico CSV (tolerante a newlines dentro de campos com aspas)
function parseCSV(content: string): Array<Record<string, string>> {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ';' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((c === '\n' || (c === '\r' && next === '\n')) && !inQuotes) {
      if (c === '\r') i++; // pula o \n
      row.push(cell.trim());
      if (row.some(x => x !== '')) records.push(row);
      row = [];
      cell = '';
    } else if (c === '\r') {
      // ignora \r sozinho
    } else {
      cell += c;
    }
  }
  // última linha sem newline
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    if (row.some(x => x !== '')) records.push(row);
  }

  if (records.length === 0) return [];

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

async function insertBatch(rows: any[], attempt = 1): Promise<number> {
  const { error } = await supabase.from('anvisa_produtos_irregulares').insert(rows);
  if (!error) return rows.length;
  if (attempt < 3) {
    console.error(`  ! Erro lote (tentativa ${attempt}): ${error.message}. Retentando...`);
    await new Promise(r => setTimeout(r, 1000 * attempt));
    return insertBatch(rows, attempt + 1);
  }
  console.error(`  ✗ Lote descartado após 3 tentativas: ${error.message}`);
  return 0;
}

async function run() {
  console.log('Deletando base anterior...');
  const { error: delErr } = await supabase.from('anvisa_produtos_irregulares').delete().neq('id', 0);
  if (delErr) { console.error('Erro ao deletar:', delErr.message); process.exit(1); }
  console.log('Deletado com sucesso.\n');

  const filePath = path.join(process.cwd(), 'Arquivos CSV', 'TA_CONSULTA_PRODUTOS_IRREGULARES_RESULTADO.CSV');
  console.log('Lendo arquivo CSV completo em memória...');
  const content = fs.readFileSync(filePath, { encoding: 'latin1' });
  console.log(`Arquivo lido: ${(content.length / 1024 / 1024).toFixed(1)} MB`);

  console.log('Parseando CSV (parser léxico)...');
  const rows = parseCSV(content);
  console.log(`Total de registros parsados: ${rows.length}`);

  // Contar por categoria
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.ds_tipo_produto] = (counts[r.ds_tipo_produto] || 0) + 1;
  console.log('Categorias encontradas:', counts);

  console.log('\nIniciando inserção em lotes...');
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const ok = await insertBatch(batch);
    inserted += ok;
    errors += batch.length - ok;
    process.stdout.write(`\r  Inseridos: ${inserted} | Erros: ${errors} | Total: ${rows.length}`);
  }

  console.log(`\n\nCarga finalizada!`);
  console.log(`  ✓ Inseridos com sucesso: ${inserted}`);
  console.log(`  ✗ Com erro: ${errors}`);

  // Validação final
  const { count } = await supabase.from('anvisa_produtos_irregulares').select('*', { count: 'exact', head: true });
  console.log(`  ✓ Total no banco (validado): ${count}`);
}

run().catch(e => { console.error(e); process.exit(1); });
