import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Rota APENAS para devMode — simula pagamento E atualiza Supabase diretamente
export async function POST(request: NextRequest) {
  const { chargeId, userId } = await request.json();

  if (!chargeId) {
    return NextResponse.json({ error: 'chargeId obrigatório' }, { status: 400 });
  }

  const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY || '';

  // 1. Dispara simulação na AbacatePay
  const simRes = await fetch(
    `https://api.abacatepay.com/v2/transparents/simulate-payment?id=${chargeId}`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${ABACATEPAY_API_KEY}` } }
  );
  const simData = await simRes.json();
  console.log('[simulate] AbacatePay:', JSON.stringify(simData));

  // 2. Atualiza Supabase diretamente (não depende do webhook)
  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status:         'ativa',
      data_pagamento: new Date().toISOString(),
      data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('abacatepay_charge_id', chargeId);

  if (error) console.error('[simulate] Erro ao atualizar Supabase:', error.message);

  // 3. Se tiver userId, atualiza também o plano no Auth
  if (userId) {
    const { data: assinatura } = await supabaseAdmin
      .from('assinaturas')
      .select('plano')
      .eq('abacatepay_charge_id', chargeId)
      .single();

    if (assinatura?.plano) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { plano: assinatura.plano },
      });
    }
  }

  return NextResponse.json({ success: true, pago: true, chargeId });
}
