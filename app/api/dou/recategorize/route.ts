import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dou/recategorize
 * Dois passes:
 *   1. Registros com categoria='Cosmético' que são medicamentos → corrige categoria + insight
 *   2. Registros com categoria='Medicamento' mas insight incorreto ("cosmético") → corrige só o insight
 */
export async function POST(request: NextRequest) {
  const isInternal = request.headers.get('x-internal-request') === '1';
  if (!isInternal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const PHARMA_PATTERNS = [
    /MG\/ML/i, /MCG\/ML/i, /UI\/ML/i, /MG\/G/i,
    /AMP VD/i, /FRASCO-AMPOLA/i, /FRASCO AMPOLA/i,
    /SOL INJ/i, /SOL\. INJ/i, /SOLUÇÃO INJETÁVEL/i,
    /PÓ LIOFILIZADO/i, /PO LIOFILIZADO/i, /PO LIOF/i,
    /COMPRIMIDO/i, /CÁPSULA/i, /CAPSULA/i,
    /XAROPE/i, /SUSPENSÃO ORAL/i, /SOLUÇÃO ORAL/i, /SOL ORAL/i,
    /SUBCUTÂNEO/i, /INTRAVENOSO/i, /INJETÁVEL/i,
    /FARMACÊUTIC/i, /FARMACEUTIC/i,
    /\b\d+\s*(MG|MCG|UI)\b/i,
    /LOTES?[:\s]+\d/i,  // "LOTES: 50031273" — padrão de suspensão de medicamentos
  ];

  const isMedProduto = (p: string) => PHARMA_PATTERNS.some(r => r.test(p));
  const isCosProduto = (p: string) =>
    /COSMÉTIC|COSMETICO|PERFUME|SHAMPOO|CONDICIONADOR|CREME FACIAL|CREME CORPORAL|PROTETOR SOLAR|HIGIENE PESSOAL|MAQUIAGEM/i.test(p);

  const buildMedInsight = (doc: any): string => {
    const nome = (doc.produto || '').substring(0, 60);
    const emp  = (doc.empresa  || '').split('/')[0].trim().substring(0, 40);
    if (doc.tipo_evento === 'SUSPENSÃO_DE_PRODUTO')
      return `⚠️ Medicamento "${nome}" (${emp}) suspenso — verifique impacto em abastecimento e substitutos no portfólio.`;
    if (doc.tipo_evento === 'AFE_CONCEDIDA')
      return `Nova empresa autorizada pela ANVISA (${emp}) — potencial novo fornecedor ou concorrente no segmento de medicamento.`;
    return `Novo medicamento "${nome}" deferido (${emp}) — avaliar impacto em portfólio terapêutico e cadeia de distribuição.`;
  };

  let fixedCategoria = 0;
  let fixedInsight = 0;
  let checkedTotal = 0;

  // ── Passe 1: categoria='Cosmético' mas produto é medicamento ─────────────
  let page1 = 0;
  let hasMore1 = true;
  do {
    const { data: docs } = await supabaseAdmin.from('dou_feed').select('*').eq('categoria', 'Cosmético').range(page1 * 100, page1 * 100 + 99);
    if (!docs || docs.length === 0) break;
    checkedTotal += docs.length;

    for (const doc of docs) {
      const produto = (doc.produto || '').toUpperCase();
      if (isMedProduto(produto) && !isCosProduto(produto)) {
        try {
          await supabaseAdmin.from('dou_feed').update({
            categoria: 'Medicamento',
            impacto_negocios: buildMedInsight(doc),
          }).eq('id', doc.id);
          fixedCategoria++;
        } catch { /* silencioso */ }
      }
    }
    hasMore1 = docs.length === 100;
    page1++;
  } while (hasMore1);

  // ── Passe 2: categoria='Medicamento' com insight errado ("cosmético") ────
  let page2 = 0;
  let hasMore2 = true;
  do {
    const { data: docs } = await supabaseAdmin.from('dou_feed').select('*').eq('categoria', 'Medicamento').range(page2 * 100, page2 * 100 + 99);
    if (!docs || docs.length === 0) break;
    checkedTotal += docs.length;

    for (const doc of docs) {
      const insight: string = (doc.impacto_negocios || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (insight.includes('cosmetico') || insight.includes('produto cosm')) {
        try {
          await supabaseAdmin.from('dou_feed').update({
            impacto_negocios: buildMedInsight(doc),
          }).eq('id', doc.id);
          fixedInsight++;
        } catch { /* silencioso */ }
      }
    }
    hasMore2 = docs.length === 100;
    page2++;
  } while (hasMore2);

  return NextResponse.json({ checkedTotal, fixedCategoria, fixedInsight });
}
