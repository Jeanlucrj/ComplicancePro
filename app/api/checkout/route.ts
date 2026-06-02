import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ─── Configuração da AbacatePay ───────────────────────────────────────────────
// Substitua pela variável de ambiente ABACATEPAY_API_KEY no .env.local
const ABACATEPAY_BASE_URL = 'https://api.abacatepay.com/v2';
const ABACATEPAY_API_KEY  = process.env.ABACATEPAY_API_KEY || '';

// ─── Planos disponíveis ───────────────────────────────────────────────────────
const PLANOS = {
  pro: {
    nome: 'Acesso Pro – Base ANVISA',
    descricao: 'Monitoramento de cosméticos e medicamentos, alertas semanais e consultas ilimitadas.',
    valor_centavos: 14700, // R$ 147,00
  },
  enterprise: {
    nome: 'Acesso Enterprise – Base ANVISA',
    descricao: 'Tudo do Pro + múltiplos usuários, API access e suporte prioritário.',
    valor_centavos: 49700, // R$ 497,00
  },
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plano = 'pro' } = body as { userId: string; plano: 'pro' | 'enterprise' };

    // 1. Validação básica
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório.' }, { status: 400 });
    }
    if (!PLANOS[plano]) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }
    if (!ABACATEPAY_API_KEY) {
      return NextResponse.json({ error: 'Chave AbacatePay não configurada.' }, { status: 500 });
    }

    // 2. Busca dados do usuário logado no Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }
    const user = userData.user;
    const planoConfig = PLANOS[plano];

    // 3. Chama a API da AbacatePay para criar a cobrança Pix transparente
    // Payload conforme AbacatePay v2 — /transparents/create
    const abacatePayload = {
      amount:      planoConfig.valor_centavos,  // em centavos
      description: planoConfig.nome,
      method:      'PIX',                        // string, não array
      customer: {
        name:      user.user_metadata?.nome || user.email?.split('@')[0] || 'Cliente',
        email:     user.email || '',
        cellphone: user.user_metadata?.telefone || '11999999999', // obrigatório na v2
        taxId:     user.user_metadata?.cpf      || '00000000000', // CPF do cliente
      },
      products: [
        {
          externalId: plano,
          name:       planoConfig.nome,
          quantity:   1,
          price:      planoConfig.valor_centavos,
        },
      ],
    };
    console.log('[checkout] Payload enviado:', JSON.stringify(abacatePayload));

    const abacateRes = await fetch(`${ABACATEPAY_BASE_URL}/transparents/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(abacatePayload),
    });

    const rawText = await abacateRes.text();
    console.log('[checkout] AbacatePay status:', abacateRes.status);
    console.log('[checkout] AbacatePay response raw:', rawText);

    if (!abacateRes.ok) {
      console.error('[checkout] AbacatePay erro:', abacateRes.status, rawText);
      // Retorna o erro real da AbacatePay para facilitar debug
      return NextResponse.json(
        { error: `AbacatePay: HTTP ${abacateRes.status} — ${rawText.substring(0, 200)}` },
        { status: 502 }
      );
    }

    const abacateData = JSON.parse(rawText);
    console.log('[checkout] AbacatePay data keys:', Object.keys(abacateData));
    console.log('[checkout] AbacatePay data:', JSON.stringify(abacateData));

    // 4. Extrai QR Code e código copia-e-cola — cobre múltiplas estruturas possíveis da API
    const d = abacateData?.data || abacateData;
    const pixQrCodeBase64 = d?.pixQrCode  || d?.qrCode    || d?.qr_code    || d?.brCode    || '';
    const pixCopiaCola    = d?.copyPaste  || d?.pixCopiaECola || d?.copia_e_cola || d?.emv || d?.payload || '';
    const chargeId        = d?.id         || d?.chargeId  || d?.transactionId || '';

    // 5. Salva a cobrança pendente no Supabase
    const { error: dbError } = await supabaseAdmin.from('assinaturas').insert({
      user_id:             userId,
      plano,
      status:              'pendente',
      abacatepay_charge_id: chargeId,
      pix_qr_code_base64:  pixQrCodeBase64,
      pix_copia_cola:      pixCopiaCola,
      valor_centavos:      planoConfig.valor_centavos,
      // Expira em 30 minutos
      data_expiracao:      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    if (dbError) {
      console.error('[checkout] Erro ao salvar assinatura:', dbError.message);
      // Não bloqueia o retorno — o usuário ainda pode pagar
    }

    // 6. Retorna os dados para o front-end renderizar o QR Code
    return NextResponse.json({
      success:        true,
      chargeId,
      pixQrCodeBase64,
      pixCopiaCola,
      plano:          planoConfig.nome,
      valorReais:     (planoConfig.valor_centavos / 100).toFixed(2),
      expiresAt:      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

  } catch (err: any) {
    console.error('[checkout] Erro inesperado:', err);
    return NextResponse.json({ error: 'Erro interno ao processar checkout.' }, { status: 500 });
  }
}
