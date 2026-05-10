'use client';

import { useState, useEffect } from 'react';
import { AlertOctagon, ShieldAlert, ArrowRight, Ban, Package, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface Irregular {
  id: number;
  seq_dossie: string;
  tipo_produto: string;
  nivel_risco: string;
  empresa_investigada: string;
  cnpj_investigada: string;
  razao_social: string;
  cnpj_fabricante: string;
  produto: string;
  produtos: string;
  acao: string;
  dt_publicacao: string;
}

function riscoBadge(nivel: string) {
  if (!nivel) return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  if (nivel.includes('III')) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40';
  if (nivel.includes('II'))  return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/40';
  return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40';
}

function acaoIcon(acao: string) {
  if (!acao) return <Package className="h-3.5 w-3.5" />;
  const a = acao.toLowerCase();
  if (a.includes('proibição') || a.includes('proibicao')) return <Ban className="h-3.5 w-3.5" />;
  if (a.includes('suspensão') || a.includes('suspensao')) return <ShieldAlert className="h-3.5 w-3.5" />;
  return <AlertOctagon className="h-3.5 w-3.5" />;
}

export default function IrregularesFeed() {
  const { tipoAnvisa, profileLoaded } = useUserProfile();
  const [items, setItems] = useState<Irregular[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileLoaded) return;

    async function load() {
      try {
        const res = await fetch(`/api/anvisa/irregulares?tipo=${tipoAnvisa}&limit=8`);
        if (res.ok) {
          const d = await res.json();
          setItems(d.irregulares || []);
        }
      } catch (e) {
        console.error('[IrregularesFeed] Erro ao carregar:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profileLoaded, tipoAnvisa]);

  const labelTipo = tipoAnvisa === 'cosmetico' ? 'Cosméticos' : tipoAnvisa === 'medicamento' ? 'Medicamentos' : 'Produtos';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-red-500" />
          <span className="text-sm font-bold text-slate-800 dark:text-white">Produtos Irregulares</span>
        </div>
        <Link
          href="/dashboard/irregulares"
          className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
        >
          VER TUDO <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="px-4 pt-2 pb-1 text-[11px] text-slate-500 dark:text-slate-400">
        Medidas sanitárias ANVISA — {labelTipo}
      </p>

      {/* Content */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {loading && (
          <div className="flex items-center gap-2 px-4 py-6">
            <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
            <span className="text-xs text-slate-400">Carregando...</span>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-slate-400">
            Nenhuma irregularidade encontrada.
          </div>
        )}

        {items.map((item) => {
          const nomeProduto = item.produto || item.produtos?.split('.')[0] || '—';
          const dt = item.dt_publicacao ? new Date(item.dt_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
          const isCosm = item.tipo_produto === 'Cosmético';

          return (
            <div key={item.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              {/* badges + data */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isCosm
                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/40'
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40'
                }`}>
                  {acaoIcon(item.acao)}
                  {item.acao || item.tipo_produto}
                </span>
                {item.nivel_risco && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${riscoBadge(item.nivel_risco)}`}>
                    {item.nivel_risco}
                  </span>
                )}
                {dt && <span className="ml-auto text-[10px] text-slate-400">{dt}</span>}
              </div>

              {/* produto */}
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug mb-0.5">
                {nomeProduto}
              </p>

              {/* empresa investigada + CNPJ */}
              {(item.empresa_investigada || item.cnpj_investigada) && (
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {item.empresa_investigada && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.empresa_investigada}
                    </p>
                  )}
                  {item.cnpj_investigada && item.cnpj_investigada !== '00000000000000' && (
                    <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-400 shrink-0">
                      {item.cnpj_investigada.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                    </span>
                  )}
                </div>
              )}
              {/* fabricante quando diferente */}
              {item.razao_social && item.razao_social !== item.empresa_investigada && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  Fab.: {item.razao_social}
                  {item.cnpj_fabricante && item.cnpj_fabricante !== '00000000000000' && item.cnpj_fabricante !== item.cnpj_investigada && (
                    <span className="ml-1 font-mono">{item.cnpj_fabricante.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/dashboard/irregulares"
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Ver todos os produtos irregulares →
          </Link>
        </div>
      )}
    </div>
  );
}
