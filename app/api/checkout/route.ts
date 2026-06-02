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
    valor_centavos: 4990, // R$ 49,90
  },
  enterprise: {
    nome: 'Acesso Enterprise – Base ANVISA',
    descricao: 'Tudo do Pro + múltiplos usuários, API access e suporte prioritário.',
    valor_centavos: 14990, // R$ 149,90
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
    const abacatePayload = {
      amount: planoConfig.valor_centavos,
      description: planoConfig.nome,
      methods: ['PIX'],
      customer: {
        name:  user.user_metadata?.nome || user.email?.split('@')[0] || 'Cliente',
        email: user.email || '',
        // Adicione CPF/CNPJ do user_metadata se disponível
        // taxId: user.user_metadata?.cpf || '',
      },
      // Expira em 30 minutos
      expiresIn: 1800,
      metadata: {
        user_id: userId,
        plano,
      },
    };

    const abacateRes = await fetch(`${ABACATEPAY_BASE_URL}/transparents/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(abacatePayload),
    });

    if (!abacateRes.ok) {
      const errText = await abacateRes.text();
      console.error('[checkout] AbacatePay erro:', abacateRes.status, errText);
      return NextResponse.json(
        { error: 'Falha ao gerar cobrança Pix. Tente novamente.' },
        { status: 502 }
      );
    }

    const abacateData = await abacateRes.json();

    // 4. Extrai QR Code e código copia-e-cola da resposta
    // Ajuste os campos conforme o contrato real da API AbacatePay v2
    const pixQrCodeBase64 = abacateData?.pixQrCode   || abacateData?.qrCode    || abacateData?.data?.qrCode    || '';
    const pixCopiaCola    = abacateData?.pixCopyPaste || abacateData?.copyPaste || abacateData?.data?.copyPaste || '';
    const chargeId        = abacateData?.id           || abacateData?.data?.id  || '';

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
