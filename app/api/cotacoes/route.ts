import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/cotacoes?cnpj=XXXX
 * Lista cotações de um fornecedor específico
 */
export async function GET(request: NextRequest) {
  try {
    const cnpj = request.nextUrl.searchParams.get('cnpj');
    const userId = request.nextUrl.searchParams.get('userId');

    if (!cnpj || !userId) {
      return NextResponse.json({ error: 'CNPJ e userId são obrigatórios' }, { status: 400 });
    }

    const { data: cotacoes, count, error } = await supabaseAdmin
      .from('cotacoes')
      .select('*', { count: 'exact' })
      .eq('cnpj_fornecedor', cnpj)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw error;

    return NextResponse.json({ cotacoes, total: count || 0 });
  } catch (error: any) {
    console.error('[GET /api/cotacoes]', error);
    return NextResponse.json({ error: 'Erro ao listar cotações', detail: error.message }, { status: 500 });
  }
}

/**
 * POST /api/cotacoes
 * Body: { cnpj_fornecedor, user_id, produtos: [{id, nome}], observacoes? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cnpj_fornecedor, user_id, produtos, observacoes } = body;

    if (!cnpj_fornecedor || !produtos || !user_id) {
      return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 });
    }

    const { data: doc, error } = await supabaseAdmin
      .from('cotacoes')
      .insert({
        cnpj_fornecedor,
        user_id,
        produtos_json: JSON.stringify(produtos),
        status: 'enviada',
        observacoes: observacoes || '',
      })
      .select()
      .single();
      
    if (error) throw error;

    return NextResponse.json({ cotacao: doc }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/cotacoes]', error);
    return NextResponse.json({ error: 'Erro ao criar cotação', detail: error.message }, { status: 500 });
  }
}
