'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Zap, 
  Building2, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
  Loader2,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DOUEntry } from '@/lib/types';

export default function InteligenciaDetalhePage() {
  const params = useParams();
  const id = params.id as string;
  const [entry, setEntry] = useState<DOUEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEntry() {
      try {
        const { data, error } = await supabase.from('dou_feed').select('*').eq('id', id).single();
        if (error) throw error;
        setEntry(data as unknown as DOUEntry);
      } catch (error) {
        console.error('Erro ao buscar detalhe do registro:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchEntry();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Carregando dossiê regulatório...</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="p-8 text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Registro não encontrado</h3>
        <p className="text-slate-500 mb-6">O registro solicitado não existe ou foi removido.</p>
        <Link href="/dashboard/inteligencia" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 transition">
          Voltar para Inteligência
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── BREADCRUMBS & ACTIONS ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link 
          href="/dashboard/inteligencia"
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Inteligência
        </Link>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-200/50 dark:border-green-800/50">
            {entry.tipo_evento}
          </span>
        </div>
      </div>

      {/* ── MAIN HEADER CARD ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl shadow-blue-500/5 border border-slate-200 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8">
           <Zap className="h-24 w-24 text-blue-500/5 rotate-12" />
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              {entry.produto}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              {entry.empresa}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Número de Registro</p>
              <p className="text-lg font-mono font-bold text-slate-900 dark:text-white">{entry.numero_registro || 'N/A'}</p>
            </div>
            {entry.technical_info && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informação Técnica</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{entry.technical_info}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Publicação DOU</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-400" />
                {new Date(entry.timestamp).toLocaleDateString('pt-BR')}
              </p>
              {(entry.edicao || entry.secao || entry.pagina) && (
                <p className="text-[11px] text-slate-400 font-mono mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {entry.edicao && <span>Edição: <strong className="text-slate-600 dark:text-slate-300">{entry.edicao}</strong></span>}
                  {entry.secao  && <span>Seção: <strong className="text-slate-600 dark:text-slate-300">{entry.secao}</strong></span>}
                  {entry.pagina && <span>Página: <strong className="text-slate-600 dark:text-slate-300">{entry.pagina}</strong></span>}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Categoria</p>
              <div className="pt-1">
                 <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold ring-1 ring-blue-500/20">
                   {entry.categoria}
                 </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── LEFT COLUMN: DETAILS ───────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Business Insight Section */}
          <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-500/20">
            <div className="flex items-center gap-2 mb-4 text-blue-100 text-[10px] font-black uppercase tracking-[0.2em]">
              <Zap className="h-4 w-4" />
              Análise de Impacto de Negócios
            </div>
            <blockquote className="text-xl font-medium leading-relaxed italic">
              "{entry.impacto_negocios}"
            </blockquote>
          </section>

          {/* Detailed Specs */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Especificações Técnicas
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                   <p className="text-xs font-bold text-slate-400 uppercase mb-1">Dossiê ID</p>
                   <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{entry.dossie_id || 'RE-PENDENTE'}</p>
                </div>
                <div>
                   <p className="text-xs font-bold text-slate-400 uppercase mb-1">Origem do Dado</p>
                   <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                     <ExternalLink className="h-4 w-4 text-blue-500" />
                     Imprensa Nacional (DOU)
                   </p>
                </div>
              </div>

              <div className="space-y-3">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Composição & Ativos Declarados</p>
                 <div className="flex flex-wrap gap-2">
                   {entry.ativos.map((ativo, idx) => (
                     <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                       <ShieldCheck className="h-4 w-4 text-green-500" />
                       <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{ativo}</span>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── RIGHT COLUMN: SUPPLIER PREVIEW ─────────────────────────── */}
        <div className="space-y-6">
           <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-500" />
                Detentora
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Razão Social / CNPJ</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                    {entry.empresa}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer">
                  Ver portfólio completo da detentora
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2 text-sm italic">
                Aviso Legal
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed italic">
                Os dados acima foram extraídos via processamento de linguagem natural do Diário Oficial da União Seção 1. O dossiê estruturado é uma ferramenta de apoio à decisão e não substitui a consulta direta ao site da ANVISA.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
