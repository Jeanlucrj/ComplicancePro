'use client';

import { useState, useEffect, useRef } from 'react';
import { Rocket, CheckCircle2, Ban, Info, ArrowRight, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DOUEntry } from '@/lib/types';
import Link from 'next/link';
import { useUserProfile } from '@/contexts/UserProfileContext';

export default function DOUFeed() {
  const { tipoAnvisa, profileLoaded } = useUserProfile();
  const [entries, setEntries] = useState<DOUEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const sectorRef = useRef<string>(tipoAnvisa);

  useEffect(() => {
    sectorRef.current = tipoAnvisa;
  }, [tipoAnvisa]);

  useEffect(() => {
    if (!profileLoaded) return;

    let active = true;
    let unsubscribe: (() => void) | null = null;

    async function init() {
      try {
        // Carrega registros baseados no setor (sem re-buscar perfil — já vem do context)
        let dbq = supabase.from('dou_feed').select('*');
        if (sectorRef.current === 'cosmetico') {
          dbq = dbq.ilike('categoria', 'Cosmético%');
        } else if (sectorRef.current === 'medicamento') {
          dbq = dbq.ilike('categoria', 'Medicamento%');
        }

        const { data } = await dbq.order('timestamp', { ascending: false }).limit(10);
        if (active) setEntries((data as unknown as DOUEntry[]) || []);

        // 3. Inscrever para atualizações em tempo real (com pequeno delay)
        const subTimeout = setTimeout(() => {
          if (!active) return;
          try {
            const channel = supabase.channel('realtime:dou_feed')
              .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'dou_feed' },
                (payload) => {
                  const newDoc = payload.new as unknown as DOUEntry;
                  
                  setEntries((prev) => {
                    const currentSector = sectorRef.current;
                    const matches = !currentSector || currentSector === 'ambos' || 
                      (currentSector === 'cosmetico' && newDoc.categoria.startsWith('Cosmético')) ||
                      (currentSector === 'medicamento' && newDoc.categoria.startsWith('Medicamento'));

                    if (matches) return [newDoc, ...prev].slice(0, 10);
                    return prev;
                  });
                }
              ).subscribe();

            unsubscribe = () => supabase.removeChannel(channel);
          } catch (e) {
            console.warn('Supabase subscribe init erro:', e);
          }
        }, 1200);

        // Limpa o timeout para evitar vazamento
        (window as any).__douSubTimeout = subTimeout;

      } catch (error) {
        console.error('Erro ao carregar feed DOU:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    return () => {
      active = false;
      if ((window as any).__douSubTimeout) {
        clearTimeout((window as any).__douSubTimeout);
      }
      if (unsubscribe) {
        setTimeout(() => {
          try { if (unsubscribe) unsubscribe(); } catch(e) {}
        }, 500);
      }
    };
  }, [profileLoaded, tipoAnvisa]);

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
        Carregando Feed Regulatório...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Rocket className="h-5 w-5 text-blue-500" />
          Inteligência DOU
        </h3>
        <Link 
          href="/dashboard/inteligencia"
          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase"
        >
          Ver Tudo
        </Link>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {entries.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <Info className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Nenhuma atualização relevante hoje.</p>
          </div>
        ) : (
          entries.map((entry) => {
            const isSuspensao = entry.tipo_evento === 'SUSPENSÃO_DE_PRODUTO';
            const isCosmetico = entry.categoria?.startsWith('Cosmético');
            const isMedicamento = entry.categoria?.startsWith('Medicamento');
            const accentBorder = isSuspensao
              ? 'border-l-red-500'
              : isCosmetico
                ? 'border-l-pink-500'
                : isMedicamento
                  ? 'border-l-blue-500'
                  : 'border-l-slate-400';
            const categoriaPill = isCosmetico
              ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300'
              : isMedicamento
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500';

            return (
            <div
              key={entry.id || entry.$id}
              className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all border-l-4 ${accentBorder} animate-in fade-in slide-in-from-right-4 duration-500`}
            >
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isSuspensao ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {isSuspensao
                      ? <Ban className="h-3 w-3" />
                      : <CheckCircle2 className="h-3 w-3" />
                    }
                    {entry.tipo_evento.replace(/_/g, ' ')}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${categoriaPill}`}>
                    {entry.categoria}
                  </span>
                  {entry.priority === 'alta' && (
                    <span className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase rounded animate-pulse">
                      Urgente
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    {new Date(entry.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </div>
                  {(entry.edicao || entry.pagina) && (
                    <span className="text-[8px] text-slate-400 font-mono">
                      {[entry.edicao && `Ed.${entry.edicao}`, entry.secao && `S.${entry.secao}`, entry.pagina && `p.${entry.pagina}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug break-words">
                  {entry.produto}
                </h4>
                <div className="flex flex-col gap-0.5 items-start">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {entry.empresa ? entry.empresa.split('/')[0].trim() : 'Desconhecida'}
                  </p>
                  {entry.empresa && entry.empresa.includes('/') && entry.empresa.split('/')[1].trim().length > 3 && (
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono">
                      {entry.empresa.split('/')[1].trim()}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-2.5 mb-3">
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed italic line-clamp-2">
                  {entry.impacto_negocios}
                </p>
              </div>

              <Link
                href={`/dashboard/inteligencia/${entry.id || entry.$id}`}
                className="w-full py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-blue-600 hover:text-white transition flex items-center justify-center gap-2"
              >
                Ver Dossiê
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
