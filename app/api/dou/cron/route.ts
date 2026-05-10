import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { parseSearchHtml, parseFullArticleText, AnvisaArticleInfo } from '@/lib/dou-processor';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const COLLECTION_DOU = 'dou_feed';
const HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function formatDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
}

function getDatesToTry(): string[] {
  const dates: string[] = [];
  for (let i = 0; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates;
}

async function fetchText(url: string, headers: HeadersInit, timeoutMs: number): Promise<string> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Executa tasks com limite de concorrência — evita disparar centenas de requests simultâneos
async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

async function discoverArticles(segmento: 'medicamento' | 'cosmetico' | 'todos'): Promise<AnvisaArticleInfo[]> {
  const datesToTry = getDatesToTry();
  const seen = new Set<string>();
  const articles: AnvisaArticleInfo[] = [];

  let terms: string[];

  if (segmento === 'medicamento') {
    terms = [
      '"Concessão de Registro de Medicamento"',
      'GGMED DEFERIR',
      'GGMED "medicamento genérico"',
      'GGMED "medicamento similar"',
      'GGMED "medicamento novo"',
      'GGMED "produto biológico"',
      '"suspensão da comercialização" ANVISA medicamento',
      '"suspensão da fabricação" ANVISA medicamento',
      '"interdição cautelar de lote" ANVISA',
      'GGFIS ANVISA medicamento suspender',
      '"cancelamento do registro do medicamento"',
      '"caducidade de registro" ANVISA medicamento',
      '"cancelamento a pedido" ANVISA medicamento',
      'RESOLUÇÃO-RE GGMED',
    ];
  } else if (segmento === 'cosmetico') {
    terms = [
      'GGCOS',
      'GGCOS DEFERIR',
      'DEFERIR cosméticos GGCOS',
      'RESOLUÇÃO-RE GGCOS',
      'CANCELAMENTO registro cosmétic',
      'AUTORIZAÇÃO DE FUNCIONAMENTO cosmétic',
    ];
  } else {
    terms = [
      'GGMED', 'GGCOS',
      'Concessão de Registro de Medicamento',
      'Gerência-Geral de Medicamentos',
      'DEFERIR cosméticos GGCOS',
      'RESOLUÇÃO-RE ANVISA',
      'CANCELAMENTO registro ANVISA',
      'AUTORIZAÇÃO DE FUNCIONAMENTO ANVISA',
      'GGFIS',
    ];
  }

  const tasks = terms.flatMap(term =>
    datesToTry.map(dateStr => async () => {
      const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(term)}&s=do1&exactDate=personalizado&publishFrom=${dateStr}&publishTo=${dateStr}&sortType=0`;
      const html = await fetchText(url, HEADERS, 30000);
      return { articles: parseSearchHtml(html), dateStr, term };
    })
  );

  // Máximo 8 requisições simultâneas ao DOU (antes eram todas de uma vez)
  const allResults = await runConcurrent(tasks, 8);

  for (const r of allResults) {
    if (r.status === 'fulfilled' && r.value.articles.length > 0) {
      for (const a of r.value.articles) {
        if (!seen.has(a.urlTitle)) {
          seen.add(a.urlTitle);
          articles.push(a);
        }
      }
    }
  }

  console.log(`[DOU cron] segmento=${segmento} total=${articles.length} artigos de ${datesToTry.length} dias`);
  return articles;
}

// Vercel cron jobs disparam GET — redireciona para a lógica principal
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  const isAuthorizedCron = !secret || authHeader === `Bearer ${secret}`;
  const isInternalRequest = request.headers.get('x-internal-request') === '1';

  if (!isAuthorizedCron && !isInternalRequest) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const segmento = (url.searchParams.get('segmento') || 'todos') as 'medicamento' | 'cosmetico' | 'todos';
  const forceReprocess = url.searchParams.get('force') === 'true';

  try {
    const articles = await discoverArticles(segmento);
    console.log(`[DOU cron] Processando ${articles.length} artigos (segmento=${segmento}, force=${forceReprocess})...`);

    let totalSaved = 0;
    let totalSkipped = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    const CHUNK_SIZE = 4;
    for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
      const chunk = articles.slice(i, i + CHUNK_SIZE);
      console.log(`[DOU cron] Lote ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(articles.length/CHUNK_SIZE)}`);

      await Promise.allSettled(chunk.map(async (article) => {
        try {
          const pageHtml = await fetchText(
            `https://www.in.gov.br/web/dou/-/${article.urlTitle}`,
            { ...HEADERS, 'Referer': 'https://www.in.gov.br/consulta/-/buscar/dou' },
            35000,
          );

          if (forceReprocess) {
            const dossiePrefix = `dou-${article.urlTitle.substring(0, 50)}`;
            try {
              const { data: existing } = await supabaseAdmin
                .from(COLLECTION_DOU)
                .select('id')
                .ilike('dossie_id', `${dossiePrefix}%`)
                .limit(100);
              if (existing && existing.length > 0) {
                // DELETE em batch — uma query em vez de N
                const ids = existing.map(doc => doc.id);
                await supabaseAdmin.from(COLLECTION_DOU).delete().in('id', ids);
                totalDeleted += ids.length;
              }
            } catch {}
          }

          const $ = cheerio.load(pageHtml);
          $('.texto-dou').find('p, br, li, tr').each(function(this: any) { $(this).after('\n'); });
          const rawText = $('.texto-dou').text();
          const cleanText = rawText.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');

          if (!cleanText || cleanText.length < 50) return;

          const edicaoMatch = pageHtml.match(/[Ee]di[çc][aã]o[:\s]*[nN]?[ºo°]?\s*(\d+)/);
          const edicao = edicaoMatch ? edicaoMatch[1] : '';

          const products = parseFullArticleText(
            cleanText, article.hierarchyStr, article.urlTitle,
            article.pubDate, edicao, '1', article.numberPage || ''
          );

          const filteredProducts = products.filter(p => {
            if (segmento === 'medicamento') return p.categoria_detalhada === 'Medicamento';
            if (segmento === 'cosmetico') return p.categoria_detalhada.startsWith('Cosmético');
            return true;
          });

          if (filteredProducts.length === 0) return;

          console.log(`  📄 ${article.urlTitle.substring(0, 50)} → ${filteredProducts.length} ${segmento}(s)`);

          const documentsToSave: Record<string, any>[] = filteredProducts.map(item => ({
            tipo_evento:      item.tipo_evento,
            priority:         item.priority,
            empresa:          (item.empresa || '').substring(0, 500),
            produto:          (item.produto || '').substring(0, 500),
            categoria:        item.categoria_detalhada || 'Medicamento',
            impacto_negocios: (item.impacto_negocios || '').substring(0, 1000),
            numero_registro:  item.numero_registro || 'N/A',
            dossie_id:        (item.dossie_id || '').substring(0, 255),
            timestamp:        item.timestamp || new Date().toISOString(),
            technical_info:   (item.technical_info || '').substring(0, 500),
            ativos:           Array.isArray(item.ativos) ? item.ativos : ['Consulte Dossiê'],
          }));

          if (!forceReprocess && documentsToSave.length > 0) {
            // Verifica duplicatas em batch — 1 query para todos os items do artigo
            const dossieIds = documentsToSave.map(d => d.dossie_id).filter(Boolean);
            const { data: existingDossies } = dossieIds.length > 0
              ? await supabaseAdmin.from(COLLECTION_DOU).select('dossie_id').in('dossie_id', dossieIds)
              : { data: [] };
            const existingSet = new Set((existingDossies || []).map((d: any) => d.dossie_id));

            const novos = documentsToSave.filter(d => !existingSet.has(d.dossie_id));
            totalSkipped += documentsToSave.length - novos.length;

            if (novos.length > 0) {
              const { error: insertErr } = await supabaseAdmin.from(COLLECTION_DOU).insert(novos);
              if (insertErr) {
                errors.push(`Insert lote: ${insertErr.message?.substring(0, 80)}`);
              } else {
                totalSaved += novos.length;
              }
            }
          } else if (forceReprocess && documentsToSave.length > 0) {
            const { error: insertErr } = await supabaseAdmin.from(COLLECTION_DOU).insert(documentsToSave);
            if (insertErr) {
              errors.push(`Insert forceReprocess: ${insertErr.message?.substring(0, 80)}`);
            } else {
              totalSaved += documentsToSave.length;
            }
          }
        } catch (e: any) {
          errors.push(`Artigo ${article.urlTitle.substring(0, 30)}: ${e.message?.substring(0, 80)}`);
        }
      }));

      await new Promise(r => setTimeout(r, 1500));
    }

    return NextResponse.json({
      success: true,
      segmento,
      artigos_descobertos: articles.length,
      itens_salvos: totalSaved,
      itens_ignorados: totalSkipped,
      itens_deletados: totalDeleted,
      erros: errors.slice(0, 15),
      sincronizado_em: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[POST /api/dou/cron] Fatal:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
