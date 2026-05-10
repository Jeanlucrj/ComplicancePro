'use client';

import { useState, useEffect } from 'react';
import {
  Zap,
  Search,
  Filter,
  Calendar,
  Building2,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Info,
  RefreshCw,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { DOUEntry } from '@/lib/types';
import { useUserProfile } from '@/contexts/UserProfileContext';

export default function InteligenciaPage() {
  const { tipoAnvisa: userTipoAnvisa, profileLoaded } = useUserProfile();
  const [entries, setEntries] = useState<DOUEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState<string>('todos');
  const [total, setTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const sectorLocked = userTipoAnvisa === 'cosmetico' || userTipoAnvisa === 'medicamento';

  // Inicializa categoria quando o perfil é carregado
  useEffect(() => {
    if (!profileLoaded) return;
    if (userTipoAnvisa === 'cosmetico') setCategoria('Cosmético');
    else if (userTipoAnvisa === 'medicamento') setCategoria('Medicamento');
    else setCategoria('todos');
  }, [profileLoaded, userTipoAnvisa]);

  // Busca dados do banco quando perfil ou filtros mudam
  useEffect(() => {
    if (!profileLoaded) return;
    fetchEntries();
  }, [search, categoria, profileLoaded]);

  // fetchLastSynced só no mount — o dado muda raramente, não precisa re-buscar a cada pesquisa
  useEffect(() => {
    fetchLastSynced();
  }, []);

  const fetchLastSynced = async () => {
    try {
      const res = await fetch('/api/dou/sync');
      if (res.ok) {
        const data = await res.json();
        setLastSynced(data.ultima_sync || data.ultima_sincronizacao || null);
      }
    } catch {
      // silencioso
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);

    try {
      // Determina segmento do usuário para o sync
      const seg = userTipoAnvisa === 'cosmetico' ? 'cosmetico'
                : userTipoAnvisa === 'medicamento' ? 'medicamento'
                : 'todos';

      // POST no sync — retorna INSTANTANEAMENTE (cron roda em background)
      const response = await fetch(`/api/dou/sync?segmento=${seg}`, {
        method: 'POST',
        headers: { 'x-internal-request': '1' },
      });
      
      const data = await response.json();
      console.log('[DOU Sync]', data);
      
      if (data.success) {
        setLastSynced(data.sincronizado_em || new Date().toISOString());
        setSyncMsg(`✓ ${data.registros_segmento} registros no banco. Buscando novos em segundo plano...`);
        
        // Recarrega dados do banco
        await fetchEntries();

        // Agenda um refresh 30s depois para pegar dados do cron que está rodando em background
        setTimeout(async () => {
          await fetchEntries();
          await fetchLastSynced();
          setSyncMsg(null);
        }, 30000);
      } else {
        setSyncMsg('❌ Erro ao sincronizar. Tente novamente.');
        setTimeout(() => setSyncMsg(null), 5000);
      }
    } catch (e) {
      console.error('Erro no sync:', e);
      setSyncMsg('❌ Falha na conexão com o servidor.');
      setTimeout(() => setSyncMsg(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      let dbq = supabase.from('dou_feed').select('*', { count: 'exact' });
      
      if (categoria !== 'todos') {
        if (categoria === 'Cosmético') {
          dbq = dbq.ilike('categoria', 'Cosmético%');
        } else if (categoria === 'Cosmético Grau 2') {
          dbq = dbq.eq('categoria', 'Cosmético Grau 2');
        } else if (categoria) {
          dbq = dbq.eq('categoria', categoria);
        }
      }

      if (search) {
        dbq = dbq.or(`produto.ilike.%${search}%,empresa.ilike.%${search}%`);
      }

      const { data, count, error } = await dbq.order('timestamp', { ascending: false }).limit(50);
      if (error) throw error;

      setEntries(data as unknown as DOUEntry[]);
      setTotal(count || 0);
    } catch (error) {
      console.error('Erro ao buscar inteligência DOU:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto min-h-screen">
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-xs">
            <Zap className="h-4 w-4 animate-pulse" />
            Market Intelligence
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Inteligência Regulatória DOU
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Acompanhe deferimentos da ANVISA em tempo real e identifique novos entrantes.
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Link>

          <div className="flex items-center gap-3">
            {lastSynced && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                Sincronizado {new Date(lastSynced).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-lg shadow-blue-500/20"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Atualizar agora'}
            </button>
          </div>

          {/* Resultado do sync */}
          {syncMsg && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold animate-in fade-in duration-300 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              {syncMsg}
            </div>
          )}
        </div>
      </div>

      {/* ── FILTERS BAR ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por produto, marca ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition text-slate-900 dark:text-white"
            />
          </div>

          {/* Categoria — travada pelo perfil do usuário */}
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            {sectorLocked ? (
              <div className="w-full pl-12 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-slate-900 dark:text-white font-medium flex items-center gap-2">
                {categoria === 'Cosmético' ? 'Cosméticos' : 'Medicamentos'}
                <span className="ml-auto text-[10px] uppercase tracking-widest font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">Seu segmento</span>
              </div>
            ) : (
              <select
                value={categoria || 'todos'}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full pl-12 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none transition text-slate-900 dark:text-white"
              >
                <option value="todos">Todas Categorias</option>
                <option value="Cosmético">Cosméticos</option>
                <option value="Cosmético Grau 2">Cosméticos Grau 2</option>
                <option value="Medicamento">Medicamentos</option>
              </select>
            )}
          </div>

          {/* Status/Count */}
          <div className="flex items-center justify-center md:justify-end gap-3 text-slate-500 dark:text-slate-400">
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm">
              {total} Registros
            </div>
          </div>
        </div>
      </div>

      {/* ── RESULTS GRID ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-500 font-medium tracking-wide">Sincronizando dados regulatórios...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <Info className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nenhum registro encontrado</h3>
          <p className="text-slate-500">Tente ajustar seus filtros ou busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8 duration-500">
          {entries.map((entry) => {
            const isSuspensao = entry.tipo_evento === 'SUSPENSÃO_DE_PRODUTO';
            const isCosmetico = entry.categoria?.startsWith('Cosmético');
            const isMedicamento = entry.categoria?.startsWith('Medicamento');
            const categoriaBg = isCosmetico
              ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200/50 dark:border-pink-800/30'
              : isMedicamento
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-800/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/30';
            const borderAccent = isSuspensao
              ? 'border-l-4 border-l-red-500'
              : isCosmetico
                ? 'border-l-4 border-l-pink-500'
                : isMedicamento
                  ? 'border-l-4 border-l-blue-500'
                  : 'border-l-4 border-l-slate-400';

            return (
            <div
              key={entry.id || entry.$id}
              className={`group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all p-6 relative overflow-hidden ${borderAccent}`}
            >
              {/* Header: badges + data */}
              <div className="flex items-start justify-between mb-4 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isSuspensao ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200/50' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200/50 dark:border-green-800/50'}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    {entry.tipo_evento.replace('_', ' ')}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${categoriaBg}`}>
                    {entry.categoria}
                  </span>
                  {entry.priority === 'alta' && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-red-500/20">
                      <Zap className="h-3 w-3" />
                      Urgente
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <Calendar className="h-3 w-3" />
                    {new Date(entry.timestamp).toLocaleDateString('pt-BR')}
                  </div>
                  {(entry.edicao || entry.pagina) && (
                    <span className="text-[9px] text-slate-400 font-mono">
                      {[entry.edicao && `Ed. ${entry.edicao}`, entry.secao && `S. ${entry.secao}`, entry.pagina && `p. ${entry.pagina}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Main Info */}
              <div className="space-y-4 mb-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 transition line-clamp-2">
                  {entry.produto}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  <div className="space-y-1">
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-tight">Detentora</p>
                    <div className="flex flex-col gap-1 items-start">
                      <p className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 line-clamp-1" title={entry.empresa && entry.empresa.includes('/') ? entry.empresa.split('/')[0].trim() : (entry.empresa || 'Desconhecida')}>
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {entry.empresa ? entry.empresa.split('/')[0].trim() : 'Desconhecida'}
                      </p>
                      {entry.empresa && entry.empresa.includes('/') && entry.empresa.split('/')[1].trim().length > 3 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-mono border border-slate-200 dark:border-slate-700">
                          {entry.empresa.split('/')[1].trim()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-tight">Registro ANVISA</p>
                    <p className="text-slate-700 dark:text-slate-300 font-mono text-xs">
                      {entry.numero_registro !== 'N/A' ? entry.numero_registro : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Insight Section */}
              <div className="bg-slate-50 dark:bg-blue-900/10 rounded-xl p-3.5 mb-5 border border-slate-200/60 dark:border-blue-800/20">
                <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1 tracking-widest">Insight</div>
                <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed line-clamp-2">
                  {entry.impacto_negocios}
                </p>
              </div>

              {/* Action */}
              <Link
                href={`/dashboard/inteligencia/${entry.id || entry.$id}`}
                className="w-full py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-600 dark:hover:bg-blue-500 hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Ver Dossiê
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
