'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertOctagon, Search, Filter, ArrowLeft, RefreshCw, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface Irregular {
  id: number;
  seq_dossie: string;
  nu_processo: string;
  tipo_produto: string;
  nivel_risco: string;
  empresa_investigada: string;
  cnpj_investigada: string;
  produto: string;
  produtos: string;
  acao: string;
  atividade: string;
  acao_atividade: string;
  registro: string;
  dt_publicacao: string;
  razao_social: string;
  cnpj_fabricante: string;
}

function riscoBg(nivel: string) {
  if (!nivel) return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  if (nivel.includes('III')) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40';
  if (nivel.includes('II'))  return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/40';
  return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40';
}

function acaoBg(acao: string) {
  const a = (acao || '').toLowerCase();
  if (a.includes('proibição') || a.includes('proibicao')) return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40';
  if (a.includes('suspensão') || a.includes('suspensao')) return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/40';
  if (a.includes('apreensão') || a.includes('apreensao')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/40';
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

const PAGE_SIZE = 20;

export default function IrregularesPage() {
  const { tipoAnvisa, profileLoaded } = useUserProfile();
  const [items, setItems] = useState<Irregular[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterAcao, setFilterAcao] = useState('');
  const [filterRisco, setFilterRisco] = useState('');
  const [offset, setOffset] = useState(0);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const fetchItems = useCallback(async (reset = false) => {
    if (!profileLoaded) return;
    reset ? setLoading(true) : setLoadingMore(true);
    const currentOffset = reset ? 0 : offset;

    const params = new URLSearchParams({
      tipo: tipoAnvisa,
      limit: String(PAGE_SIZE),
      offset: String(currentOffset),
    });
    if (search) params.set('search', search);

    const res = await fetch(`/api/anvisa/irregulares?${params}`);
    if (res.ok) {
      const d = await res.json();
      if (reset) {
        setItems(d.irregulares || []);
        setOffset(PAGE_SIZE);
        if (d.ultima_atualizacao) setUltimaAtualizacao(d.ultima_atualizacao);
      } else {
        setItems(prev => [...prev, ...(d.irregulares || [])]);
        setOffset(prev => prev + PAGE_SIZE);
      }
      setTotal(d.total || 0);
    }
    setLastFetchTime(new Date());
    reset ? setLoading(false) : setLoadingMore(false);
  }, [profileLoaded, tipoAnvisa, search, offset]);

  useEffect(() => {
    if (profileLoaded) fetchItems(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded, tipoAnvisa, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncStatus('Buscando atualizações na base...');
    
    // Agora o botão apenas puxa os dados fresquinhos recém injetados pelo seu terminal!
    await fetchItems(true);
    
    setTimeout(() => {
        setSyncStatus('Dados recarregados na tela com sucesso!');
        setRefreshing(false);
        setTimeout(() => setSyncStatus(null), 4000);
    }, 600);
  };

  const labelTipo = tipoAnvisa === 'cosmetico' ? 'Cosméticos' : tipoAnvisa === 'medicamento' ? 'Medicamentos' : 'Cosméticos e Medicamentos';

  const filtered = useMemo(() => items.filter(item => {
    if (filterAcao && !item.acao?.toLowerCase().includes(filterAcao.toLowerCase())) return false;
    if (filterRisco && item.nivel_risco !== filterRisco) return false;
    return true;
  }), [items, filterAcao, filterRisco]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Vigilância Sanitária</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertOctagon className="h-6 w-6 text-red-500" />
              Produtos Irregulares ANVISA
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Medidas sanitárias — {labelTipo}
              {total > 0 && <span className="ml-2 font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString('pt-BR')} registros</span>}
              {ultimaAtualizacao && (
                <span className="ml-3 text-slate-400">
                  · Última publicação ANVISA:{' '}
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {(() => {
                      const d = new Date(ultimaAtualizacao);
                      return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
                    })()}
                  </span>
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-red-400 hover:text-red-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Sincronizando...' : 'Atualizar Dados'}
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">
               {syncStatus ? syncStatus : lastFetchTime ? `Sincronizado às ${lastFetchTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit'})}` : ''}
            </span>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-6 flex flex-wrap gap-3 items-end">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Buscar produto ou empresa..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-white"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">
              Buscar
            </button>
          </form>

          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={filterAcao}
                onChange={e => setFilterAcao(e.target.value)}
                className="pl-7 pr-6 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white appearance-none"
              >
                <option value="">Todas as ações</option>
                <option value="Proibição">Proibição</option>
                <option value="Suspensão">Suspensão</option>
                <option value="Apreensão">Apreensão</option>
                <option value="Recolhimento">Recolhimento</option>
                <option value="Inutilização">Inutilização</option>
                <option value="Interdição">Interdição</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filterRisco}
                onChange={e => setFilterRisco(e.target.value)}
                className="pl-3 pr-6 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white appearance-none"
              >
                <option value="">Todos os riscos</option>
                <option value="Risco I">Risco I</option>
                <option value="Risco II">Risco II</option>
                <option value="Risco III">Risco III</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <AlertOctagon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum produto irregular encontrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const nomeProduto = item.produto || item.produtos?.split('.')[0]?.trim() || '—';
              const dt = item.dt_publicacao
                ? (() => {
                    const d = new Date(item.dt_publicacao);
                    return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
                  })()
                : '';
              const isCosm = item.tipo_produto === 'Cosmético';

              return (
                <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-red-300 dark:hover:border-red-800 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isCosm
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/40'
                            : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40'
                        }`}>
                          {item.tipo_produto}
                        </span>
                        {item.acao && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${acaoBg(item.acao)}`}>
                            {item.acao}
                          </span>
                        )}
                        {item.nivel_risco && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${riscoBg(item.nivel_risco)}`}>
                            {item.nivel_risco}
                          </span>
                        )}
                        {dt && <span className="text-[11px] text-slate-400 ml-auto">{dt}</span>}
                      </div>

                      {/* Produto */}
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug mb-1">
                        {nomeProduto}
                      </h3>

                      {/* Empresa investigada */}
                      {(item.empresa_investigada || item.cnpj_investigada) && (
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Investigada</span>
                          {item.empresa_investigada && (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.empresa_investigada}</span>
                          )}
                          {item.cnpj_investigada && item.cnpj_investigada !== '00000000000000' && (
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">
                              {item.cnpj_investigada.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Fabricante (quando diferente da empresa investigada) */}
                      {item.razao_social && item.razao_social !== item.empresa_investigada && (
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fabricante</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{item.razao_social}</span>
                          {item.cnpj_fabricante && item.cnpj_fabricante !== '00000000000000' && item.cnpj_fabricante !== item.cnpj_investigada && (
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">
                              {item.cnpj_fabricante.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Produtos completos (se diferente do produto principal) */}
                      {item.produtos && item.produtos !== item.produto && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-snug">
                          {item.produtos}
                        </p>
                      )}

                      {/* Ação/Atividade */}
                      {item.acao_atividade && (
                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-1.5 line-clamp-2">
                          {item.acao_atividade}
                        </p>
                      )}
                    </div>

                    {/* Processo + Registro */}
                    <div className="flex flex-col gap-1 text-right shrink-0">
                      {item.nu_processo && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                          Proc.: {item.nu_processo}
                        </span>
                      )}
                      {item.registro && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                          Reg.: {item.registro}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Carregar mais */}
            {offset < total && (
              <div className="text-center pt-4">
                <button
                  onClick={() => fetchItems(false)}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Carregando...</span>
                  ) : (
                    `Carregar mais (${(total - offset).toLocaleString('pt-BR')} restantes)`
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
