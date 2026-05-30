import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: playwrightChromium } = await import('playwright-core');
    return playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true });
}

function formatarCnpj(cnpjLimpo: string): string {
  return cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export async function GET(request: NextRequest) {
  const cnpj = request.nextUrl.searchParams.get('cnpj');
  if (!cnpj) return NextResponse.json({ error: 'CNPJ obrigatório' }, { status: 400 });

  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const cnpjMask  = formatarCnpj(cnpjLimpo);
  const cnpjRaiz  = cnpjLimpo.substring(0, 8);
  console.log(`[scrap-on-demand] CNPJ: ${cnpjLimpo} | formatado: ${cnpjMask}`);

  let browser;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Acessa o portal para bypassar WAF/Cloudflare e obter cookies de sessão
    await page.goto('https://consultas.anvisa.gov.br/#/cosmeticos/regularizados/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    const base = 'https://consultas.anvisa.gov.br/api/consulta/cosmeticos';

    // URLs de regularizados em ordem de prioridade — testa sequencialmente até achar resultado
    const urlsRegularizados = [
      `${base}/regularizados?count=500&offset=0&filter%5Bcnpj%5D=${encodeURIComponent(cnpjMask)}`,
      `${base}/regularizados?count=500&offset=0&filter%5BcnpjEmpresa%5D=${encodeURIComponent(cnpjMask)}`,
      `${base}/regularizados?count=500&offset=0&filter%5Bempresa.cnpj%5D=${encodeURIComponent(cnpjMask)}`,
      `${base}/regularizados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}`,
      `${base}/regularizados?count=500&offset=0&filter%5BcnpjEmpresa%5D=${cnpjLimpo}`,
      `${base}/regularizados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjRaiz}`,
    ];

    const urlsRegistrados = [
      `${base}/registrados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}`,
      `${base}/registrados?count=500&offset=0&filter%5Bcnpj%5D=${encodeURIComponent(cnpjMask)}`,
    ];

    // Executa dentro do browser (bypassa WAF) — testa URLs sequencialmente
    // @ts-expect-error — Playwright evaluate types
    const responseData = await page.evaluate(async ([urlsReg, urlsRes]: [string[], string[]]) => {
      const tryFetch = async (url: string) => {
        try {
          const res = await fetch(url, {
            headers: { Authorization: 'Guest', Accept: 'application/json, text/plain, */*' }
          });
          if (!res.ok) return { items: [], debug: `HTTP${res.status}`, keys: '' };
          const data = await res.json();
          const items = data.content || data.produtos || data.registros || data.items || data.lista || data.resultado || [];
          return { items, debug: `ok(${items.length})`, keys: Object.keys(data).join(',') };
        } catch (e: any) {
          return { items: [], debug: `ERR:${e.message}`, keys: '' };
        }
      };

      // Regularizados: testa sequencialmente, para na primeira URL que retornar itens
      let regularizados: any[] = [];
      const debugReg: string[] = [];
      for (let i = 0; i < urlsReg.length; i++) {
        const r = await tryFetch(urlsReg[i]);
        debugReg.push(`URL${i}:${r.debug}|keys:${r.keys}`);
        if (r.items.length > 0) {
          regularizados = r.items;
          break;
        }
      }

      // Registrados: testa sequencialmente também
      let registrados: any[] = [];
      const debugRes: string[] = [];
      for (let i = 0; i < urlsRes.length; i++) {
        const r = await tryFetch(urlsRes[i]);
        debugRes.push(`URL${i}:${r.debug}|keys:${r.keys}`);
        if (r.items.length > 0) {
          registrados = r.items;
          break;
        }
      }

      return { regularizados, registrados, debugReg, debugRes };
    }, [urlsRegularizados, urlsRegistrados]);

    await browser.close();

    console.log(`[scrap] Regularizados: ${(responseData as any).debugReg?.join(' | ')}`);
    console.log(`[scrap] Registrados:   ${(responseData as any).debugRes?.join(' | ')}`);

    const anvisa_produtos: any[] = [];

    (responseData.regularizados || []).forEach((p: any) => {
      anvisa_produtos.push({
        processo: p.processo || p.numeroProcesso || '',
        nome: p.nomeProduto || p.nome || '',
        tipo: 'Cosmético',
        sub_categoria: 'Regularizado',
        situacao: p.situacaoProdutoFormatado || p.situacaoProduto?.descricao || p.situacao || 'ATIVO',
        data_validade: (p.vencimento || p.dataVencimento)
          ? new Date(p.vencimento || p.dataVencimento).toLocaleDateString('pt-BR') : '',
        seguro_compra: true,
      });
    });

    (responseData.registrados || []).forEach((p: any) => {
      anvisa_produtos.push({
        processo: p.numeroProcesso || p.processo || '',
        nome: p.nomeProduto || p.nome || '',
        tipo: 'Cosmético',
        sub_categoria: 'Registrado',
        situacao: p.situacaoProduto?.descricao || p.situacao || 'ATIVO',
        data_validade: (p.dataVencimento || p.vencimento)
          ? new Date(p.dataVencimento || p.vencimento).toLocaleDateString('pt-BR') : '',
        seguro_compra: true,
      });
    });

    console.log(`[scrap-on-demand] Total: ${anvisa_produtos.length} produtos`);
    return NextResponse.json({ success: true, anvisa_produtos, total: anvisa_produtos.length });

  } catch (error: any) {
    if (browser) await browser.close();
    console.error(`[scrap-on-demand] ERRO:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
