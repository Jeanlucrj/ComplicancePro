import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Tipagem do resultado ──────────────────────────────────────────────────────

export interface ScoreIAResult {
  score: number;                   // 0–100
  nivel: 'ALTO' | 'MÉDIO' | 'BAIXO' | 'CRÍTICO';
  cor: 'green' | 'yellow' | 'orange' | 'red';
  resumo: string;                  // parágrafo de análise
  pontos_positivos: string[];      // até 3 itens
  pontos_atencao: string[];        // até 3 itens
  recomendacoes: string[];         // até 3 ações concretas
  gerado_em: string;               // ISO timestamp
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nivelFromScore(score: number): ScoreIAResult['nivel'] {
  if (score >= 80) return 'ALTO';
  if (score >= 60) return 'MÉDIO';
  if (score >= 40) return 'BAIXO';
  return 'CRÍTICO';
}

function corFromScore(score: number): ScoreIAResult['cor'] {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

// ── Monta o prompt com todos os dados disponíveis ─────────────────────────────

function buildPrompt(ctx: {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  estado: string;
  cidade: string;
  data_abertura: string | null;
  situacao_receita: string;
  status_anvisa: string;
  tipo_anvisa: string | null;
  total_produtos: number;
  produtos_vencidos: number;
  produtos_a_vencer_30d: number;
  produtos_ativos: number;
  mencoes_dou: { tipo_evento: string; produto: string; timestamp: string }[];
  score_atual: number | null;
}): string {
  const tempo_mercado = ctx.data_abertura
    ? `${Math.floor((Date.now() - new Date(ctx.data_abertura).getTime()) / (365.25 * 24 * 3600 * 1000))} anos`
    : 'desconhecido';

  const mencoes_txt = ctx.mencoes_dou.length > 0
    ? ctx.mencoes_dou.map(m =>
        `  - [${new Date(m.timestamp).toLocaleDateString('pt-BR')}] ${m.tipo_evento}: ${m.produto}`
      ).join('\n')
    : '  Nenhuma menção encontrada nos últimos 90 dias.';

  return `Você é um especialista em compliance regulatório do setor de cosméticos e medicamentos no Brasil.

Analise o perfil deste fornecedor e gere um Score de Confiabilidade de 0 a 100 com base nos dados abaixo.

## DADOS DO FORNECEDOR

- **CNPJ:** ${ctx.cnpj}
- **Razão Social:** ${ctx.razao_social}
- **Nome Fantasia:** ${ctx.nome_fantasia || 'N/A'}
- **Localização:** ${ctx.cidade} / ${ctx.estado}
- **Tempo de Mercado:** ${tempo_mercado}
- **Situação Receita Federal:** ${ctx.situacao_receita}
- **Status ANVISA:** ${ctx.status_anvisa}
- **Segmento ANVISA:** ${ctx.tipo_anvisa || 'Não informado'}

## PORTFÓLIO DE PRODUTOS ANVISA

- Total de produtos registrados: **${ctx.total_produtos}**
- Produtos com registro ativo: **${ctx.produtos_ativos}**
- Produtos com registro vencido: **${ctx.produtos_vencidos}**
- Produtos a vencer nos próximos 30 dias: **${ctx.produtos_a_vencer_30d}**

## MENÇÕES NO DIÁRIO OFICIAL (últimos 90 dias)

${mencoes_txt}

## CRITÉRIOS DE PONTUAÇÃO (use como referência)

- Receita Federal ATIVA → +20 pontos; SUSPENSA/INAPTA → -30 pontos
- Status ANVISA REGULAR → +25 pontos; NAO_CADASTRADA → -10; IRREGULAR → -25
- Tempo de mercado > 5 anos → +10; > 10 anos → +15
- % produtos ativos > 90% → +15; 70–90% → +5; < 70% → -10
- Produtos a vencer em 30 dias → -5 por grupo de 3
- Suspensão ou recolhimento no DOU → -20 por ocorrência
- Deferimento de registros no DOU (positivo) → +5 por ocorrência

## INSTRUÇÃO

Responda APENAS com um JSON válido, sem markdown, sem explicações fora do JSON.
O JSON deve ter exatamente esta estrutura:

{
  "score": <número inteiro de 0 a 100>,
  "resumo": "<2 a 3 frases em português sobre o perfil de risco deste fornecedor>",
  "pontos_positivos": ["<item 1>", "<item 2>", "<item 3>"],
  "pontos_atencao": ["<item 1>", "<item 2>", "<item 3>"],
  "recomendacoes": ["<ação concreta 1>", "<ação concreta 2>", "<ação concreta 3>"]
}

Regras:
- score deve refletir objetivamente os critérios acima
- pontos_positivos: liste apenas fatores genuinamente favoráveis (se não houver 3, liste menos)
- pontos_atencao: liste apenas riscos reais identificados nos dados
- recomendacoes: ações práticas que o comprador deve tomar com este fornecedor
- Seja direto e profissional, sem elogios genéricos`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { cnpj: string } }
) {
  const cnpj = params.cnpj.replace(/\D/g, '');
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
  }

  try {
    // 1. Busca dados do fornecedor no banco
    const { data: fornRes } = await supabaseAdmin
      .from('fornecedores')
      .select('id, cnpj, razao_social, nome_fantasia, estado, cidade, data_abertura, situacao_receita, status_anvisa, tipo_anvisa, score_qualidade')
      .eq('cnpj', cnpj)
      .eq('user_id', userId)
      .limit(1);

    if (!fornRes || fornRes.length === 0) {
      return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
    }

    const f = fornRes[0] as any;

    // 2. Busca apenas as colunas necessárias para o cálculo de score
    const [cosmRes, medsRes] = await Promise.allSettled([
      supabaseAdmin.from('anvisa_cosmeticos').select('seguro_compra, vencimento_limpo').eq('cnpj', cnpj).limit(1000),
      supabaseAdmin.from('anvisa_medicamentos').select('seguro_compra, vencimento_limpo').eq('cnpj', cnpj).limit(1000)
    ]);

    const todosOsProdutos = [
      ...(cosmRes.status === 'fulfilled' && cosmRes.value.data ? cosmRes.value.data : []),
      ...(medsRes.status === 'fulfilled' && medsRes.value.data ? medsRes.value.data : []),
    ] as any[];

    const hoje = new Date();
    const em30dias = new Date(hoje.getTime() + 30 * 24 * 3600 * 1000);

    let vencidos = 0;
    let aVencer30d = 0;
    let ativos = 0;

    for (const p of todosOsProdutos) {
      const seguro = p.seguro_compra === true;
      const venc = p.vencimento_limpo ? new Date(p.vencimento_limpo) : null;
      if (venc && venc < hoje) {
        vencidos++;
      } else if (venc && venc < em30dias) {
        aVencer30d++;
      } else if (seguro) {
        ativos++;
      }
    }

    // 3. Busca menções no DOU (últimos 90 dias)
    const noventaDiasAtras = new Date(hoje.getTime() - 90 * 24 * 3600 * 1000).toISOString();
    let mencoesDOU: any[] = [];
    try {
      const { data: douRes } = await supabaseAdmin
        .from('dou_feed')
        .select('*')
        .gte('timestamp', noventaDiasAtras)
        .order('timestamp', { ascending: false })
        .limit(20);
        
      // Filtra as menções que citam este CNPJ ou razão social
      const nomeUpper = (f.nome_fantasia || f.razao_social || '').toUpperCase().substring(0, 20);
      if (douRes) {
        mencoesDOU = douRes.filter((d: any) =>
          (d.empresa || '').toUpperCase().includes(nomeUpper) ||
          (d.empresa || '').includes(cnpj)
        ) as any[];
      }
    } catch {
      // sem menções — ok
    }

    // 4. Monta contexto e chama Claude
    const ctx = {
      cnpj,
      razao_social: f.razao_social || '',
      nome_fantasia: f.nome_fantasia || null,
      estado: f.estado || '',
      cidade: f.cidade || '',
      data_abertura: f.data_abertura || null,
      situacao_receita: f.situacao_receita || 'DESCONHECIDA',
      status_anvisa: f.status_anvisa || 'DESCONHECIDO',
      tipo_anvisa: f.tipo_anvisa || null,
      total_produtos: todosOsProdutos.length,
      produtos_vencidos: vencidos,
      produtos_a_vencer_30d: aVencer30d,
      produtos_ativos: ativos,
      mencoes_dou: mencoesDOU.map((d: any) => ({
        tipo_evento: d.tipo_evento,
        produto: d.produto,
        timestamp: d.timestamp,
      })),
      score_atual: f.score_qualidade ?? null,
    };

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const geminiResult = await model.generateContent(buildPrompt(ctx));
    const rawText = geminiResult.response.text().trim();

    // 5. Parseia o JSON retornado pelo modelo
    let parsed: any;
    try {
      // Gemini às vezes envolve o JSON em ```json ... ``` — remove se vier assim
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Resposta do modelo fora do formato esperado', raw: rawText },
        { status: 502 }
      );
    }

    const score: number = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 0)));

    const result: ScoreIAResult = {
      score,
      nivel: nivelFromScore(score),
      cor: corFromScore(score),
      resumo: parsed.resumo || '',
      pontos_positivos: Array.isArray(parsed.pontos_positivos) ? parsed.pontos_positivos.slice(0, 3) : [],
      pontos_atencao: Array.isArray(parsed.pontos_atencao) ? parsed.pontos_atencao.slice(0, 3) : [],
      recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes.slice(0, 3) : [],
      gerado_em: new Date().toISOString(),
    };

    // 6. Persiste score numérico no fornecedor (atualiza score_qualidade)
    try {
      await supabaseAdmin.from('fornecedores').update({
        score_qualidade: score,
      }).eq('id', f.id);
    } catch {
      // falha silenciosa — não bloqueia a resposta
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[POST /api/fornecedores/[cnpj]/score-ia]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
