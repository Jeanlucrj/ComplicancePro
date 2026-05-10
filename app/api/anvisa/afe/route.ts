import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/anvisa/afe?cnpj=xxx
 * Retorna as autorizações AFE e AE de uma empresa pelo CNPJ.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cnpj = (searchParams.get('cnpj') || '').replace(/\D/g, '');

  if (!cnpj || cnpj.length < 11) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('anvisa_afe')
      .select('*')
      .eq('cnpj', cnpj)
      .order('tipo_autorizacao', { ascending: true })
      .order('data_vencimento', { ascending: false });

    if (error) throw error;

    const autorizacoes = (data || []).map((d: any) => ({
      id:                 d.id,
      cnpj:               d.cnpj,
      razao_social:       d.razao_social,
      tipo_autorizacao:   d.tipo_autorizacao, // 'AFE' ou 'AE'
      numero_autorizacao: d.numero_autorizacao,
      situacao:           d.situacao,
      data_concessao:     d.data_concessao,
      data_vencimento:    d.data_vencimento,
      atividades:         d.atividades,
      municipio:          d.municipio,
      uf:                 d.uf,
    }));

    // Resumo por tipo
    const afe = autorizacoes.filter(a => a.tipo_autorizacao === 'AFE');
    const ae  = autorizacoes.filter(a => a.tipo_autorizacao === 'AE');

    const afeAtiva = afe.some(a => a.situacao === 'Ativa');
    const aeAtiva  = ae.some(a => a.situacao === 'Ativa');

    return NextResponse.json({
      autorizacoes,
      total: autorizacoes.length,
      resumo: {
        afe_ativa:     afeAtiva,
        ae_ativa:      aeAtiva,
        total_afe:     afe.length,
        total_ae:      ae.length,
        tem_restricao: afe.length > 0 && !afeAtiva,
      },
    });
  } catch (err: any) {
    console.error('[GET /api/anvisa/afe]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
