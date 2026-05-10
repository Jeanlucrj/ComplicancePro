/**
 * scripts/sync-dou-cosmetico.ts
 * Sync manual do DOU para cosméticos — roda sem servidor Next.js.
 * Uso: npx tsx scripts/sync-dou-cosmetico.ts
 *      npx tsx scripts/sync-dou-cosmetico.ts --force   (re-processa duplicatas)
 *      npx tsx scripts/sync-dou-cosmetico.ts --dias=10  (busca últimos N dias)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { parseSearchHtml, parseFullArticleText } from '../lib/dou-processor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

const TERMS_COSMETICO = [
  'GGCOS',
  'GGCOS DEFERIR',
  'DEFERIR cosméticos GGCOS',
  'RESOLUÇÃO-RE GGCOS',
  'CANCELAMENTO registro cosmétic',
  'AUTORIZAÇÃO DE FUNCIONAMENTO cosmétic',
];

function formatDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const diasArg = args.find(a => a.startsWith('--dias='));
  const dias = diasArg ? parseInt(diasArg.split('=')[1]) : 7;

  // Gera datas dos últimos N dias
  const dates: string[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  BeautyProcure — Sync DOU Cosméticos             ║`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`Período: últimos ${dias} dias (${dates[dates.length-1]} → ${dates[0]})`);
  console.log(`Force: ${force}`);
  console.log('');

  // Descobre artigos
  console.log('🔍 Buscando artigos no DOU...');
  const seen = new Set<string>();
  const articles: any[] = [];

  const allResults = await Promise.allSettled(
    TERMS_COSMETICO.flatMap(term =>
      dates.map(dateStr =>
        axios.get(
          `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(term)}&s=do1&exactDate=personalizado&publishFrom=${dateStr}&publishTo=${dateStr}&sortType=0`,
          { headers: HEADERS, timeout: 30000 }
        ).then(r => ({ articles: parseSearchHtml(r.data), dateStr, term }))
      )
    )
  );

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

  console.log(`✅ ${articles.length} artigos encontrados\n`);

  if (articles.length === 0) {
    console.log('ℹ️  Nenhum artigo novo de cosméticos nos últimos', dias, 'dias.');
    return;
  }

  let salvos = 0, ignorados = 0, erros = 0;
  const CHUNK = 4;

  for (let i = 0; i < articles.length; i += CHUNK) {
    const chunk = articles.slice(i, i + CHUNK);
    console.log(`📦 Lote ${Math.floor(i/CHUNK)+1}/${Math.ceil(articles.length/CHUNK)}`);

    await Promise.allSettled(chunk.map(async (article) => {
      try {
        const { data: pageHtml } = await axios.get(
          `https://www.in.gov.br/web/dou/-/${article.urlTitle}`,
          { headers: { ...HEADERS, Referer: 'https://www.in.gov.br/consulta/-/buscar/dou' }, timeout: 35000 }
        );

        const $ = cheerio.load(pageHtml);
        $('.texto-dou').find('p, br, li, tr').each(function(this: any) { $(this).after('\n'); });
        const rawText = $('.texto-dou').text();
        const cleanText = rawText.split('\n').map((l: string) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');

        if (!cleanText || cleanText.length < 50) return;

        const edicaoMatch = pageHtml.match(/[Ee]di[çc][aã]o[:\s]*[nN]?[ºo°]?\s*(\d+)/);
        const edicao = edicaoMatch ? edicaoMatch[1] : '';

        const products = parseFullArticleText(
          cleanText, article.hierarchyStr, article.urlTitle,
          article.pubDate, edicao, '1', article.numberPage || ''
        );

        const cosmeticos = products.filter((p: any) =>
          p.categoria_detalhada?.startsWith('Cosmético') || p.categoria_detalhada === 'Cosmético'
        );

        if (cosmeticos.length > 0) {
          console.log(`  📄 ${article.urlTitle.substring(0, 55)} → ${cosmeticos.length} cosméticos`);
        }

        for (const item of cosmeticos) {
          try {
            if (!force) {
              const { data: check } = await supabase
                .from('dou_feed')
                .select('id')
                .eq('dossie_id', item.dossie_id)
                .limit(1);
              if (check && check.length > 0) { ignorados++; continue; }
            }

            const { error } = await supabase.from('dou_feed').insert([{
              tipo_evento:      item.tipo_evento,
              priority:         item.priority,
              empresa:          (item.empresa || '').substring(0, 500),
              produto:          (item.produto || '').substring(0, 500),
              categoria:        item.categoria_detalhada || 'Cosmético',
              impacto_negocios: (item.impacto_negocios || '').substring(0, 1000),
              numero_registro:  item.numero_registro || 'N/A',
              dossie_id:        (item.dossie_id || '').substring(0, 255),
              timestamp:        item.timestamp || new Date().toISOString(),
              technical_info:   (item.technical_info || '').substring(0, 500),
              ativos:           Array.isArray(item.ativos) ? item.ativos : ['Consulte Dossiê'],
            }]);

            if (error) { erros++; console.error('  ❌ Insert erro:', error.message); }
            else salvos++;
          } catch (e: any) {
            erros++;
            console.error('  ❌', e.message?.substring(0, 80));
          }
        }
      } catch (e: any) {
        erros++;
        console.error(`  ⚠️  ${article.urlTitle.substring(0, 40)}: ${e.message?.substring(0, 60)}`);
      }
    }));

    // Pausa entre lotes para não sobrecarregar o DOU
    if (i + CHUNK < articles.length) await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Resultado                                       ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  ✅ Salvos:    ${String(salvos).padEnd(34)}║`);
  console.log(`║  ⏭️  Ignorados: ${String(ignorados).padEnd(34)}║`);
  console.log(`║  ❌ Erros:     ${String(erros).padEnd(34)}║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
