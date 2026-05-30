import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function launchBrowser() {
  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: playwrightChromium } = await import('playwright-core');
    return playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    const { chromium } = await import('playwright');
    return chromium.launch({ headless: true });
  }
}

export async function GET(request: NextRequest) {
  const cnpj = request.nextUrl.searchParams.get('cnpj');
  if (!cnpj) {
    return NextResponse.json({ error: 'CNPJ obrigatório' }, { status: 400 });
  }

  const cnpjLimpo = cnpj.replace(/\D/g, '');
  console.log(`[scrap-on-demand] Iniciando extração via Playwright para o CNPJ: ${cnpjLimpo}`);

  let browser;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // 1. Acessa a página principal para contornar WAF e inicializar o Angular (gera o token de sessão)
    await page.goto('https://consultas.anvisa.gov.br/#/cosmeticos/regularizados/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // Espera o Angular carregar e persistir o token em sessionStorage (pode levar até 4s)
    await page.waitForTimeout(3500);

    // 2. Extrai token de sessão
    const authHeaderRaw = await page.evaluate(() => {
      return sessionStorage.getItem('token') || 'Guest';
    });
    const authorization = authHeaderRaw === 'Guest' ? 'Guest' : `Bearer ${authHeaderRaw}`;
    console.log(`[scrap-on-demand] Token: ${authHeaderRaw === 'Guest' ? 'Guest (sem sessão)' : 'Sessão ativa'}`);

    // 3. URLs das APIs ANVISA — múltiplos formatos para regularizados e registrados
    // O portal ANVISA usa o CNPJ formatado com máscara (ex: 14.053.642/0001-63)
    const cnpjRaiz = cnpjLimpo.substring(0, 8);
    const cnpjFormatado = cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    const cnpjFormatadoEnc = encodeURIComponent(cnpjFormatado);
    const base = 'https://consultas.anvisa.gov.br/api/consulta/cosmeticos';
    const urlsRegularizados = [
      // CNPJ formatado com máscara (formato que o portal ANVISA usa internamente)
      `${base}/regularizados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjFormatadoEnc}`,
      `${base}/regularizados?count=500&offset=0&filter%5BcnpjEmpresa%5D=${cnpjFormatadoEnc}`,
      `${base}/regularizados?count=500&offset=0&filter%5Bempresa.cnpj%5D=${cnpjFormatadoEnc}`,
      // CNPJ limpo (sem máscara)
      `${base}/regularizados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}`,
      `${base}/regularizados?count=500&offset=0&filter%5BcnpjEmpresa%5D=${cnpjLimpo}`,
      `${base}/regularizados?count=500&offset=0&filter%5Bempresa.cnpj%5D=${cnpjLimpo}`,
      // Raiz do CNPJ (8 dígitos)
      `${base}/regularizados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjRaiz}`,
    ];
    const urlsRegistrados = [
      `${base}/registrados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}`,
      `${base}/registrados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjFormatadoEnc}`,
      `${base}/registrados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjRaiz}`,
    ];

    // 4. Requisições REST da ANVISA dentro do browser (bypassa CORS/WAF)
    const evalArgs = [urlsRegularizados, urlsRegistrados, authorization] as [string[], string[], string];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — Playwright evaluate types não inferem tuple generics corretamente
    const responseData = await page.evaluate(async ([urlsReg, urlsRes, auth]: [string[], string[], string]) => {
      const fetchAnvisa = async (url: string) => {
        try {
          const res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json, text/plain, */*' } });
          if (!res.ok) return { items: [], debug: `HTTP${res.status}` };
          const data = await res.json();
          // Tenta todos os campos possíveis da resposta
          const items = data.content || data.produtos || data.registros || data.items || data.lista || data.resultado || data.notificacoes || [];
          return { items, debug: `ok(${items.length})`, rawKeys: Object.keys(data).join(',') };
        } catch (e: any) { return { items: [], debug: e.message, rawKeys: '' }; }
      };
      const dedup = (arr: any[]) => {
        const seen = new Set<string>();
        return arr.filter(p => {
          const k = p.processo || p.numeroProcesso || JSON.stringify(p);
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
      };
      const regResults = await Promise.all(urlsReg.map(fetchAnvisa));
      const resResults = await Promise.all(urlsRes.map(fetchAnvisa));
      const regularizados = dedup(regResults.flatMap(r => r.items));
      const registrados   = dedup(resResults.flatMap(r => r.items));
      const debugReg = regResults.map((r, i) => `URL${i}(${r.debug}|keys:${r.rawKeys})`);
      const debugRes = resResults.map((r, i) => `URL${i}(${r.debug}|keys:${r.rawKeys})`);
      return { regularizados, registrados, debugReg, debugRes };
    }, evalArgs);

    await browser.close();

    console.log(`[scrap] Debug Regularizados: ${(responseData as any).debugReg?.join(' | ')}`);
    console.log(`[scrap] Debug Registrados:   ${(responseData as any).debugRes?.join(' | ')}`);

    // 5. Formata no padrão que o front-end espera
    const anvisa_produtos: any[] = [];

    (responseData.regularizados || []).forEach((p: any) => {
      const dt_validade = (p.dataVencimento || p.vencimento)
        ? new Date(p.vencimento || p.dataVencimento).toLocaleDateString('pt-BR') : '';
      anvisa_produtos.push({
        processo: p.processo || p.numeroProcesso || '',
        nome: p.nomeProduto || p.nome || '',
        tipo: 'Cosmético',
        sub_categoria: 'Regularizado',
        situacao: p.situacaoProdutoFormatado || p.situacaoProduto?.descricao || p.situacao || 'ATIVO',
        data_validade: dt_validade,
        seguro_compra: true,
      });
    });

    (responseData.registrados || []).forEach((p: any) => {
      const dt_validade = (p.dataVencimento || p.vencimento)
        ? new Date(p.vencimento || p.dataVencimento).toLocaleDateString('pt-BR') : '';
      anvisa_produtos.push({
        processo: p.numeroProcesso || p.processo || '',
        nome: p.nomeProduto || p.nome || '',
        tipo: 'Cosmético',
        sub_categoria: 'Registrado',
        situacao: p.situacaoProduto?.descricao || p.situacao || 'ATIVO',
        data_validade: dt_validade,
        seguro_compra: true,
      });
    });

    console.log(`[scrap-on-demand] Sucesso! ${anvisa_produtos.length} produtos encontrados.`);
    return NextResponse.json({ success: true, anvisa_produtos, total: anvisa_produtos.length });

  } catch (error: any) {
    if (browser) await browser.close();
    console.error(`[scrap-on-demand] ERRO CRÍTICO no WAF:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
