'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Copy, RefreshCw, Shield, Zap, Clock } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Plano = 'pro' | 'enterprise';

interface CheckoutData {
  chargeId:       string;
  pixQrCodeBase64: string;
  pixCopiaCola:   string;
  plano:          string;
  valorReais:     string;
  expiresAt:      string;
}

interface PlanoConfig {
  id:       Plano;
  nome:     string;
  preco:    string;
  periodo:  string;
  recursos: string[];
  destaque: boolean;
}

// ─── Configuração dos planos (visual) ─────────────────────────────────────────
const PLANOS: PlanoConfig[] = [
  {
    id:      'pro',
    nome:    'Pro',
    preco:   'R$ 49,90',
    periodo: '/mês',
    destaque: false,
    recursos: [
      '50 consultas de CNPJ/mês',
      'Monitoramento ANVISA',
      'Alertas de irregulares',
      'Catálogo de cosméticos',
      'Suporte por e-mail',
    ],
  },
  {
    id:      'enterprise',
    nome:    'Enterprise',
    preco:   'R$ 149,90',
    periodo: '/mês',
    destaque: true,
    recursos: [
      'Consultas ilimitadas',
      'Tudo do plano Pro',
      'Múltiplos usuários',
      'Acesso à API',
      'Suporte prioritário',
      'Relatórios avançados',
    ],
  },
];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const planoParam   = (searchParams.get('plano') || 'pro') as Plano;

  const [userId,       setUserId]       = useState<string | null>(null);
  const [planoSel,    setPlanoSel]     = useState<Plano>(planoParam);
  const [loading,     setLoading]      = useState(false);
  const [checkout,    setCheckout]     = useState<CheckoutData | null>(null);
  const [copiado,     setCopiado]      = useState(false);
  const [pago,        setPago]         = useState(false);
  const [tempoRest,   setTempoRest]    = useState<string>('');
  const [erro,        setErro]         = useState<string | null>(null);

  // 1. Obtém userId da sessão Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) setUserId(data.session.user.id);
    });
  }, []);

  // 2. Countdown do QR Code
  useEffect(() => {
    if (!checkout?.expiresAt) return;

    const tick = () => {
      const diff = new Date(checkout.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTempoRest('Expirado'); return; }
      const min = Math.floor(diff / 60000);
      const seg = Math.floor((diff % 60000) / 1000);
      setTempoRest(`${min}:${seg.toString().padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkout?.expiresAt]);

  // 3. Polling para verificar pagamento (a cada 5s após gerar QR)
  const verificarPagamento = useCallback(async (chargeId: string) => {
    if (!userId) return;
    try {
      const res  = await fetch(`/api/checkout/status?chargeId=${chargeId}&userId=${userId}`);
      const data = await res.json();
      if (data?.pago) setPago(true);
    } catch { /* silencioso */ }
  }, [userId]);

  useEffect(() => {
    if (!checkout?.chargeId || pago) return;
    const id = setInterval(() => verificarPagamento(checkout.chargeId), 5000);
    return () => clearInterval(id);
  }, [checkout?.chargeId, pago, verificarPagamento]);

  // 4. Gera a cobrança Pix via API interna
  const gerarPix = async () => {
    if (!userId) { setErro('Você precisa estar logado para continuar.'); return; }
    setLoading(true);
    setErro(null);
    setCheckout(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plano: planoSel }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErro(data.error || 'Erro ao gerar cobrança. Tente novamente.');
        return;
      }
      setCheckout(data);
    } catch {
      setErro('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Copia código Pix para área de transferência
  const copiarCodigo = async () => {
    if (!checkout?.pixCopiaCola) return;
    try {
      await navigator.clipboard.writeText(checkout.pixCopiaCola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      setErro('Não foi possível copiar. Copie o código manualmente.');
    }
  };

  // ─── Tela de sucesso ────────────────────────────────────────────────────────
  if (pago) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-10 text-center max-w-md w-full shadow-2xl">
          <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Pagamento Confirmado!</h1>
          <p className="text-slate-400 mb-6">Seu plano foi ativado com sucesso. Aproveite todos os recursos.</p>
          <a
            href="/dashboard"
            className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition"
          >
            Ir para o Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ─── Layout principal ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Shield className="h-6 w-6 text-purple-400" />
        <span className="font-bold text-lg">CompliancePro</span>
        <span className="ml-auto text-slate-400 text-sm">Checkout Seguro</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-center mb-2">Escolha seu plano</h1>
        <p className="text-slate-400 text-center mb-10">
          Pagamento via Pix — instantâneo e seguro
        </p>

        {/* Seleção de plano */}
        {!checkout && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {PLANOS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlanoSel(p.id)}
                className={`text-left rounded-2xl border-2 p-6 transition-all ${
                  planoSel === p.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                }`}
              >
                {p.destaque && (
                  <span className="inline-block text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full mb-3">
                    Mais Popular
                  </span>
                )}
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-2xl font-bold text-white">{p.preco}</span>
                  <span className="text-slate-400 text-sm mb-0.5">{p.periodo}</span>
                </div>
                <p className="text-lg font-semibold text-white mb-3">Plano {p.nome}</p>
                <ul className="space-y-2">
                  {p.recursos.map((r) => (
                    <li key={r} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        )}

        {/* Área de pagamento */}
        <div className="max-w-md mx-auto">

          {/* Erro */}
          {erro && (
            <div className="bg-red-900/30 border border-red-500/40 text-red-300 rounded-xl p-4 mb-6 text-sm">
              {erro}
            </div>
          )}

          {/* QR Code gerado */}
          {checkout ? (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
              {/* Timer */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Expira em
                </span>
                <span className={`font-mono font-bold ${tempoRest === 'Expirado' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {tempoRest}
                </span>
              </div>

              {/* Resumo */}
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Você está pagando</p>
                <p className="font-bold text-white">{checkout.plano}</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">R$ {checkout.valorReais}</p>
              </div>

              {/* QR Code */}
              {checkout.pixQrCodeBase64 ? (
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl">
                    <img
                      src={`data:image/png;base64,${checkout.pixQrCodeBase64}`}
                      alt="QR Code Pix"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-400 text-sm">
                  QR Code não disponível. Use o código abaixo.
                </div>
              )}

              {/* Copia e cola */}
              {checkout.pixCopiaCola && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Pix Copia e Cola</p>
                  <div className="bg-slate-800 rounded-xl p-3 flex items-start gap-3">
                    <p className="text-xs font-mono text-slate-300 break-all flex-1 select-all">
                      {checkout.pixCopiaCola}
                    </p>
                    <button
                      onClick={copiarCodigo}
                      className="flex-shrink-0 text-purple-400 hover:text-purple-300 transition"
                      title="Copiar código"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={copiarCodigo}
                    className={`mt-3 w-full py-3 rounded-xl font-semibold text-sm transition ${
                      copiado
                        ? 'bg-emerald-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {copiado ? '✓ Código copiado!' : 'Copiar código Pix'}
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center">
                Abra o app do seu banco, escolha Pix e escaneie o QR Code ou cole o código.
                O acesso é liberado automaticamente após a confirmação.
              </p>

              {/* Gerar novo */}
              <button
                onClick={() => { setCheckout(null); setErro(null); }}
                className="w-full py-2 text-slate-400 hover:text-white text-sm transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Gerar novo Pix
              </button>
            </div>

          ) : (
            /* Botão gerar Pix */
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Plano selecionado</span>
                <span className="text-white font-semibold">
                  {PLANOS.find(p => p.id === planoSel)?.nome}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Total mensal</span>
                <span className="text-purple-400 font-bold text-lg">
                  {PLANOS.find(p => p.id === planoSel)?.preco}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-4">
                <button
                  onClick={gerarPix}
                  disabled={loading || !userId}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Gerando Pix...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      Gerar Pix
                    </>
                  )}
                </button>
                {!userId && (
                  <p className="text-center text-xs text-slate-500 mt-3">
                    <a href="/login" className="text-purple-400 hover:underline">Faça login</a> para continuar.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Shield className="h-3.5 w-3.5" />
                Pagamento processado pela AbacatePay
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
