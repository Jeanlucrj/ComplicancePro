import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ─── Segurança do Webhook ─────────────────────────────────────────────────────
// Configure ABACATEPAY_WEBHOOK_SECRET no .env.local com o segredo gerado
// no painel da AbacatePay (Settings → Webhooks).
const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica assinatura do webhook (segurança)
    // A AbacatePay envia um header com o segredo — ajuste conforme documentação real
    const receivedSecret = request.headers.get('x-abacatepay-secret')
      || request.headers.get('x-webhook-secret')
      || '';

    if (WEBHOOK_SECRET && receivedSecret !== WEBHOOK_SECRET) {
      console.warn('[webhook/abacatepay] Assinatura inválida:', receivedSecret);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[webhook/abacatepay] Evento recebido:', JSON.stringify(body, null, 2));

    // 2. Extrai campos do evento
    // Ajuste conforme o contrato real da AbacatePay v2
    const event  = body?.event  || body?.type   || '';
    const charge = body?.charge || body?.data   || body || {};
    const status = (charge?.status || '').toUpperCase();
    const chargeId = charge?.id || body?.id || '';

    // 3. Só processa eventos de pagamento confirmado
    const isPago = event === 'PAYMENT_CONFIRMED'
      || event === 'charge.paid'
      || status === 'PAID'
      || status === 'CONCLUIDO'
      || status === 'COMPLETED';

    if (!isPago) {
      console.log(`[webhook/abacatepay] Evento ignorado: ${event} / status: ${status}`);
      return NextResponse.json({ received: true, action: 'ignored' });
    }

    if (!chargeId) {
      console.error('[webhook/abacatepay] chargeId ausente no payload');
      return NextResponse.json({ error: 'chargeId ausente' }, { status: 400 });
    }

    // 4. Busca a assinatura pendente pelo chargeId
    const { data: assinatura, error: findError } = await supabaseAdmin
      .from('assinaturas')
      .select('*')
      .eq('abacatepay_charge_id', chargeId)
      .eq('status', 'pendente')
      .single();

    if (findError || !assinatura) {
      console.warn('[webhook/abacatepay] Assinatura não encontrada para chargeId:', chargeId);
      // Retorna 200 para evitar reenvio do webhook
      return NextResponse.json({ received: true, action: 'not_found' });
    }

    const { user_id, plano } = assinatura;

    // 5. Marca assinatura como ativa no Supabase
    const { error: updateError } = await supabaseAdmin
      .from('assinaturas')
      .update({
        status:          'ativa',
        data_pagamento:  new Date().toISOString(),
        // Próxima cobrança em 30 dias
        data_expiracao:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', assinatura.id);

    if (updateError) {
      console.error('[webhook/abacatepay] Erro ao atualizar assinatura:', updateError.message);
      return NextResponse.json({ error: 'Erro ao atualizar assinatura.' }, { status: 500 });
    }

    // 6. Atualiza o plano do usuário no Supabase Auth (user_metadata)
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: { plano },
    });

    if (metaError) {
      console.error('[webhook/abacatepay] Erro ao atualizar user_metadata:', metaError.message);
      // Não bloqueia — a assinatura já está ativa na tabela
    }

    console.log(`[webhook/abacatepay] ✅ Pagamento confirmado. user_id=${user_id} plano=${plano}`);
    return NextResponse.json({ received: true, action: 'activated', user_id, plano });

  } catch (err: any) {
    console.error('[webhook/abacatepay] Erro inesperado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
