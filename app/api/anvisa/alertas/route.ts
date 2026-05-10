import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/anvisa/alertas?cnpjs=xxx,yyy&tipo=cosmetico|medicamento|ambos
 *
 * Cruza uma lista de CNPJs contra as tabelas anvisa_irregulares e anvisa_risco.
 * Retorna todos os registros encontrados para geração de alertas proativos.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cnpjsRaw = searchParams.get('cnpjs') || '';
  const tipo = searchParams.get('tipo') || 'ambos';

  const cnpjs = cnpjsRaw
    .split(',')
    .map((c) => c.replace(/\D/g, ''))
    .filter((c) => c.length === 14);

  if (cnpjs.length === 0) {
    return NextResponse.json({ irregulares: [], risco: [] });
  }

  try {
    // --- Irregulares: cruza por cnpj_investigada OU cnpj_fabricante ---
    let irregularesQuery = supabaseAdmin
      .from('anvisa_irregulares')
      .select('id, seq_dossie, tipo_produto, nivel_risco, empresa_investigada, cnpj_investigada, razao_social, cnpj_fabricante, produto, produtos, acao, dt_publicacao')
      .or(`cnpj_investigada.in.(${cnpjs.join(',')}),cnpj_fabricante.in.(${cnpjs.join(',')})`);

    if (tipo === 'cosmetico') {
      irregularesQuery = irregularesQuery.eq('tipo_produto', 'Cosmético');
    } else if (tipo === 'medicamento') {
      irregularesQuery = irregularesQuery.eq('tipo_produto', 'Medicamento');
    }

    // --- Risco: cruza por cnpj ---
    const riscoQuery = supabaseAdmin
      .from('anvisa_risco')
      .select('id, cnpj, razao_social, expediente, cod_processo, tipo_processo, num_registro, situacao, nivel_risco, data_protocolo, data_situacao')
      .in('cnpj', cnpjs);

    const [irregularesRes, riscoRes] = await Promise.all([irregularesQuery, riscoQuery]);

    if (irregularesRes.error) throw irregularesRes.error;
    if (riscoRes.error) throw riscoRes.error;

    return NextResponse.json({
      irregulares: irregularesRes.data || [],
      risco: riscoRes.data || [],
    });
  } catch (err: any) {
    console.error('[GET /api/anvisa/alertas]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
