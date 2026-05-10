import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/anvisa/sync-cnpj
 * Recebe produtos ANVISA buscados pelo browser (sem bloqueio Cloudflare)
 * e salva no Supabase.
 *
 * Body: { cnpj: string, produtos: AnvisaRawProduct[] }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.cnpj || !Array.isArray(body.produtos)) {
    return NextResponse.json({ error: 'Body inválido. Esperado: { cnpj, produtos[] }' }, { status: 400 });
  }

  const cnpjLimpo = body.cnpj.replace(/\D/g, '');
  const produtos: any[] = body.produtos;

  // Remove registros antigos deste CNPJ
  try {
    await supabaseAdmin.from('anvisa_cosmeticos').delete().eq('cnpj', cnpjLimpo);
  } catch (_) { /* coleção vazia — ok */ }

  // Insere os novos produtos
  let salvos = 0;
  const BATCH = 50;
  for (let i = 0; i < produtos.length; i += BATCH) {
    const lote = produtos.slice(i, i + BATCH).map(p => {
      const ativo = p.situacaoProduto === 'S' || p.situacaoProdutoFormatado === 'ATIVO';
      const vencimento = p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '';
      return {
        cnpj: cnpjLimpo,
        razao_social: (p.nomeEmpresa || '').substring(0, 255),
        nome_produto: (p.nomeProduto || '').substring(0, 255),
        processo: (p.processo || '').toString(),
        situacao: p.situacaoProdutoFormatado || (ativo ? 'ATIVO' : 'INATIVO'),
        vencimento,
        vencimento_limpo: null,
        seguro_compra: ativo,
      };
    });
    
    try { await supabaseAdmin.from('anvisa_cosmeticos').insert(lote); salvos += lote.length; } catch { /* lote com erro, ignora */ }
  }

  return NextResponse.json({ salvos, total: produtos.length, cnpj: cnpjLimpo });
}
