'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell, AlertTriangle, CheckCircle2, Loader2,
  ShieldAlert, Ban, AlertOctagon, FileWarning,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatarCNPJ } from '@/utils/formatters';

interface AlertaLocal {
  id: string;
  tipo: 'info' | 'warning' | 'error';
  categoria: 'receita' | 'anvisa_status' | 'vencimento' | 'irregular' | 'risco' | 'afe';
  titulo: string;
  descricao: string;
  badge: string;
}

function AlertIcon({ categoria }: { categoria: AlertaLocal['categoria'] }) {
  const cls = 'h-6 w-6';
  if (categoria === 'irregular') return <Ban className={cls} />;
  if (categoria === 'risco')     return <FileWarning className={cls} />;
  if (categoria === 'receita')   return <AlertOctagon className={cls} />;
  if (categoria === 'vencimento') return <AlertTriangle className={cls} />;
  if (categoria === 'afe')       return <ShieldAlert className={cls} />;
  return <ShieldAlert className={cls} />;
}

function badgeClasses(tipo: AlertaLocal['tipo']) {
  if (tipo === 'error')   return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400';
  if (tipo === 'warning') return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400';
  return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400';
}

function borderClasses(tipo: AlertaLocal['tipo']) {
  if (tipo === 'error')   return 'border-red-200 dark:border-red-900/40';
  if (tipo === 'warning') return 'border-amber-200 dark:border-amber-900/40';
  return 'border-slate-200 dark:border-slate-800';
}

function titleClasses(tipo: AlertaLocal['tipo']) {
  if (tipo === 'error')   return 'text-red-700 dark:text-red-400';
  if (tipo === 'warning') return 'text-amber-700 dark:text-amber-400';
  return 'text-slate-900 dark:text-white';
}

const CATEGORIA_LABEL: Record<AlertaLocal['categoria'], string> = {
  irregular:    'Produto Irregular',
  risco:        'Pendência Regulatória',
  anvisa_status:'Status ANVISA',
  receita:      'Receita Federal',
  vencimento:   'Vencimento',
  afe:          'AFE / AE',
};

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<AlertaLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [fornecedoresCount, setFornecedoresCount] = useState(0);
  useEffect(() => {
    async function getUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setUserId(session.user.id);
      } catch (e) {
        console.error('Erro ao recuperar usuário:', e);
      }
    }
    getUser();
  }, []);

  useEffect(() => {
    if (userId) gerarAlertas();
  }, [userId]);

  const gerarAlertas = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const novosAlertas: AlertaLocal[] = [];
      const hoje = new Date();
      const trintaDias = new Date();
      trintaDias.setDate(hoje.getDate() + 30);

      // 1. Perfil do usuário (tipo_anvisa) — fallback para user_metadata
      const { data: { session: sess } } = await supabase.auth.getSession();
      let tipoAnvisa: string = sess?.user?.user_metadata?.tipo_anvisa || 'ambos';
      const perfilRes = await fetch(`/api/fornecedores?userId=${userId}&onlyPerfil=true`);
      if (perfilRes.ok) {
        const d = await perfilRes.json();
        if (d.fornecedores?.[0]?.tipo_anvisa) tipoAnvisa = d.fornecedores[0].tipo_anvisa;
      }

      // 2. Fornecedores salvos + Produtos em paralelo
      const [resFornecedores, resProdutos] = await Promise.all([
        fetch(`/api/fornecedores?userId=${userId}`).then((r) => r.json()),
        fetch(`/api/produtos?userId=${userId}`).then((r) => r.json()),
      ]);

      const listaFornecedores = resFornecedores.fornecedores || [];
      setFornecedoresCount(listaFornecedores.length);

      // 3. Alertas de status do fornecedor
      for (const f of listaFornecedores) {
        const nome = f.nome_fantasia || f.razao_social;

        if (f.status_anvisa === 'SUSPENSA' || f.status_anvisa === 'IRREGULAR') {
          novosAlertas.push({
            id: `f-anvisa-${f.id}`,
            tipo: 'error',
            categoria: 'anvisa_status',
            titulo: 'Fornecedor com Restrição ANVISA',
            descricao: `${nome} (${formatarCNPJ(f.cnpj)}) está com status ${f.status_anvisa} no portal oficial.`,
            badge: 'Urgente',
          });
        }

        if (f.situacao_receita && f.situacao_receita !== 'ATIVA' && f.situacao_receita !== 'DESCONHECIDA') {
          novosAlertas.push({
            id: `f-receita-${f.id}`,
            tipo: 'warning',
            categoria: 'receita',
            titulo: 'Irregularidade na Receita Federal',
            descricao: `CNPJ ${formatarCNPJ(f.cnpj)} (${nome}) consta como ${f.situacao_receita} na Receita Federal.`,
            badge: 'Atenção',
          });
        }
      }

      // 4. Alertas de vencimento de produtos
      const listaProdutos = resProdutos.produtos || [];
      for (const p of listaProdutos) {
        if (p.vencimento_limpo) {
          const dataVenc = new Date(p.vencimento_limpo);
          if (dataVenc < hoje) {
            novosAlertas.push({
              id: `p-exp-${p.id}`,
              tipo: 'error',
              categoria: 'vencimento',
              titulo: 'Registro ANVISA Vencido',
              descricao: `Produto "${p.nome_produto}" venceu em ${dataVenc.toLocaleDateString('pt-BR')}. Reavalie a compra.`,
              badge: 'Vencido',
            });
          } else if (dataVenc < trintaDias) {
            novosAlertas.push({
              id: `p-warn-${p.id}`,
              tipo: 'warning',
              categoria: 'vencimento',
              titulo: 'Vencimento de Registro Próximo',
              descricao: `Registro do produto "${p.nome_produto}" expira em ${dataVenc.toLocaleDateString('pt-BR')} (menos de 30 dias).`,
              badge: 'Atenção',
            });
          }
        }
      }

      // 5. Cruzamento com anvisa_irregulares e anvisa_risco
      if (listaFornecedores.length > 0) {
        const cnpjs = listaFornecedores
          .map((f: any) => f.cnpj?.replace(/\D/g, ''))
          .filter((c: string) => c?.length === 14)
          .join(',');

        if (cnpjs) {
          const anvisaRes = await fetch(`/api/anvisa/alertas?cnpjs=${cnpjs}&tipo=${tipoAnvisa}`);
          if (anvisaRes.ok) {
            const { irregulares, risco } = await anvisaRes.json();

            // Agrupa irregulares por CNPJ investigado
            const irregPorCnpj = new Map<string, any[]>();
            for (const irr of (irregulares || [])) {
              const cnpjKey = irr.cnpj_investigada || irr.cnpj_fabricante || '';
              if (!irregPorCnpj.has(cnpjKey)) irregPorCnpj.set(cnpjKey, []);
              irregPorCnpj.get(cnpjKey)!.push(irr);
            }

            for (const [cnpj, itens] of irregPorCnpj) {
              const fornecedor = listaFornecedores.find(
                (f: any) => f.cnpj?.replace(/\D/g, '') === cnpj
              );
              const nomeEmpresa = fornecedor
                ? (fornecedor.nome_fantasia || fornecedor.razao_social)
                : (itens[0].empresa_investigada || formatarCNPJ(cnpj));

              novosAlertas.push({
                id: `irr-${cnpj}`,
                tipo: 'error',
                categoria: 'irregular',
                titulo: 'Fornecedor na Lista de Irregulares ANVISA',
                descricao: `${nomeEmpresa} (${formatarCNPJ(cnpj)}) possui ${itens.length} produto(s) na lista de irregulares ANVISA. Verifique antes de efetuar compras.`,
                badge: 'Crítico',
              });
            }

            // Agrupa pendências de risco por CNPJ
            const riscoPorCnpj = new Map<string, any[]>();
            for (const r of (risco || [])) {
              if (!riscoPorCnpj.has(r.cnpj)) riscoPorCnpj.set(r.cnpj, []);
              riscoPorCnpj.get(r.cnpj)!.push(r);
            }

            for (const [cnpj, itens] of riscoPorCnpj) {
              const fornecedor = listaFornecedores.find(
                (f: any) => f.cnpj?.replace(/\D/g, '') === cnpj
              );
              const nomeEmpresa = fornecedor
                ? (fornecedor.nome_fantasia || fornecedor.razao_social)
                : (itens[0].razao_social || formatarCNPJ(cnpj));

              novosAlertas.push({
                id: `risco-${cnpj}`,
                tipo: 'warning',
                categoria: 'risco',
                titulo: 'Fornecedor com Pendência Regulatória',
                descricao: `${nomeEmpresa} (${formatarCNPJ(cnpj)}) possui ${itens.length} processo(s) em exigência na ANVISA.`,
                badge: 'Pendente',
              });
            }
          }
        }
      }

      // 6. AFE/AE — verifica fornecedores sem autorização ativa (paralelo)
      const fornecedoresComCnpj = listaFornecedores.filter((f: any) => f.cnpj?.replace(/\D/g, '').length === 14);
      await Promise.all(
        fornecedoresComCnpj.map(async (f: any) => {
          const cnpjLimpo = f.cnpj.replace(/\D/g, '');
          try {
            const afeRes = await fetch(`/api/anvisa/afe?cnpj=${cnpjLimpo}`);
            if (!afeRes.ok) return;
            const afeJson = await afeRes.json();
            if (afeJson.total > 0 && afeJson.resumo?.tem_restricao) {
              novosAlertas.push({
                id: `afe-${cnpjLimpo}`,
                tipo: 'error',
                categoria: 'afe',
                titulo: 'AFE/AE sem autorização ativa',
                descricao: `${f.nome_fantasia || f.razao_social} (${formatarCNPJ(f.cnpj)}) não possui Autorização de Funcionamento (AFE/AE) ativa na ANVISA.`,
                badge: 'Crítico',
              });
            }
          } catch { /* ignora erros individuais */ }
        })
      );

      // Ordena: error primeiro, depois warning
      novosAlertas.sort((a, b) => {
        const ordem = { error: 0, warning: 1, info: 2 };
        return ordem[a.tipo] - ordem[b.tipo];
      });

      setAlertas(novosAlertas);
    } catch (error) {
      console.error('Erro ao gerar alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Alertas</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Notificações automáticas de compliance regulatório — ANVISA e Receita Federal
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Analisando fornecedores e base ANVISA...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alertas.length > 0 ? (
            <>
              {/* Resumo por categoria */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {(['error', 'warning'] as const).map((tipo) => {
                  const count = alertas.filter((a) => a.tipo === tipo).length;
                  if (!count) return null;
                  return (
                    <div
                      key={tipo}
                      className={`rounded-xl border p-3 flex items-center gap-2 ${borderClasses(tipo)} bg-white dark:bg-slate-900`}
                    >
                      <span className={`p-1.5 rounded-lg ${badgeClasses(tipo)}`}>
                        {tipo === 'error' ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </span>
                      <div>
                        <p className={`text-lg font-bold leading-none ${titleClasses(tipo)}`}>{count}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                          {tipo === 'error' ? 'crítico' : 'atenção'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`bg-white dark:bg-slate-900 p-4 rounded-xl border flex items-start gap-4 shadow-sm hover:shadow-md transition-all ${borderClasses(alerta.tipo)}`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${badgeClasses(alerta.tipo)}`}>
                    <AlertIcon categoria={alerta.categoria} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-2">
                          {CATEGORIA_LABEL[alerta.categoria]}
                        </span>
                        <h3 className={`font-bold ${titleClasses(alerta.tipo)}`}>
                          {alerta.titulo}
                        </h3>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                        alerta.tipo === 'error'
                          ? 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
                          : alerta.tipo === 'warning'
                            ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                            : 'text-slate-500 bg-slate-100 dark:bg-slate-800'
                      }`}>
                        {alerta.badge}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {alerta.descricao}
                    </p>
                    {alerta.categoria === 'irregular' && (
                      <Link
                        href="/dashboard/irregulares"
                        className="inline-flex items-center mt-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                      >
                        Ver produtos irregulares →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : !loading && (
            <div className="flex flex-col space-y-4">
              {fornecedoresCount > 0 ? (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/20 p-8 rounded-2xl flex items-center gap-6">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-900 dark:text-green-400">Tudo em dia.</h3>
                    <p className="text-green-700 dark:text-green-500/80">
                      Nenhuma irregularidade detectada para seus fornecedores. Registros ANVISA dentro do prazo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 rounded-3xl text-center">
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Bell className="h-8 w-8 text-slate-400" />
                  </div>
                  <h4 className="text-slate-900 dark:text-white font-bold mb-1">Nenhum alerta gerado</h4>
                  <p className="text-slate-500 dark:text-slate-500 text-sm max-w-sm mx-auto mb-6">
                    Adicione fornecedores para monitorar automaticamente o compliance ANVISA e Receita Federal.
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
                  >
                    Buscar Fornecedores
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
