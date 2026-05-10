'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Eye, Clock, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Fornecedor } from '@/lib/types';
import { formatarCNPJ } from '@/utils/formatters';

export default function MateriaisPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserId(session.user.id);
        }
      } catch (e) {
        console.error('Erro ao recuperar usuário:', e);
      }
    }
    getUser();
  }, []);

  useEffect(() => {
    if (userId) carregarFornecedores();
  }, [userId]);

  const carregarFornecedores = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/fornecedores?userId=${userId}`);
      const data = await response.json();
      setFornecedores(data.fornecedores || []);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
    } finally {
      setLoading(false);
    }
  };

  const fornecedoresFiltrados = fornecedores.filter(f => 
    f.razao_social.toLowerCase().includes(busca.toLowerCase()) ||
    (f.nome_fantasia && f.nome_fantasia.toLowerCase().includes(busca.toLowerCase())) ||
    f.cnpj.includes(busca.replace(/\D/g, ''))
  );

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Fornecedores Analisados</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Dossiês técnicos e certificados de conformidade salvos
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar materiais..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Recuperando dossiês e documentos...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {fornecedoresFiltrados.length > 0 ? (
            fornecedoresFiltrados.map((f) => (
              <div 
                key={f.id || f.$id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:shadow-xl transition-all group"
              >
                <div className="flex items-center space-x-5">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition">
                    <FileText className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                      Dossiê Técnico - {f.nome_fantasia || f.razao_social}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                      PDF • Atualizado em {new Date(f.$updatedAt || Date.now()).toLocaleDateString('pt-BR')} • {formatarCNPJ(f.cnpj)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Link
                    href={`/dashboard/fornecedor/${f.cnpj.replace(/\D/g, '')}?tipo=${f.tipo_anvisa || 'ambos'}`}
                    className="p-2.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title="Visualizar Dossiê"
                  >
                    <Eye className="h-6 w-6" />
                  </Link>
                  <Link
                    href={`/dashboard/fornecedor/${f.cnpj.replace(/\D/g, '')}?tipo=${f.tipo_anvisa || 'ambos'}&print=true`}
                    className="p-2.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title="Baixar PDF"
                  >
                    <Download className="h-6 w-6" />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 rounded-3xl text-center">
              <Clock className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <h4 className="text-slate-900 dark:text-white font-bold mb-1">Nenhum dossiê salvo</h4>
              <p className="text-slate-500 dark:text-slate-500 text-sm max-w-sm mx-auto">
                Homologue novos fornecedores na busca para gerar e salvar dossiês técnicos automaticamente aqui.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

