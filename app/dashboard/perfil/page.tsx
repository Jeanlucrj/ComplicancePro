'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2, User, Mail, MapPin, Briefcase, ShieldCheck,
  Loader2, Calendar, Phone, ArrowLeft, Pencil, Check, X, Bell,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Fornecedor } from '@/lib/types';
import Link from 'next/link';
import { formatarCNPJ } from '@/utils/formatters';

function labelSetor(tipo: string | undefined | null) {
  if (tipo === 'cosmetico') return 'Cosméticos';
  if (tipo === 'medicamento') return 'Medicamentos';
  return 'Não definido';
}

function PerfilContent() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Fornecedor | null>(null);
  const [loading, setLoading] = useState(true);

  // Setor
  const [editingSetor, setEditingSetor] = useState(false);
  const [novoSetor, setNovoSetor] = useState('');
  const [savingSetor, setSavingSetor] = useState(false);
  const [setorError, setSetorError] = useState<string | null>(null);

  // Telefone / WhatsApp
  const [editingTelefone, setEditingTelefone] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [savingTelefone, setSavingTelefone] = useState(false);
  const [telefoneError, setTelefoneError] = useState<string | null>(null);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [whatsAppStatus, setWhatsAppStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  // Toggle alertas automáticos
  const [whatsappAlertas, setWhatsappAlertas] = useState(false);
  const [togglingAlertas, setTogglingAlertas] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const isNovo = searchParams.get('novo') === 'true';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login'); return; }

        const meta = session.user.user_metadata || {};
        setUser({
          name: meta.full_name || session.user.email,
          email: session.user.email,
          $createdAt: session.user.created_at,
          $id: session.user.id,
          telefone: meta.telefone || '',
        });
        setWhatsappAlertas(!!meta.whatsapp_alertas);

        const res = await fetch(`/api/fornecedores?userId=${session.user.id}&onlyPerfil=true`);
        if (res.ok) {
          const data = await res.json();
          if (data.fornecedores?.length > 0) {
            const forn = data.fornecedores[0];
            // user_metadata é a fonte primária; banco é fallback
            const tipoFinal = meta.tipo_anvisa || forn.tipo_anvisa || null;
            setProfile({ ...forn, tipo_anvisa: tipoFinal });
          }
        }
      } catch (err) {
        console.error('Erro ao buscar perfil:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const updateMeta = async (fields: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessão expirada');
    const { error } = await supabase.auth.updateUser({
      data: { ...session.user.user_metadata, ...fields },
    });
    if (error) throw error;
    await supabase.auth.refreshSession();
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    else if (value.length > 6) value = value.replace(/^(\d{2})(\d{4,5})(\d{0,4}).*/, '($1) $2-$3');
    else if (value.length > 2) value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    setNovoTelefone(value);
  };

  const handleSaveTelefone = async () => {
    setSavingTelefone(true);
    setTelefoneError(null);
    try {
      await updateMeta({ telefone: novoTelefone });
      setUser((prev: any) => ({ ...prev, telefone: novoTelefone }));
      setEditingTelefone(false);
    } catch (err: any) {
      setTelefoneError(err.message || 'Erro ao salvar telefone');
    } finally {
      setSavingTelefone(false);
    }
  };

  const handleTestarWhatsApp = async () => {
    if (!user?.telefone) return;
    setTestingWhatsApp(true);
    setWhatsAppStatus('idle');
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: user.telefone }),
      });
      setWhatsAppStatus(res.ok ? 'ok' : 'error');
    } catch {
      setWhatsAppStatus('error');
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleToggleAlertas = async () => {
    setTogglingAlertas(true);
    try {
      const novoValor = !whatsappAlertas;
      await updateMeta({ whatsapp_alertas: novoValor });
      setWhatsappAlertas(novoValor);
    } catch (err: any) {
      console.error('Erro ao salvar preferência:', err);
    } finally {
      setTogglingAlertas(false);
    }
  };

  const handleEditSetor = () => {
    setNovoSetor(profile?.tipo_anvisa || 'cosmetico');
    setSetorError(null);
    setEditingSetor(true);
  };

  const handleSaveSetor = async () => {
    if (!profile) return;
    setSavingSetor(true);
    setSetorError(null);
    try {
      const cnpjLimpo = profile.cnpj.replace(/\D/g, '');
      const res = await fetch(`/api/fornecedores/${cnpjLimpo}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_anvisa: novoSetor, user_id: user?.$id }),
      });
      const json = await res.json();
      if (res.ok) {
        setProfile((prev) =>
          prev ? { ...prev, tipo_anvisa: novoSetor as 'cosmetico' | 'medicamento' | 'ambos' } : prev
        );
        await supabase.auth.refreshSession();
        setEditingSetor(false);
      } else {
        setSetorError(json.error || json.detail || 'Erro ao salvar');
      }
    } catch (err: any) {
      setSetorError(err.message || 'Erro desconhecido');
    } finally {
      setSavingSetor(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Banner de boas-vindas pós-checkout */}
      {isNovo && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 flex items-start gap-4">
          <div className="text-3xl">🎉</div>
          <div>
            <p className="font-bold text-emerald-400 text-lg">Bem-vindo ao CompliancePro!</p>
            <p className="text-slate-300 text-sm mt-1">
              Seu pagamento foi confirmado e seu acesso está ativo. Agora <strong>complete os dados da sua empresa</strong> abaixo — isso é essencial para configurar seus alertas ANVISA e WhatsApp corretamente.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dados Cadastrais</h1>
          <p className="text-slate-500 dark:text-slate-400">Gerencie as informações da sua empresa e do seu perfil</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Card: Responsável */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16" />
            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/20">
                <User className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{user?.name}</h3>
                <p className="text-blue-500 font-semibold text-sm">Responsável Legal</p>
              </div>
              <div className="w-full pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-400">
                  <Mail className="h-5 w-5 text-slate-400 shrink-0" />
                  <span className="text-sm truncate">{user?.email}</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm">Conta Verificada</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-400">
                  <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
                  <span className="text-sm">Membro desde {new Date(user?.$createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Dados da Empresa */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center space-x-3 mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Building2 className="h-6 w-6 text-blue-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Informações da Empresa</h2>
            </div>

            {!profile ? (
              <div className="text-center py-12 space-y-4">
                <Building2 className="h-12 w-12 text-slate-300 mx-auto" />
                <p className="text-slate-500">Nenhum dado empresarial vinculado.</p>
                <Link
                  href="/dashboard"
                  className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm"
                >
                  Vincular Empresa
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Razão Social</label>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{profile.razao_social}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Nome Fantasia</label>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{profile.nome_fantasia || profile.razao_social}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">CNPJ</label>
                  <div className="flex items-center space-x-2">
                    <p className="text-lg font-mono font-bold text-slate-900 dark:text-white">{formatarCNPJ(profile.cnpj)}</p>
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Ativa</span>
                  </div>
                </div>

                {/* Setor — editável */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Setor Principal</label>
                  {editingSetor ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={novoSetor}
                          onChange={(e) => setNovoSetor(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="cosmetico">Cosméticos</option>
                          <option value="medicamento">Medicamentos</option>
                        </select>
                        <button onClick={handleSaveSetor} disabled={savingSetor} className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition" title="Salvar">
                          {savingSetor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setEditingSetor(false)} className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition" title="Cancelar">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {setorError && <p className="text-xs text-red-500">{setorError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-blue-500" />
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{labelSetor(profile.tipo_anvisa)}</p>
                      <button onClick={handleEditSetor} className="ml-1 p-1 text-slate-400 hover:text-blue-500 transition" title="Alterar setor">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Localização</label>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <p className="text-base font-bold text-slate-900 dark:text-white">{profile.cidade}, {profile.estado}</p>
                  </div>
                </div>

                {/* WhatsApp — editável */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">WhatsApp</label>
                  {editingTelefone ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="tel"
                          value={novoTelefone}
                          onChange={handleTelefoneChange}
                          placeholder="(11) 99999-9999"
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={handleSaveTelefone} disabled={savingTelefone} className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition" title="Salvar">
                          {savingTelefone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setEditingTelefone(false)} className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition" title="Cancelar">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {telefoneError && <p className="text-xs text-red-500">{telefoneError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <Phone className="h-4 w-4 text-green-500 shrink-0" />
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {user?.telefone || <span className="text-slate-400 font-normal italic">Não cadastrado</span>}
                      </p>
                      <button
                        onClick={() => { setNovoTelefone(user?.telefone || ''); setTelefoneError(null); setEditingTelefone(true); }}
                        className="p-1 text-slate-400 hover:text-blue-500 transition"
                        title="Alterar WhatsApp"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {user?.telefone && (
                        <button
                          onClick={handleTestarWhatsApp}
                          disabled={testingWhatsApp}
                          className="px-3 py-1 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
                        >
                          {testingWhatsApp ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Testar'}
                        </button>
                      )}
                      {whatsAppStatus === 'ok' && <span className="text-xs text-green-600 font-bold">✓ Mensagem enviada!</span>}
                      {whatsAppStatus === 'error' && <span className="text-xs text-red-500 font-bold">Falha no envio</span>}
                    </div>
                  )}
                </div>

                {/* Toggle alertas automáticos */}
                <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Bell className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Alertas automáticos via WhatsApp</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Receba diariamente um resumo dos alertas ANVISA dos seus fornecedores
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleToggleAlertas}
                      disabled={togglingAlertas || !user?.telefone}
                      title={!user?.telefone ? 'Cadastre seu WhatsApp primeiro' : undefined}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 shrink-0 ${
                        whatsappAlertas ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      {togglingAlertas ? (
                        <Loader2 className="h-3 w-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                      ) : (
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${whatsappAlertas ? 'translate-x-6' : 'translate-x-1'}`} />
                      )}
                    </button>
                  </div>
                  {whatsappAlertas && (
                    <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium ml-8">
                      ✓ Ativo — você receberá alertas diariamente às 08h
                    </p>
                  )}
                  {!user?.telefone && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 ml-8">
                      Cadastre seu número WhatsApp acima para ativar
                    </p>
                  )}
                </div>
              </div>
            )}

            {profile && (
              <div className="mt-8 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/20">
                <p className="text-xs text-blue-700 dark:text-blue-300 italic">
                  * Dados coletados da Receita Federal e ANVISA. O setor pode ser alterado clicando no ícone de lápis.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PerfilPage() {
  return (
    <Suspense fallback={null}>
      <PerfilContent />
    </Suspense>
  );
}
