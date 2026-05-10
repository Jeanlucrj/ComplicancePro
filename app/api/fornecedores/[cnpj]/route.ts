import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fornecedores/[cnpj]
 * Retorna fornecedor + produtos + cotações
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { cnpj: string } }
) {
  try {
    const cnpj = params.cnpj;
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Usuário não identificado. Faça login novamente.' }, { status: 401 });
    }

    if (!cnpj) {
      return NextResponse.json({ error: 'CNPJ não fornecido' }, { status: 400 });
    }

    // Busca fornecedor
    const { data: fornecedorRes } = await supabaseAdmin
      .from('fornecedores')
      .select('*')
      .eq('cnpj', cnpj)
      .eq('user_id', userId)
      .limit(1);

    const fornecedor = fornecedorRes && fornecedorRes[0];
    if (!fornecedor) {
      return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
    }

    let produtosLocais: any[] = [];
    try {
      const { data: produtosRes } = await supabaseAdmin
        .from('produtos_catalogo')
        .select('*')
        .eq('cnpj_fornecedor', cnpj)
        .eq('user_id', userId)
        .limit(100);
      if (produtosRes) produtosLocais = produtosRes;
    } catch (e: any) {
      console.error('[GET /fornecedores/cnpj] produtos:', e.message);
    }

    // Busca produtos na base ANVISA (Cosméticos e Medicamentos) - usa CNPJ limpo
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    let anvisaProdutos: any[] = [];
    try {
      const [cosmRes, medsRes] = await Promise.all([
        supabaseAdmin.from('anvisa_cosmeticos').select('*').eq('cnpj', cnpjLimpo).limit(100),
        supabaseAdmin.from('anvisa_medicamentos').select('*').eq('cnpj', cnpjLimpo).limit(100)
      ]);
      
      const cosm = (cosmRes.data || []).map((d: any) => ({ ...d, tipo_anvisa: 'Cosmético' }));
      const meds = (medsRes.data || []).map((d: any) => ({ ...d, tipo_anvisa: 'Medicamento' }));
      anvisaProdutos = [...cosm, ...meds];
    } catch (e: any) {
      console.error('[GET /fornecedores/cnpj] anvisa:', e.message);
    }

    // Organiza por categoria para o frontend
    const produtosPorCategoria: { [key: string]: any[] } = {};
    
    // Processa produtos locais
    produtosLocais.forEach(p => {
      const cat = p.categoria || 'Geral';
      if (!produtosPorCategoria[cat]) produtosPorCategoria[cat] = [];
      produtosPorCategoria[cat].push(p);
    });

    // Processa produtos ANVISA (que ainda não foram importados localmente)
    // Evita duplicidade se o registro_anvisa for o mesmo
    const registrosLocais = new Set(produtosLocais.map(p => p.registro_anvisa));
    
    anvisaProdutos.forEach(p => {
      if (!registrosLocais.has(p.processo)) {
        const cat = `ANVISA: ${p.tipo_anvisa}`;
        if (!produtosPorCategoria[cat]) produtosPorCategoria[cat] = [];
        // Mapeia para o formato que o frontend espera no catálogo
        produtosPorCategoria[cat].push({
          id: `anvisa-${p.id}`,
          $id: `anvisa-${p.id}`, // Add legacy $id so frontend doesn't break
          nome_produto: p.nome_produto,
          registro_anvisa: p.processo,
          categoria: cat,
          descricao: p.situacao,
          data_vencimento_registro: p.vencimento,
          vencimento_limpo: p.vencimento_limpo,
          seguro_compra: p.seguro_compra,
          is_anvisa_only: true
        });
      }
    });

    return NextResponse.json({
      fornecedor,
      produtos: produtosLocais,
      anvisa: anvisaProdutos,
      produtosPorCategoria,
      totalProdutos: produtosLocais.length + anvisaProdutos.length
    });
  } catch (error: any) {
    console.error('[GET /api/fornecedores/cnpj]', error);
    return NextResponse.json({ error: 'Erro interno', detail: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/fornecedores/[cnpj]
 * Atualiza tipo_anvisa do perfil do fornecedor.
 */
export async function PATCH(
  request: NextRequest,
  _ctx: { params: { cnpj: string } }
) {
  try {
    const body = await request.json();
    const { tipo_anvisa, user_id } = body;

    if (!tipo_anvisa || !['cosmetico', 'medicamento', 'ambos'].includes(tipo_anvisa)) {
      return NextResponse.json({ error: 'tipo_anvisa inválido' }, { status: 400 });
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 });
    }

    // Salva no user_metadata do Supabase Auth — faz merge para não apagar outros campos
    const { data: { user: currentUser } } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const existingMeta = currentUser?.user_metadata || {};
    await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: { ...existingMeta, tipo_anvisa },
    });

    // Tenta também atualizar a coluna no banco (ignora erro se coluna não existir)
    await supabaseAdmin
      .from('fornecedores')
      .update({ tipo_anvisa })
      .eq('user_id', user_id)
      .eq('is_perfil', true);

    return NextResponse.json({ success: true, tipo_anvisa });
  } catch (error: any) {
    console.error('[PATCH /api/fornecedores/cnpj]', error);
    return NextResponse.json({ error: 'Erro ao atualizar', detail: error.message }, { status: 500 });
  }
}
