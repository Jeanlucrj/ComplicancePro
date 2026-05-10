import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cnpj = (searchParams.get('cnpj') || '').replace(/\D/g, '');

  if (!cnpj || cnpj.length < 11) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  try {
    const { data: result, count } = await supabaseAdmin
      .from('anvisa_risco')
      .select('*', { count: 'exact' })
      .eq('cnpj', cnpj)
      .limit(50);

    const pendencias = (result || []).map((d: any) => ({
      expediente: d.expediente,
      cnpj: d.cnpj,
      razao_social: d.razao_social,
      cod_processo: d.cod_processo,
      tipo_processo: d.tipo_processo,
      num_registro: d.num_registro,
      data_protocolo: d.data_protocolo,
      situacao: d.situacao,
      nivel_risco: d.nivel_risco,
      data_situacao: d.data_situacao,
      data_vencimento: d.data_vencimento,
    }));

    return NextResponse.json({ pendencias, total: count || 0 });
  } catch (err: any) {
    console.error('[GET /api/anvisa/risco]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
