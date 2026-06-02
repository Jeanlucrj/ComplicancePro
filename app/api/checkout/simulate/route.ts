import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Rota APENAS para devMode — simula pagamento para testar o fluxo completo
export async function POST(request: NextRequest) {
  const { chargeId } = await request.json();

  if (!chargeId) {
    return NextResponse.json({ error: 'chargeId obrigatório' }, { status: 400 });
  }

  const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY || '';

  const res = await fetch(
    `https://api.abacatepay.com/v2/transparents/simulate-payment?id=${chargeId}`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ABACATEPAY_API_KEY}` },
    }
  );

  const data = await res.json();
  console.log('[simulate] resultado:', JSON.stringify(data));
  return NextResponse.json(data);
}
