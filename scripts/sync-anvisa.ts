/**
 * Sincroniza CSVs da ANVISA com o Supabase.
 *
 * Uso:
 *   npx tsx scripts/sync-anvisa.ts --type=medicamento
 *   npx tsx scripts/sync-anvisa.ts --type=cosmetico
 *   npx tsx scripts/sync-anvisa.ts --type=medicamento --file=tmp/meu.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import * as iconv from 'iconv-lite';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INSERT_BATCH = 500;
const UPDATE_CONCURRENCY = 30;

// ─── Regras de negócio ────────────────────────────────────────────────────────

function calcularSeguroCompra(situacao: string, vencimento: string): boolean {
  const s = situacao.toUpperCase();
  if (s !== 'ATIVO' && s !== 'CONCEDIDO') return false;
  if (!vencimento) return true;
  const parts = vencimento.split(/[\/\s]/);
  if (parts.length >= 3) {
    const [d, m, y] = parts.map(Number);
    const data = new Date(y, m - 1, d);
    if (!isNaN(data.getTime()) && data < new Date()) return false;
  }
  return true;
}

// ─── Config por tipo ──────────────────────────────────────────────────────────

const DATASETS = {
  medicamento: {
    table: 'anvisa_medicamentos',
    csvFile: path.resolve(process.cwd(), 'Arquivos CSV/DADOS_ABERTOS_MEDICAMENTOS.csv'),
    uniqueKey: 'registro',
    mapRow: (r: Record<string, string>) => {
      const empresa = r['EMPRESA_DETENTORA_REGISTRO'] || '';
      const idx = empresa.indexOf(' - ');
      const cnpj = idx >= 0 ? empresa.slice(0, idx).trim() : empresa.replace(/\D/g, '').slice(0, 14);
      const razao_social = idx >= 0 ? empresa.slice(idx + 3).trim() : empresa;

      const vencRaw = (r['DATA_VENCIMENTO_REGISTRO'] || '').trim();
      let vencimento = vencRaw;
      // Formato "082029" → "01/08/2029"
      if (/^\d{6}$/.test(vencRaw)) {
        vencimento = `01/${vencRaw.slice(0, 2)}/${vencRaw.slice(2)}`;
      }

      const situacao = (r['SITUACAO_REGISTRO'] || '').trim();
      return {
        cnpj,
        razao_social: razao_social.slice(0, 255),
        nome_produto: (r['NOME_PRODUTO'] || '').slice(0, 255),
        processo: (r['NUMERO_PROCESSO'] || '').trim(),
        registro: (r['NUMERO_REGISTRO_PRODUTO'] || '').trim(),
        principio_ativo: (r['PRINCIPIO_ATIVO'] || '').slice(0, 500),
        vencimento,
        vencimento_limpo: vencimento || null,
        seguro_compra: calcularSeguroCompra(situacao, vencimento),
      };
    },
  },

  cosmetico: {
    table: 'anvisa_cosmeticos',
    csvFile: path.resolve(process.cwd(), 'Arquivos CSV/DADOS_ABERTOS_COSMETICO.csv'),
    uniqueKey: 'processo',
    mapRow: (r: Record<string, string>) => {
      const vencRaw = (r['DT_VENCIMENTO_REGISTRO'] || '').trim();
      // Formato "10/10/2026 00:00:00" (MM/DD/YYYY) → "DD/MM/YYYY"
      let vencimento = vencRaw;
      const mdy = vencRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (mdy) vencimento = `${mdy[2]}/${mdy[1]}/${mdy[3]}`;

      const situacao = (r['ST_SITUACAO_REGISTRO'] || '').trim();
      return {
        cnpj: (r['NU_CNPJ_EMPRESA'] || '').replace(/\D/g, ''),
        razao_social: (r['NO_RAZAO_SOCIAL_EMPRESA'] || '').slice(0, 255),
        nome_produto: (r['NO_PRODUTO'] || '').slice(0, 255),
        processo: (r['NU_PROCESSO'] || '').trim(),
        situacao,
        vencimento,
        vencimento_limpo: vencimento || null,
        seguro_compra: calcularSeguroCompra(situacao, vencimento),
      };
    },
  },
  irregulares: {
    table: 'anvisa_irregulares',
    csvFile: path.resolve(process.cwd(), 'Arquivos CSV/TA_CONSULTA_PRODUTOS_IRREGULARES_RESULTADO.CSV'),
    uniqueKey: 'seq_dossie',
    mapRow: (r: Record<string, string>) => ({
      seq_dossie:        (r['CO_SEQ_DOSSIE_INVESTIG_MED'] || '').trim(),
      nu_processo:       (r['NU_PROCESSO'] || '').trim(),
      cnpj_fabricante:   (r['NU_CNPJ'] || '').replace(/\D/g, ''),
      razao_social:      (r['NO_RAZAO_SOCIAL'] || '').slice(0, 255),
      tipo_produto:      (r['DS_TIPO_PRODUTO'] || '').trim(),
      nivel_risco:       (r['DS_RISCO_PRODUTO'] || '').trim(),
      empresa_investigada: (r['NO_EMPRESA_INVESTIGADA'] || '').slice(0, 255),
      cnpj_investigada:  (r['NU_CNPJ_EMPRESA_INVESTIGADA'] || '').replace(/\D/g, ''),
      dt_publicacao:     (r['DT_PUBLICACAO'] || '').trim() || null,
      produtos:          (r['PRODUTOS_CONCATENADOS'] || '').slice(0, 5000),
      acao:              (r['DS_ACAO_FISCALIZACAO'] || '').trim(),
      atividade:         (r['DS_ATIVIDADE_FISCALIZACAO'] || '').trim(),
      acao_atividade:    (r['ACAO_ATIVIDADE'] || '').slice(0, 1000),
      produto:           (r['PRODUTO'] || '').slice(0, 500),
      registro:          (r['REGISTRO'] || '').trim() || null,
    }),
  },

  afe: {
    table: 'anvisa_afe',
    csvFile: path.resolve(process.cwd(), 'Arquivos CSV/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV'),
    uniqueKey: 'numero_autorizacao',
    mapRow: (r: Record<string, string>) => ({
      cnpj:               (r['NU_CNPJ'] || '').replace(/\D/g, ''),
      razao_social:       (r['NO_RAZAO_SOCIAL'] || '').slice(0, 255),
      nome_fantasia:      (r['NO_FANTASIA'] || '').slice(0, 255) || null,
      tipo_autorizacao:   (r['TIPO_PRODUTO'] || '').trim(),
      numero_autorizacao: (r['NU_AUTORIZACAO_NOVO'] || r['NU_AUTORIZACAO'] || '').trim(),
      situacao:           (r['ATIVO'] || '').trim(),
      data_concessao:     (r['DT_AUTORIZACAO'] || '').trim() || null,
      data_vencimento:    (r['DT_CANCELAMENTO'] || '').trim() || null,
      atividades:         (r['ATIVIDADES'] || r['CO_TIPO_ATIVIDADES'] || '').slice(0, 2000),
      municipio:          (r['CIDADE'] || '').trim(),
      uf:                 (r['UF'] || '').trim(),
    }),
  },
} as const;

type Tipo = keyof typeof DATASETS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

import csv from 'csv-parser';
import { Readable } from 'stream';

async function lerCsv(filePath: string): Promise<Record<string, string>[]> {
  const buffer = fs.readFileSync(filePath);
  const content = iconv.decode(buffer, 'latin1');
  return new Promise((resolve, reject) => {
    const results: Record<string, string>[] = [];
    const stream = Readable.from(content);
    stream
      .pipe(csv({ separator: ';' }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function buscarTodosDoDb(table: string, campos: string): Promise<Record<string, unknown>[]> {
  const todos: Record<string, unknown>[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await sb.from(table).select(campos).range(from, from + step - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    todos.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < step) break;
    from += step;
  }
  return todos;
}

function rowsMudou(db: Record<string, unknown>, csv: Record<string, unknown>): boolean {
  for (const key of Object.keys(csv)) {
    const a = db[key] == null ? '' : String(db[key]);
    const b = csv[key] == null ? '' : String(csv[key]);
    if (a !== b) return true;
  }
  return false;
}

async function emLotes<T>(items: T[], fn: (item: T) => Promise<void>, concurrency: number) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}

// ─── Sync principal ───────────────────────────────────────────────────────────

async function sync(tipo: Tipo, fileOverride?: string) {
  const cfg = DATASETS[tipo];
  const uKey = cfg.uniqueKey;
  const filePath = fileOverride || cfg.csvFile;

  console.log(`\n=== Sync ${tipo} → ${cfg.table} ===`);

  const getKey = (cfg as any).getKey
    ? (cfg as any).getKey as (r: Record<string, unknown>) => string
    : (r: Record<string, unknown>) => String(r[uKey] ?? '');

  console.log('Lendo CSV...');
  const rawRows = await lerCsv(filePath);
  console.log(`  ${rawRows.length} linhas no CSV`);

  // Mapeia e desduplicar por chave (mantém o último registro de cada chave)
  const csvMapDedup = new Map<string, Record<string, unknown>>();
  for (const raw of rawRows) {
    const row = (cfg.mapRow as (r: Record<string, string>) => Record<string, unknown>)(raw);
    const k = getKey(row);
    if (k) csvMapDedup.set(k, row);
  }
  const csvRows = [...csvMapDedup.values()];

  // Busca TODOS os registros do banco de uma vez (paginado, colunas completas)
  console.log('Buscando registros existentes no Supabase...');
  const dbRows = await buscarTodosDoDb(cfg.table, '*');
  console.log(`  ${dbRows.length} registros no banco`);

  // Mapa: chave única → registro completo do banco
  const dbMap = new Map<string, Record<string, unknown>>();
  for (const row of dbRows) {
    const k = getKey(row);
    if (k) dbMap.set(k, row);
  }

  const novos: Record<string, unknown>[] = [];
  const aAtualizar: Array<{ id: string; dados: Record<string, unknown> }> = [];
  let semMudanca = 0;

  for (const row of csvRows) {
    const k = getKey(row);
    if (!k) continue;
    const dbRow = dbMap.get(k);
    if (!dbRow) {
      novos.push(row);
    } else if (rowsMudou(dbRow, row)) {
      aAtualizar.push({ id: String(dbRow['id']), dados: row });
    } else {
      semMudanca++;
    }
  }

  console.log(`\n  Novos:        ${novos.length}`);
  console.log(`  Atualizados:  ${aAtualizar.length}`);
  console.log(`  Sem mudança:  ${semMudanca}`);

  if (novos.length > 0) {
    console.log('\nInserindo novos...');
    let count = 0;
    for (let i = 0; i < novos.length; i += INSERT_BATCH) {
      const { error } = await sb.from(cfg.table).insert(novos.slice(i, i + INSERT_BATCH));
      if (error) throw new Error(`Insert: ${error.message}`);
      count += Math.min(INSERT_BATCH, novos.length - i);
      process.stdout.write(`\r  ${count}/${novos.length}`);
    }
    console.log(`\r  ${novos.length} novos inseridos.   `);
  }

  if (aAtualizar.length > 0) {
    console.log('\nAtualizando registros alterados...');
    let count = 0;
    await emLotes(aAtualizar, async ({ id, dados }) => {
      const { error } = await sb.from(cfg.table).update(dados).eq('id', id);
      if (error) throw new Error(`Update: ${error.message}`);
      count++;
      if (count % 100 === 0) process.stdout.write(`\r  ${count}/${aAtualizar.length}`);
    }, UPDATE_CONCURRENCY);
    console.log(`\r  ${aAtualizar.length} registros atualizados.   `);
  }

  console.log(`\nSync ${tipo} concluído!`);
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const tipo = (args.find(a => a.startsWith('--type='))?.split('=')[1] || '') as Tipo;
const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];

if (!tipo || !DATASETS[tipo]) {
  console.error('Uso: npx tsx scripts/sync-anvisa.ts --type=medicamento|cosmetico [--file=caminho.csv]');
  process.exit(1);
}

sync(tipo, fileArg).catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
