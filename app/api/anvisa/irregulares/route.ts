import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tipo   = searchParams.get('tipo');   // 'cosmetico' | 'medicamento' | 'ambos'
  const limit  = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';

  try {
    let query = supabaseAdmin
      .from('anvisa_irregulares')
      .select('*', { count: 'exact' });

    // Filtro por tipo conforme cadastro do usuário
    if (tipo === 'cosmetico') {
      query = query.eq('tipo_produto', 'Cosmético');
    } else if (tipo === 'medicamento') {
      query = query.eq('tipo_produto', 'Medicamento');
    } else {
      // ambos: só cosméticos e medicamentos (já é o que a tabela tem)
      query = query.in('tipo_produto', ['Cosmético', 'Medicamento']);
    }

    if (search) {
      query = query.or(
        `produto.ilike.%${search}%,empresa_investigada.ilike.%${search}%,produtos.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query
      .order('dt_publicacao', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Data mais recente respeitando o mesmo filtro de tipo
    let ultimaQuery = supabaseAdmin
      .from('anvisa_irregulares')
      .select('dt_publicacao')
      .not('dt_publicacao', 'is', null);
    if (tipo === 'cosmetico') {
      ultimaQuery = ultimaQuery.eq('tipo_produto', 'Cosmético');
    } else if (tipo === 'medicamento') {
      ultimaQuery = ultimaQuery.eq('tipo_produto', 'Medicamento');
    }
    const { data: ultimaData } = await ultimaQuery
      .order('dt_publicacao', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    // Como a tabela anvisa_irregulares já tem os nomes de colunas corretos,
    // não precisamos mapear de co_seq_dossie_investig_med para seq_dossie.
    const mappedIrregulares = data || [];

    return NextResponse.json({
      irregulares: mappedIrregulares,
      total: count || 0,
      ultima_atualizacao: ultimaData?.dt_publicacao || null,
    });
  } catch (err: any) {
    console.error('[GET /api/anvisa/irregulares]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
