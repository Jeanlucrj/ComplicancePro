'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Search, Filter, ArrowRight, Plus, Building2, CheckCircle2, AlertCircle, Loader2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Badge from '@/components/Badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Fornecedor } from '@/lib/types';
import { formatarCNPJ, calcularTempoMercado, getScoreColor, calcularScore } from '@/utils/formatters';
import DOUFeed from '@/components/DOUFeed';
import IrregularesFeed from '@/components/IrregularesFeed';
import { useUserProfile } from '@/contexts/UserProfileContext';

// ── tipos para o resultado da avaliação ──────────────────────────────────────
interface AvaliacaoResult {
  cnpj: string;
  consultado_em: string;
  salvo_no_banco: boolean;
  erros: string[];
  receita_federal: {
    razao_social: string;
    nome_fantasia: string;
    situacao_cadastral: string;
    data_abertura: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    telefone: string;
    cnae_principal: string;
    porte: string;
    socios: { nome: string; qualificacao: string }[];
  } | null;
  anvisa: {
    status: string;
    descricao: string;
    fonte: string;
  };
}

// ── StatusIcon movido para fora do componente — evita re-criação a cada render ──
function StatusIcon({ s }: { s: string }) {
  if (s === 'ATIVA' || s === 'REGULAR') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (s === 'NAO_ENCONTRADA') return <AlertCircle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

// ── helper para formatar CNPJ digitado ─────────────────────────────────────
function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2')
    .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, '$1-$2');
}

export default function DashboardPage() {
  const { userId, tipoAnvisa: userTipoAnvisa, profileLoaded } = useUserProfile();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [statusAnvisaFiltro, setStatusAnvisaFiltro] = useState('todos');

  // ── estado para avaliação de novo CNPJ ──────────────────────────────────
  const [novoCnpj, setNovoCnpj] = useState('');
  const [tipoAnvisa, setTipoAnvisa] = useState<'cosmetico' | 'medicamento' | 'ambos'>('cosmetico');
  const [avaliando, setAvaliando] = useState(false);
  const [avaliacaoResult, setAvaliacaoResult] = useState<AvaliacaoResult | null>(null);
  const [avaliacaoError, setAvaliacaoError] = useState<string | null>(null);
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [salvandoNoBanco, setSalvandoNoBanco] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Inicializa tipoAnvisa a partir do perfil do usuário (context)
  useEffect(() => {
    if (profileLoaded && userTipoAnvisa) setTipoAnvisa(userTipoAnvisa);
  }, [profileLoaded, userTipoAnvisa]);

  // Carrega fornecedores
  useEffect(() => {
    if (userId) carregarFornecedores();
  }, [estadoFiltro, statusAnvisaFiltro, busca, userId]);

  const carregarFornecedores = async () => {
    setLoading(true);
    try {
      if (!userId) return;
      
      const params = new URLSearchParams();
      if (estadoFiltro !== 'todos') params.append('estado', estadoFiltro);
      if (statusAnvisaFiltro !== 'todos') params.append('status_anvisa', statusAnvisaFiltro);
      if (busca.trim() !== '') params.append('busca', busca);
      params.append('userId', userId);

      const response = await fetch(`/api/fornecedores?${params.toString()}`);
      const data = await response.json();
      setFornecedores(data.fornecedores || []);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── avalia CNPJ via Receita Federal + ANVISA ────────────────────────────
  const avaliarNovoCnpj = async () => {
    const cnpjLimpo = novoCnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setAvaliacaoError('Informe um CNPJ completo com 14 dígitos.');
      return;
    }
    setAvaliando(true);
    setAvaliacaoError(null);
    setAvaliacaoResult(null);
    setMostrarResultado(false);

    try {
      const res = await fetch(`/api/enriquecer?cnpj=${cnpjLimpo}&tipo=${tipoAnvisa}&userId=${userId || ''}`);
      const data = await res.json();

      if (!data.receita_federal && data.erros?.length > 0) {
        setAvaliacaoError(`Não foi possível avaliar: ${data.erros[0]}`);
      } else {
        setAvaliacaoResult(data);
        setMostrarResultado(true);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch {
      setAvaliacaoError('Erro ao consultar os dados. Verifique sua conexão.');
    } finally {
      setAvaliando(false);
    }
  };

  // ── salva no banco após avaliação ────────────────────────────────────────
  const salvarNoSistema = async () => {
    if (!avaliacaoResult) return;
    setSalvandoNoBanco(true);
    try {
      const cnpjLimpo = avaliacaoResult.cnpj;
      // 1. Cria o fornecedor no banco a partir dos dados da Receita Federal
      const r = avaliacaoResult.receita_federal!;
      const res = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: cnpjLimpo,
          razao_social: r.razao_social,
          nome_fantasia: r.nome_fantasia || r.razao_social,
          estado: r.estado,
          cidade: r.cidade,
          cep: r.cep,
          endereco: r.endereco,
          data_abertura: r.data_abertura,
          situacao_receita: avaliacaoResult.receita_federal?.situacao_cadastral || 'DESCONHECIDA',
          status_anvisa: avaliacaoResult.anvisa?.status === 'REGULAR' ? 'REGULAR' : 'PENDENTE',
          email: undefined,
          telefone: r.telefone,
          tipo_anvisa: tipoAnvisa,
          user_id: userId,
          score_qualidade: calcularScore(
            avaliacaoResult.anvisa?.status === 'REGULAR' ? 'REGULAR' : 'PENDENTE',
            avaliacaoResult.receita_federal?.situacao_cadastral || 'DESCONHECIDA',
            r.data_abertura
          ),
        }),
      });

      if (res.ok) {
        setAvaliacaoResult(prev => prev ? { ...prev, salvo_no_banco: true } : prev);
        await carregarFornecedores();
      } else {
        const err = await res.json();
        setAvaliacaoError(`Erro ao salvar: ${err.error || res.statusText}`);
      }
    } catch {
      setAvaliacaoError('Erro ao salvar no sistema.');
    } finally {
      setSalvandoNoBanco(false);
    }
  };

  const handleBuscaChange = (value: string) => {
    setBuscaInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBusca(value), 400);
  };

  const statusColor = (status: string) => {
    if (status === 'ATIVA' || status === 'REGULAR') return 'text-green-600 dark:text-green-400';
    if (status === 'NAO_ENCONTRADA') return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="p-8 space-y-8">

      {/* ── NOVA SEIÇÃO: Avaliar Novo Fornecedor ──────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 shadow-xl border border-blue-500/30">
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Avaliar Novo Fornecedor</h2>
          </div>
          <p className="text-blue-100 text-sm mb-5 ml-1">
            Digite o CNPJ para consultar dados reais da Receita Federal e ANVISA instantaneamente.
          </p>

          {/* Toggle Tipo ANVISA — exibe apenas o(s) tipo(s) cadastrado(s) pela empresa */}
          <div className="flex gap-2 mb-4">
            <p className="text-blue-100 text-sm font-medium self-center mr-1">Tipo de produto:</p>
            {(profileLoaded && userTipoAnvisa !== 'ambos'
              ? [userTipoAnvisa]
              : (['cosmetico', 'medicamento', 'ambos'] as const)
            ).map(tipo => (
              <button
                key={tipo}
                onClick={() => setTipoAnvisa(tipo)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold border transition ${
                  tipoAnvisa === tipo
                    ? 'bg-white text-blue-700 border-white shadow-md'
                    : 'bg-white/10 text-blue-100 border-white/20 hover:bg-white/20'
                }`}
              >
                {tipo === 'cosmetico' ? '💄 Cosméticos' : tipo === 'medicamento' ? '💊 Medicamentos' : '🔍 Ambos'}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-300" />
              <input
                type="text"
                placeholder="00.000.000/0001-00"
                value={novoCnpj}
                onChange={e => setNovoCnpj(formatCnpjInput(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && !avaliando && avaliarNovoCnpj()}
                className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-white/40 font-mono text-sm"
              />
            </div>
            <button
              onClick={avaliarNovoCnpj}
              disabled={avaliando || novoCnpj.replace(/\D/g, '').length < 14}
              className="px-6 py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {avaliando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Consultando...</>
                : <><Search className="h-4 w-4" /> Avaliar Agora</>
              }
            </button>
          </div>

          {avaliacaoError && (
            <div className="mt-3 flex items-center gap-2 text-red-200 text-sm bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {avaliacaoError}
            </div>
          )}
        </div>
      </div>

      {/* ── RESULTADO DA AVALIAÇÃO ──────────────────────────────────────────── */}
      {avaliacaoResult && mostrarResultado && (
        <div ref={resultRef} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden animate-in slide-in-from-top-4 duration-300">
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  {avaliacaoResult.receita_federal?.nome_fantasia || avaliacaoResult.receita_federal?.razao_social || formatarCNPJ(avaliacaoResult.cnpj)}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  CNPJ: {formatarCNPJ(avaliacaoResult.cnpj)} · Consultado às {new Date(avaliacaoResult.consultado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <button
              onClick={() => setMostrarResultado(v => !v)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 grid md:grid-cols-3 gap-6">
            {/* Receita Federal */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Receita Federal</p>
              <div className={`flex items-center gap-2 ${statusColor(avaliacaoResult.receita_federal?.situacao_cadastral || '')}`}>
                <StatusIcon s={avaliacaoResult.receita_federal?.situacao_cadastral || ''} />
                <span className="font-bold text-lg">{avaliacaoResult.receita_federal?.situacao_cadastral || '—'}</span>
              </div>
              {avaliacaoResult.receita_federal && (
                <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <p><span className="font-medium">Razão Social:</span> {avaliacaoResult.receita_federal.razao_social}</p>
                  <p><span className="font-medium">CNAE:</span> {avaliacaoResult.receita_federal.cnae_principal}</p>
                  <p><span className="font-medium">Porte:</span> {avaliacaoResult.receita_federal.porte}</p>
                  <p><span className="font-medium">Endereço:</span> {avaliacaoResult.receita_federal.endereco}, {avaliacaoResult.receita_federal.cidade}/{avaliacaoResult.receita_federal.estado}</p>
                  <p><span className="font-medium">Abertura:</span> {avaliacaoResult.receita_federal.data_abertura}</p>
                  {avaliacaoResult.receita_federal.telefone && (
                    <p><span className="font-medium">Tel:</span> {avaliacaoResult.receita_federal.telefone}</p>
                  )}
                </div>
              )}
            </div>

            {/* ANVISA */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ANVISA</p>
              <div className={`flex items-center gap-2 ${statusColor(avaliacaoResult.anvisa?.status || '')}`}>
                <StatusIcon s={avaliacaoResult.anvisa?.status || ''} />
                <span className="font-bold text-lg">
                  {avaliacaoResult.anvisa?.status === 'REGULAR' ? 'REGULAR'
                   : avaliacaoResult.anvisa?.status === 'NAO_ENCONTRADA' ? 'Não Cadastrada'
                   : avaliacaoResult.anvisa?.status}
                </span>
              </div>
              <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <p>{avaliacaoResult.anvisa?.descricao}</p>
                <p className="text-xs text-slate-400 italic">Fonte: {avaliacaoResult.anvisa?.fonte}</p>
              </div>

              {/* Sócios */}
              {avaliacaoResult.receita_federal?.socios && avaliacaoResult.receita_federal.socios.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Quadro Societário</p>
                  <div className="space-y-1">
                    {avaliacaoResult.receita_federal.socios.slice(0, 3).map((s, i) => (
                      <p key={i} className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-medium">{s.nome}</span>
                        <span className="text-slate-400"> · {s.qualificacao}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="space-y-4 flex flex-col">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ações</p>

              {avaliacaoResult.salvo_no_banco ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg p-3 text-sm font-medium">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  Fornecedor salvo no sistema!
                </div>
              ) : (
                <button
                  onClick={salvarNoSistema}
                  disabled={salvandoNoBanco || !avaliacaoResult.receita_federal}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {salvandoNoBanco
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                    : <><Plus className="h-4 w-4" /> Adicionar ao Sistema</>
                  }
                </button>
              )}

              {avaliacaoResult.salvo_no_banco && (
                <Link
                  href={`/dashboard/fornecedor/${avaliacaoResult.cnpj}?tipo=${tipoAnvisa}`}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm active:scale-95 flex items-center justify-center gap-2 text-center"
                >
                  Ver Dossiê Completo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              <button
                onClick={() => {
                  setNovoCnpj('');
                  setAvaliacaoResult(null);
                  setMostrarResultado(false);
                }}
                className="w-full py-2.5 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Nova Consulta
              </button>

              {avaliacaoResult.erros?.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                  <p className="text-xs text-amber-700 dark:text-amber-300">{avaliacaoResult.erros[0]}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SEÇÃO PRINCIPAL: Fornecedores + Feed DOU ──────────────────────── */}
      <div className="grid lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Fornecedores Cadastrados</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Encontre e homologue fornecedores de cosméticos com dados atualizados de compliance
          </p>
        </div>

        {/* Filters Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 mb-6 border border-slate-200 dark:border-slate-800">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Busca */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nome ou CNPJ..."
                  value={buscaInput}
                  onChange={(e) => handleBuscaChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Filtro Estado */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Estado
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="todos">Todos os Estados</option>
                  <option value="SP">São Paulo</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="PR">Paraná</option>
                  <option value="SC">Santa Catarina</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="BA">Bahia</option>
                </select>
              </div>
            </div>

            {/* Filtro Status Anvisa */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Status Anvisa
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <select
                  value={statusAnvisaFiltro}
                  onChange={(e) => setStatusAnvisaFiltro(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="REGULAR">Regular</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="SUSPENSA">Suspensa</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {loading ? (
              'Carregando...'
            ) : (
              <>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {fornecedores.length}
                </span>{' '}
                {fornecedores.length === 1 ? 'fornecedor encontrado' : 'fornecedores encontrados'}
              </>
            )}
          </p>
        </div>

        {/* Table */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Fornecedor
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Localidade
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Anvisa
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Receita Federal
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Tempo de Mercado
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {fornecedores.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        Nenhum fornecedor encontrado com os filtros selecionados.{' '}
                        <button
                          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Avaliar um novo CNPJ?
                        </button>
                      </td>
                    </tr>
                  ) : (
                    fornecedores.map((fornecedor) => (
                      <tr
                        key={fornecedor.id || fornecedor.$id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800 transition border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        {/* Fornecedor */}
                        <td className="px-6 py-4">
                          <Link
                            href={`/dashboard/fornecedor/${fornecedor.cnpj.replace(/\D/g, '')}?tipo=${fornecedor.tipo_anvisa || 'ambos'}`}
                            className="group"
                          >
                            <p className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                              {fornecedor.nome_fantasia || fornecedor.razao_social}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-300">
                              {formatarCNPJ(fornecedor.cnpj)}
                            </p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[9px] uppercase font-bold">
                              {fornecedor.tipo_anvisa === 'cosmetico' ? '💄 Cosmético' : 
                               fornecedor.tipo_anvisa === 'medicamento' ? '💊 Medicamento' : '🔍 Ambos'}
                            </span>
                          </Link>
                        </td>

                        {/* Localidade */}
                        <td className="px-6 py-4">
                          <p className="text-slate-900 dark:text-slate-300">
                            {fornecedor.cidade}, {fornecedor.estado}
                          </p>
                        </td>

                        {/* Status Anvisa */}
                        <td className="px-6 py-4">
                          <Badge status={fornecedor.status_anvisa} />
                        </td>

                        {/* Status Receita Federal */}
                        <td className="px-6 py-4">
                          <Badge status={fornecedor.situacao_receita} />
                        </td>

                        {/* Tempo de Mercado */}
                        <td className="px-6 py-4">
                          <p className="text-slate-600 dark:text-slate-200 font-medium">
                            {calcularTempoMercado(fornecedor.data_abertura)}
                          </p>
                        </td>

                        {/* Score */}
                        <td className="px-6 py-4">
                          {fornecedor.score_qualidade !== null ? (
                            <span
                              className={`text-lg font-bold ${getScoreColor(
                                fornecedor.score_qualidade
                              )}`}
                            >
                              {fornecedor.score_qualidade.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/dashboard/fornecedor/${fornecedor.cnpj.replace(/\D/g, '')}?tipo=${fornecedor.tipo_anvisa || 'ambos'}`}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-sm"
                          >
                            Ver Dossiê
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
        </div>

        {/* ── SIDEBAR: Feed Regulatório ───────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            <DOUFeed />
            <IrregularesFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
