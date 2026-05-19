import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ── Mesma lógica de detecção de setor do /api/enriquecer ─────────────────────

const CNAE_COSMETICO   = ['2063', '4772', '4646', '2061', '2062', '9602'];
const CNAE_MEDICAMENTO = ['2121', '2122', '2123', '2124', '4644', '4771', '4773', '8630', '8650'];

// CNAEs claramente fora do setor saúde/beleza — excluídos para usuários com setor específico
const CNAE_OUTRO = [
  // Transporte e logística
  '4911', '4912', '4921', '4922', '4923', '4924', '4929',
  '4930', '4940', '4950', '5091', '5099', '5111', '5112',
  '5210', '5211', '5212',
  // Construção civil
  '4110', '4120', '4211', '4212', '4213', '4221', '4222', '4223',
  // Agricultura e pecuária
  '0111', '0112', '0113', '0114', '0115', '0116', '0119', '0121', '0122',
  // Segurança e vigilância
  '8011', '8012', '8020', '8030',
  // Educação
  '8511', '8512', '8513', '8521', '8531', '8532',
  // Serviços financeiros
  '6410', '6421', '6422', '6423', '6424', '6431', '6432',
];

function detectarSetor(codigo: string, descricao: string): 'cosmetico' | 'medicamento' | 'outro' | null {
  const prefix = codigo.replace(/\D/g, '').substring(0, 4);
  if (CNAE_COSMETICO.includes(prefix))   return 'cosmetico';
  if (CNAE_MEDICAMENTO.includes(prefix)) return 'medicamento';
  if (CNAE_OUTRO.includes(prefix))       return 'outro';

  const d = (descricao || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (d.includes('cosmet') || d.includes('perfum') || d.includes('higiene pessoal') || d.includes('beleza') || d.includes('estetica')) return 'cosmetico';
  if (d.includes('medicament') || d.includes('farmace') || d.includes('farmacia') || d.includes('drogaria') || d.includes('droga') || d.includes('hospital')) return 'medicamento';
  if (d.includes('transport') || d.includes('logistic') || d.includes('carga') || d.includes('frete') || d.includes('constru') || d.includes('agricul')) return 'outro';

  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export interface CnaeInfo {
  cnae_codigo: string;
  cnae_descricao: string;
  setor: 'cosmetico' | 'medicamento' | 'outro' | null;
}

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get('cnpjs') || '';
  const cnpjs = [...new Set(
    param.split(',').map(c => c.replace(/\D/g, '')).filter(c => c.length === 14)
  )];

  if (cnpjs.length === 0) return NextResponse.json({});

  const result: Record<string, CnaeInfo> = {};

  // 1. Busca no cache local
  const { data: cached } = await supabaseAdmin
    .from('cnpj_cnae_cache')
    .select('cnpj, cnae_codigo, cnae_descricao, setor')
    .in('cnpj', cnpjs);

  const emCache = new Set<string>();
  for (const row of cached || []) {
    result[row.cnpj] = { cnae_codigo: row.cnae_codigo, cnae_descricao: row.cnae_descricao, setor: row.setor };
    emCache.add(row.cnpj);
  }

  // 2. Para os ausentes, consulta BrasilAPI em paralelo
  const ausentes = cnpjs.filter(c => !emCache.has(c));

  await Promise.allSettled(
    ausentes.map(async (cnpj) => {
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
          headers: { 'User-Agent': 'DataControl/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;

        const data = await res.json();
        const cnae_codigo    = String(data.cnae_fiscal || '');
        const cnae_descricao = String(data.cnae_fiscal_descricao || '');
        const setor          = detectarSetor(cnae_codigo, cnae_descricao);

        result[cnpj] = { cnae_codigo, cnae_descricao, setor };

        // Salva no cache (30 dias)
        await supabaseAdmin.from('cnpj_cnae_cache').upsert(
          { cnpj, cnae_codigo, cnae_descricao, setor, cached_at: new Date().toISOString() },
          { onConflict: 'cnpj' }
        );
      } catch {
        // timeout ou CNPJ inválido — ignora silenciosamente
      }
    })
  );

  return NextResponse.json(result);
}
