import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Polling de status do pagamento — chamado a cada 5s pelo front-end
export async function GET(request: NextRequest) {
  const chargeId = request.nextUrl.searchParams.get('chargeId');
  const userId   = request.nextUrl.searchParams.get('userId');

  if (!chargeId || !userId) {
    return NextResponse.json({ error: 'chargeId e userId são obrigatórios.' }, { status: 400 });
  }

  const { data: assinatura } = await supabaseAdmin
    .from('assinaturas')
    .select('status')
    .eq('abacatepay_charge_id', chargeId)
    .eq('user_id', userId)
    .single();

  return NextResponse.json({
    pago:   assinatura?.status === 'ativa',
    status: assinatura?.status || 'pendente',
  });
}
