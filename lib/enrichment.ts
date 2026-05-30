/**
 * lib/enrichment.ts
 * Módulo de enriquecimento de dados governamentais.
 * - Receita Federal: via BrasilAPI (gratuito, sem autenticação)
 * - ANVISA: via portal público de consulta (dados abertos .gov.br)
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from './supabase-server';

// ────────────────────────────────────────────────────────────────────────────
// ANVISA SESSION (cookie de sessão necessário para acesso à API)
// ────────────────────────────────────────────────────────────────────────────

let _anvisaSession: { cookie: string; expires: number } | null = null;

/**
 * Obtém um cookie de sessão do portal ANVISA fazendo uma requisição preflight.
 * Sem ele, a API retorna 403. Com ele, retorna os dados normalmente.
 * Cacheia por 10 minutos para não fazer round-trip a cada busca.
 */
async function getAnvisaSession(): Promise<string> {
  if (_anvisaSession && Date.now() < _anvisaSession.expires) {
    return _anvisaSession.cookie;
  }
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('https://consultas.anvisa.gov.br/', {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    const setCookieRaw = res.headers.get('set-cookie') || '';
    const match = setCookieRaw.match(/(dtCookie\w+=[^;]+)/);
    if (match) {
      _anvisaSession = { cookie: match[1], expires: Date.now() + 10 * 60 * 1000 };
      return _anvisaSession.cookie;
    }
  } catch (e) {
    // falha silenciosa — tenta sem cookie
  }
  return '';
}

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface ReceitaFederalData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: number;           // 2 = Ativa
  descricao_situacao_cadastral: string; // ex: "ATIVA"
  data_inicio_atividade: string;
  data_situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  email: string | null;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  porte: string;
  natureza_juridica: string;
  capital_social: number;
  qsa: Array<{ nome_socio: string; qualificacao_socio: string }>;
}

export interface AnvisaProduct {
  processo: string;
  nome: string;
  tipo: string;
  situacao: string;
  data_inicial: string;
  data_validade: string;
  vencimento_limpo?: string | null;
  seguro_compra?: boolean;
  registro_ativo: boolean;
  sub_categoria?: 'Registrado' | 'Regularizado' | string;
}

export interface AnvisaConsultaResult {
  status: 'REGULAR' | 'IRREGULAR' | 'CANCELADA' | 'PENDENTE' | 'NAO_ENCONTRADA' | 'ERRO';
  descricao: string;
  fonte: string;
}

export interface EnrichmentResult {
  receita: ReceitaFederalData | null;
  anvisa: AnvisaConsultaResult;
  anvisa_produtos: AnvisaProduct[];
  erros: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// RECEITA FEDERAL (via BrasilAPI)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Consulta dados da Receita Federal via BrasilAPI (gratuito).
 * Endpoint: https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 */
export async function consultarReceitaFederal(cnpj: string): Promise<ReceitaFederalData | null> {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  
  if (cnpjLimpo.length !== 14) {
    throw new Error(`CNPJ inválido: ${cnpj}. Deve ter 14 dígitos numéricos.`);
  }

  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'DataControl/1.0',
    },
    signal: controller.signal,
    next: { revalidate: 3600 },
  });
  clearTimeout(timeout);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`CNPJ ${cnpjLimpo} não encontrado na Receita Federal.`);
    }
    const errorText = await response.text();
    throw new Error(`Erro BrasilAPI (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data as ReceitaFederalData;
}

/**
 * Mapeia situação cadastral da Receita Federal para status legível.
 */
export function mapearSituacaoReceita(situacao: number): string {
  const codigos: { [k: number]: string } = {
    1: 'NULA',
    2: 'ATIVA',
    3: 'SUSPENSA',
    4: 'INAPTA',
    8: 'BAIXADA',
  };
  return codigos[situacao] || 'DESCONHECIDA';
}

// ────────────────────────────────────────────────────────────────────────────
// ANVISA (via portal público de dados abertos)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Consulta situação da empresa na ANVISA.
 * 
 * Estratégias (em ordem de prioridade):
 * 1. Portal ANVISA consultas (com headers corretos que o browser usaria)
 * 2. Inferência inteligente baseada no CNAE da Receita Federal
 *    - CNAEs de cosméticos/farmacêuticos = "Regularidade inferida"
 *    - Outros = "Não verificado diretamente"
 */
function buscarAfeNoCsvLocal(cnpjLimpo: string): AnvisaConsultaResult | null {
  try {
    const csvPath = path.join(process.cwd(), 'Arquivos CSV', 'TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV');
    const content = fs.readFileSync(csvPath, 'latin1');
    const lines = content.split('\n');
    const header = lines[0].split(';');

    const idxCnpj      = header.indexOf('NU_CNPJ');
    const idxAtivo     = header.indexOf('ATIVO');
    const idxTipo      = header.indexOf('TIPO_PRODUTO');
    const idxNum       = header.indexOf('NU_AUTORIZACAO_NOVO');
    const idxAtividades = header.indexOf('ATIVIDADES');

    if (idxCnpj === -1 || idxAtivo === -1) return null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(';');
      const cnpjCol = (cols[idxCnpj] || '').replace(/["\s]/g, '');
      if (cnpjCol !== cnpjLimpo) continue;

      const ativo = (cols[idxAtivo] || '').replace(/"/g, '').trim().toUpperCase();
      const tipo  = (cols[idxTipo]  || '').replace(/"/g, '').trim();
      const num   = (cols[idxNum]   || '').replace(/"/g, '').trim();
      const atividades = (cols[idxAtividades] || '').replace(/"/g, '').trim();

      if (ativo === 'SIM') {
        return {
          status: 'REGULAR',
          descricao: `Autorização ativa no CSV ANVISA: ${tipo}${num ? ' nº ' + num : ''}. ${atividades ? 'Atividades: ' + atividades : ''}`.trim(),
          fonte: 'ANVISA',
        };
      } else {
        return {
          status: 'IRREGULAR',
          descricao: `Autorização inativa na ANVISA: ${tipo}${num ? ' nº ' + num : ''}.`,
          fonte: 'ANVISA',
        };
      }
    }
  } catch {
    // CSV não encontrado ou ilegível — ignora silenciosamente
  }
  return null;
}

export async function consultarAnvisa(cnpj: string): Promise<AnvisaConsultaResult> {
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  // 1. Banco local Supabase (anvisa_afe sincronizado via script semanal)
  try {
    const { data: afeLocal } = await supabaseAdmin
      .from('anvisa_afe')
      .select('*')
      .eq('cnpj', cnpjLimpo);

    if (afeLocal && afeLocal.length > 0) {
      const isAtiva = (s: string) => s === 'Ativa' || s === 'SIM' || s?.toUpperCase() === 'SIM';
      const ativa = afeLocal.some((a: any) => isAtiva(a.situacao));
      const atividades = Array.from(new Set(afeLocal.map((a: any) => a.tipo_autorizacao))).join(' / ');
      return {
        status: ativa ? 'REGULAR' : 'IRREGULAR',
        descricao: `Autorização ${atividades} ativa na ANVISA: ${afeLocal[0].numero_autorizacao || 'Registrada'}`,
        fonte: 'ANVISA',
      };
    }
  } catch {
    // banco inacessível — segue para as próximas fontes
  }

  // 2. Portal ANVISA ao vivo
  const urlsToTry = [
    `https://consultas.anvisa.gov.br/api/empresa/funcionamento?filter%5Bcnpj%5D=${cnpjLimpo}`,
    `https://consultas.anvisa.gov.br/api/cosmetico/1/empresa/?count=5&offset=0&cnpj=${cnpjLimpo}`,
  ];

  try {
    const sessionCookie = await getAnvisaSession();
    const anvisaController = new AbortController();
    const anvisaTimeout = setTimeout(() => anvisaController.abort(), 4000);
    const responses = await Promise.all(
      urlsToTry.map(url => fetch(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Authorization': 'Guest',
          'Origin': 'https://consultas.anvisa.gov.br',
          'Referer': 'https://consultas.anvisa.gov.br/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
        },
        signal: anvisaController.signal,
        next: { revalidate: 7200 },
      }).then(res => res.ok ? res.json() : null).catch(() => null))
    );
    clearTimeout(anvisaTimeout);

    for (const data of responses) {
      if (!data) continue;

      const authCosmetico = data.empresaAutorizacao;
      if (authCosmetico && Array.isArray(authCosmetico) && authCosmetico.length > 0) {
        const ativa = authCosmetico.find((a: any) => a.ativa === true);
        if (ativa) {
          const listaAtividades = authCosmetico
            .filter((a: any) => a.ativa === true)
            .map((a: any) => a.tipoProduto || a.tipoAutorizacao)
            .join(', ');
          return {
            status: 'REGULAR',
            descricao: `AFE Cosméticos Regular para: ${listaAtividades}`,
            fonte: 'ANVISA Portal',
          };
        }
      }

      const content = data.content;
      if (content && Array.isArray(content) && content.length > 0) {
        const empresasFiltradas = content.filter((e: any) => e.cnpj === cnpjLimpo);
        const alvo = empresasFiltradas.length > 0 ? empresasFiltradas[0] : content[0];
        return {
          status: 'REGULAR',
          descricao: `AFE Regular: Autorização ${alvo.autorizacao || alvo.numeroAutorizacao || 'Registrada'}`,
          fonte: 'ANVISA Portal',
        };
      }
    }
  } catch (e) {
    console.error(`[consultarAnvisa] Falha na consulta ao portal:`, e);
  }

  // 3. CSV local semanal — fonte de verdade quando portal está inacessível ou não encontrou
  const csvResult = buscarAfeNoCsvLocal(cnpjLimpo);
  if (csvResult) return csvResult;

  return {
    status: 'NAO_ENCONTRADA',
    descricao: 'Empresa não encontrada no portal ANVISA nem no CSV de funcionamento baixado semanalmente.',
    fonte: 'ANVISA',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// CSV LOCAL (tmp/cosmeticos.csv — snapshot ANVISA regularizados)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lê o CSV local de cosméticos regularizados e filtra pelo CNPJ.
 * Encoding latin1, separador ';', ~51K linhas.
 */
function buscarProdutosCSV(cnpjLimpo: string): AnvisaProduct[] {
  const results: AnvisaProduct[] = [];

  // ── Fonte 1: cosmeticos.csv (Registrados - Grau 2) ────────────────────────
  try {
    const csvPath = path.join(process.cwd(), 'tmp', 'cosmeticos.csv');
    const content = fs.readFileSync(csvPath, 'latin1');
    const lines = content.split('\n');
    const header = lines[0].split(';');

    const idxCNPJ      = header.indexOf('NU_CNPJ_EMPRESA');
    const idxNome      = header.indexOf('NO_PRODUTO');
    const idxProcesso  = header.indexOf('NU_PROCESSO');
    const idxRegistro  = header.indexOf('NU_REGISTRO_PRODUTO');
    const idxVencimento = header.indexOf('DT_VENCIMENTO_REGISTRO');
    const idxSituacao  = header.indexOf('ST_SITUACAO_REGISTRO');

    if (idxCNPJ !== -1 && idxNome !== -1) {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(';');
        if (cols[idxCNPJ]?.replace(/\D/g, '') !== cnpjLimpo) continue;
        const situacao = (cols[idxSituacao] || '').trim();
        if (situacao !== 'ATIVO') continue;
        const vRaw = (cols[idxVencimento] || '').trim();
        let vencimento = '';
        const mDt = vRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (mDt) vencimento = `${mDt[3]}-${mDt[1]}-${mDt[2]}`;
        const temRegistro = idxRegistro !== -1 && (cols[idxRegistro] || '').trim() !== '';
        results.push({
          processo:       (cols[idxProcesso] || '').trim(),
          nome:           (cols[idxNome] || '').trim(),
          tipo:           'Cosmético',
          sub_categoria:  temRegistro ? 'Registrado' : 'Regularizado',
          situacao,
          data_inicial:   '',
          data_validade:  vencimento,
          vencimento_limpo: vencimento || null,
          seguro_compra:  true,
          registro_ativo: true,
        });
      }
    }
  } catch (_) {
    // CSV de registrados não disponível — tudo bem, usamos o de regularizados
  }

  // ── Fonte 2: cosmeticos_regularizados.csv (Regularizados - Grau 1) ────────
  // Gerado por scripts/update-csv.ts --isentos a partir de dados.anvisa.gov.br (CKAN)
  try {
    const regPath = path.join(process.cwd(), 'tmp', 'cosmeticos_regularizados.csv');
    const content = fs.readFileSync(regPath, 'utf-8');
    const lines = content.split('\n');
    const header = lines[0].split(';');

    // Detecta as colunas (o CKAN usa nomes diferentes do CSV de registrados)
    const findCol = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i !== -1) return i;
      }
      return -1;
    };

    const idxCNPJ      = findCol('NU_CNPJ_EMPRESA', 'CNPJ', 'cnpj');
    const idxNome      = findCol('NO_PRODUTO', 'NOME_PRODUTO', 'nomeProduto', 'nome');
    const idxProcesso  = findCol('NU_PROCESSO', 'NUMERO_PROCESSO', 'processo');
    const idxSituacao  = findCol('ST_SITUACAO_REGISTRO', 'DS_SITUACAO_REGISTRO', 'situacao', 'SITUACAO');

    if (idxCNPJ !== -1 && idxNome !== -1) {
      const seenProcessos = new Set(results.map(p => p.processo).filter(Boolean));

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(';');
        if ((cols[idxCNPJ] || '').replace(/\D/g, '') !== cnpjLimpo) continue;
        const situacao = (cols[idxSituacao] || 'ATIVO').trim();
        if (situacao.toLowerCase().includes('inativ') || situacao.toLowerCase().includes('cancel')) continue;
        const processo = (cols[idxProcesso] || '').trim();
        if (seenProcessos.has(processo)) continue; // já está nos registrados
        seenProcessos.add(processo);
        results.push({
          processo,
          nome:           (cols[idxNome] || '').trim(),
          tipo:           'Cosmético',
          sub_categoria:  'Regularizado',
          situacao:       situacao || 'ATIVO',
          data_inicial:   '',
          data_validade:  '',
          vencimento_limpo: null,
          seguro_compra:  true,
          registro_ativo: true,
        });
      }
    }
  } catch (_) {
    // CSV de regularizados ainda não existe — será criado pelo scripts/update-csv.ts
  }

  console.log(`[buscarProdutosCSV] ${results.length} produto(s) no CSV para CNPJ ${cnpjLimpo}`);
  return results;
}


// Cache do resource_id do CKAN para cosméticos (evita round-trip extra a cada busca)
let _cosmeticsResourceId: string | null = null;

/**
 * Busca produtos de cosméticos no portal dados.anvisa.gov.br via API CKAN.
 * Esta fonte NÃO tem proteção bot e retorna apenas os registros do CNPJ desejado.
 */
async function buscarProdutosCKAN(cnpjLimpo: string): Promise<AnvisaProduct[]> {
  try {
    // Descobrir resource_id (com cache em memória)
    if (!_cosmeticsResourceId) {
      const ctrlPkg = new AbortController();
      setTimeout(() => ctrlPkg.abort(), 6000);
      const pkgRes = await fetch(
        'https://dados.anvisa.gov.br/api/3/action/package_show?id=cosmeticos-produtos-regularizados',
        { signal: ctrlPkg.signal }
      );
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        const resources: any[] = pkgData.result?.resources || [];
        const csvResource = resources.find((r: any) =>
          r.format?.toUpperCase() === 'CSV' || r.url?.toLowerCase().includes('.csv')
        );
        if (csvResource?.id) _cosmeticsResourceId = csvResource.id;
      }
    }

    if (!_cosmeticsResourceId) {
      console.warn('[buscarProdutosCKAN] resource_id não encontrado no package ANVISA.');
      return [];
    }

    const ctrlDs = new AbortController();
    setTimeout(() => ctrlDs.abort(), 10000);
    const dsRes = await fetch(
      `https://dados.anvisa.gov.br/api/3/action/datastore_search?resource_id=${encodeURIComponent(_cosmeticsResourceId)}&filters={"NU_CNPJ_EMPRESA":"${cnpjLimpo}"}&limit=200`,
      { signal: ctrlDs.signal }
    );
    if (!dsRes.ok) return [];

    const dsData = await dsRes.json();
    if (!dsData.success || !dsData.result?.records?.length) return [];

    console.log(`[buscarProdutosCKAN] ${dsData.result.records.length} produto(s) encontrado(s) via CKAN para CNPJ ${cnpjLimpo}`);

    return (dsData.result.records as any[]).map((row) => ({
      processo: String(row['NU_PROCESSO'] || ''),
      nome: String(row['NO_PRODUTO'] || ''),
      tipo: 'Cosmético',
      sub_categoria: 'Regularizado',
      situacao: String(row['DS_SITUACAO_REGISTRO'] || 'ATIVO'),
      data_inicial: '',
      data_validade: String(row['DT_VENCIMENTO'] || ''),
      vencimento_limpo: row['DT_VENCIMENTO'] ? String(row['DT_VENCIMENTO']) : null,
      seguro_compra: true,
      registro_ativo: true,
    }));
  } catch (e) {
    console.warn('[buscarProdutosCKAN] Falhou (CKAN indisponível):', e);
    return [];
  }
}

// CNAEs relacionados a cosméticos
const CNAES_COSMETICOS = new Set([
  2063100, 2061400, 2062200,
  4646001, 4646002,
  4772500, 9602501, 9602502, 4713001,
]);

// CNAEs relacionados a medicamentos
const CNAES_MEDICAMENTOS = new Set([
  2110600, 2121101, 2121102, 2122000,
  4644301, 4644302, 4645101,
  4771701, 4771702,
]);

/**
 * Tenta buscar cosméticos REGULARIZADOS (Notificados) diretamente na API pública da ANVISA.
 */
function mapAnvisaCosmeticoContent(content: any[]): AnvisaProduct[] {
  return content.map((p: any) => {
    const tp = (p.tipoPeticao || '').toUpperCase();
    const reg = (p.numeroRegistro || p.registro || '').trim();
    
    // Grade 1 (Regularizado/Notificado) costuma ter "ISENTO" ou "NOTIFICACAO" na petição.
    // Grade 2 (Registrado) tem "CONCESSÃO" ou "REGISTRO" e NÃO tem "ISENTO".
    const ehIsento = tp.includes('ISENTO') || tp.includes('NOTIFICAÇÃO') || tp.includes('NOTIFICACAO');
    const temPalavraRegistro = tp.includes('REGISTRO') || tp.includes('CONCESSÃO') || tp.includes('CONCESSAO');
    
    // Um produto é "Registrado" se tem um número de registro E a petição não diz que é isento.
    const ehRegistrado = reg !== '' && temPalavraRegistro && !ehIsento;
    
    return {
      processo: p.processo || p.numeroProcesso || '',
      nome: p.nomeProduto || p.nome || '',
      tipo: 'Cosmético',
      sub_categoria: ehRegistrado ? 'Registrado' : 'Regularizado',
      situacao: p.situacaoProdutoFormatado || p.situacaoProduto?.descricao || p.situacao || 'ATIVO',
      data_inicial: '',
      data_validade: p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : (p.dataVencimento || ''),
      vencimento_limpo: p.vencimento || p.dataVencimento || null,
      seguro_compra: p.situacaoProduto === 'S' || p.situacaoProdutoFormatado === 'ATIVO',
      registro_ativo: p.situacaoProduto === 'S' || p.situacaoProdutoFormatado === 'ATIVO',
    };
  });
}

async function buscarCosmeticosRegularizadosAnvisaAPI(cnpjLimpo: string): Promise<AnvisaProduct[]> {
  const url = `https://consultas.anvisa.gov.br/api/consulta/cosmeticos/regularizados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}`;
  try {
    const sessionCookie = await getAnvisaSession();
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Guest',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Origin': 'https://consultas.anvisa.gov.br',
        'Referer': 'https://consultas.anvisa.gov.br/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return mapAnvisaCosmeticoContent(data.content || data.produtos || []);
  } catch (e) {
    console.error('[buscarCosmeticosRegularizadosAnvisaAPI] Erro:', e);
    return [];
  }
}

/**
 * Tenta buscar cosméticos REGISTRADOS diretamente na API pública da ANVISA.
 */
async function buscarCosmeticosRegistradosAnvisaAPI(cnpjLimpo: string): Promise<AnvisaProduct[]> {
  const url = `https://consultas.anvisa.gov.br/api/consulta/cosmeticos/registrados?count=500&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}`;
  try {
    const sessionCookie = await getAnvisaSession();
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Guest',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Origin': 'https://consultas.anvisa.gov.br',
        'Referer': 'https://consultas.anvisa.gov.br/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
      signal: ctrl.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const content: any[] = data.content || data.produtos || [];
    return content.map((p: any) => ({
      processo: p.numeroProcesso || p.processo || '',
      nome: p.nomeProduto || p.nome || '',
      tipo: 'Cosmético',
      sub_categoria: 'Registrado',
      situacao: p.situacaoProduto?.descricao || p.situacao || 'ATIVO',
      data_inicial: '',
      data_validade: p.dataVencimento || '',
      vencimento_limpo: p.dataVencimento || null,
      seguro_compra: true,
      registro_ativo: true,
    }));
  } catch (e) {
    console.error('[buscarCosmeticosRegistradosAnvisaAPI] Erro:', e);
    return [];
  }
}

/**
 * Tenta buscar medicamentos diretamente na API pública da ANVISA.
 */
async function buscarMedicamentosAnvisaAPI(cnpjLimpo: string): Promise<AnvisaProduct[]> {
  const url = `https://consultas.anvisa.gov.br/api/consulta/medicamento/produtos/?count=1000&offset=0&filter%5Bcnpj%5D=${cnpjLimpo}&filter%5BcheckRegistrado%5D=true&filter%5BcheckNotificado%5D=true`;
  try {
    const sessionCookie = await getAnvisaSession();
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Guest',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Origin': 'https://consultas.anvisa.gov.br',
        'Referer': 'https://consultas.anvisa.gov.br/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
      signal: ctrl.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const content: any[] = data.content || [];
    
    return content.map((item: any) => ({
      processo: item.processo?.numero || item.numeroProcesso || '',
      nome: item.produto?.nome || item.nomeProduto || '',
      tipo: 'Medicamento',
      sub_categoria: item.produto?.tipoAutorizacao || 'Registrado',
      situacao: 'ATIVO',
      data_inicial: '',
      data_validade: item.produto?.dataVencimento || '',
      vencimento_limpo: item.produto?.dataVencimento || null,
      seguro_compra: true,
      registro_ativo: true,
    }));
  } catch (e) {
    console.error('[buscarMedicamentosAnvisaAPI] Erro:', e);
    return [];
  }
}


/**
 * Busca lista de produtos regularizados (cosméticos/medicamentos).
 * 
 * Parâmetros:
 * - cnpj: CNPJ da empresa (com ou sem máscara)
 * - tipo: 'cosmetico' | 'medicamento' | 'ambos' — determina qual base consultar
 * @param forceAPI - Se true, ignora o banco local e busca apenas na API da ANVISA
 * @param forceLive - Se true, força a busca na API live mesmo se houver dados locais
 */
export async function buscarProdutosAnvisa(
  cnpj: string, 
  tipo: 'cosmetico' | 'medicamento' | 'ambos' = 'ambos',
  forceAPI = false,
  forceLive = false
): Promise<AnvisaProduct[]> {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const buscarCosm = tipo === 'cosmetico' || tipo === 'ambos';
  const buscarMed = tipo === 'medicamento' || tipo === 'ambos';
  // 1. Banco Supabase local (enriquecido pelo cron do Open Data)
  let dbCosm: AnvisaProduct[] = [];
  let dbMed: AnvisaProduct[] = [];
  try {
    const promises: Promise<any>[] = [];
    if (!forceAPI && buscarCosm) promises.push(Promise.resolve(supabaseAdmin.from('anvisa_cosmeticos').select('*').eq('cnpj', cnpjLimpo).limit(1000)));
    if (!forceAPI && buscarMed) promises.push(Promise.resolve(supabaseAdmin.from('anvisa_medicamentos').select('*').eq('cnpj', cnpjLimpo).limit(1000)));
    
    if (promises.length > 0) {
      const results = await Promise.all(promises);
      let idx = 0;

      const SITUACOES_INATIVAS = ['inativo', 'cancelado', 'suspens', 'proibid'];
      const estaAtivo = (p: any) => {
        const s = (p.situacao || '').toLowerCase();
        return !SITUACOES_INATIVAS.some(term => s.includes(term));
      };

      dbCosm = buscarCosm && results[idx] && results[idx].data ? results[idx++].data
        .filter(estaAtivo)
        .map((p: any) => ({
          processo: p.processo,
          nome: p.nome_produto,
          tipo: 'Cosmético',
          sub_categoria: p.vencimento_limpo === null ? 'Regularizado' : 'Registrado',
          situacao: p.situacao || 'ATIVO',
          data_inicial: '',
          data_validade: p.vencimento,
          vencimento_limpo: p.vencimento_limpo,
          seguro_compra: p.seguro_compra,
          registro_ativo: true,
        })) : [];

      dbMed = buscarMed && results[idx] && results[idx].data ? results[idx++].data
        .filter(estaAtivo)
        .map((p: any) => ({
          processo: p.processo,
          nome: p.nome_produto,
          tipo: 'Medicamento',
          sub_categoria: 'Registrado',
          situacao: p.situacao || 'ATIVO',
          data_inicial: '',
          data_validade: p.vencimento,
          vencimento_limpo: p.vencimento_limpo,
          seguro_compra: p.seguro_compra,
          registro_ativo: true,
        })) : [];
    }

    // OTIMIZAÇÃO: Caso seja uma FILIAL e não encontrou nada, tenta buscar pela MATRIZ (8 primeiros dígitos)
    // Isso é vital para grandes farmacêuticas como Eurofarma, Libbs, etc.
    if (dbCosm.length === 0 && dbMed.length === 0 && cnpjLimpo.length === 14 && !cnpjLimpo.endsWith('0001')) {
      const cnpjMatriz = cnpjLimpo.substring(0, 8);
      console.log(`[buscarProdutosAnvisa] Filial sem produtos. Tentando Matriz: ${cnpjMatriz}...`);
      
      const promisesMatriz: Promise<any>[] = [];
      if (!forceAPI && buscarCosm) promisesMatriz.push(supabaseAdmin.from('anvisa_cosmeticos').select('*').like('cnpj', `${cnpjMatriz}%`).limit(1000) as unknown as Promise<any>);
      if (!forceAPI && buscarMed) promisesMatriz.push(supabaseAdmin.from('anvisa_medicamentos').select('*').like('cnpj', `${cnpjMatriz}%`).limit(1000) as unknown as Promise<any>);
      
      if (promisesMatriz.length > 0) {
        const resultsMatriz = await Promise.all(promisesMatriz);
        let mIdx = 0;
        if (buscarCosm && resultsMatriz[mIdx]?.data?.length) {
          dbCosm = resultsMatriz[mIdx++].data.map((p: any) => ({
            processo: p.processo,
            nome: p.nome_produto,
            tipo: 'Cosmético',
            sub_categoria: p.vencimento_limpo === null ? 'Regularizado' : 'Registrado',
            situacao: p.situacao || 'ATIVO',
            data_inicial: '',
            data_validade: p.vencimento,
            vencimento_limpo: p.vencimento_limpo,
            seguro_compra: p.seguro_compra,
            registro_ativo: true,
          }));
        }
        if (buscarMed && resultsMatriz[mIdx]?.data?.length) {
          dbMed = resultsMatriz[mIdx++].data.map((p: any) => ({
            processo: p.processo,
            nome: p.nome_produto,
            tipo: 'Medicamento',
            sub_categoria: 'Registrado',
            situacao: p.situacao || 'ATIVO',
            data_inicial: '',
            data_validade: p.vencimento,
            vencimento_limpo: p.vencimento_limpo,
            seguro_compra: p.seguro_compra,
            registro_ativo: true,
          }));
        }
      }
    }
  } catch (error) {
    console.error(`[buscarProdutosAnvisa] Erro banco local para CNPJ ${cnpjLimpo}:`, error);
  }

  const dbCosmExtra = dbCosm;
  const cosmeticosMesclados = [...dbCosmExtra];

  const mergedLocal = [...cosmeticosMesclados, ...dbMed];
  
  // 3. Busca complementar na API ANVISA direta (para pegar "Regularizados" que podem faltar no CSV)
  // Usamos uma corrida com timeout: se a API responder em até 8s, mesclamos os dados.
  // Se demorar mais, retornamos o que temos localmente para não bloquear o usuário.
  
  // OTIMIZAÇÃO: Se já temos dados locais e não foi pedido forceLive, pulamos a API lenta
  if (mergedLocal.length > 0 && !forceLive && !forceAPI) {
    console.log(`[buscarProdutosAnvisa] Local encontrou ${mergedLocal.length} produto(s). Pulando API Live para performance.`);
    return mergedLocal;
  }

  console.log(`[buscarProdutosAnvisa] Local: ${mergedLocal.length} produto(s). Buscando API para CNPJ ${cnpjLimpo}...`);
  
  const apiBuscas: Promise<AnvisaProduct[]>[] = [];
  if (buscarCosm) {
    apiBuscas.push(buscarCosmeticosRegularizadosAnvisaAPI(cnpjLimpo));
    apiBuscas.push(buscarCosmeticosRegistradosAnvisaAPI(cnpjLimpo));
  }
  if (buscarMed) {
    apiBuscas.push(buscarMedicamentosAnvisaAPI(cnpjLimpo));
  }

  // Race: API tem até 8 segundos para responder (reduzido de 25s para não travar UI)
  const API_TIMEOUT_MS = 8000;
  const timeoutPromise = new Promise<AnvisaProduct[]>((_, reject) =>
    setTimeout(() => reject(new Error('API timeout')), API_TIMEOUT_MS)
  );

  let apiTotal: AnvisaProduct[] = [];
  try {
    const apiResults = await Promise.race([
      Promise.all(apiBuscas.map(p => p.catch(() => []))).then(r => r.flat()),
      timeoutPromise,
    ]);
    apiTotal = apiResults;
    console.log(`[buscarProdutosAnvisa] API respondeu com ${apiTotal.length} produto(s).`);
  } catch (e) {
    console.warn(`[buscarProdutosAnvisa] API não respondeu a tempo (${API_TIMEOUT_MS}ms). Usando apenas dados locais.`);
  }

  // Mescla tudo deduplicando por processo. API tem precedência para sub_categoria.
  const finalMap = new Map<string, AnvisaProduct>();

  // Locais primeiro
  mergedLocal.forEach(p => {
    if (p.processo) finalMap.set(p.processo, p);
  });

  // API sobrescreve (para corrigir sub_categoria "Registrado" → "Regularizado" quando necessário)
  apiTotal.forEach(p => {
    if (p.processo) {
      const local = finalMap.get(p.processo);
      finalMap.set(p.processo, local ? { ...local, ...p } : p);
    }
  });

  // Garante que o resultado só contém o tipo solicitado — sem misturar cosméticos e medicamentos
  const tipoFiltro = tipo === 'cosmetico' ? 'Cosmético'
    : tipo === 'medicamento' ? 'Medicamento'
    : null; // null = ambos, sem filtro

  const finalResult = Array.from(finalMap.values()).filter(p =>
    tipoFiltro === null || p.tipo === tipoFiltro
  );
  
  const stats = finalResult.reduce((acc, p) => {
    acc[p.sub_categoria || 'N/A'] = (acc[p.sub_categoria || 'N/A'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`[buscarProdutosAnvisa] Total final para CNPJ ${cnpjLimpo}: ${finalResult.length} produto(s).`, stats);
  
  return finalResult;
}

// ────────────────────────────────────────────────────────────────────────────
// ENRIQUECIMENTO COMPLETO
// ────────────────────────────────────────────────────────────────────────────

/**
 * Executa a consulta completa: Receita Federal + ANVISA.
 * Retorna os dados enriquecidos ou erros por fonte.
 * @param tipo - Tipo de produto a buscar: 'cosmetico', 'medicamento' ou 'ambos'
 * @param forceAPI - Se true, ignora o banco local de produtos e busca na API da ANVISA
 * @param forceLive - Se true, força a busca na API live mesmo se houver dados locais
 */
export async function enriquecerFornecedor(
  cnpj: string,
  tipo: 'cosmetico' | 'medicamento' | 'ambos' = 'ambos',
  forceAPI = false,
  forceLive = false
): Promise<EnrichmentResult> {
  const erros: string[] = [];
  let receita: ReceitaFederalData | null = null;
  let anvisa: AnvisaConsultaResult = {
    status: 'ERRO',
    descricao: 'Consulta não realizada',
    fonte: '',
  };
  let anvisa_produtos: AnvisaProduct[] = [];

  console.time(`[enrichment] Total ${cnpj}`);

  // 1. Executa as consultas em paralelo para máxima performance
  const [receitaRes, anvisaRes, produtosRes] = await Promise.allSettled([
    consultarReceitaFederal(cnpj),
    consultarAnvisa(cnpj), // Tenta portal sem CNAE primeiro
    buscarProdutosAnvisa(cnpj, tipo, forceAPI, forceLive)
  ]);

  // 2. Processa resultado da Receita Federal
  if (receitaRes.status === 'fulfilled') {
    receita = receitaRes.value;
  } else {
    erros.push(`Receita Federal: ${receitaRes.reason.message}`);
  }

  // 3. Processa resultado do Status ANVISA
  if (anvisaRes.status === 'fulfilled' && anvisaRes.value.status !== 'NAO_ENCONTRADA') {
    anvisa = anvisaRes.value;
  } else {
    // Busca AFE local se a consulta live falhou ou retornou vazio
    try {
      const { data: afe } = await supabaseAdmin.from('anvisa_afe').select('*').eq('cnpj', cnpj.replace(/\D/g, ''));
      if (afe && afe.length > 0) {
        const ativa = afe.some((a: any) => a.situacao === 'Ativa');
        anvisa = {
          status: ativa ? 'REGULAR' : 'IRREGULAR',
          descricao: `Autorização ${afe[0].tipo_autorizacao} ativa na ANVISA: ${afe[0].numero_autorizacao || 'Registrada'}`,
          fonte: 'ANVISA'
        };
      } else if (receita?.cnae_fiscal && (anvisaRes.status !== 'fulfilled' || anvisaRes.value.status === 'ERRO')) {
         // Inferência por CNAE quando portal falhou/errou ou estava inacessível (Cloudflare)
         // NAO_ENCONTRADA explícita do portal é respeitada (não cai aqui)
         anvisa = await consultarAnvisa(cnpj);
      } else if (anvisaRes.status === 'fulfilled') {
        anvisa = anvisaRes.value;
      }
    } catch {
       if (anvisaRes.status === 'fulfilled') anvisa = anvisaRes.value;
    }
  }

  if (anvisa.status === 'ERRO') {
    erros.push(`ANVISA Status: Falha na determinação de regularidade.`);
  }

  // Bloco "Compliance Lexical" removido: sobrescrever NAO_ENCONTRADA com base apenas
  // no nome da empresa é incorreto — uma empresa pode ter "COSMÉTICOS" na razão social
  // sem ter registro ativo na ANVISA. O portal ANVISA é a fonte de verdade.

  // 4. Processa resultado de Produtos ANVISA
  if (produtosRes.status === 'fulfilled') {
    anvisa_produtos = produtosRes.value;
  } else {
    erros.push(`ANVISA Produtos: ${produtosRes.reason.message}`);
  }

  console.timeEnd(`[enrichment] Total ${cnpj}`);

  return { receita, anvisa, anvisa_produtos, erros };
}
