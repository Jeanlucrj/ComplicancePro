import { NextRequest, NextResponse } from 'next/server';
import { enviarWhatsApp } from '@/lib/zapi';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/test
 * Envia mensagem de teste para um número.
 * Body: { telefone }
 */
export async function POST(request: NextRequest) {
  try {
    const { telefone } = await request.json();

    if (!telefone) {
      return NextResponse.json({ error: 'telefone é obrigatório' }, { status: 400 });
    }

    const mensagem =
      `✅ *CompliancePro — Teste de Notificação*\n\n` +
      `Seu WhatsApp foi configurado com sucesso!\n` +
      `Você receberá alertas ANVISA por aqui.\n\n` +
      `_${new Date().toLocaleString('pt-BR')}_`;

    const enviado = await enviarWhatsApp(telefone, mensagem);

    if (!enviado) {
      return NextResponse.json({ error: 'Falha ao enviar. Verifique se o número está correto.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/whatsapp/test]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
