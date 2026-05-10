import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/produtos?userId=xxx
 * Retorna os produtos do catálogo do usuário.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    const { data: produtos, error } = await supabaseAdmin
      .from('produtos_catalogo')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ produtos: produtos || [] });
  } catch (error: any) {
    console.error('[GET /api/produtos]', error);
    return NextResponse.json({ error: 'Erro ao buscar produtos', detail: error.message }, { status: 500 });
  }
}

/**
 * POST /api/produtos
 * Cria um ou mais produtos para um fornecedor.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cnpj_fornecedor, produtos, user_id } = body;

    if (!cnpj_fornecedor || !produtos || !Array.isArray(produtos) || !user_id) {
      return NextResponse.json({ error: 'Campos obrigatórios: cnpj_fornecedor, produtos (array), user_id' }, { status: 400 });
    }

    const cnpjLimpo = cnpj_fornecedor.replace(/\D/g, '');

    const buildPayload = (p: any) => ({
      cnpj_fornecedor: cnpj_fornecedor,
      nome_produto: (p.nome || 'Produto sem nome').substring(0, 255),
      registro_anvisa: (p.processo || '').toString().substring(0, 100) || null,
      categoria: (p.tipo || 'Geral').substring(0, 100),
      descricao: `${p.sub_categoria ? `[${p.sub_categoria}] ` : ''}${p.situacao || ''}`.substring(0, 1000),
      preco_referencia: p.preco || null,
      data_inicial_registro: (p.data_inicial || '').toString().substring(0, 20) || null,
      data_vencimento_registro: (p.data_validade || '').toString().substring(0, 20) || null,
      vencimento_limpo: (p.vencimento_limpo || '').toString().substring(0, 20) || null,
      seguro_compra: p.seguro_compra || false,
      user_id: user_id,
    });

    // 1 query para buscar todos os existentes de uma vez (elimina N SELECTs)
    const registros = produtos.filter(p => p.processo).map(p => p.processo.toString().substring(0, 100));
    const { data: existentes } = registros.length > 0
      ? await supabaseAdmin
          .from('produtos_catalogo')
          .select('id, registro_anvisa')
          .eq('cnpj_fornecedor', cnpjLimpo)
          .in('registro_anvisa', registros)
      : { data: [] };

    const existenteMap = new Map((existentes || []).map(e => [e.registro_anvisa, e.id]));

    const paraInserir: any[] = [];
    const paraAtualizar: { id: string; payload: any }[] = [];

    for (const p of produtos) {
      const payload = buildPayload(p);
      const regKey = payload.registro_anvisa;
      const idExistente = regKey ? existenteMap.get(regKey) : undefined;
      if (idExistente) {
        paraAtualizar.push({ id: idExistente, payload });
      } else {
        paraInserir.push(payload);
      }
    }

    let totalSalvos = 0;

    // INSERT em batch (1 query para todos os novos)
    if (paraInserir.length > 0) {
      const { error } = await supabaseAdmin.from('produtos_catalogo').insert(paraInserir);
      if (!error) totalSalvos += paraInserir.length;
    }

    // UPDATEs individuais (necessário pois cada registro tem id diferente),
    // mas agora sem os SELECTs por produto — só os updates necessários
    for (const { id, payload } of paraAtualizar) {
      const { error } = await supabaseAdmin.from('produtos_catalogo').update(payload).eq('id', id);
      if (!error) totalSalvos++;
    }

    return NextResponse.json({
      success: true,
      count: totalSalvos,
      message: `${totalSalvos} produtos adicionados com sucesso.`
    });

  } catch (error: any) {
    console.error('[POST /api/produtos]', error);
    return NextResponse.json({ error: 'Erro ao cadastrar produtos', detail: error.message }, { status: 500 });
  }
}
