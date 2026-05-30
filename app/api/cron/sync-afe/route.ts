import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CSV_URL = 'https://dados.anvisa.gov.br/dados/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV';

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

function mapRow(header: string[], values: string[]): Record<string, string> {
  const row: Record<string, string> = {};
  header.forEach((h, i) => { row[h] = values[i] ?? ''; });
  return row;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();

  try {
    // 1. Download CSV da ANVISA
    const res = await fetch(CSV_URL, {
      headers: { 'User-Agent': 'DataControl-SaaS/1.0 (dados-abertos-anvisa)' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    const text = new TextDecoder('latin1').decode(new Uint8Array(buffer));
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV vazio ou inválido');

    const header = parseCSVLine(lines[0]);
    const idxCnpj      = header.indexOf('NU_CNPJ');
    const idxRazao     = header.indexOf('NO_RAZAO_SOCIAL');
    const idxFantasia  = header.indexOf('NO_FANTASIA');
    const idxTipo      = header.indexOf('TIPO_PRODUTO');
    const idxNumNovo   = header.indexOf('NU_AUTORIZACAO_NOVO');
    const idxNum       = header.indexOf('NU_AUTORIZACAO');
    const idxAtivo     = header.indexOf('ATIVO');
    const idxDtConc    = header.indexOf('DT_AUTORIZACAO');
    const idxDtCanc    = header.indexOf('DT_CANCELAMENTO');
    const idxAtividades = header.indexOf('ATIVIDADES');
    const idxCidade    = header.indexOf('CIDADE');
    const idxUf        = header.indexOf('UF');

    // 2. Limpa e re-insere tudo em lotes
    await supabaseAdmin.from('anvisa_afe').delete().neq('id', 0);

    const BATCH = 500;
    let inseridos = 0;
    let erros = 0;
    const lote: any[] = [];

    const flush = async () => {
      if (lote.length === 0) return;
      const { error } = await supabaseAdmin.from('anvisa_afe').insert([...lote]);
      if (error) erros += lote.length;
      else inseridos += lote.length;
      lote.length = 0;
    };

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 3) continue;
      const r = mapRow(header, values);

      const cnpj = (r[header[idxCnpj]] || '').replace(/\D/g, '');
      if (!cnpj || cnpj.length < 11) continue;

      lote.push({
        cnpj,
        razao_social:       (r[header[idxRazao]]    || '').substring(0, 500),
        nome_fantasia:      (r[header[idxFantasia]]  || '').substring(0, 500) || null,
        tipo_autorizacao:   (r[header[idxTipo]]      || '').trim().substring(0, 200),
        numero_autorizacao: (r[header[idxNumNovo]]   || r[header[idxNum]] || '').trim().substring(0, 50),
        situacao:           (r[header[idxAtivo]]     || '').trim().substring(0, 10),
        data_concessao:     (r[header[idxDtConc]]    || '').trim().substring(0, 50) || null,
        data_vencimento:    (r[header[idxDtCanc]]    || '').trim().substring(0, 50) || null,
        atividades:         (r[header[idxAtividades]]|| '').substring(0, 2000) || null,
        municipio:          (r[header[idxCidade]]    || '').substring(0, 200) || null,
        uf:                 (r[header[idxUf]]        || '').trim().substring(0, 10) || null,
      });

      if (lote.length >= BATCH) await flush();
    }
    await flush();

    const duracao = ((Date.now() - start) / 1000).toFixed(1);

    return NextResponse.json({
      status: erros === 0 ? 'success' : 'partial',
      inseridos,
      erros,
      duracao_segundos: parseFloat(duracao),
      executado_em: new Date().toISOString(),
    });

  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
