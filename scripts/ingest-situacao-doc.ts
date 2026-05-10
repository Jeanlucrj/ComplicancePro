import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const HEADERS = [
  'nu_processo', 'st_ativo', 'nu_cnpj', 'no_empresa', 'nu_servico',
  'ds_servico', 'co_documento', 'ds_complemento', 'nu_quantidade',
  'ds_situacao', 'dt_situacao', 'nu_seq', 'col_13', 'col_14', 'col_15',
  'nu_seq2', 'co_protocolo', 'nu_id', 'co_referencia', 'col_20', 'dt_atualizacao'
];

function parseCSVContent(content: string, headers: string[]): Array<Record<string, string>> {
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
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    if (row.some(x => x !== '')) records.push(row);
  }

  return records.map(cols => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      let v = (cols[i] || '').replace(/"/g, '').trim();
      if (v && v.includes('/') && h.startsWith('dt_')) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) v = d.toISOString();
      }
      obj[h] = v;
    });
    return obj;
  });
}

function readLastLines(filePath: string, targetLines: number): string {
  const stats = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  let pos = stats.size;
  let collected = '';
  let lineCount = 0;

  while (pos > 0 && lineCount < targetLines + 2) {
    const readSize = Math.min(CHUNK_SIZE, pos);
    pos -= readSize;
    const buf = Buffer.allocUnsafe(readSize);
    fs.readSync(fd, buf, 0, readSize, pos);
    const chunk = buf.toString('latin1');
    collected = chunk + collected;

    let inQ = false;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === '"') inQ = !inQ;
      else if (chunk[i] === '\n' && !inQ) lineCount++;
    }
    if (lineCount >= targetLines + 2) break;
  }
  fs.closeSync(fd);
  return collected;
}

async function run() {
  const filePath = 'c:/Users/User/.gemini/antigravity/scratch/BeautyProcure/Arquivos CSV/TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV';
  console.log('Lendo últimas 10.000 linhas do arquivo 5GB...');
  const raw = readLastLines(filePath, 10000);
  const rows = parseCSVContent(raw, HEADERS);
  const data = rows.slice(-10000);
  console.log('Parsados:', data.length, 'registros');
  console.log('Mais recente dt_atualizacao:', data[data.length - 1]?.dt_atualizacao);
  console.log('Mais antigo dt_atualizacao:', data[0]?.dt_atualizacao);

  let ok = 0, err = 0;
  for (let i = 0; i < data.length; i += 300) {
    const batch = data.slice(i, i + 300);
    const { error } = await supabase
      .from('anvisa_situacao_documento_tecnico')
      .upsert(batch, { onConflict: 'co_documento', ignoreDuplicates: true });
    if (!error) ok += batch.length;
    else { console.error('\nErro:', error.message); err += batch.length; }
    process.stdout.write('\rProcessados: ' + (i + batch.length));
  }

  const { count } = await supabase
    .from('anvisa_situacao_documento_tecnico')
    .select('*', { count: 'exact', head: true });
  console.log('\nBanco validado:', count, 'registros | Erros:', err);
}
run().catch(e => { console.error(e); process.exit(1); });
