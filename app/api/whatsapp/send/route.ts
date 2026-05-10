import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { enviarWhatsApp, formatarMensagemAlertas } from '@/lib/zapi';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/send
 * Envia alertas ANVISA via WhatsApp para o usuário autenticado.
 * Body: { userId, alertas }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, alertas } = await request.json();

    if (!userId || !alertas?.length) {
      return NextResponse.json({ error: 'userId e alertas são obrigatórios' }, { status: 400 });
    }

    // Busca dados do usuário (telefone e nome da empresa)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const telefone = authUser.user.user_metadata?.telefone;
    if (!telefone) {
      return NextResponse.json({ error: 'Nenhum telefone cadastrado para este usuário' }, { status: 400 });
    }

    // Busca nome da empresa
    const { data: perfil } = await supabaseAdmin
      .from('fornecedores')
      .select('razao_social, nome_fantasia')
      .eq('user_id', userId)
      .eq('is_perfil', true)
      .maybeSingle();

    const nomeEmpresa = perfil?.nome_fantasia || perfil?.razao_social || 'sua empresa';

    const mensagem = formatarMensagemAlertas(nomeEmpresa, alertas);
    const enviado = await enviarWhatsApp(telefone, mensagem);

    if (!enviado) {
      return NextResponse.json({ error: 'Falha ao enviar mensagem WhatsApp' }, { status: 500 });
    }

    return NextResponse.json({ success: true, telefone });
  } catch (err: any) {
    console.error('[POST /api/whatsapp/send]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
