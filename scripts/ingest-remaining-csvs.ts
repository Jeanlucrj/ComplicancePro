import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const CSV_DIR = path.join(process.cwd(), 'Arquivos CSV');

// ─── Parser léxico (tolerante a \n dentro de aspas) ──────────────────────────
function parseCSVContent(content: string, headers?: string[]): Array<Record<string, string>> {
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

  // Se não foi passado headers, a primeira linha é o cabeçalho
  const head = headers || records[0].map(h => h.replace(/"/g, '').trim().toLowerCase());
  const dataRows = headers ? records : records.slice(1);

  return dataRows.map(cols => {
    const obj: Record<string, string> = {};
    head.forEach((h, i) => {
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

// ─── Leitor de TAIL (últimas N linhas sem carregar arquivo inteiro) ───────────
function readLastLines(filePath: string, targetLines: number): string {
  const stats = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  const CHUNK = 5 * 1024 * 1024; // 5MB por vez
  let pos = stats.size;
  let collected = '';
  let lineCount = 0;

  while (pos > 0 && lineCount < targetLines + 2) {
    const readSize = Math.min(CHUNK, pos);
    pos -= readSize;
    const buf = Buffer.allocUnsafe(readSize);
    fs.readSync(fd, buf, 0, readSize, pos);
    const chunk = buf.toString('latin1');
    collected = chunk + collected;
    // contar newlines fora de aspas para decidir se já temos linhas suficientes
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

// ─── Insert simples em lotes (para tabelas sem chave única) ──────────────────
async function insertBatch(table: string, rows: any[]): Promise<{ok: number, err: number}> {
  const { error } = await supabase.from(table).insert(rows);
  if (!error) return { ok: rows.length, err: 0 };
  console.error(`  ✗ Erro insert: ${error.message}`);
  return { ok: 0, err: rows.length };
}

async function upsertBatch(table: string, rows: any[], conflictKey: string): Promise<{ok: number, err: number}> {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictKey });
  if (!error) return { ok: rows.length, err: 0 };
  console.error(`  ✗ Erro upsert: ${error.message}`);
  return { ok: 0, err: rows.length };
}

async function ingestFull(label: string, filePath: string, table: string, conflictKey: string | null, headers?: string[]) {
  console.log(`\n🔄 ${label}`);
  const content = fs.readFileSync(filePath, { encoding: 'latin1' });
  const rows = parseCSVContent(content, headers);
  console.log(`   Parsados: ${rows.length} registros`);

  // Se não tem chave única: truncate + insert simples
  if (!conflictKey) {
    console.log(`   Sem chave única — limpando tabela antes de inserir...`);
    await supabase.from(table).delete().gte('id', 0);
  }

  const BATCH = 300;
  let ok = 0, err = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    let r: {ok: number, err: number};
    if (conflictKey) {
      r = await upsertBatch(table, rows.slice(i, i + BATCH), conflictKey);
    } else {
      r = await insertBatch(table, rows.slice(i, i + BATCH));
    }
    ok += r.ok; err += r.err;
    process.stdout.write(`\r   Upserted: ${ok} | Erros: ${err}`);
  }
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  console.log(`\n   ✅ Banco validado: ${count} registros`);
}

async function ingestTail(label: string, filePath: string, table: string, conflictKey: string, tailLines: number, headers: string[]) {
  console.log(`\n🔄 ${label} (últimas ${tailLines.toLocaleString()} linhas do arquivo ${(fs.statSync(filePath).size/1024/1024/1024).toFixed(1)}GB)`);
  const raw = readLastLines(filePath, tailLines);
  const rows = parseCSVContent(raw, headers);
  // Pegar só os últimas tailLines rows (o tail pode trazer um pouco mais)
  const data = rows.slice(-tailLines);
  console.log(`   Parsados: ${data.length} registros mais recentes`);

  const BATCH = 300;
  let ok = 0, err = 0;
  for (let i = 0; i < data.length; i += BATCH) {
    const r = await upsertBatch(table, data.slice(i, i + BATCH), conflictKey);
    ok += r.ok; err += r.err;
    process.stdout.write(`\r   Upserted: ${ok} | Erros: ${err}`);
  }
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  console.log(`\n   ✅ Banco validado: ${count} registros`);
}

// ─── Colunas do arquivo sem cabeçalho ─────────────────────────────────────────
const SITUACAO_DOC_HEADERS = [
  'nu_processo', 'st_ativo', 'nu_cnpj', 'no_empresa', 'nu_servico',
  'ds_servico', 'co_documento', 'ds_complemento', 'nu_quantidade',
  'ds_situacao', 'dt_situacao', 'nu_seq', 'col_13', 'col_14', 'col_15',
  'nu_seq2', 'co_protocolo', 'nu_id', 'co_referencia', 'col_20', 'dt_atualizacao'
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   BeautyProcure — Atualização ANVISA (import:anvisa) ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const tasks = [
    {
      label: 'Catálogo de Cosméticos',
      file: `${CSV_DIR}/DADOS_ABERTOS_COSMETICO.csv`,
      table: 'anvisa_cosmeticos',
      conflict: 'nu_registro_produto',
      full: true,
    },
    {
      label: 'Catálogo de Medicamentos',
      file: `${CSV_DIR}/DADOS_ABERTOS_MEDICAMENTOS.csv`,
      table: 'anvisa_medicamentos',
      conflict: 'nu_registro_produto',
      full: true,
    },
    {
      label: 'Produtos Irregulares',
      file: `${CSV_DIR}/TA_CONSULTA_PRODUTOS_IRREGULARES_RESULTADO.CSV`,
      table: 'anvisa_produtos_irregulares',
      conflict: null,
      full: true,
    },
    {
      label: 'Empresas Internacionais',
      file: `${CSV_DIR}/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_INTERNACIONAL.CSV`,
      table: 'anvisa_funcionamento_internacional',
      conflict: 'co_seq_empresa_internacional',
      full: true,
    },
    {
      label: 'Empresas Nacionais',
      file: `${CSV_DIR}/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV`,
      table: 'anvisa_funcionamento_nacional',
      conflict: 'nu_autorizacao_novo',
      full: true,
    },
    {
      label: 'Parecer de Medicamentos (sem chave única → truncate+insert)',
      file: `${CSV_DIR}/TA_CONSULTA_PARECER_AVAL_MEDICAMENTOS.CSV`,
      table: 'anvisa_parecer_aval_medicamentos',
      conflict: null,  // sem UNIQUE constraint — usa truncate+insert
      full: true,
      noHeader: true,
    },
    {
      label: 'Situação Documentos Técnicos (5GB → últimas 10k linhas)',
      file: `${CSV_DIR}/TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV`,
      table: 'anvisa_situacao_documento_tecnico',
      conflict: 'co_documento',
      full: false,
      tailLines: 10000,
      noHeader: true,
    },
  ];

  for (const t of tasks) {
    if (!fs.existsSync(t.file)) {
      console.log(`\n⏭️  Pulando (não encontrado): ${t.file}`);
      continue;
    }

    try {
      if (t.full) {
        const headers = t.noHeader ? SITUACAO_DOC_HEADERS : undefined;
        await ingestFull(t.label, t.file, t.table, t.conflict, headers);
      } else {
        await ingestTail(t.label, t.file, t.table, t.conflict, t.tailLines!, SITUACAO_DOC_HEADERS);
      }
    } catch (e: any) {
      console.error(`\n  ✗ Erro em ${t.label}: ${e.message}`);
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   ✅ Atualização ANVISA completa!                    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
}

run().catch(e => { console.error(e); process.exit(1); });
