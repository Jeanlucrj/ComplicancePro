'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, ShieldCheck, ShieldAlert, ShieldX, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Loader2, RefreshCw, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type { ScoreIAResult } from '@/app/api/fornecedores/[cnpj]/score-ia/route';

interface ScoreIACardProps {
  cnpj: string;
  userId: string;
  /** Data da última geração salva no banco (fallback para exibição cross-device) */
  scoreGeradoEmDb?: string | null;
  /** Se true, solicita o score automaticamente ao montar */
  autoLoad?: boolean;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

function getCacheKey(cnpj: string, userId: string) {
  return `score_ia_${cnpj}_${userId}`;
}

function loadCache(cnpj: string, userId: string): ScoreIAResult | null {
  try {
    const raw = localStorage.getItem(getCacheKey(cnpj, userId));
    if (!raw) return null;
    const parsed: ScoreIAResult = JSON.parse(raw);
    if (Date.now() - new Date(parsed.gerado_em).getTime() > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(cnpj, userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(cnpj: string, userId: string, result: ScoreIAResult) {
  try {
    localStorage.setItem(getCacheKey(cnpj, userId), JSON.stringify(result));
  } catch {
    // storage cheio — silencioso
  }
}

// ── Gauge circular SVG ────────────────────────────────────────────────────────

function ScoreGauge({ score, cor }: { score: number; cor: ScoreIAResult['cor'] }) {
  const radius = 52;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  // Gauge de 270° (começa em 135°, termina em 405°)
  const arc = circumference * 0.75;
  const progress = arc * (score / 100);

  const colors: Record<ScoreIAResult['cor'], string> = {
    green: '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    red: '#ef4444',
  };

  const bgColors: Record<ScoreIAResult['cor'], string> = {
    green: '#dcfce7',
    yellow: '#fef9c3',
    orange: '#ffedd5',
    red: '#fee2e2',
  };

  const trackColor = '#e2e8f0';
  const fillColor = colors[cor];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" style={{ transform: 'rotate(135deg)' }}>
        {/* Track */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={fillColor}
          strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
        />
      </svg>
      {/* Score no centro */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ paddingBottom: 16 }}
      >
        <span className="text-3xl font-black" style={{ color: fillColor }}>{score}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">/100</span>
      </div>
    </div>
  );
}

// ── Ícone do nível ────────────────────────────────────────────────────────────

function NivelIcon({ nivel }: { nivel: ScoreIAResult['nivel'] }) {
  if (nivel === 'ALTO') return <ShieldCheck className="h-5 w-5 text-green-500" />;
  if (nivel === 'MÉDIO') return <ShieldAlert className="h-5 w-5 text-yellow-500" />;
  if (nivel === 'BAIXO') return <ShieldAlert className="h-5 w-5 text-orange-500" />;
  return <ShieldX className="h-5 w-5 text-red-500" />;
}

const nivelLabel: Record<ScoreIAResult['nivel'], string> = {
  ALTO: 'Risco Baixo',
  MÉDIO: 'Risco Moderado',
  BAIXO: 'Risco Alto',
  CRÍTICO: 'Risco Crítico',
};

const nivelClasses: Record<ScoreIAResult['cor'], string> = {
  green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-800 dark:text-green-300',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/40 text-yellow-800 dark:text-yellow-300',
  orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40 text-orange-800 dark:text-orange-300',
  red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300',
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function ScoreIACard({ cnpj, userId, scoreGeradoEmDb, autoLoad = true }: ScoreIACardProps) {
  const [result, setResult] = useState<ScoreIAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchScore = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = loadCache(cnpj, userId);
      if (cached) {
        setResult(cached);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/fornecedores/${cnpj}/score-ia?userId=${userId}`,
        { method: 'POST' }
      );
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Limite mensal de consultas atingido. Faça upgrade para continuar.');
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const data: ScoreIAResult = await res.json();
      setResult(data);
      saveCache(cnpj, userId, data);
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar score');
    } finally {
      setLoading(false);
    }
  }, [cnpj, userId]);

  useEffect(() => {
    if (autoLoad && userId) fetchScore();
  }, [autoLoad, userId, fetchScore]);

  // ── Estado: sem dados ainda ──────────────────────────────────────────────────
  if (!result && !loading && !error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
            <Sparkles className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-white text-sm">Score de Confiabilidade IA</p>
            <p className="text-xs text-slate-500">Análise inteligente baseada em Receita Federal, ANVISA e DOU</p>
          </div>
        </div>
        <button
          onClick={() => fetchScore()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-violet-500/25 shrink-0"
        >
          <Zap className="h-4 w-4" />
          Gerar Score
        </button>
      </div>
    );
  }

  // ── Estado: carregando ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
            <Sparkles className="h-5 w-5 text-violet-500 animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-white text-sm">Analisando fornecedor...</p>
            <p className="text-xs text-slate-500">IA processando Receita Federal, ANVISA e DOU</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-violet-600 dark:text-violet-400">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          <div className="flex-1 space-y-1.5">
            {['Consultando portfólio de produtos...', 'Verificando menções no DOU...', 'Calculando score de risco...'].map((txt, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full bg-violet-400 ${i === 0 ? 'animate-pulse' : 'opacity-30'}`} />
                <span className={`text-xs ${i === 0 ? 'text-violet-600 dark:text-violet-400 font-medium' : 'text-slate-400'}`}>{txt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Estado: erro ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Erro ao gerar score</p>
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
        <button
          onClick={() => fetchScore(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-semibold rounded-lg transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
        </button>
      </div>
    );
  }

  // ── Estado: resultado ─────────────────────────────────────────────────────────
  return (
    <div className={`border rounded-2xl overflow-hidden ${nivelClasses[result!.cor]}`}>
      {/* Header compacto */}
      <div className="p-5 flex items-center gap-4">
        <ScoreGauge score={result!.score} cor={result!.cor} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Score IA · Confiabilidade</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <NivelIcon nivel={result!.nivel} />
            <span className="text-base font-black">{nivelLabel[result!.nivel]}</span>
          </div>
          <p className="text-xs leading-relaxed line-clamp-3 opacity-80">{result!.resumo}</p>
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
          title={expanded ? 'Recolher' : 'Ver detalhes'}
        >
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>

      {/* Detalhes expandíveis */}
      {expanded && (
        <div className="border-t border-current/10 px-5 pb-5 pt-4 space-y-4">
          {/* Positivos */}
          {result!.pontos_positivos.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Pontos Positivos</span>
              </div>
              <ul className="space-y-1.5">
                {result!.pontos_positivos.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Atenção */}
          {result!.pontos_atencao.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Pontos de Atenção</span>
              </div>
              <ul className="space-y-1.5">
                {result!.pontos_atencao.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recomendações */}
          {result!.recomendacoes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-4 w-4 text-violet-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Recomendações</span>
              </div>
              <ol className="space-y-1.5">
                {result!.recomendacoes.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-black text-violet-600 dark:text-violet-400 shrink-0">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Rodapé */}
          {(() => {
            const SCORE_TTL_MS = 24 * 60 * 60 * 1000;
            const ultimaGeracao = result ? new Date(result.gerado_em) : scoreGeradoEmDb ? new Date(scoreGeradoEmDb) : null;
            const dentroDoCache = ultimaGeracao && (Date.now() - ultimaGeracao.getTime() < SCORE_TTL_MS);
            return (
              <div className="flex items-center justify-between pt-2 border-t border-current/10">
                <span className="text-[10px] opacity-50">
                  Gerado em {ultimaGeracao ? ultimaGeracao.toLocaleString('pt-BR') : '—'}
                </span>
                <button
                  onClick={() => fetchScore(true)}
                  className="flex items-center gap-1 text-[10px] font-semibold opacity-60 hover:opacity-100 transition"
                  title={dentroDoCache ? 'Atualizar sem custo (dentro do cache de 24h)' : 'Consome 1 crédito'}
                >
                  <RefreshCw className="h-3 w-3" />
                  {dentroDoCache ? 'Atualizar' : 'Atualizar · 1 crédito'}
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
