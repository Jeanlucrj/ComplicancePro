'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, Loader2, CheckCircle2, Building2, MapPin, Briefcase, Search, Phone } from 'lucide-react';
import { BrandLogoIcon } from '@/components/BrandLogo';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [telefone, setTelefone] = useState('');
  const [setor, setSetor] = useState('cosmetico');
  const [loading, setLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Auto-fill CNPJ
  useEffect(() => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length === 14) {
      const controller = new AbortController();
      enrichData(cnpjLimpo, controller.signal);
      return () => controller.abort();
    }
  }, [cnpj]);

  const enrichData = async (cnpjLimpo: string, signal: AbortSignal) => {
    setIsEnriching(true);
    try {
      const response = await fetch(`/api/enriquecer?cnpj=${cnpjLimpo}`, { signal });
      if (response.ok) {
        const data = await response.json();
        if (data.receita_federal) {
          setRazaoSocial(data.receita_federal.razao_social || '');
          setNomeFantasia(data.receita_federal.nome_fantasia || data.receita_federal.razao_social || '');
          setCidade(data.receita_federal.cidade || '');
          setEstado(data.receita_federal.estado || '');
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Erro ao auto-preencher via CNPJ:', err);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    else if (value.length > 6) value = value.replace(/^(\d{2})(\d{4,5})(\d{0,4}).*/, '($1) $2-$3');
    else if (value.length > 2) value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    setTelefone(value);
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.slice(0, 14);
    
    // Simplistic masking
    if (value.length > 12) value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    else if (value.length > 8) value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4}).*/, '$1.$2.$3/$4');
    else if (value.length > 5) value = value.replace(/^(\d{2})(\d{3})(\d{1,3}).*/, '$1.$2.$3');
    else if (value.length > 2) value = value.replace(/^(\d{2})(\d{1,3}).*/, '$1.$2');
    
    setCnpj(value);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validação de Senha
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      setLoading(false);
      return;
    }

    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setError('CNPJ deve ter 14 dígitos.');
      setLoading(false);
      return;
    }

    try {
      // 1. Cria a conta do usuário
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            telefone: telefone.replace(/\D/g, '') ? telefone : undefined,
          }
        }
      });
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('Falha ao criar usuário.');
      
      const userId = authData.user.id;
      
      // 3. Cria o perfil do fornecedor/empresa
      const response = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cnpj: cnpjLimpo,
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia || razaoSocial,
          cidade,
          estado,
          tipo_anvisa: setor, // 'cosmetico' ou 'medicamento'
          user_id: userId,
          status_anvisa: 'PENDENTE',
          situacao_receita: 'ATIVA',
          is_perfil: true
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao criar perfil da empresa.');
      }
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <Link href="/" className="flex justify-center items-center space-x-3 mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BrandLogoIcon className="h-8 w-8 text-white" />
          </div>
          <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Data Control
          </span>
        </Link>
        <h2 className="text-center text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Comece agora mesmo
        </h2>
        <p className="mt-3 text-center text-lg text-slate-600 dark:text-slate-400">
          Crie sua conta e assine via Pix para ter acesso completo
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white dark:bg-slate-900 py-10 px-4 shadow-2xl shadow-slate-200/50 dark:shadow-none sm:rounded-3xl sm:px-12 border border-slate-200 dark:border-slate-800">
          <form className="space-y-8" onSubmit={handleSignup}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-2xl text-base font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Coluna 1: Dados Pessoais */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <User className="h-5 w-5 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Pessoais</h3>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Nome completo
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm"
                      placeholder="Nome do responsável"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    E-mail
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    WhatsApp <span className="text-slate-400 font-normal">(para alertas)</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="tel"
                      value={telefone}
                      onChange={handleTelefoneChange}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Senha de acesso
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                </div>
              </div>

              {/* Coluna 2: Dados da Empresa */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Empresa</h3>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    CNPJ
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      {isEnriching ? (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : (
                        <Building2 className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={cnpj}
                      onChange={handleCnpjChange}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm"
                      placeholder="00.000.000/0000-00"
                    />
                    {cnpj.replace(/\D/g, '').length === 14 && !isEnriching && (
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Razão Social
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm"
                      placeholder="Nome empresarial"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Nome Fantasia
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm"
                      placeholder="Nome da sua marca"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Cidade
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        required
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm"
                        placeholder="Cidade"
                      />
                    </div>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      UF
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        required
                        maxLength={2}
                        value={estado}
                        onChange={(e) => setEstado(e.target.value.toUpperCase())}
                        className="block w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm text-center font-bold"
                        placeholder="UF"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Setor de Atuação
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Briefcase className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <select
                      value={setor}
                      onChange={(e) => setSetor(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm appearance-none cursor-pointer"
                    >
                      <option value="cosmetico">Cosméticos</option>
                      <option value="medicamento">Medicamentos</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100/50 dark:border-blue-900/20 space-y-3">
              <div className="flex items-center space-x-3 text-sm text-blue-800 dark:text-blue-300 font-medium">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Acesso completo ao dashboard após assinatura</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-blue-800 dark:text-blue-300 font-medium">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Nenhum dado de pagamento exigido agora</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isEnriching}
              className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-2xl shadow-xl shadow-blue-500/30 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
              ) : (
                'Criar minha conta agora'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-base text-slate-600 dark:text-slate-400">
              Já possui uma conta?{' '}
              <Link href="/login" className="font-bold text-blue-600 hover:text-blue-500 transition-colors underline decoration-blue-500/30 underline-offset-4">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
