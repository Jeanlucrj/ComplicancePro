'use client';

import { useState, useEffect } from 'react';
import { Shield, FileText, Activity, Layers, DownloadCloud, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AnvisaNorm {
  id: string;
  numero_norma: string;
  tipo: string;
  tema_principal: string;
  status: string;
  data_publicacao: string;
  link_datalegis?: string;
  resumo_ia_impacto?: string;
  ativos_afetados?: string[];
}

export default function ProductDossierPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<'geral' | 'compliance'>('geral');
  const [normativas, setNormativas] = useState<AnvisaNorm[]>([]);
  const [loading, setLoading] = useState(true);

  // Aqui mockariamos a classe ou o tema do produto pelo ID.
  // Vamos buscar RDCs que envolvam "Ácido Salicílico" ou normativas ativas como exemplo
  const productClasse = 'Filtros Solares'; 

  useEffect(() => {
    const fetchNorms = async () => {
      try {
        const { data, error: err } = await supabase
          .from('anvisa_norms')
          .select('*')
          .eq('tema_principal', productClasse)
          .order('data_publicacao', { ascending: false });

        if (err) throw err;
        setNormativas((data ?? []) as AnvisaNorm[]);
      } catch (error) {
        console.error('Erro ao buscar normativas:', error);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'compliance') {
      fetchNorms();
    }
  }, [activeTab]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Sérum Anti-acne B3 Premium <span className="text-sm font-medium px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full">ID: {params.id}</span>
          </h1>
          <p className="text-slate-500 mt-2 text-sm flex items-center gap-2">
             <Shield className="w-4 h-4 text-emerald-500" /> Ativo Grau II - ANVISA Regularizado
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900 shadow-sm transition">
          <DownloadCloud className="w-4 h-4" /> Baixar Relatório Técnico
        </button>
      </div>

      {/* Tabs */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 mb-8 overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800">
           <button 
             onClick={() => setActiveTab('geral')}
             className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'geral' ? 'bg-blue-50/50 dark:bg-slate-800/50 text-blue-700 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
           >
             <FileText className="w-4 h-4" />
             Informações Gerais
           </button>
           <button 
             onClick={() => setActiveTab('compliance')}
             className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'compliance' ? 'bg-blue-50/50 dark:bg-slate-800/50 text-blue-700 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
           >
             <Layers className="w-4 h-4" />
             Dossiê de Compliance
           </button>
        </div>

        <div className="p-6 md:p-8">
          {activeTab === 'geral' && (
            <div className="animate-in fade-in duration-300 grid md:grid-cols-2 gap-8">
               <div className="space-y-6">
                 <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Fórmula Base</h3>
                    <p className="text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg font-mono text-sm leading-relaxed border border-slate-100 dark:border-slate-700">
                      Aqua, Niacinamide, Salicylic Acid, Glycerin, Phenoxyethanol, Sodium Hyaluronate.
                    </p>
                 </div>
                 <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Fabricante</h3>
                    <p className="font-medium text-lg">Biocare Cosmeticos Ltda.</p>
                 </div>
               </div>
               <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center items-center text-center">
                  <Activity className="w-12 h-12 text-blue-500 mb-4 opacity-80" />
                  <h4 className="font-bold text-lg mb-2">Status do Lote</h4>
                  <p className="text-slate-500 text-sm">Validado sem intercorrências laboratoriais até nov de 2027.</p>
               </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="animate-in slide-in-from-right-4 duration-300">
               <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Legislações Pertinentes</h2>
                    <p className="text-sm text-slate-500">Normativas da ANVISA cruzadas com a composição ({productClasse}).</p>
                  </div>
                  <div className="text-xs px-3 py-1.5 bg-blue-100 text-blue-800 font-bold rounded-full">
                    Cruzamento de IA Inteligente Ativado
                  </div>
               </div>

               {loading ? (
                 <div className="flex animate-pulse space-x-4">
                    <div className="h-10 bg-slate-200 rounded w-full"></div>
                 </div>
               ) : normativas.length > 0 ? (
                 <div className="space-y-4">
                   {normativas.map((norm) => (
                     <div key={norm.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-300 transition-colors bg-white dark:bg-slate-900">
                       <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 mb-3">
                         <div className="flex items-center gap-3">
                           <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded shadow-sm ${norm.status === 'Revogada' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                             {norm.status}
                           </span>
                           <h3 className="font-bold text-slate-800 dark:text-slate-200">{norm.numero_norma}</h3>
                         </div>
                         <time className="text-xs text-slate-400 font-medium">Publicado em: {new Date(norm.data_publicacao).toLocaleDateString()}</time>
                       </div>
                       
                       <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                         {norm.resumo_ia_impacto || "Resumo em processamento..."}
                       </p>

                       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                         <div className="flex flex-wrap gap-2">
                           {norm.ativos_afetados?.map((ativo, idx) => (
                             <span key={idx} className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                               {ativo}
                             </span>
                           ))}
                         </div>
                         {norm.link_datalegis && (
                           <a href={norm.link_datalegis} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline">
                             Ler na Integra →
                           </a>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <AlertTriangle className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Sem ocorrências diretas</h3>
                    <p className="text-sm text-slate-500 max-w-sm">Nenhuma normativa ou RDC recente impacta a formulação ativa deste produto.</p>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
