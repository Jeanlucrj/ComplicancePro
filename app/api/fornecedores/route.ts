import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fornecedores
 * Query params: estado, busca, status_anvisa
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const estado = searchParams.get('estado');
    const busca = searchParams.get('busca');
    const statusAnvisa = searchParams.get('status_anvisa');
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório para listar fornecedores' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('fornecedores')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('nome_fantasia', { ascending: true })
      .limit(100);

    const onlyPerfil = searchParams.get('onlyPerfil') === 'true';
    if (onlyPerfil) {
      query = query.eq('is_perfil', true);
    } else {
      query = query.eq('is_perfil', false);
    }

    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado);
    }

    if (statusAnvisa && statusAnvisa !== 'todos') {
      query = query.eq('status_anvisa', statusAnvisa);
    }

    if (busca && busca.trim() !== '') {
      query = query.or(`razao_social.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%,cnpj.ilike.%${busca}%`);
    }

    const { data: fornecedores, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ fornecedores, total: count || 0 });
  } catch (error: any) {
    console.error('[GET /api/fornecedores]', error);
    return NextResponse.json({ error: 'Erro interno do servidor', detail: error.message }, { status: 500 });
  }
}

/**
 * POST /api/fornecedores
 * Cria um novo fornecedor no banco a partir dos dados enviados.
 * Verifica duplicidade pelo CNPJ antes de criar.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cnpj, razao_social, nome_fantasia, estado, cidade, cep,
      endereco, data_abertura, situacao_receita, status_anvisa,
      email, telefone, score_qualidade, tipo_anvisa, user_id, is_perfil
    } = body;

    if (!cnpj || !razao_social || !user_id) {
      return NextResponse.json({ error: 'Campos obrigatórios: cnpj, razao_social, user_id' }, { status: 400 });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, '');

    // Verifica duplicidade
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('fornecedores')
      .select('*')
      .eq('cnpj', cnpjLimpo)
      .eq('user_id', user_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Fornecedor já cadastrado.', fornecedor: existing[0] },
        { status: 409 }
      );
    }

    let insertData = {
      cnpj: cnpjLimpo,
      razao_social,
      nome_fantasia: nome_fantasia || razao_social,
      estado: estado || '',
      cidade: cidade || '',
      cep: cep || '',
      endereco: endereco || '',
      data_abertura: data_abertura || null,
      situacao_receita: situacao_receita || 'DESCONHECIDA',
      status_anvisa: status_anvisa || 'PENDENTE',
      email: email || null,
      telefone: telefone || null,
      tipo_anvisa: tipo_anvisa || 'ambos',
      score_qualidade: score_qualidade ?? null,
      user_id: user_id,
      is_perfil: !!is_perfil
    };

    // Cria o documento
    let { data: doc, error: insertError } = await supabaseAdmin
      .from('fornecedores')
      .insert([insertData])
      .select()
      .single();

    if (insertError && insertError.message && insertError.message.includes('tipo_anvisa')) {
      console.warn("Coluna tipo_anvisa nao encontrada. Tentando inserir sem a coluna.");
      const { tipo_anvisa: _, ...fallbackData } = insertData;
      const retryResult = await supabaseAdmin
        .from('fornecedores')
        .insert([fallbackData as any])
        .select()
        .single();
      
      doc = retryResult.data;
      insertError = retryResult.error;
    }

    if (insertError) throw insertError;

    // WORKAROUND: Armazena o tipo_anvisa na metadata do usuário autenticado no Supabase Auth
    // para suprir a falta da coluna no banco de dados.
    if (is_perfil && user_id && tipo_anvisa) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user_id, {
          user_metadata: { tipo_anvisa: tipo_anvisa }
        });
      } catch (metaErr) {
        console.error('Erro ao salvar tipo_anvisa no metadata:', metaErr);
      }
    }

    return NextResponse.json({ fornecedor: doc }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/fornecedores]', error);
    return NextResponse.json({ error: 'Erro ao criar fornecedor', detail: error.message }, { status: 500 });
  }
}
