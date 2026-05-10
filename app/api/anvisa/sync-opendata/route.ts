import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const URLS = {
  cosmetico: 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_COSMETICO.csv',
  medicamento: 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv',
};

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ';' && !inQuotes) { fields.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function processarRegras(situacao: string, vencimento: string) {
  const s = (situacao || '').toUpperCase();
  const hoje = new Date();
  let seguro_compra = s === 'ATIVO' || s === 'ATIVA';
  if (vencimento) {
    const parts = vencimento.split('/');
    if (parts.length === 3) {
      const dataVal = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(dataVal.getTime()) && dataVal < hoje) seguro_compra = false;
    }
  }
  return { seguro_compra, vencimento_limpo: vencimento || null };
}

function mapCosmetico(row: Record<string, string>) {
  const cnpj = (row['NU_CNPJ_EMPRESA'] || '').replace(/\D/g, '');
  if (!cnpj || cnpj.length < 11) return null;
  const situacao = (row['ST_SITUACAO_REGISTRO'] || '').trim();
  const vencRaw = (row['DT_VENCIMENTO_REGISTRO'] || '').trim();
  let vencimento = '';
  const mdyMatch = vencRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (mdyMatch) vencimento = `${mdyMatch[2]}/${mdyMatch[1]}/${mdyMatch[3]}`;
  const { seguro_compra, vencimento_limpo } = processarRegras(situacao, vencimento);
  return {
    cnpj,
    razao_social: (row['NO_RAZAO_SOCIAL_EMPRESA'] || '').substring(0, 255),
    nome_produto: (row['NO_PRODUTO'] || '').substring(0, 255),
    processo: (row['NU_PROCESSO'] || '').toString().trim(),
    registro: (row['NU_REGISTRO_PRODUTO'] || '').toString().trim(),
    situacao: situacao || 'DESCONHECIDA',
    vencimento,
    vencimento_limpo,
    seguro_compra,
  };
}

function mapMedicamento(row: Record<string, string>) {
  const empresaStr = (row['EMPRESA_DETENTORA_REGISTRO'] || '').toString();
  const cnpjMatch = empresaStr.match(/^(\d{14})/);
  const cnpj = cnpjMatch ? cnpjMatch[1] : empresaStr.replace(/\D/g, '').substring(0, 14);
  if (!cnpj || cnpj.length < 11) return null;
  const razao_social = empresaStr.includes(' - ')
    ? empresaStr.split(' - ').slice(1).join(' - ').trim()
    : empresaStr;
  const situacao = (row['SITUACAO_REGISTRO'] || '').trim();
  const vencRaw = (row['DATA_VENCIMENTO_REGISTRO'] || '').toString().trim();
  let vencimento = '';
  if (/^\d{6}$/.test(vencRaw)) {
    vencimento = `01/${vencRaw.substring(0, 2)}/${vencRaw.substring(2)}`;
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(vencRaw)) {
    vencimento = vencRaw;
  }
  const { seguro_compra, vencimento_limpo } = processarRegras(situacao, vencimento);
  return {
    cnpj,
    razao_social: razao_social.substring(0, 255),
    nome_produto: (row['NOME_PRODUTO'] || '').substring(0, 255),
    processo: (row['NUMERO_PROCESSO'] || '').toString().trim(),
    registro: (row['NUMERO_REGISTRO_PRODUTO'] || '').toString().trim(),
    situacao: situacao || 'DESCONHECIDA',
    vencimento,
    vencimento_limpo,
    seguro_compra,
  };
}

async function downloadCSV(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CompliancePro-SaaS/1.0 (dados-abertos-anvisa)' },
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));
  return parseCSV(text);
}

async function upsertLote(tableName: string, items: any[]): Promise<number> {
  const BATCH = 100;
  let criados = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const lote = items.slice(i, i + BATCH);
    const result = await supabaseAdmin.from(tableName).insert(lote);
    if (!result.error) criados += lote.length;
  }
  return criados;
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const cnpjsAtivos = new Set<string>();
    let page = 0;
    while (true) {
      const { data: docs } = await supabaseAdmin.from('fornecedores').select('cnpj').range(page * 1000, page * 1000 + 999);
      if (!docs || docs.length === 0) break;
      for (const doc of docs) {
        const c = (doc.cnpj || '').replace(/\D/g, '');
        if (c.length >= 11) cnpjsAtivos.add(c);
      }
      page++;
    }

    if (cnpjsAtivos.size === 0) {
      return NextResponse.json({ status: 'noop', motivo: 'Nenhum fornecedor cadastrado.' });
    }

    const resumo = { cosmetico: 0, medicamento: 0, erros: [] as string[] };

    // 2. Cosméticos
    try {
      const rows = await downloadCSV(URLS.cosmetico);
      const filtrados = rows.map(mapCosmetico).filter(r => r && cnpjsAtivos.has(r!.cnpj) && r!.processo) as any[];

      for (const cnpj of cnpjsAtivos) {
        try {
          await supabaseAdmin.from('anvisa_cosmeticos').delete().eq('cnpj', cnpj);
        } catch { /* ok */ }
      }

      resumo.cosmetico = await upsertLote('anvisa_cosmeticos', filtrados);
    } catch (e: any) {
      resumo.erros.push(`cosmeticos: ${e.message}`);
    }

    // 3. Medicamentos
    try {
      const rows = await downloadCSV(URLS.medicamento);
      const filtrados = rows.map(mapMedicamento).filter(r => r && cnpjsAtivos.has(r!.cnpj) && r!.processo) as any[];

      for (const cnpj of cnpjsAtivos) {
        try {
          await supabaseAdmin.from('anvisa_medicamentos').delete().eq('cnpj', cnpj);
        } catch { /* ok */ }
      }

      resumo.medicamento = await upsertLote('anvisa_medicamentos', filtrados);
    } catch (e: any) {
      resumo.erros.push(`medicamentos: ${e.message}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      status: resumo.erros.length === 0 ? 'success' : 'partial',
      cnpjs_monitorados: cnpjsAtivos.size,
      cosmeticos_sincronizados: resumo.cosmetico,
      medicamentos_sincronizados: resumo.medicamento,
      erros: resumo.erros,
      fontes: URLS,
      executado_em: new Date().toISOString(),
      duracao_segundos: parseFloat(elapsed),
    });

  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
