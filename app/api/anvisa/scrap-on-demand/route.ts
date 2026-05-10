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

    // 1. Acessa a página principal para enganar o WAF (Cloudflare/F5) e obter o auth-token Guest
    await page.goto('https://consultas.anvisa.gov.br/#/cosmeticos/regularizados/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // 2. Extrai token de sessão

    const authHeaderRaw = await page.evaluate(() => {
      return sessionStorage.getItem('token') || 'Guest';
    });
    const authorization = authHeaderRaw === 'Guest' ? 'Guest' : `Bearer ${authHeaderRaw}`;

    // 3. URLs das APIs ANVISA
    const apiUrlRegularizados = `https://consultas.anvisa.gov.br/api/consulta/cosmeticos/regularizados?count=1000&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}`;
    const apiUrlRegistrados   = `https://consultas.anvisa.gov.br/api/consulta/cosmeticos/registrados?count=1000&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}`;

    // 4. Requisições REST da ANVISA dentro do browser (bypassa CORS/WAF)
    const evalArgs = [apiUrlRegularizados, apiUrlRegistrados, authorization] as [string, string, string];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — Playwright evaluate types não inferem tuple generics corretamente
    const responseData = await page.evaluate(async ([urlReg, urlRes, auth]: [string, string, string]) => {
      const fetchAnvisa = async (url: string) => {
        try {
          const res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json, text/plain, */*' } });
          if (!res.ok) return [];
          const data = await res.json();
          return data.content || data.produtos || [];
        } catch { return []; }
      };
      const [regularizados, registrados] = await Promise.all([fetchAnvisa(urlReg), fetchAnvisa(urlRes)]);
      return { regularizados, registrados };
    }, evalArgs);

    await browser.close();

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
