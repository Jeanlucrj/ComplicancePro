import { NextRequest, NextResponse } from 'next/server';
import { parseSearchHtml } from '@/lib/dou-processor';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

/**
 * GET /api/dou/diagnostico?dias=7
 * Roda as buscas DOU por segmento e retorna o que foi encontrado — SEM salvar nada.
 * Permite validar quais termos retornam artigos e para quais datas.
 */
export async function GET(request: NextRequest) {
  const dias = Math.min(parseInt(request.nextUrl.searchParams.get('dias') || '7'), 14);

  const datesToTry: string[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    datesToTry.push(`${dd}-${mm}-${d.getFullYear()}`);
  }

  const SEGMENTOS: Record<string, string[]> = {
    cosmeticos: [
      'GGCOS DEFERIR',
      'DEFERIR cosméticos GGCOS',
      'RESOLUÇÃO-RE GGCOS',
    ],
    medicamentos: [
      'GGMED',
      'GGMED DEFERIR',
      'Concessão de Registro de Medicamento',
      'Medicamento Novo GGMED',
      'Medicamento Genérico GGMED',
      'Gerência-Geral de Medicamentos DEFERIR',
    ],
    suspensoes: [
      'GGFIS SUSPENDER',
      'SUSPENDER fabricação distribuição medicamento',
      'SUSPENDER fabricação distribuição cosméticos',
      'CANCELAMENTO registro ANVISA',
    ],
    afe: [
      'AUTORIZAÇÃO DE FUNCIONAMENTO ANVISA',
    ],
  };

  const resultado: Record<string, any> = {};

  for (const [segmento, terms] of Object.entries(SEGMENTOS)) {
    resultado[segmento] = { total_artigos: 0, por_data: {}, por_termo: {} };

    for (const dateStr of datesToTry) {
      for (const term of terms) {
        const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(term)}&s=do1&exactDate=personalizado&publishFrom=${dateStr}&publishTo=${dateStr}&sortType=0`;
        try {
          const res = await axios.get(url, { headers: HEADERS, timeout: 12000 });
          const artigos = parseSearchHtml(res.data);

          if (artigos.length > 0) {
            resultado[segmento].por_data[dateStr] = (resultado[segmento].por_data[dateStr] || 0) + artigos.length;
            resultado[segmento].por_termo[term]   = (resultado[segmento].por_termo[term]   || 0) + artigos.length;
            resultado[segmento].total_artigos     += artigos.length;

            // Exemplo dos primeiros 3 artigos encontrados
            if (!resultado[segmento].exemplos) {
              resultado[segmento].exemplos = artigos.slice(0, 3).map(a => ({
                titulo: a.title.substring(0, 80),
                data: a.pubDate,
                hierarchy: a.hierarchyStr.substring(0, 100),
              }));
            }
          }
        } catch {
          resultado[segmento].por_termo[`ERRO:${term}`] = 'timeout/rede';
        }
      }
    }
  }

  return NextResponse.json({
    datas_verificadas: datesToTry,
    resultado,
    instrucao: 'Acesse /api/dou/diagnostico para verificar o que o DOU retorna por segmento',
  });
}
