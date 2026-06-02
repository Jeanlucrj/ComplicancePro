'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Copy, RefreshCw, Shield, Zap, Clock, ArrowRight, Eye, EyeOff } from 'lucide-react';

type Plano = 'pro' | 'enterprise';
type Etapa = 'identificacao' | 'pagamento' | 'sucesso';

interface CheckoutData {
  chargeId: string;
  pixQrCodeBase64: string;
  pixCopiaCola: string;
  plano: string;
  valorReais: string;
  expiresAt: string;
}

const PLANOS = {
  pro: {
    nome: 'Pro',
    preco: 'R$ 147,00',
    valor: 147,
    recursos: ['50 consultas de CNPJ/mês', 'Monitoramento ANVISA', 'Alertas de irregulares', 'Catálogo ANVISA completo', 'Suporte por e-mail'],
  },
  enterprise: {
    nome: 'Enterprise',
    preco: 'R$ 497,00',
    valor: 497,
    recursos: ['Consultas ilimitadas', 'Alertas via WhatsApp', 'API REST para ERP', 'Score de compliance + IA', 'Suporte prioritário 24/7'],
  },
} as const;

// ─── Componente principal ─────────────────────────────────────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const planoParam   = (searchParams.get('plano') || 'pro') as Plano;
  const plano        = PLANOS[planoParam] ?? PLANOS.pro;

  const [etapa,       setEtapa]       = useState<Etapa>('identificacao');
  const [userId,      setUserId]      = useState<string | null>(null);
  const [checkout,    setCheckout]    = useState<CheckoutData | null>(null);

  // Formulário de identificação
  const [isLogin,     setIsLogin]     = useState(false);
  const [nome,        setNome]        = useState('');
  const [email,       setEmail]       = useState('');
  const [senha,       setSenha]       = useState('');
  const [verSenha,    setVerSenha]    = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [erroAuth,    setErroAuth]    = useState('');

  // Pagamento
  const [loadingPix,  setLoadingPix]  = useState(false);
  const [erroPix,     setErroPix]     = useState('');
  const [copiado,     setCopiado]     = useState(false);
  const [tempoRest,   setTempoRest]   = useState('');
  const [pago,        setPago]        = useState(false);

  // 1. Verifica se já está logado ao entrar na página
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) {
        setUserId(data.session.user.id);
        setEtapa('pagamento'); // Pula etapa de identificação
      }
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

  // 3. Polling de pagamento (a cada 5s)
  const verificarPagamento = useCallback(async (chargeId: string) => {
    if (!userId) return;
    try {
      const res  = await fetch(`/api/checkout/status?chargeId=${chargeId}&userId=${userId}`);
      const data = await res.json();
      if (data?.pago) { setPago(true); setEtapa('sucesso'); }
    } catch { /* silencioso */ }
  }, [userId]);

  useEffect(() => {
    if (!checkout?.chargeId || pago) return;
    const id = setInterval(() => verificarPagamento(checkout.chargeId), 5000);
    return () => clearInterval(id);
  }, [checkout?.chargeId, pago, verificarPagamento]);

  // ─── Etapa 1: Criar conta ou logar ────────────────────────────────────────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);
    setErroAuth('');

    try {
      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) { setErroAuth('E-mail ou senha incorretos.'); return; }
        setUserId(data.user.id);
      } else {
        // Criar conta
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome } },
        });
        if (error) {
          setErroAuth(error.message.includes('already') ? 'E-mail já cadastrado. Faça login.' : 'Erro ao criar conta. Tente novamente.');
          return;
        }
        if (!data.user) { setErroAuth('Erro ao criar conta.'); return; }
        setUserId(data.user.id);
      }
      setEtapa('pagamento');
    } catch {
      setErroAuth('Erro de conexão. Tente novamente.');
    } finally {
      setLoadingAuth(false);
    }
  };

  // ─── Etapa 2: Gerar Pix ───────────────────────────────────────────────────
  const gerarPix = async () => {
    if (!userId) return;
    setLoadingPix(true);
    setErroPix('');
    setCheckout(null);

    try {
      const res  = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plano: planoParam }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setErroPix(data.error || 'Erro ao gerar Pix.'); return; }
      setCheckout(data);
    } catch {
      setErroPix('Não foi possível conectar. Tente novamente.');
    } finally {
      setLoadingPix(false);
    }
  };

  // ─── Copiar código Pix ────────────────────────────────────────────────────
  const copiarCodigo = async () => {
    if (!checkout?.pixCopiaCola) return;
    await navigator.clipboard.writeText(checkout.pixCopiaCola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  // ─── Tela de sucesso ──────────────────────────────────────────────────────
  if (etapa === 'sucesso') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-10 text-center max-w-sm w-full">
          <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Pagamento Confirmado!</h1>
          <p className="text-slate-400 mb-6">Seu plano <strong className="text-white">{plano.nome}</strong> foi ativado.</p>
          <a href="/dashboard" className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition">
            Ir para o Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Shield className="h-5 w-5 text-purple-400" />
        <span className="font-bold">CompliancePro</span>
        <span className="ml-auto text-slate-500 text-sm flex items-center gap-1">
          <Shield className="h-3.5 w-3.5" /> Checkout Seguro
        </span>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Coluna esquerda: Resumo do plano */}
          <div className="space-y-6">
            <div>
              <p className="text-slate-400 text-sm mb-1">Você está assinando</p>
              <h1 className="text-2xl font-bold">Plano {plano.nome}</h1>
              <p className="text-3xl font-extrabold text-purple-400 mt-1">{plano.preco}<span className="text-base font-normal text-slate-400">/mês</span></p>
            </div>
            <ul className="space-y-3">
              {plano.recursos.map(r => (
                <li key={r} className="flex items-center gap-3 text-sm text-slate-300">
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-800 pt-4 text-xs text-slate-500 space-y-1">
              <p>✓ Pagamento 100% via Pix</p>
              <p>✓ Acesso imediato após confirmação</p>
              <p>✓ Cancele quando quiser</p>
            </div>
          </div>

          {/* Coluna direita: Etapas */}
          <div className="space-y-4">

            {/* Indicador de etapas */}
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <span className={`flex items-center gap-1 font-semibold ${etapa === 'identificacao' ? 'text-purple-400' : 'text-emerald-400'}`}>
                {etapa !== 'identificacao' ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="w-4 h-4 rounded-full border-2 border-purple-400 inline-flex items-center justify-center text-[10px] text-purple-400">1</span>}
                Identificação
              </span>
              <div className="flex-1 h-px bg-slate-800" />
              <span className={`flex items-center gap-1 font-semibold ${etapa === 'pagamento' ? 'text-purple-400' : etapa === 'sucesso' ? 'text-emerald-400' : 'text-slate-600'}`}>
                <span className="w-4 h-4 rounded-full border-2 border-current inline-flex items-center justify-center text-[10px]">2</span>
                Pagamento
              </span>
            </div>

            {/* ── ETAPA 1: Identificação ───────────────────────────────────── */}
            {etapa === 'identificacao' && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
                <h2 className="font-bold text-lg">{isLogin ? 'Entre na sua conta' : 'Crie sua conta'}</h2>

                {erroAuth && (
                  <div className="bg-red-900/30 border border-red-500/40 text-red-300 rounded-xl p-3 text-sm">
                    {erroAuth}
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-3">
                  {!isLogin && (
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Nome completo</label>
                      <input
                        type="text"
                        required
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">E-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Senha</label>
                    <div className="relative">
                      <input
                        type={verSenha ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                      <button type="button" onClick={() => setVerSenha(!verSenha)} className="absolute right-3 top-3 text-slate-400 hover:text-white">
                        {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loadingAuth}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {loadingAuth ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {isLogin ? 'Entrar e continuar' : 'Criar conta e continuar'}
                    {!loadingAuth && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>

                <p className="text-center text-xs text-slate-500">
                  {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
                  <button onClick={() => { setIsLogin(!isLogin); setErroAuth(''); }} className="text-purple-400 hover:underline">
                    {isLogin ? 'Criar agora' : 'Entrar'}
                  </button>
                </p>
              </div>
            )}

            {/* ── ETAPA 2: Pagamento Pix ───────────────────────────────────── */}
            {etapa === 'pagamento' && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
                <h2 className="font-bold text-lg">Pagamento via Pix</h2>

                {erroPix && (
                  <div className="bg-red-900/30 border border-red-500/40 text-red-300 rounded-xl p-3 text-sm">{erroPix}</div>
                )}

                {!checkout ? (
                  /* Botão gerar Pix */
                  <>
                    <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Total</span>
                      <span className="text-purple-400 font-bold text-xl">{plano.preco}<span className="text-slate-400 text-sm font-normal">/mês</span></span>
                    </div>
                    <button
                      onClick={gerarPix}
                      disabled={loadingPix}
                      className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-3"
                    >
                      {loadingPix ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                      {loadingPix ? 'Gerando Pix...' : 'Gerar Pix'}
                    </button>
                  </>
                ) : (
                  /* QR Code gerado */
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 flex items-center gap-1"><Clock className="h-4 w-4" /> Expira em</span>
                      <span className={`font-mono font-bold ${tempoRest === 'Expirado' ? 'text-red-400' : 'text-emerald-400'}`}>{tempoRest}</span>
                    </div>

                    {checkout.pixQrCodeBase64 ? (
                      <div className="flex justify-center">
                        <div className="bg-white p-3 rounded-xl">
                          <img src={`data:image/png;base64,${checkout.pixQrCodeBase64}`} alt="QR Code Pix" className="w-44 h-44 object-contain" />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800 rounded-xl p-4 text-center text-slate-400 text-sm">Use o código abaixo para pagar</div>
                    )}

                    {checkout.pixCopiaCola && (
                      <>
                        <div className="bg-slate-800 rounded-xl p-3 flex items-start gap-3">
                          <p className="text-xs font-mono text-slate-300 break-all flex-1 select-all">{checkout.pixCopiaCola}</p>
                          <button onClick={copiarCodigo} className="text-purple-400 hover:text-purple-300"><Copy className="h-4 w-4" /></button>
                        </div>
                        <button onClick={copiarCodigo} className={`w-full py-3 rounded-xl font-semibold text-sm transition ${copiado ? 'bg-emerald-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>
                          {copiado ? '✓ Código copiado!' : 'Copiar código Pix'}
                        </button>
                      </>
                    )}

                    <p className="text-xs text-slate-500 text-center">Abra o app do banco → Pix → Copia e Cola ou QR Code. Acesso liberado automaticamente.</p>

                    <button onClick={() => { setCheckout(null); setErroPix(''); }} className="w-full py-2 text-slate-500 hover:text-white text-xs transition flex items-center justify-center gap-1">
                      <RefreshCw className="h-3 w-3" /> Gerar novo Pix
                    </button>
                  </>
                )}

                <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
                  <Shield className="h-3.5 w-3.5" /> Pagamento processado pela AbacatePay
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
