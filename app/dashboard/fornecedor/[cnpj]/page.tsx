'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Shield, MapPin, Globe, Phone, Mail, Award, CheckCircle2, AlertCircle, ShoppingCart, Truck, Calendar, Clock, Download, Share2, X, Building2, TrendingUp, Package, RefreshCw, CheckCheck, XCircle, AlertTriangle } from 'lucide-react';
import ScoreIACard from '@/components/ScoreIACard';
import Badge from '@/components/Badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { supabase } from '@/lib/supabase';
import { Fornecedor, Produto, Cotacao } from '@/lib/types';
import {
  formatarCNPJ,
  formatarData,
  formatarTelefone,
  formatarMoeda,
  calcularTempoMercado,
  getScoreColor,
  isVencida,
} from '@/utils/formatters';
import { calcularFreteEstimado, FreteEstimativa } from '@/utils/frete';

export default function FornecedorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cnpj = params.cnpj as string;
  const tipoUrl = searchParams.get('tipo') as 'cosmetico' | 'medicamento' | 'ambos' | null;

  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosPorCategoria, setProdutosPorCategoria] = useState<{
    [key: string]: Produto[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [frete, setFrete] = useState<FreteEstimativa | null>(null);
  const [cepUsuario, setCepUsuario] = useState('01310-100'); // CEP padrão (Av. Paulista)
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [sentQuotes, setSentQuotes] = useState<Cotacao[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<any>(null);
  const [loadingEnrichment, setLoadingEnrichment] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedSyncProducts, setSelectedSyncProducts] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [tipoAnvisaSync, setTipoAnvisaSync] = useState<'cosmetico' | 'medicamento' | 'ambos' | null>(tipoUrl || null);
  // Tipo do USUÁRIO LOGADO — nunca sobrescrito pelo tipo do fornecedor
  const [userTipoAnvisa, setUserTipoAnvisa] = useState<'cosmetico' | 'medicamento' | 'ambos' | null>(null);
  // Flag que indica quando o tipo do usuário já foi determinado (true = carregado, mesmo que null)
  const [userTipoLoaded, setUserTipoLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, title: '', message: '', type: 'success' });
  const [userId, setUserId] = useState<string | null>(null);
  const [riscoPendencias, setRiscoPendencias] = useState<any[] | null>(null);
  const [loadingRisco, setLoadingRisco] = useState(false);
  const [afeData, setAfeData] = useState<{ autorizacoes: any[]; resumo: any } | null>(null);
  const [loadingAfe, setLoadingAfe] = useState(false);
  // Guard: impede chamadas simultâneas a verificarDadosGov
  const govLoadingRef = useRef(false);

  // Recupera usuário logado e o tipo ANVISA do perfil cadastrado
  useEffect(() => {
    async function getUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const uid = session.user.id;

          // Tenta primeiro via user_metadata (caminho rápido)
          let perfilTipo = session.user.user_metadata?.tipo_anvisa as 'cosmetico' | 'medicamento' | 'ambos' | null;

          // Se não estiver no metadata, busca o perfil da empresa no banco (is_perfil=true)
          if (!perfilTipo) {
            try {
              const profileRes = await fetch(`/api/fornecedores?userId=${uid}&onlyPerfil=true`);
              if (profileRes.ok) {
                const profileData = await profileRes.json();
                if (profileData.fornecedores && profileData.fornecedores.length > 0) {
                  perfilTipo = profileData.fornecedores[0].tipo_anvisa as 'cosmetico' | 'medicamento' | 'ambos' | null;
                }
              }
            } catch (profileErr) {
              console.error('Erro ao buscar perfil:', profileErr);
            }
          }

          if (perfilTipo) {
            setUserTipoAnvisa(perfilTipo); // tipo do USUÁRIO — nunca sobrescrito pelo fornecedor
            if (!tipoUrl) setTipoAnvisaSync(perfilTipo);
          }

          // Seta userId POR ÚLTIMO — depois de ter o tipo do usuário determinado
          // Isso garante que quando o efeito do tipoUrl disparar, userTipoAnvisa já está correto
          setUserId(uid);
        }
      } catch (e) {
        console.error('Erro ao recuperar usuário:', e);
      } finally {
        setUserTipoLoaded(true); // sinaliza que a determinação do tipo está completa
      }
    }
    getUser();
  }, [tipoUrl]);

  // Carrega dados iniciais quando tem o userId
  useEffect(() => {
    if (userId) {
      carregarDados();
      carregarCotacoes();
    }
  }, [cnpj, userId]);

  // Carrega radar de risco e AFE/AE assim que tiver o CNPJ
  useEffect(() => {
    if (!cnpj) return;

    setLoadingRisco(true);
    fetch(`/api/anvisa/risco?cnpj=${cnpj}`)
      .then(r => r.json())
      .then(data => setRiscoPendencias(data.pendencias || []))
      .catch(() => setRiscoPendencias([]))
      .finally(() => setLoadingRisco(false));

    setLoadingAfe(true);
    fetch(`/api/anvisa/afe?cnpj=${cnpj}`)
      .then(r => r.json())
      .then(data => setAfeData({ autorizacoes: data.autorizacoes || [], resumo: data.resumo || {} }))
      .catch(() => setAfeData({ autorizacoes: [], resumo: {} }))
      .finally(() => setLoadingAfe(false));
  }, [cnpj]);

  // Se vier com tipo na URL, inicializa e busca
  // Aguarda userTipoLoaded=true para garantir que o tipo do usuário tem prioridade sobre o da URL
  useEffect(() => {
    if (!userId || !userTipoLoaded) return;
    // O tipo do USUÁRIO tem SEMPRE prioridade sobre o tipo do URL (que vem do fornecedor)
    const tipoEfetivo = userTipoAnvisa || tipoUrl;
    if (tipoEfetivo) {
      setTipoAnvisaSync(tipoEfetivo);
      const locked = tipoEfetivo === 'cosmetico' || tipoEfetivo === 'medicamento';
      verificarDadosGov(false, tipoEfetivo, false, locked);
    }
  }, [tipoUrl, cnpj, userId, userTipoLoaded]);

  // Efeito para acionar o Print automaticamente se solicitado (Meus Materiais)
  useEffect(() => {
    if (searchParams.get('print') === 'true' && !loading && fornecedor) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, loading, fornecedor]);

  const verificarDadosGov = async (salvar = false, tipoInput?: 'cosmetico' | 'medicamento' | 'ambos', force = false, noFallback = false) => {
    // Evita chamadas simultâneas — double-trigger no mount causava loading infinito
    if (govLoadingRef.current && !salvar && !force) return;
    govLoadingRef.current = true;
    setLoadingEnrichment(true);
    const tipo = tipoInput || tipoAnvisaSync || 'ambos';
    try {
      // 1. Dados institucionais com timeout de 20s
      const res = await fetch(
        `/api/enriquecer?cnpj=${cnpj}${salvar ? '&salvar=true' : ''}&tipo=${tipo}${force ? '&forceAPI=true' : ''}&userId=${userId || ''}`,
        { signal: AbortSignal.timeout(20000) }
      );
      const data = await res.json();

      // 2. Scrap On-Demand (Playwright) — sempre que force=true (botão Sincronizar) ou sem produtos
      if ((tipo === 'cosmetico' || tipo === 'ambos') && (force || !data.anvisa_produtos || data.anvisa_produtos.length === 0)) {
        try {
          const rpDb = await fetch(
            `/api/anvisa/scrap-on-demand?cnpj=${cnpj}`,
            { signal: AbortSignal.timeout(55000) }
          );
          const dataDb = await rpDb.json();
          if (dataDb.success && dataDb.anvisa_produtos?.length > 0) {
            const existingProds = data.anvisa_produtos || [];
            const merged = [...dataDb.anvisa_produtos];
            existingProds.forEach((p: any) => {
              if (!merged.find((m: any) => m.processo === p.processo)) merged.push(p);
            });
            data.anvisa_produtos = merged;
          }
        } catch (dbErr) {
          console.warn('Scrap On-demand timeout/erro (continuando sem ele):', dbErr);
        }
      }

      // 3. Fallback inteligente: tenta outro tipo se não achou nada
      if (!noFallback && (!data.anvisa_produtos || data.anvisa_produtos.length === 0) && (tipo === 'cosmetico' || tipo === 'medicamento')) {
        const outroTipo = tipo === 'cosmetico' ? 'medicamento' : 'cosmetico';
        try {
          const resRetry = await fetch(
            `/api/enriquecer?cnpj=${cnpj}${salvar ? '&salvar=true' : ''}&tipo=${outroTipo}&userId=${userId || ''}`,
            { signal: AbortSignal.timeout(20000) }
          );
          const dataRetry = await resRetry.json();
          if (dataRetry.anvisa_produtos?.length > 0) {
            setEnrichmentData(dataRetry);
            setTipoAnvisaSync(outroTipo);
            return;
          }
        } catch (retryErr) {
          console.warn('Retry fallback erro:', retryErr);
        }
      }

      setEnrichmentData(data);
      if (salvar) {
        await carregarDados();
      }
    } catch (e) {
      console.error('Erro ao verificar dados governamentais:', e);
      setEnrichmentData(null);
    } finally {
      govLoadingRef.current = false;
      setLoadingEnrichment(false);
    }
  };

  const carregarDados = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/fornecedores/${cnpj}?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Fornecedor não encontrado');
      }

      const data = await response.json();
      const fDoc = data.fornecedor;
      setFornecedor(fDoc);

      // Sincroniza apenas o tipo no estado — verificarDadosGov é chamada pelo useEffect dedicado
      if (!tipoUrl && fDoc?.tipo_anvisa) {
        setTipoAnvisaSync(fDoc.tipo_anvisa);
      }

      setProdutos(data.produtos || []);
      setProdutosPorCategoria(data.produtosPorCategoria || {});

      // Calcula frete automaticamente se houver CEP
      if (data.fornecedor.cep) {
        calcularFrete(data.fornecedor.cep, cepUsuario);
      }
    } catch (error) {
      console.error('Erro ao carregar fornecedor:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarCotacoes = async () => {
    if (!userId) return;
    setLoadingQuotes(true);
    try {
      const res = await fetch(`/api/cotacoes?cnpj=${cnpj}&userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSentQuotes(data.cotacoes || []);
      }
    } catch (error) {
      console.error('Erro ao carregar cotações:', error);
    } finally {
      setLoadingQuotes(false);
    }
  };

  const enviarCotacao = async (produtosSelecionados: { id: string; nome: string }[]) => {
    setSendingQuote(true);
    try {
      const res = await fetch('/api/cotacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj_fornecedor: cnpj,
          user_id: userId, // Integração com o usuário autenticado
          produtos: produtosSelecionados,
        }),
      });
      if (res.ok) {
        await carregarCotacoes();
        return true;
      }
    } catch (error) {
      console.error('Erro ao enviar cotação:', error);
    } finally {
      setSendingQuote(false);
    }
    return false;
  };

  const abrirSincronizacao = () => {
    setEnrichmentData(null);
    setIsSyncModalOpen(true);
    const tipoUsuario: 'cosmetico' | 'medicamento' | 'ambos' = (userTipoAnvisa && userTipoAnvisa !== 'ambos')
      ? userTipoAnvisa
      : (tipoAnvisaSync || 'ambos');
    const locked = tipoUsuario === 'cosmetico' || tipoUsuario === 'medicamento';
    // force=true garante que o scrap-on-demand é chamado mesmo se enrichmentData já estiver populado
    verificarDadosGov(false, tipoUsuario, true, locked);
  };

  const confirmarImportacao = async () => {
    if (selectedSyncProducts.length === 0) return;
    setImporting(true);
    try {
      const itemsParaImportar = (enrichmentData?.anvisa_produtos || [])
        .filter((p: any) => selectedSyncProducts.includes(p.processo));

      const res = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj_fornecedor: cnpj,
          produtos: itemsParaImportar,
          user_id: userId
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFeedback({
          show: true,
          title: 'Importação Concluída',
          message: data.message || 'Produtos importados com sucesso para o dossiê!',
          type: 'success'
        });
        setIsSyncModalOpen(false);
        setSelectedSyncProducts([]);
        await carregarDados(); // Recarrega o catálogo local
      } else {
        const errorData = await res.json();
        setFeedback({
          show: true,
          title: 'Erro na Importação',
          message: errorData.detail || errorData.error || 'Não foi possível completar a operação.',
          type: 'error'
        });
      }
    } catch (e: any) {
      console.error('Erro na importação:', e);
      setFeedback({
        show: true,
        title: 'Erro Técnico',
        message: `Falha na comunicação: ${e.message}`,
        type: 'error'
      });
    } finally {
      setImporting(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === produtos.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(produtos.map(p => p.$id).filter((id): id is string => !!id));
    }
  };

  const toggleProduct = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const calcularFrete = async (cepOrigem: string, cepDestino: string) => {
    setCalculandoFrete(true);
    try {
      const estimativa = await calcularFreteEstimado(cepDestino, cepOrigem);
      setFrete(estimativa);
    } catch (error) {
      console.error('Erro ao calcular frete:', error);
    } finally {
      setCalculandoFrete(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!fornecedor) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Fornecedor não encontrado
          </h2>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Voltar para busca
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <Link
        href="/dashboard"
        className="inline-flex items-center space-x-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 transition"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Voltar para busca</span>
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-8 mb-6 border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {fornecedor.nome_fantasia || fornecedor.razao_social}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-4">
              {fornecedor.razao_social !== fornecedor.nome_fantasia &&
                fornecedor.razao_social}
            </p>
            <p className="text-slate-500 dark:text-slate-400">{formatarCNPJ(fornecedor.cnpj)}</p>
          </div>
          <div className="text-right">
            {fornecedor.score_qualidade !== null && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Score de Qualidade</p>
                <p
                  className={`text-5xl font-bold ${getScoreColor(
                    fornecedor.score_qualidade
                  )}`}
                >
                  {fornecedor.score_qualidade.toFixed(1)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score IA */}
      {userId && (
        <ScoreIACard cnpj={cnpj} userId={userId} autoLoad={true} />
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Gerais */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
              <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span>Informações Gerais</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Localização</p>
                <p className="text-slate-900 dark:text-slate-300 flex items-start space-x-2">
                  <MapPin className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  <span>
                    {fornecedor.endereco || `${fornecedor.cidade}, ${fornecedor.estado}`}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Data de Abertura</p>
                <p className="text-slate-900 dark:text-slate-300 flex items-start space-x-2">
                  <Calendar className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  <span>
                    {formatarData(fornecedor.data_abertura)} (
                    {calcularTempoMercado(fornecedor.data_abertura)})
                  </span>
                </p>
              </div>
              {fornecedor.telefone && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Telefone</p>
                  <p className="text-slate-900 dark:text-slate-300 flex items-start space-x-2">
                    <Phone className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    <span>{formatarTelefone(fornecedor.telefone)}</span>
                  </p>
                </div>
              )}
              {fornecedor.email && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Email</p>
                  <p className="text-slate-900 dark:text-slate-300 flex items-start space-x-2">
                    <Mail className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    <span className="break-all">{fornecedor.email}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Compliance */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              <span>Compliance e Regularização</span>
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Status Anvisa</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Regularização junto à Agência Nacional de Vigilância Sanitária
                  </p>
                </div>
                <Badge status={fornecedor.status_anvisa} />
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    Situação Receita Federal
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Status cadastral junto à Receita Federal
                  </p>
                </div>
                <Badge status={fornecedor.situacao_receita} />
              </div>
            </div>
          </div>

          {/* Catálogo de Produtos */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <span>Catálogo de Produtos ({produtos.length})</span>
              </h2>
              <button
                onClick={abrirSincronizacao}
                className="text-xs flex items-center space-x-1 py-1.5 px-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition font-bold"
              >
                <RefreshCw className={`h-3 w-3 ${loadingEnrichment ? 'animate-spin' : ''}`} />
                <span>Sincronizar com ANVISA</span>
              </button>
            </div>

            {produtos.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                Nenhum produto cadastrado
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(produtosPorCategoria).map(
                  ([categoria, produtosCategoria]) => (
                    <div key={categoria}>
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-3 pb-2 border-b dark:border-slate-800">
                        {categoria} ({produtosCategoria.length})
                      </h3>
                      <div className="space-y-2">
                        {produtosCategoria.map((produto) => (
                          <div
                            key={produto.$id}
                            className="flex justify-between items-start p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {produto.nome_produto}
                              </p>
                              {produto.registro_anvisa && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  Registro Anvisa: {produto.registro_anvisa}
                                </p>
                              )}
                              {produto.descricao && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                  {produto.descricao}
                                </p>
                              )}
                              {(produto.data_vencimento_registro || produto.vencimento_limpo === null) && (
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {produto.vencimento_limpo === null ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-800/30 flex items-center">
                                      <Shield className="h-3 w-3 mr-1" /> VALIDADE INDETERMINADA (BAIXO RISCO)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700">
                                      VIGÊNCIA: {produto.data_inicial_registro ? formatarData(produto.data_inicial_registro) : '?'} até {formatarData(produto.data_vencimento_registro!)}
                                    </span>
                                  )}

                                  {produto.seguro_compra === false && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-100 dark:border-red-800/30 flex items-center animate-pulse">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> RISCO DETECTADO - NÃO COMPRAR
                                    </span>
                                  )}

                                  {produto.seguro_compra === true && produto.vencimento_limpo !== null && new Date(produto.data_vencimento_registro!) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) && (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center">
                                      <AlertCircle className="h-3 w-3 mr-1" /> Vence em breve
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {produto.preco_referencia !== null && (
                              <div className="ml-4 text-right">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  Preço Ref.
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {formatarMoeda(produto.preco_referencia)}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Calculadora de Frete */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Estimativa de Frete</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Seu CEP
                </label>
                <input
                  type="text"
                  value={cepUsuario}
                  onChange={(e) => setCepUsuario(e.target.value)}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>
              <button
                onClick={() => {
                  if (fornecedor.cep) {
                    calcularFrete(fornecedor.cep, cepUsuario);
                  }
                }}
                disabled={calculandoFrete || !fornecedor.cep}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-slate-300 dark:disabled:bg-slate-800"
              >
                {calculandoFrete ? 'Calculando...' : 'Calcular Frete'}
              </button>

              {frete && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {frete.transportadora}
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {formatarMoeda(frete.valorEstimado)}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Prazo: {frete.prazoMinimo} a {frete.prazoMaximo} dias úteis
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Ações Rápidas
            </h3>
                        <button 
                onClick={() => setIsQuoteModalOpen(true)}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                Solicitar Cotação
              </button>
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="w-full py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition font-bold border border-blue-200 dark:border-blue-800/50 flex items-center justify-center space-x-2 active:scale-[0.98]"
              >
                <Clock className="h-4 w-4" />
                <span>Cotações Enviadas</span>
                {sentQuotes.length > 0 && (
                  <span className="ml-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {sentQuotes.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => {
                  alert('Fornecedor salvo em "Meus Materiais"!');
                }}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition font-medium border border-slate-200 dark:border-slate-700 active:scale-[0.98]"
              >
                Salvar Fornecedor
              </button>
              <button 
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition font-medium border border-slate-200 dark:border-slate-700 active:scale-[0.98]"
              >
                Exportar Dossiê (PDF)
              </button>
            </div>
          </div>
      </div>

      {/* Painel de Verificacao Governamental */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center">
              <Shield className="h-5 w-5 text-blue-600 mr-2" />
              Verificação Governamental
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Receita Federal e ANVISA em tempo real</p>

            {!enrichmentData && !loadingEnrichment && (
              <button
                onClick={() => verificarDadosGov(false)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold text-sm shadow-sm active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Consultar Agora</span>
              </button>
            )}

            {loadingEnrichment && (
              <div className="text-center py-6 space-y-2">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Consultando fontes governamentais...</p>
              </div>
            )}

            {enrichmentData && !loadingEnrichment && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${enrichmentData.receita_federal?.situacao_cadastral === 'ATIVA' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Receita Federal</span>
                    {enrichmentData.receita_federal?.situacao_cadastral === 'ATIVA' ? <CheckCheck className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <p className={`text-sm font-semibold ${enrichmentData.receita_federal?.situacao_cadastral === 'ATIVA' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {enrichmentData.receita_federal?.situacao_cadastral || 'Não encontrado'}
                  </p>
                  {enrichmentData.receita_federal?.cnae_principal && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{enrichmentData.receita_federal.cnae_principal}</p>
                  )}
                </div>

                <div className={`p-3 rounded-lg border ${enrichmentData.anvisa?.status === 'REGULAR' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40' : enrichmentData.anvisa?.status === 'NAO_ENCONTRADA' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">ANVISA</span>
                    {enrichmentData.anvisa?.status === 'REGULAR' ? <CheckCheck className="h-4 w-4 text-green-600" /> : enrichmentData.anvisa?.status === 'NAO_ENCONTRADA' ? <AlertCircle className="h-4 w-4 text-amber-500" /> : <XCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <p className={`text-sm font-semibold ${enrichmentData.anvisa?.status === 'REGULAR' ? 'text-green-700 dark:text-green-300' : enrichmentData.anvisa?.status === 'NAO_ENCONTRADA' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                    {enrichmentData.anvisa?.status === 'REGULAR' ? 'REGULAR' : enrichmentData.anvisa?.status === 'NAO_ENCONTRADA' ? 'Não Cadastrada' : enrichmentData.anvisa?.status}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{enrichmentData.anvisa?.descricao}</p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => verificarDadosGov(false)} className="flex-1 py-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition flex items-center justify-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Atualizar
                  </button>
                  <button onClick={() => verificarDadosGov(true)} className="flex-1 py-1.5 text-[11px] font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition">
                    Salvar no Banco
                  </button>
                </div>
              </div>
            )}
          </div>

      {/* Radar de Risco Regulatório ANVISA */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-800 mt-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center">
          <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
          Radar de Risco Regulatório
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Pendências "Em exigência" na base ANVISA — atualização semanal</p>

        {loadingRisco && (
          <div className="flex items-center gap-2 py-4">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Consultando base regulatória...</span>
          </div>
        )}

        {!loadingRisco && riscoPendencias !== null && riscoPendencias.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">Sem pendências regulatórias ativas</span>
          </div>
        )}

        {!loadingRisco && riscoPendencias && riscoPendencias.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                {riscoPendencias.length} pendência{riscoPendencias.length !== 1 ? 's' : ''} ativa{riscoPendencias.length !== 1 ? 's' : ''} — Em exigência ANVISA
              </span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {riscoPendencias.map((p, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">{p.expediente || p.cod_processo}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/40">
                      {p.nivel_risco}
                    </span>
                  </div>
                  {p.razao_social && (
                    <p className="text-slate-700 dark:text-slate-200 font-semibold">{p.razao_social}</p>
                  )}
                  {p.tipo_processo && (
                    <p className="text-slate-500 dark:text-slate-400 line-clamp-2">{p.tipo_processo}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-slate-400 dark:text-slate-500">
                    {p.cnpj && <span>CNPJ: <span className="font-mono text-slate-600 dark:text-slate-300">{p.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</span></span>}
                    {p.cod_processo && <span>Cód.: <span className="font-mono text-slate-600 dark:text-slate-300">{p.cod_processo}</span></span>}
                    {p.situacao && <span>Situação: <span className="text-slate-600 dark:text-slate-300 font-medium">{p.situacao}</span></span>}
                    {p.data_situacao && <span>Data: <span className="text-slate-600 dark:text-slate-300">{p.data_situacao}</span></span>}
                    {p.num_registro && <span>Reg.: <span className="font-mono text-slate-600 dark:text-slate-300">{p.num_registro}</span></span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AFE / AE — Autorização de Funcionamento ANVISA */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-800 mt-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center">
          <Shield className="h-5 w-5 text-blue-500 mr-2" />
          Autorização de Funcionamento ANVISA (AFE / AE)
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Licença para fabricar, importar ou distribuir produtos sujeitos à vigilância sanitária
        </p>

        {loadingAfe && (
          <div className="flex items-center gap-2 py-4">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Consultando autorizações...</span>
          </div>
        )}

        {!loadingAfe && afeData && afeData.autorizacoes.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma AFE/AE encontrada na base — dados importados mensalmente da ANVISA.
            </span>
          </div>
        )}

        {!loadingAfe && afeData && afeData.autorizacoes.length > 0 && (
          <div className="space-y-3">
            {/* Resumo */}
            <div className="flex flex-wrap gap-2 mb-2">
              {afeData.resumo.total_afe > 0 && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  afeData.resumo.afe_ativa
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/40'
                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40'
                }`}>
                  {afeData.resumo.afe_ativa
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <XCircle className="h-3.5 w-3.5" />}
                  AFE — {afeData.resumo.afe_ativa ? 'Ativa' : 'Sem AFE ativa'}
                </span>
              )}
              {afeData.resumo.total_ae > 0 && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  afeData.resumo.ae_ativa
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/40'
                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40'
                }`}>
                  {afeData.resumo.ae_ativa
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <XCircle className="h-3.5 w-3.5" />}
                  AE — {afeData.resumo.ae_ativa ? 'Ativa' : 'Sem AE ativa'}
                </span>
              )}
              {afeData.resumo.tem_restricao && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Restrição detectada
                </span>
              )}
            </div>

            {/* Lista de autorizações */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {afeData.autorizacoes.map((a: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{a.tipo_autorizacao}</span>
                      {a.numero_autorizacao && (
                        <span className="font-mono text-slate-600 dark:text-slate-300">Nº {a.numero_autorizacao}</span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                      a.situacao === 'Ativa'
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/40'
                        : a.situacao === 'Vencida'
                          ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40'
                          : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                    }`}>
                      {a.situacao}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-slate-400 dark:text-slate-500">
                    {a.data_concessao && <span>Concessão: <span className="text-slate-600 dark:text-slate-300">{a.data_concessao}</span></span>}
                    {a.data_vencimento && <span>Vencimento: <span className="text-slate-600 dark:text-slate-300 font-medium">{a.data_vencimento}</span></span>}
                    {a.municipio && <span>{a.municipio}{a.uf ? `/${a.uf}` : ''}</span>}
                  </div>
                  {a.atividades && (
                    <p className="text-slate-500 dark:text-slate-400 line-clamp-2">{a.atividades}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Cotação Detalhado */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                <span className="w-2 h-6 bg-green-500 rounded-full mr-3"></span>
                Confirmar Solicitação de Cotação
              </h2>
              <button 
                onClick={() => setIsQuoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Informações do Destinatário */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Dados do Fornecedor (Destinatário)
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Razão Social</p>
                    <p className="font-medium text-slate-900 dark:text-white uppercase truncate" title={fornecedor!.razao_social}>{fornecedor!.razao_social}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">CNPJ</p>
                    <p className="font-medium text-slate-900 dark:text-white">{formatarCNPJ(fornecedor!.cnpj)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500 dark:text-slate-400">E-mail para Envio</p>
                    <p className="font-medium text-blue-600 dark:text-blue-400">{fornecedor!.email || 'comercial@datacontrol.com.br'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Telefone</p>
                    <p className="font-medium text-slate-900 dark:text-white text-xs">{fornecedor!.telefone || '(11) 9999-9999'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Localização</p>
                    <p className="font-medium text-slate-900 dark:text-white text-xs whitespace-nowrap overflow-hidden text-ellipsis">{fornecedor!.cidade} - {fornecedor!.estado}</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

              {/* Seleção de Produtos */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Produtos para Cotação
                  </h4>
                  <button 
                    onClick={handleSelectAll}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {selectedProducts.length === produtos.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                </div>

                <div className="space-y-2 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                  {produtos.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm italic">Nenhum produto disponível</div>
                  ) : (
                    produtos.map((produto) => (
                      <label 
                        key={produto.$id}
                        className="flex items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                      >
                        <input 
                          type="checkbox"
                          checked={selectedProducts.includes(produto.$id ?? '')}
                          onChange={() => toggleProduct(produto.$id ?? '')}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{produto.nome_produto}</p>
                          <p className="text-xs text-slate-500">{produto.categoria}</p>
                        </div>
                        {produto.preco_referencia && (
                          <span className="text-xs font-semibold text-slate-400">
                            {formatarMoeda(produto.preco_referencia)}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

              {/* Status do Envio */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl space-y-3 border border-blue-100 dark:border-blue-800/30">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700 dark:text-blue-300 flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Data de Envio:
                  </span>
                  <span className="font-semibold text-blue-900 dark:text-blue-200">
                    {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700 dark:text-blue-300 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Prazo para Resposta:
                  </span>
                  <span className="font-semibold text-blue-900 dark:text-blue-200">
                    Até {new Date(Date.now() + 48*60*60*1000).toLocaleDateString('pt-BR')} (48 horas)
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 flex gap-3">
              <button 
                onClick={() => setIsQuoteModalOpen(false)}
                className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button 
                disabled={selectedProducts.length === 0 || sendingQuote}
                onClick={async () => {
                  const produtosSelecionados = produtos
                    .filter(p => selectedProducts.includes(p.$id ?? ''))
                    .map(p => ({ id: p.$id ?? '', nome: p.nome_produto }));

                  const ok = await enviarCotacao(produtosSelecionados);
                  if (ok) {
                    setFeedback({
                      show: true,
                      title: 'Cotação Enviada!',
                      message: `Sua solicitação de ${selectedProducts.length} item(ns) foi enviada com sucesso para ${fornecedor?.nome_fantasia || fornecedor?.razao_social || 'o fornecedor'}. O prazo de resposta é de até 48 horas.`,
                      type: 'success'
                    });
                    setIsQuoteModalOpen(false);
                    setSelectedProducts([]);
                  } else {
                    setFeedback({
                      show: true,
                      title: 'Erro no Envio',
                      message: 'Não foi possível enviar sua cotação no momento. Por favor, tente novamente.',
                      type: 'error'
                    });
                  }
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 ${
                  selectedProducts.length > 0 && !sendingQuote
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20' 
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {sendingQuote ? 'Enviando...' : selectedProducts.length === 0 ? 'Selecione Produtos' : `Confirmar ${selectedProducts.length} itens`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Cotações */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                <Clock className="h-6 w-6 text-blue-600 mr-3" />
                Histórico de Cotações Enviadas
              </h2>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {loadingQuotes ? (
                <div className="text-center py-12"><LoadingSpinner /></div>
              ) : sentQuotes.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">Nenhuma cotação enviada para este fornecedor ainda.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sentQuotes.map((quote) => {
                    const prods: { id: string; nome: string }[] = (() => {
                      try { return JSON.parse(quote.produtos_json); } catch { return []; }
                    })();
                    return (
                      <div 
                        key={quote.$id}
                        className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800/40 hover:border-blue-200 dark:hover:border-blue-800/50 transition"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              #{(quote.$id ?? '').slice(-8).toUpperCase()}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              quote.status === 'enviada' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-green-100 text-green-700'
                            }`}>{quote.status}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {new Date(quote.$createdAt ?? '').toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              às {new Date(quote.$createdAt ?? '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Produtos Solicitados:</p>
                          <div className="flex flex-wrap gap-2">
                            {prods.map((prod: { id: string; nome: string }, idx: number) => (
                              <span 
                                key={idx}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px] font-medium"
                              >
                                {prod.nome}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/30">
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-full py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sincronização ANVISA */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-purple-50 dark:bg-purple-900/10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                <RefreshCw className={`h-6 w-6 text-purple-600 mr-3 ${loadingEnrichment ? 'animate-spin' : ''}`} />
                Sincronizar Catálogo com ANVISA
              </h2>
              <button onClick={() => setIsSyncModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Badge de filtro — usa o tipo do USUÁRIO LOGADO, não o do fornecedor */}
              {userTipoAnvisa && (userTipoAnvisa === 'cosmetico' || userTipoAnvisa === 'medicamento') && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/40 text-xs font-semibold text-purple-700 dark:text-purple-300">
                  {userTipoAnvisa === 'cosmetico' ? '💄' : '💊'}
                  <span>Exibindo apenas <strong>{userTipoAnvisa === 'cosmetico' ? 'Cosméticos' : 'Medicamentos'}</strong> conforme seu perfil cadastrado.</span>
                </div>
              )}

              {/* Seletor de Tipo - Oculto se já definido para não "repetir campos" */}
              {(!tipoUrl && !fornecedor?.tipo_anvisa && !tipoAnvisaSync && !loading) && (
                <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Tipo de produto a buscar na ANVISA
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {(['cosmetico', 'medicamento', 'ambos'] as const).map(tipo => (
                      <button
                        key={tipo}
                        onClick={() => setTipoAnvisaSync(tipo)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                          tipoAnvisaSync === tipo
                            ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-600'
                        }`}
                      >
                        {tipo === 'cosmetico' ? '💄 Cosméticos' : tipo === 'medicamento' ? '💊 Medicamentos' : '🔍 Ambos'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (tipoAnvisaSync) verificarDadosGov(false, tipoAnvisaSync, true);
                    }}
                    disabled={loadingEnrichment || !tipoAnvisaSync}
                    className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingEnrichment ? 'animate-spin' : ''}`} />
                    {loadingEnrichment ? 'Buscando...' : `Buscar ${tipoAnvisaSync === 'cosmetico' ? 'Cosméticos' : tipoAnvisaSync === 'medicamento' ? 'Medicamentos' : 'Todos'} na ANVISA`}
                  </button>
                </div>
              )}

              {(tipoUrl || tipoAnvisaSync) && !enrichmentData?.anvisa_produtos?.length && !loadingEnrichment && (
                <div className="mb-4 text-center">
                  <button
                    onClick={() => {
                      const t = (tipoUrl || tipoAnvisaSync) as any;
                      const locked = fornecedor?.tipo_anvisa === 'cosmetico' || fornecedor?.tipo_anvisa === 'medicamento';
                      verificarDadosGov(false, t, true, locked);
                    }}
                    className="text-purple-600 hover:underline text-sm font-medium"
                  >
                    🔄 Recarregar busca de {(tipoUrl || tipoAnvisaSync) === 'cosmetico' ? 'Cosméticos' : (tipoUrl || tipoAnvisaSync) === 'medicamento' ? 'Medicamentos' : 'Produtos'}
                  </button>
                </div>
              )}

              {loadingEnrichment ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-slate-500 animate-pulse font-medium">Consultando portal oficial da ANVISA... (em torno de 30s)</p>
                </div>
              ) : !enrichmentData?.anvisa_produtos || enrichmentData.anvisa_produtos.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">Nenhum produto regularizado encontrado na ANVISA para o CNPJ {formatarCNPJ(cnpj)}.</p>
                  <div className="text-xs text-slate-400 italic bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/40 text-left">
                    <p className="font-bold mb-1 flex items-center"><Shield className="h-3 w-3 mr-1"/> Dica Importante:</p>
                    <p>Grandes empresas costumam registrar produtos em CNPJs industriais (Fábricas).</p>
                    <p className="mt-1">Para a <b>Natura</b>, experimente o CNPJ Industrial: <span className="text-slate-900 dark:text-white font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 select-all">00.190.373/0001-72</span></p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {enrichmentData.anvisa_produtos.length} produtos encontrados no portal oficial.
                      </p>
                      <p className="text-[10px] text-slate-400 italic">
                        Nota: Inclui produtos <b>Registrados</b> e <b>Regularizados</b> encontrados no banco nacional e consultas em tempo real.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        if (selectedSyncProducts.length === enrichmentData.anvisa_produtos.length) setSelectedSyncProducts([]);
                        else setSelectedSyncProducts(enrichmentData.anvisa_produtos.map((p: any) => p.processo));
                      }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {selectedSyncProducts.length === enrichmentData.anvisa_produtos.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl divide-y dark:divide-slate-800 max-h-[40vh] overflow-y-auto custom-scrollbar">
                    {enrichmentData.anvisa_produtos.map((p: any) => {
                      const jaExiste = produtos.some(local => local.registro_anvisa === p.processo);
                      return (
                        <label key={p.processo} className="flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition group">
                          <div className="relative flex items-center">
                            <input 
                              type="checkbox"
                              checked={selectedSyncProducts.includes(p.processo)}
                              onChange={() => {
                                setSelectedSyncProducts(prev => 
                                  prev.includes(p.processo) ? prev.filter(id => id !== p.processo) : [...prev, p.processo]
                                );
                              }}
                              className="h-5 w-5 rounded-md border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-purple-500 dark:bg-slate-800 transition shadow-sm"
                            />
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-slate-900 dark:text-white uppercase line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">{p.nome}</p>
                              {jaExiste && (
                                <span className="flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/30">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                                  JÁ NO DOSSIÊ
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-[10px] text-slate-500 mt-1">
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">Proc: {p.processo}</span>
                              {p.sub_categoria && (
                                <span className={`px-1.5 py-0.5 rounded border font-bold ${
                                  p.sub_categoria === 'Registrado'
                                  ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-100 dark:border-purple-800/30'
                                  : p.sub_categoria === 'Regularizado'
                                  ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 border-sky-100 dark:border-sky-800/30'
                                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-100 dark:border-emerald-800/30'
                                }`}>
                                  {p.sub_categoria}
                                </span>
                              )}
                              <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800/30">
                                Validade: {formatarData(p.data_validade)}
                              </span>
                              {isVencida(p.data_validade) ? (
                                <span className="font-bold flex items-center text-red-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5"></span>
                                  REGISTRO VENCIDO
                                </span>
                              ) : (
                                <span className="font-bold flex items-center text-green-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5"></span>
                                  REGISTRO ATIVO
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 flex gap-3">
              <button 
                onClick={() => setIsSyncModalOpen(false)}
                className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button 
                disabled={selectedSyncProducts.length === 0 || importing || loadingEnrichment}
                onClick={confirmarImportacao}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] flex items-center justify-center space-x-2 ${
                  selectedSyncProducts.length > 0 && !importing && !loadingEnrichment
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20' 
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-400/20 dark:border-slate-700/50'
                }`}
              >
                <Download className="h-5 w-5" />
                <span>{importing ? 'Importando...' : selectedSyncProducts.length === 0 ? 'Selecione Itens' : `Importar ${selectedSyncProducts.length} Produtos`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Feedback (Sucesso/Erro) */}
      {feedback.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                feedback.type === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{feedback.title}</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">{feedback.message}</p>
              <button 
                onClick={() => setFeedback(prev => ({ ...prev, show: false }))}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg active:scale-[0.98] ${
                  feedback.type === 'success' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                }`}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
