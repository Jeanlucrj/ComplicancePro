/**
 * lib/dou-processor.ts
 * Pipeline de ingestão do DOU/ANVISA — foco em MEDICAMENTOS.
 *
 * Frases-chave monitoradas:
 *   CONCESSÃO:
 *     - "Concessão de Registro de Medicamento"
 *   SUSPENSÃO (GGFIS / Resolução-RE):
 *     - "suspensão da comercialização"
 *     - "Suspensão da fabricação, comercialização, distribuição e uso"
 *     - "Interdição cautelar de lote"
 *   CANCELAMENTO:
 *     - "Cancelamento do registro do medicamento"
 *     - "Caducidade de registro"
 *     - "Cancelamento a pedido"
 *
 * Filtro de órgão:
 *   - MINISTÉRIO DA SAÚDE / AGÊNCIA NACIONAL DE VIGILÂNCIA SANITÁRIA
 *   - Unidade Organizacional: GGMED, GGFIS, ou Resolução-RE
 *
 * Dados extraídos:
 *   - Número do Registro (13 dígitos)
 *   - Princípio Ativo (DCB)
 *   - Categoria Regulatória (Genérico, Similar, Novo, Biológico)
 *   - Empresa / CNPJ
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface DOUExtractionResult {
  tipo_evento: string;
  priority: 'alta' | 'media';
  empresa: string;
  cnpj_empresa?: string;
  produto: string;
  nome_produto?: string;
  categoria_detalhada: string;      // 'Medicamento'
  categoria_regulatoria?: string;   // 'Genérico' | 'Similar' | 'Novo' | 'Biológico' | 'Específico'
  principio_ativo?: string;         // DCB extraído
  ativos: string[];
  technical_info: string;
  impacto_negocios: string;
  numero_registro: string;          // 13 dígitos do registro ANVISA
  numero_processo?: string;
  numero_lote?: string;
  resolucao_re?: string;
  texto_base?: string;
  url_dou?: string;
  timestamp: string;
  dossie_id: string;
  edicao?: string;
  secao?: string;
  pagina?: string;
}

export interface AnvisaArticleInfo {
  urlTitle: string;
  title: string;
  pubDate: string;
  hierarchyStr: string;
  numberPage: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

// ── 1. Extrai artigos ANVISA de uma página de busca ───────────────────────────

export function parseSearchHtml(html: string): AnvisaArticleInfo[] {
  const articles: AnvisaArticleInfo[] = [];
  const seen = new Set<string>();

  const urlTitlePattern = /"urlTitle":"([^"]+)"/g;

  let m: RegExpExecArray | null;
  while ((m = urlTitlePattern.exec(html)) !== null) {
    const urlTitle = m[1];
    if (seen.has(urlTitle)) continue;

    const idx = m.index;
    const chunk = html.substring(idx, idx + 3000);

    const titleMatch   = chunk.match(/"title":"((?:[^"\\]|\\.)*)"/);
    const pubDateMatch = chunk.match(/"pubDate":"(\d{2}\/\d{2}\/\d{4})"/);
    const hierMatch    = chunk.match(/"hierarchyStr":"([^"]+)"/);

    if (!titleMatch || !pubDateMatch) continue;

    const hier = hierMatch ? hierMatch[1] : '';

    // Filtro de órgão: MINISTÉRIO DA SAÚDE / ANVISA / Vigilância Sanitária
    // Bug fix: usar apenas lowercase para evitar false negatives por case
    const hLower = hier.toLowerCase();
    const isAnvisa =
      hLower.includes('vigilância sanitária') ||
      hLower.includes('vigilancia sanitaria') ||
      hLower.includes('anvisa') ||
      hLower.includes('ministério da saúde') ||
      hLower.includes('ministerio da saude') ||
      hLower.includes('agência nacional de vigilância') ||
      hLower.includes('agencia nacional de vigilancia') ||
      hLower.includes('ggmed') ||
      hLower.includes('ggfis') ||
      hLower.includes('ggcos') ||
      hLower.includes('ggbio') ||
      hLower.includes('ggsan') ||
      hLower.includes('ggtps') ||
      hLower.includes('medicamento') ||
      hLower.includes('resolução-re') ||
      hLower.includes('resolucao-re');
    if (!isAnvisa) continue;

    const numberPageMatch = chunk.match(/"numberPage":"([^"]+)"/);

    seen.add(urlTitle);
    articles.push({
      urlTitle,
      title: titleMatch[1].replace(/<[^>]+>/g, '').replace(/\\"/g, '"'),
      pubDate: pubDateMatch[1],
      hierarchyStr: hier,
      numberPage: numberPageMatch ? numberPageMatch[1] : '',
    });
  }

  return articles;
}

// ── 2. Fetch + parse de um artigo completo ────────────────────────────────────

export async function fetchAndProcessDOU(url: string, hierarchyStrHint = ''): Promise<DOUExtractionResult[]> {
  const urlTitle = url.replace(/^https?:\/\/[^/]+\/[^/]+\/[^/]+\/-\//, '').replace(/\/$/, '');
  const articleUrl = `https://www.in.gov.br/web/dou/-/${urlTitle}`;

  try {
    const res = await axios.get(articleUrl, { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data as string);

    $('.texto-dou').find('p, br, li, tr').each((_, el) => {
      $(el).after('\n');
    });
    const rawText = $('.texto-dou').text();
    const text = rawText
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');

    if (!text || text.length < 50) {
      console.warn(`⚠️ texto-dou vazio para ${urlTitle}`);
      return [];
    }

    const pubDateMatch = (res.data as string).match(/pubDate":"(\d{2}\/\d{2}\/\d{4})/);
    const pubDate = pubDateMatch ? pubDateMatch[1] : '';

    const hierMatch = (res.data as string).match(/"hierarchyStr":"([^"]+)"/);
    const hierarchyStr = hierarchyStrHint || (hierMatch ? hierMatch[1] : '');

    const headerArea = (res.data as string).substring(0, 5000);
    const edicaoMatch = headerArea.match(/[Ee]di[çc][aã]o[:\s]*[nN]?[ºo°]?\s*(\d+)/);
    const secaoMatch  = headerArea.match(/[Ss]e[çc][aã]o[:\s]*(\d+)/);
    const paginaMatch = headerArea.match(/[Pp][áa]gina[:\s]*(\d+)/);
    const edicao = edicaoMatch ? edicaoMatch[1] : '';
    const secao  = secaoMatch  ? secaoMatch[1]  : '1';
    const pagina = paginaMatch ? paginaMatch[1] : '';

    return parseFullArticleText(text, hierarchyStr, urlTitle, pubDate, edicao, secao, pagina);
  } catch (err: any) {
    console.error(`❌ fetchAndProcessDOU(${url}):`, err.message);
    return [];
  }
}

// ── 3. Detecção de tipo de evento com frases exatas do DOU ───────────────────

function detectTipoEvento(text: string): { tipo_evento: string; priority: 'alta' | 'media' } {
  const upper = text.toUpperCase();

  // ── SUSPENSÃO (GGFIS / Resolução-RE) — prioridade ALTA ─────────────
  if (
    upper.includes('SUSPENSÃO DA COMERCIALIZAÇÃO') ||
    upper.includes('SUSPENSAO DA COMERCIALIZACAO') ||
    upper.includes('SUSPENSÃO DA FABRICAÇÃO') ||
    upper.includes('SUSPENSAO DA FABRICACAO') ||
    upper.includes('SUSPENDER') && upper.includes('COMERCIALIZAÇÃO') ||
    upper.includes('MEDIDA DE INTERESSE SANITÁRIO') && upper.includes('SUSPENSÃO') ||
    upper.includes('INTERDIÇÃO CAUTELAR') ||
    upper.includes('INTERDICAO CAUTELAR')
  ) {
    return { tipo_evento: 'SUSPENSÃO_DE_PRODUTO', priority: 'alta' };
  }

  // ── CANCELAMENTO — prioridade ALTA ─────────────────────────────────
  if (upper.includes('CADUCIDADE DE REGISTRO') || upper.includes('CADUCIDADE DO REGISTRO')) {
    return { tipo_evento: 'CADUCIDADE_DE_REGISTRO', priority: 'alta' };
  }

  if (upper.includes('CANCELAMENTO') && upper.includes('REGISTRO') && upper.includes('MEDICAMENTO')) {
    if (upper.includes('A PEDIDO')) {
      return { tipo_evento: 'CANCELAMENTO_A_PEDIDO', priority: 'media' };
    }
    return { tipo_evento: 'CANCELAMENTO_DE_REGISTRO', priority: 'alta' };
  }

  if (upper.includes('CANCELAMENTO A PEDIDO')) {
    return { tipo_evento: 'CANCELAMENTO_A_PEDIDO', priority: 'media' };
  }

  if (upper.includes('CANCELAMENTO') && upper.includes('REGISTRO')) {
    return { tipo_evento: 'CANCELAMENTO_DE_REGISTRO', priority: 'alta' };
  }

  // ── CONCESSÃO DE REGISTRO ──────────────────────────────────────────
  if (
    upper.includes('CONCESSÃO DE REGISTRO DE MEDICAMENTO') ||
    upper.includes('CONCESSAO DE REGISTRO DE MEDICAMENTO') ||
    upper.includes('CONCESSÃO DE REGISTRO') ||
    upper.includes('CONCESSAO DE REGISTRO')
  ) {
    return { tipo_evento: 'REGISTRO_CONCEDIDO', priority: 'media' };
  }

  // ── AFE ────────────────────────────────────────────────────────────
  if (upper.includes('AUTORIZAÇÃO DE FUNCIONAMENTO') || upper.includes(' AFE ')) {
    return { tipo_evento: 'AFE_CONCEDIDA', priority: 'media' };
  }

  // ── DEFERIR (genérico) ─────────────────────────────────────────────
  if (upper.includes('DEFERIR') || upper.includes('DEFERIDO')) {
    return { tipo_evento: 'REGISTRO_DEFERIDO', priority: 'media' };
  }

  return { tipo_evento: 'REGISTRO_DEFERIDO', priority: 'media' };
}

// ── 4. Detecção de categoria regulatória ─────────────────────────────────────

function detectCategoriaRegulatoria(text: string, hierarchyStr: string): string {
  const combined = (text + ' ' + hierarchyStr).toUpperCase();

  if (combined.includes('GENÉRICO') || combined.includes('GENERICO') || combined.includes('MEDICAMENTO GENÉRICO'))
    return 'Genérico';
  if (combined.includes('SIMILAR') || combined.includes('MEDICAMENTO SIMILAR'))
    return 'Similar';
  if (combined.includes('BIOLÓGIC') || combined.includes('BIOLOGICO') || combined.includes('PRODUTO BIOLÓGICO'))
    return 'Biológico';
  if (combined.includes('ESPECÍFICO') || combined.includes('ESPECIFICO') || combined.includes('MEDICAMENTO ESPECÍFICO'))
    return 'Específico';
  if (combined.includes('MEDICAMENTO NOVO') || combined.includes('NOVO MEDICAMENTO'))
    return 'Novo';
  if (combined.includes('FITOTERÁPIC') || combined.includes('FITOTERAPICO'))
    return 'Fitoterápico';

  return 'Referência';
}

// ── 5. Extração de princípio ativo (DCB) ─────────────────────────────────────

function extrairPrincipioAtivo(nomeProduto: string, textoContexto: string): string[] {
  const ativos = new Set<string>();
  const combined = nomeProduto + '\n' + textoContexto.substring(0, 3000);

  // Padrão 1: "PRINCÍPIO ATIVO: xxx" ou "Princípio ativo: xxx"
  const paMatch = combined.match(/[Pp]rinc[ií]pio\s+[Aa]tivo\s*[:=]\s*([^\n.;]+)/i);
  if (paMatch) {
    paMatch[1].split(/[,;+]/).forEach(a => {
      const clean = a.trim();
      if (clean.length >= 3) ativos.add(clean);
    });
  }

  // Padrão 2: "DCB: xxx" ou "(DCB: xxx)"
  const dcbMatch = combined.match(/DCB\s*[:=]\s*([^\n)]+)/i);
  if (dcbMatch) {
    dcbMatch[1].split(/[,;+]/).forEach(a => {
      const clean = a.trim();
      if (clean.length >= 3) ativos.add(clean);
    });
  }

  // Padrão 3: Ativos farmacêuticos conhecidos no nome do produto
  const FARMA_PATTERNS = [
    // Analgésicos / Anti-inflamatórios
    /\b(dipirona|paracetamol|ibuprofeno|diclofenaco|naproxeno|cetoprofeno|piroxicam|meloxicam|nimesulida|celecoxibe)\b/gi,
    // Antibióticos
    /\b(amoxicilina|azitromicina|cefalexina|ciprofloxacino|levofloxacino|metronidazol|doxiciclina|claritromicina|ceftriaxona|sulfametoxazol|trimetoprima|ampicilina|penicilina|tetraciclina|gentamicina|clindamicina|eritromicina|norfloxacino|nitrofurantoína)\b/gi,
    // Cardiovasculares
    /\b(losartana|enalapril|captopril|atenolol|propranolol|carvedilol|metoprolol|anlodipino|nifedipino|valsartana|hidroclorotiazida|furosemida|espironolactona|sinvastatina|atorvastatina|rosuvastatina|clopidogrel|varfarina|rivaroxabana|apixabana)\b/gi,
    // SNC / Psiquiátricos
    /\b(fluoxetina|sertralina|escitalopram|paroxetina|venlafaxina|duloxetina|amitriptilina|clonazepam|diazepam|alprazolam|lorazepam|zolpidem|risperidona|olanzapina|quetiapina|haloperidol|carbamazepina|valproato|lamotrigina|topiramato|gabapentina|pregabalina)\b/gi,
    // Gastro
    /\b(omeprazol|pantoprazol|esomeprazol|lansoprazol|ranitidina|domperidona|metoclopramida|ondansetrona|bromoprida|simeticona|lactulose)\b/gi,
    // Diabetes / Endócrino
    /\b(metformina|glibenclamida|glicazida|insulina|sitagliptina|dapagliflozina|empagliflozina|liraglutida|semaglutida|levotiroxina|propiltiouracil)\b/gi,
    // Anti-hipertensivos / Outros
    /\b(tadalafila|sildenafila|finasterida|dutasterida|tamsulosina|dexametasona|prednisona|prednisolona|betametasona|budesonida|montelucaste|salbutamol|formoterol|beclometasona|tiotropio)\b/gi,
    // Antivirais / Antirretrovirais
    /\b(oseltamivir|tenofovir|lamivudina|efavirenz|dolutegravir|atazanavir|ritonavir|sofosbuvir|daclatasvir|aciclovir|valaciclovir)\b/gi,
    // Oncológicos
    /\b(tamoxifeno|anastrozol|letrozol|imatinibe|erlotinibe|rituximabe|trastuzumabe|bevacizumabe|pembrolizumabe|nivolumabe)\b/gi,
    // Dosagens no nome (ex: "dipirona 500mg", "tadalafila 20mg")
    /\b(\w{4,})\s+\d+\s*(mg|mcg|ui|ml|g)\b/gi,
  ];

  for (const pat of FARMA_PATTERNS) {
    const matches = Array.from(nomeProduto.matchAll(pat));
    for (const match of matches) {
      const name = match[1] || match[0];
      const clean = name.trim().replace(/\s+\d+\s*(mg|mcg|ui|ml|g)$/i, '').trim();
      if (clean.length >= 3) ativos.add(clean);
    }
  }

  return ativos.size > 0 ? Array.from(ativos) : ['Consulte Dossiê'];
}

// ── 6. Extrai número de registro (13 dígitos) ───────────────────────────────

function extrairRegistro13Digitos(text: string): string | null {
  // Bug fix: formato com prefixo REG. (ex: REG.1.XXXX.XXXX.XXX-X)
  const comPreffixo = text.match(/\bREG\.?(\d\.\d{4}\.\d{4}\.\d{3}-\d)\b/i);
  if (comPreffixo) return comPreffixo[1].replace(/[.\-]/g, '');

  // Formato: 1.XXXX.XXXX.XXX-X (13 dígitos com pontos e hífen)
  const formatado = text.match(/\b(1\.\d{4}\.\d{4}\.\d{3}-\d)\b/);
  if (formatado) return formatado[1].replace(/[.\-]/g, '');

  // Formato contínuo: 13 dígitos começando com 1
  const continuo = text.match(/\b(1\d{12})\b/);
  if (continuo) return continuo[1];

  // Qualquer sequência de 9-13 dígitos (fallback)
  const generico = text.match(/\b(\d{9,13})\b/);
  if (generico) return generico[1];

  return null;
}

// ── 7. Extrai Resolução-RE do texto ──────────────────────────────────────────

function extrairResolucaoRE(text: string): string | null {
  const reMatch = text.match(/RESOLUÇÃO[- ]RE\s+(?:N[ºo°]\.?\s*)?(\d[\d.]+)/i);
  if (reMatch) return `RE ${reMatch[1]}`;
  
  const reMatch2 = text.match(/\bRE\s+(?:N[ºo°]\.?\s*)?(\d[\d.]+)\s*,?\s*DE\s+\d/i);
  if (reMatch2) return `RE ${reMatch2[1]}`;

  return null;
}

// ── 8. Extrai lote(s) do texto ───────────────────────────────────────────────

function extrairLote(text: string): string | null {
  const loteMatch = text.match(/[Ll]otes?\s*[:=]?\s*([A-Z0-9][\w\-./]+(?:\s*[,;e]\s*[A-Z0-9][\w\-./]+)*)/);
  if (loteMatch) return loteMatch[1].trim().substring(0, 200);
  return null;
}

// ── 9. Parser do texto-dou completo (linha a linha) ──────────────────────────

export function parseFullArticleText(
  text: string,
  hierarchyStr: string,
  urlTitle: string,
  pubDate: string,
  edicao = '',
  secao = '1',
  pagina = '',
): DOUExtractionResult[] {
  const results: DOUExtractionResult[] = [];

  // ── Timestamp ────────────────────────────────────────────────────────────
  let timestamp = new Date().toISOString();
  if (pubDate) {
    const [day, month, year] = pubDate.split('/');
    timestamp = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 9, 0, 0).toISOString();
  }

  // ── Tipo de evento (frases exatas) ────────────────────────────────────────
  const { tipo_evento, priority } = detectTipoEvento(text);

  // ── Categoria detalhada (Medicamento, Cosmético…) ─────────────────────────
  const categoria = detectCategory(hierarchyStr, text);

  // ── Categoria regulatória (Genérico, Similar, Novo…) ──────────────────────
  const categoriaReg = detectCategoriaRegulatoria(text, hierarchyStr);

  // ── Resolução-RE ──────────────────────────────────────────────────────────
  const resolucaoRE = extrairResolucaoRE(text);

  // ── Localiza o ANEXO ──────────────────────────────────────────────────────
  const anexoIdx = text.search(/ANEXO\b/i);
  const tableText = (anexoIdx > -1 ? text.substring(anexoIdx) : text).trim();

  // ── Divide em linhas limpas ───────────────────────────────────────────────
  const lines = tableText
    .split(/\n/)
    .map((l) => l.replace(/\r/g, '').trim())
    .filter(Boolean);

  // ── Padrões ───────────────────────────────────────────────────────────────
  const EMPRESA_RE = /^(.{3,})\s*[/–—-]\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s*$/;
  const EMPRESA_CNPJ_LABEL_RE = /^(?:[\d.]+\.?\s+)?(?:NOME\s+DA\s+EMPRESA:\s*)?(.+?)\s+(?:CNPJ:\s*)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i;
  // Bug fix: PROCESSO_RE expande para capturar REG.1.XXXX.XXXX.XXX-X na mesma linha
  const PROCESSO_RE = /^(?:Processo(?:\s+n[ºo°])?[:\s]*)?(?:N[ºo°]\.?\s*)?(25\d{3}[.\s]\d{5,6}[/\s]\d{4}-\d{2})(?:\s*[/\-–]\s*|\s+)(?:(REG\.?\s*\d[\d.\-]+|\d{9,13}))?/i;
  const REGISTRO_RE = /\b(\d{9,13})\b/;
  const PETICAO_RE = /^\d{1,8}\s*[-–]?\s*\d{0,8}\s*-\s*(REG|IVD|AFE|AFR|EPC|ESC|ISENTO|NOT|CANCEL|AUT|BPF)/i;
  const EXPEDIENTE_RE = /^\d{1,8}\s*\/\s*\d{2,4}$/;
  const SEPARATOR_RE = /^(?:[-_]\s*){5,}$/;
  const TABLE_HEADER_RE = /^(NOME\s+DA\s+EMPRESA|NOME\s+DO\s+PRODUTO|NÚMERO\s+DO\s+PROCESSO|PETIÇÃO|EXPEDIENTE|DOSSIÊ|ANEXO\b)/i;
  // Bug fix: GERÊNCIA sozinha no início é boilerplate; "Gerência-Geral de Medicamentos" no corpo é legítima
  // Removemos GERÊNCIA genérica e adicionamos apenas padrões ultra-específicos de boilerplate
  const BOILERPLATE_RE = /^(O\s+GERENTE|A\s+GERENTE|RESOLVE\b|ART\.\s*\d|ESTA\s+RESOLUÇÃO|PUBLICADO|EDIÇÃO|ÓRGÃO\s+DO|RESOLUÇÃO\s+DA\s+DIRETORIA|DIÁRIO\s+OFICIAL|SEÇÃO\s+I|MINISTÉRIO\s+DA\s+SAÚDE|AGÊNCIA\s+NACIONAL\s+DE\s+VIGILÂNCIA|ANVISA\s*$|BRASÍLIA|COORDENAÇÃO\s+GERAL|SUPERINTENDÊNCIA\s+DE|SECRETARIA\s+(DE|DO|DA|EXECUTIVA)|DEPARTAMENTO\s+DE|GABINETE\s+DO|ASSESSORIA\s+DE|DIRETORIA\s+DE|CONSIDERANDO\b|PARÁGRAFO\s+ÚNICO|INCISO\s+[IVXLC]+|VIGÊNCIA)/i;
  const GOV_UNIT_RE = /^(Coordenação|Gerência|Superintendência|Diretoria|Secretaria)\s+(de|Geral)/i;

  let currentEmpresa = '';
  let currentCNPJ = '';
  let pendingProdutos: string[] = [];
  let pendingProductLines: string[] = [];
  // Bug fix: armazena o número de registro do PROCESSO para usar no flush posterior
  let currentRegistroProcesso = 'N/A';

  const commitProduct = () => {
    if (pendingProductLines.length > 0) {
      const joined = pendingProductLines.join(' ').trim();
      if (joined.length >= 3 && !TABLE_HEADER_RE.test(joined) && !BOILERPLATE_RE.test(joined)) {
        pendingProdutos.push(joined);
      }
      pendingProductLines = [];
    }
  };

  const flush = (registro: string) => {
    commitProduct();
    if (!currentEmpresa) return;

    if (pendingProdutos.length === 0 && tipo_evento === 'AFE_CONCEDIDA') {
      pendingProdutos.push('Autorização de Funcionamento Institucional');
    }

    if (pendingProdutos.length === 0) return;

    const empresaFull = currentCNPJ ? `${currentEmpresa} / ${currentCNPJ}` : currentEmpresa;

    for (const produto of pendingProdutos) {
      if (!produto || produto.length < 3) continue;
      if (TABLE_HEADER_RE.test(produto)) continue;
      if (BOILERPLATE_RE.test(produto)) continue;

      const cleanProduto = produto.substring(0, 500);

      // Tenta extrair registro de 13 dígitos
      const reg13 = extrairRegistro13Digitos(registro) || extrairRegistro13Digitos(produto) || registro || 'N/A';

      // Extrai princípio ativo do nome do produto + contexto
      const ativos = extrairPrincipioAtivo(produto, text);

      // Extrai lote se for suspensão
      const lote = (tipo_evento === 'SUSPENSÃO_DE_PRODUTO') ? extrairLote(produto + ' ' + text.substring(0, 2000)) : null;

      const impacto = gerarImpactoNegocios(tipo_evento, categoria, produto, currentEmpresa, categoriaReg);
      const dossieId = `dou-${urlTitle.substring(0, 50)}-${reg13 || produto.substring(0, 20).replace(/\s+/g, '-')}`;

      results.push({
        tipo_evento,
        priority,
        empresa: empresaFull.substring(0, 500),
        cnpj_empresa: currentCNPJ,
        produto: cleanProduto,
        nome_produto: cleanProduto,
        categoria_detalhada: categoria,
        categoria_regulatoria: categoriaReg,
        principio_ativo: ativos.filter(a => a !== 'Consulte Dossiê').join(', ') || undefined,
        ativos,
        technical_info: gerarTechnicalInfo(tipo_evento, categoria, reg13, categoriaReg),
        impacto_negocios: impacto,
        numero_registro: reg13,
        numero_lote: lote || undefined,
        resolucao_re: resolucaoRE || undefined,
        dossie_id: dossieId,
        timestamp,
        edicao,
        secao,
        pagina,
      });
    }
    pendingProdutos = [];
  };

  // ── Máquina de estados linha a linha ─────────────────────────────────────
  type State = 'empresa' | 'produto';
  let state: State = 'empresa';

  for (const line of lines) {
    if (SEPARATOR_RE.test(line)) {
      commitProduct();
      state = 'empresa';
      continue;
    }

    if (TABLE_HEADER_RE.test(line)) continue;
    if (BOILERPLATE_RE.test(line)) continue;

    // -- Formato rotulado --
    const labeledEmpresaMatch = /^(?:\d+\.)?\s*Empresa\s*:\s*(.*?)(?:\s*-\s*CNPJ\s*:\s*(.*))?$/i.exec(line);
    if (labeledEmpresaMatch) {
      commitProduct();
      flush('N/A');
      let candidateName = labeledEmpresaMatch[1].trim();
      let candidateCNPJ = (labeledEmpresaMatch[2] || '').trim();
      if (candidateName.toUpperCase() === 'NÃO IDENTIFICADA' || candidateName.toUpperCase() === 'DESCONHECIDA') {
        candidateName = 'EMPRESA DESCONHECIDA';
      }
      currentEmpresa = candidateName;
      currentCNPJ = candidateCNPJ !== 'DESCONHECIDO' ? candidateCNPJ : '';
      state = 'produto';
      continue;
    }

    const labeledProdutoMatch = /^Produto(?:[^:]*):\s*(.*)$/i.exec(line);
    if (labeledProdutoMatch) {
      commitProduct();
      pendingProdutos.push(labeledProdutoMatch[1].trim());
      continue;
    }

    // Labels de dados complementares
    if (/^(Tipo de Produto|Expediente nº|Assunto|Ações de fiscalização|Proibição|Motivação)\b/i.test(line)) {
      commitProduct();
      continue;
    }

    // -- Detecção de empresa/processo --
    const empresaMatch = EMPRESA_RE.exec(line) || EMPRESA_CNPJ_LABEL_RE.exec(line);
    const processoMatch = PROCESSO_RE.exec(line);
    const isPeticao = PETICAO_RE.test(line);

    if (empresaMatch) {
      const candidateName = empresaMatch[1].trim();
      if (GOV_UNIT_RE.test(candidateName)) continue;
      commitProduct();
      flush('N/A');
      currentEmpresa = candidateName;
      currentCNPJ = empresaMatch[2].trim();
      state = 'produto';
      continue;
    }

    if (processoMatch) {
      // Bug fix: SEMPRE fazer flush ao encontrar novo PROCESSO (independente do state)
      // Extrai o número de registro da mesma linha (REG.1.XXXX ou apenas dígitos)
      const regBruto = processoMatch[2]?.trim() || '';
      const regLimpo =
        extrairRegistro13Digitos(regBruto) ||
        extrairRegistro13Digitos(line) ||
        (() => {
          const regMatch = REGISTRO_RE.exec(line);
          return regMatch ? regMatch[1] : 'N/A';
        })();
      // Se já tivemos empresa, faz flush do bloco anterior
      if (currentEmpresa || pendingProdutos.length > 0 || pendingProductLines.length > 0) {
        flush(currentRegistroProcesso);
      }
      // Guarda o registro para o próximo flush (após empresa+produto serem lidos)
      currentRegistroProcesso = regLimpo;
      state = 'empresa';
      continue;
    }

    if (isPeticao || EXPEDIENTE_RE.test(line)) {
      commitProduct();
      state = 'produto';
      continue;
    }

    // Linha de conteúdo de produto
    if (state === 'produto') {
      if (line.length < 3) continue;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) continue;
      if (/^\d{1,6}$/.test(line)) continue;
      if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(line)) continue;
      if (/^\/?\s*\d{5,}\s+\d+\s*-\s*(AFE|REG|IVD|ESC|EPC|AUT|NOT|BPF|CANCEL)/i.test(line)) continue;
      if (/^\d{7,}\s/.test(line) && /\s-\s/.test(line)) continue;
      if (GOV_UNIT_RE.test(line)) continue;
      if (/^MOTIVO\s+(DO|DA|DE)\s/i.test(line)) continue;
      if (/^(Cancelamento|Suspens[aã]o|Interdi[cç][aã]o)\s+(a\s+pedido|por\s+determinação|de\s+ofício)/i.test(line)) continue;
      if (/^(Conforme|De acordo|Nos termos|Em atendimento|Em cumprimento|Tendo em vista|Considerando que|Não cumprimento|Não apresentação|As ações de|Comprovação|Confirmação|A motivação|É de responsabilidade)/i.test(line)) continue;
      if (/^(Observa[cç][aã]o|Nota|OBS|N\.B\.)/i.test(line)) continue;

      pendingProductLines.push(line);
    }
  }

  // Flush final — usa o último registro de processo capturado
  flush(currentRegistroProcesso);

  // ── Deduplicação ──────────────────────────────────────────────────────────
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.numero_registro !== 'N/A' ? r.numero_registro : `${r.empresa}-${r.produto}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Detecta categoria (Medicamento, Cosmético…) ─────────────────────────────

function detectCategory(hierarchyStr: string, text: string): string {
  const hUpper = hierarchyStr.toUpperCase();
  const textStart = text.substring(0, 1500).toUpperCase();
  const fullU = text.toUpperCase();

  // Cosméticos (específico)
  if (hUpper.includes('COSMÉTICO') || hUpper.includes('COSMETICO') || hUpper.includes('GGCOS') ||
      textStart.includes('COSMÉTICOS E PERFUMES') || textStart.includes('PRODUTOS DE HIGIENE PESSOAL')) {
    const tl = text.toLowerCase();
    if (tl.includes('protetor solar') || tl.includes(' fps ') || tl.includes('fator de proteção') ||
        tl.includes('clareador') || tl.includes('anticaspa') || tl.includes('antiacne'))
      return 'Cosmético Grau 2';
    return 'Cosmético';
  }

  // Medicamentos — GGMED, GGFIS, GGBIO (explícito na hierarchy)
  if (hUpper.includes('GGMED') || hUpper.includes('GGBIO') || hUpper.includes('BIOLÓGIC')) {
    return 'Medicamento';
  }

  // GGFIS / Inspeção / Fiscalização — pode ser medicamento ou cosmético
  // Verificar texto para decidir
  if (hUpper.includes('GGFIS') || hUpper.includes('INSPEÇÃO') || hUpper.includes('FISCALIZAÇÃO')) {
    if (fullU.includes('COSMÉTIC') || fullU.includes('COSMETICO') || fullU.includes('HIGIENE PESSOAL')) {
      return 'Cosmético';
    }
    return 'Medicamento';
  }

  // Produto para Saúde
  if (hUpper.includes('TECNOLOGIA DE PRODUTOS PARA SAÚDE') || hUpper.includes('GGTPS') || hUpper.includes('IVD')) {
    return 'Produto para Saúde';
  }

  if (hUpper.includes('SANEANTE') || hUpper.includes('GGSAN')) return 'Saneante';
  if (hUpper.includes('ALIMENTO') || hUpper.includes('GGALI')) return 'Alimento';

  // Indicadores farmacêuticos no texto (registros de medicamento reais)
  const ehMedicamento =
    fullU.includes('MG/ML') || fullU.includes('MCG/ML') || fullU.includes('UI/ML') ||
    fullU.includes('MG/G')  || fullU.includes('MCG/G')  ||
    fullU.includes('FRASCO-AMPOLA') || fullU.includes('SOL INJ') || 
    fullU.includes('COMPRIMIDO') || fullU.includes('CÁPSULA') || fullU.includes('CAPSULA') ||
    fullU.includes('XAROPE') || fullU.includes('SUSPENSÃO ORAL') ||
    fullU.includes('INJETÁVEL') ||
    /\b\d+\s*(MG|MCG|UI)\b/.test(fullU);

  if (ehMedicamento) return 'Medicamento';

  // Hierarchy explicitamente menciona "MEDICAMENTO"
  if (hUpper.includes('MEDICAMENTO')) return 'Medicamento';

  // Fallback por palavras-chave no início do texto
  if (textStart.includes('CONCESSÃO DE REGISTRO DE MEDICAMENTO')) return 'Medicamento';
  if (textStart.includes('REGISTRO DE MEDICAMENTO')) return 'Medicamento';
  if (textStart.includes('MEDICAMENTO GENÉRICO')) return 'Medicamento';
  if (textStart.includes('MEDICAMENTO SIMILAR')) return 'Medicamento';
  if (textStart.includes('MEDICAMENTO NOVO')) return 'Medicamento';
  if (textStart.includes('COSMÉTIC')) return 'Cosmético';

  // AFE — detectar segmento pelo contexto do texto (NÃO assumir medicamento)
  if (hUpper.includes('AFE') || hUpper.includes('AUTORIZAÇÃO DE FUNCIONAMENTO') ||
      textStart.includes('AUTORIZAÇÃO DE FUNCIONAMENTO') || textStart.includes('AFE')) {
    // Palavras que indicam segmento farmacêutico/medicamento
    const ehFarma = fullU.includes('FARMACÊUTIC') || fullU.includes('FARMACEUTIC') ||
      fullU.includes('DROGARIA') || fullU.includes('LABORATÓRIO') || fullU.includes('LABORATORIO');
    // Palavras que indicam segmento cosmético
    const ehCosm = fullU.includes('COSMÉTIC') || fullU.includes('COSMETICO') ||
      fullU.includes('PERFUMARIA') || fullU.includes('HIGIENE PESSOAL');
    // Manipulação e insumos → Medicamento
    const ehManipulacao = fullU.includes('MANIPULAÇÃO') || fullU.includes('MANIPULACAO') ||
      fullU.includes('FARMÁCIA DE MANIPULAÇÃO') || fullU.includes('FARMACIA DE MANIPULACAO') ||
      fullU.includes('INSUMO FARMACÊUTIC') || fullU.includes('INSUMO FARMACEUTIC') ||
      fullU.includes('INSUMOS FARMACÊUTIC') || fullU.includes('INSUMOS FARMACEUTIC');
    // Distribuidora — depende do produto
    const ehDistribuidora = fullU.includes('DISTRIBUIDORA') || fullU.includes('DISTRIBUID');

    if (ehCosm && !ehFarma) return 'Cosmético';
    if (ehManipulacao || ehFarma) return 'Medicamento';
    if (ehDistribuidora) return 'Medicamento';  // Distribuidoras AFE geralmente são de medicamento
    
    // Se não conseguimos determinar, usar hint do texto mais amplo
    if (textStart.includes('MEDICAMENT')) return 'Medicamento';
    if (textStart.includes('COSMÉTIC') || textStart.includes('COSMETICO')) return 'Cosmético';
    return 'Medicamento';  // AFE sem contexto → medicamento (mais comum)
  }

  return 'Cosmético';
}

// ── Gera technical_info contextualizado ──────────────────────────────────────

function gerarTechnicalInfo(tipo_evento: string, categoria: string, registro: string, categoriaReg: string): string {
  if (tipo_evento === 'SUSPENSÃO_DE_PRODUTO') {
    return `⚠️ Suspensão pela ANVISA/GGFIS — produto retirado de circulação. Registro: ${registro}`;
  }
  if (tipo_evento === 'AFE_CONCEDIDA') {
    return `AFE concedida — empresa autorizada para fabricação/importação de ${categoria.toLowerCase()}.`;
  }
  if (tipo_evento === 'CADUCIDADE_DE_REGISTRO') {
    return `Registro caduco — empresa não renovou o registro decenal. Nº ${registro}`;
  }
  if (tipo_evento === 'CANCELAMENTO_DE_REGISTRO') {
    return `❌ Cancelamento de registro pela ANVISA. Nº ${registro}`;
  }
  if (tipo_evento === 'CANCELAMENTO_A_PEDIDO') {
    return `Cancelamento a pedido da empresa. Nº ${registro} — descontinuação voluntária.`;
  }
  if (tipo_evento === 'REGISTRO_CONCEDIDO') {
    return `✅ Concessão de Registro — Medicamento ${categoriaReg}. Nº ${registro}. Autorizado para comercialização.`;
  }
  if (categoria === 'Medicamento') {
    return `Registro deferido: Medicamento ${categoriaReg}. Nº ${registro} — autorização para comercialização.`;
  }
  return `Registro deferido pela ANVISA. Nº ${registro}.`;
}

// ── Gera impacto de negócios ─────────────────────────────────────────────────

function gerarImpactoNegocios(
  tipo_evento: string,
  categoria: string,
  produto: string,
  empresa: string,
  categoriaReg: string,
): string {
  const nomeProd = produto.substring(0, 60);
  const nomeEmp = empresa.split('/')[0].trim().substring(0, 40);

  if (tipo_evento === 'SUSPENSÃO_DE_PRODUTO') {
    return `⚠️ Medicamento "${nomeProd}" (${nomeEmp}) suspenso pela GGFIS — verificar impacto no abastecimento e buscar substitutos.`;
  }
  if (tipo_evento === 'CANCELAMENTO_DE_REGISTRO') {
    return `❌ Registro de "${nomeProd}" (${nomeEmp}) cancelado — produto retirado definitivamente do mercado.`;
  }
  if (tipo_evento === 'CANCELAMENTO_A_PEDIDO') {
    return `ℹ️ ${nomeEmp} cancelou registro de "${nomeProd}" — provável descontinuação ou substituição de linha.`;
  }
  if (tipo_evento === 'CADUCIDADE_DE_REGISTRO') {
    return `⏳ Registro de "${nomeProd}" (${nomeEmp}) expirou — empresa não renovou prazo decenal ANVISA.`;
  }
  if (tipo_evento === 'AFE_CONCEDIDA') {
    const seg = categoria === 'Cosmético' ? 'no segmento de cosméticos' : 'no segmento de medicamento';
    return `Nova empresa autorizada pela ANVISA (${nomeEmp}) — potencial novo fornecedor ou concorrente ${seg}.`;
  }
  if (tipo_evento === 'REGISTRO_CONCEDIDO') {
    return `✅ Novo medicamento ${categoriaReg} "${nomeProd}" registrado (${nomeEmp}) — avaliar impacto no portfólio terapêutico.`;
  }
  
  return `Novo medicamento "${nomeProd}" deferido (${nomeEmp}) — avaliar impacto em portfólio e cadeia de distribuição.`;
}

// ── Compatibilidade ──────────────────────────────────────────────────────────

export function parseDOUText(_rawHtml: string, _sourceUrl: string): DOUExtractionResult[] {
  return [];
}

export function parseSearchResult(_html: string, _sourceUrl: string): DOUExtractionResult[] {
  return [];
}
