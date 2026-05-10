import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import * as iconv from 'iconv-lite';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CSV_PATH = path.resolve(__dirname, '../Arquivos CSV/DADOS_ABERTOS_MEDICAMENTOS.csv');
const BATCH_SIZE = 500;

// "28614626000107 - LABORATORIO DE EXTRATOS ALERGENICOS LTDA"
function parseEmpresa(empresa: string): { cnpj: string; razao_social: string } {
  if (!empresa) return { cnpj: '', razao_social: '' };
  const idx = empresa.indexOf(' - ');
  if (idx === -1) return { cnpj: '', razao_social: empresa.trim() };
  return {
    cnpj: empresa.slice(0, idx).trim(),
    razao_social: empresa.slice(idx + 3).trim(),
  };
}

function limparVencimento(v: string): string | null {
  if (!v) return null;
  // formato MM/YYYY ou MMYYYY
  const m = v.replace(/\D/g, '');
  if (m.length === 6) return `20${m.slice(2)}-${m.slice(0, 2)}-01`;
  return null;
}

async function inserirBatch(rows: Record<string, string>[]) {
  const records = rows.map((r) => {
    const { cnpj, razao_social } = parseEmpresa(r['EMPRESA_DETENTORA_REGISTRO'] || '');
    return {
      cnpj,
      razao_social,
      nome_produto:   r['NOME_PRODUTO']            || null,
      processo:       r['NUMERO_PROCESSO']          || null,
      registro:       r['NUMERO_REGISTRO_PRODUTO']  || null,
      principio_ativo: r['PRINCIPIO_ATIVO']         || null,
      vencimento:     r['DATA_VENCIMENTO_REGISTRO'] || null,
      vencimento_limpo: limparVencimento(r['DATA_VENCIMENTO_REGISTRO'] || ''),
      seguro_compra:  (r['SITUACAO_REGISTRO'] || '').toLowerCase() === 'ativo',
    };
  });

  const { error } = await supabase
    .from('anvisa_medicamentos')
    .insert(records);

  if (error) throw new Error(error.message);
}

async function main() {
  console.log('Iniciando importação de medicamentos...');

  const buffer = fs.readFileSync(CSV_PATH);
  const content = iconv.decode(buffer, 'latin1');

  const rows: Record<string, string>[] = await new Promise((resolve, reject) => {
    const results: Record<string, string>[] = [];
    const parser = parse(content, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      trim: true,
      quote: '"',
      relax_quotes: true,
      relax_column_count: true,
    });
    parser.on('readable', () => {
      let row;
      while ((row = parser.read()) !== null) results.push(row);
    });
    parser.on('error', reject);
    parser.on('end', () => resolve(results));
  });

  console.log(`Total de registros lidos: ${rows.length}`);

  let inseridos = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await inserirBatch(batch);
    inseridos += batch.length;
    process.stdout.write(`\r  Progresso: ${inseridos}/${rows.length}`);
  }

  console.log(`\nImportação concluída! ${inseridos} registros processados.`);
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
