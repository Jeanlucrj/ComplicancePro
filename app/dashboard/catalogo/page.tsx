'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, Package, Pill, ShieldCheck, ShieldX, AlertTriangle,
  ChevronLeft, ChevronRight, ExternalLink, Filter, Clock, Building2
} from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Tipo = 'todos' | 'cosmetico' | 'medicamento';
type Campo = 'nome' | 'cnpj' | 'processo' | 'registro';

interface Produto {
  $id: string;
  tipo: 'cosmetico' | 'medicamento';
  cnpj: string;
  razao_social: string;
  nome_produto: string;
  processo: string;
  registro: string;
  situacao: string;
  principio_ativo: string;
  vencimento: string;
  seguro_compra: boolean;
}

interface ResultadoBusca {
  resultados: Produto[];
  total: number;
  pagina: number;
  por_pagina: number;
  cosmeticos_total: number;
  medicamentos_total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCNPJ(cnpj: string) {
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function StatusBadge({ situacao, seguro_compra }: { situacao: string; seguro_compra: boolean }) {
  const s = (situacao || '').toUpperCase();
  if (s === 'ATIVO' || s === 'ATIVA') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <ShieldCheck className="h-3 w-3" /> Ativo
      </span>
    );
  }
  if (!seguro_compra) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
        <ShieldX className="h-3 w-3" /> {situacao || 'Inativo'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      <AlertTriangle className="h-3 w-3" /> {situacao}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: 'cosmetico' | 'medicamento' }) {
  if (tipo === 'cosmetico') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
        <Package className="h-3 w-3" /> Cosmético
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <Pill className="h-3 w-3" /> Medicamento
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CatalogoPage() {
  const { tipoAnvisa: userTipoAnvisa, profileLoaded } = useUserProfile();
  const [query, setQuery] = useState('');
  const [campo, setCampo] = useState<Campo>('nome');
  const [tipo, setTipo] = useState<Tipo>('todos');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profileLoaded && userTipoAnvisa !== 'ambos') setTipo(userTipoAnvisa);
  }, [profileLoaded, userTipoAnvisa]);

  const buscar = useCallback(async (p = 1) => {
    const q = query.trim();
    if (q.length < 3) { setErro('Digite ao menos 3 caracteres.'); return; }
    setErro('');
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, campo, tipo, page: String(p) });
      const res = await fetch(`/api/anvisa/catalogo?${params}`);
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro na busca'); setResultado(null); return; }
      setResultado(data);
      setPagina(p);
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [query, campo, tipo]);

  const totalPaginas = resultado ? Math.ceil(resultado.total / resultado.por_pagina) : 0;

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="h-7 w-7 text-purple-400" />
          Catálogo ANVISA
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Consulte produtos cosméticos e medicamentos registrados na base ANVISA
        </p>
      </div>

      {/* Barra de busca */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">

        {/* Filtros de campo e tipo */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-400 font-medium">Buscar por:</span>
          </div>
          {([
            { value: 'nome', label: 'Nome do Produto' },
            { value: 'cnpj', label: 'CNPJ' },
            { value: 'registro', label: 'Nº Registro' },
            { value: 'processo', label: 'Nº Processo' },
          ] as { value: Campo; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => { setCampo(opt.value); setResultado(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                campo === opt.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {(profileLoaded && userTipoAnvisa !== 'ambos'
              ? [{ value: userTipoAnvisa as Tipo, label: userTipoAnvisa === 'cosmetico' ? 'Cosméticos' : 'Medicamentos' }]
              : ([
                  { value: 'todos', label: 'Todos' },
                  { value: 'cosmetico', label: 'Cosméticos' },
                  { value: 'medicamento', label: 'Medicamentos' },
                ] as { value: Tipo; label: string }[])
            ).map(opt => (
              <button
                key={opt.value}
                onClick={() => { setTipo(opt.value); setResultado(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tipo === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input + botão */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar(1)}
              placeholder={
                campo === 'cnpj' ? 'Digite o CNPJ (ex: 00.000.000/0001-00)' :
                campo === 'registro' ? 'Digite o número do registro ANVISA (ex: 25351.000123/2024-00)' :
                campo === 'processo' ? 'Digite o número do processo' :
                'Digite o nome do produto...'
              }
              className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>
          <button
            onClick={() => buscar(1)}
            disabled={loading}
            className="px-6 py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center gap-2 min-w-[130px] justify-center"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Search className="h-4 w-4" /> Buscar</>
            )}
          </button>
        </div>

        {erro && (
          <p className="text-red-400 text-sm flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> {erro}
          </p>
        )}
      </div>

      {/* Resumo dos resultados */}
      {resultado && (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-slate-300 text-sm">
            <span className="font-bold text-white">{resultado.total}</span> resultado{resultado.total !== 1 ? 's' : ''} encontrado{resultado.total !== 1 ? 's' : ''}
          </p>
          {resultado.cosmeticos_total > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
              <Package className="h-3 w-3" /> {resultado.cosmeticos_total} cosmético{resultado.cosmeticos_total !== 1 ? 's' : ''}
            </span>
          )}
          {resultado.medicamentos_total > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
              <Pill className="h-3 w-3" /> {resultado.medicamentos_total} medicamento{resultado.medicamentos_total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Resultados */}
      {resultado && resultado.resultados.length === 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-12 text-center">
          <Search className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nenhum produto encontrado</p>
          <p className="text-slate-500 text-sm mt-1">Verifique o termo buscado ou tente outro critério</p>
        </div>
      )}

      {resultado && resultado.resultados.length > 0 && (
        <div className="space-y-3">
          {resultado.resultados.map(produto => (
            <div
              key={produto.$id}
              className="bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-2xl p-5 transition-all"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Nome + badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-white font-semibold text-base leading-tight">{produto.nome_produto}</h3>
                    <TipoBadge tipo={produto.tipo} />
                    <StatusBadge situacao={produto.situacao} seguro_compra={produto.seguro_compra} />
                  </div>

                  {/* Empresa */}
                  <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{produto.razao_social}</span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-slate-500 text-xs shrink-0">{formatCNPJ(produto.cnpj)}</span>
                  </div>

                  {/* Registro + Processo + Vencimento */}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    {produto.registro && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-slate-400 font-semibold">Reg.</span>
                        <span className="font-mono">{produto.registro}</span>
                      </span>
                    )}
                    {produto.processo && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-slate-400 font-semibold">Proc.</span>
                        <span className="font-mono">{produto.processo}</span>
                      </span>
                    )}
                    {produto.vencimento && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Venc. {produto.vencimento}
                      </span>
                    )}
                  </div>

                  {/* Princípio ativo (apenas medicamentos) */}
                  {produto.principio_ativo && (
                    <div className="text-xs text-slate-500">
                      <span className="text-slate-400 font-semibold">Princípio ativo: </span>
                      {produto.principio_ativo}
                    </div>
                  )}
                </div>

                {/* Indicador de segurança */}
                <div className={`shrink-0 text-center px-4 py-2 rounded-xl border ${
                  produto.seguro_compra
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/5 border-red-500/20 text-red-400'
                }`}>
                  {produto.seguro_compra
                    ? <><ShieldCheck className="h-6 w-6 mx-auto mb-0.5" /><span className="text-[10px] font-bold block">SEGURO</span></>
                    : <><ShieldX className="h-6 w-6 mx-auto mb-0.5" /><span className="text-[10px] font-bold block">RISCO</span></>
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => buscar(pagina - 1)}
            disabled={pagina === 1 || loading}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-slate-400 text-sm">
            Página <span className="font-bold text-white">{pagina}</span> de <span className="font-bold text-white">{totalPaginas}</span>
          </span>
          <button
            onClick={() => buscar(pagina + 1)}
            disabled={pagina === totalPaginas || loading}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Estado inicial */}
      {!resultado && !loading && (
        <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
          <Package className="h-14 w-14 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Busque produtos no catálogo ANVISA</p>
          <p className="text-slate-600 text-sm mt-1 max-w-md mx-auto">
            Base atualizada toda sexta-feira com os dados abertos de cosméticos e medicamentos registrados
          </p>
        </div>
      )}

    </div>
  );
}
