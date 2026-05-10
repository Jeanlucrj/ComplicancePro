import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get('cnpj');

  if (!cnpj) {
    return NextResponse.json({ error: 'CNPJ obrigatório' }, { status: 400 });
  }

  // Tenta buscar no banco com e sem máscara
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const cnpjFormatado = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

  try {
    const { data: produtos, error } = await supabase
      .from('cosmeticos_regularizados')
      .select('*')
      .or(`cnpj.eq.${cnpjLimpo},cnpj.eq.${cnpjFormatado}`);

    if (error) {
      console.error('Erro de Supabase Query:', error);
      throw error;
    }

    // Compatibilidade reversa com o formato esperado pelo frontend no enrichmentData.anvisa_produtos
    const anvisa_produtos = (produtos || []).map(p => ({
      processo: p.processo,
      nome: p.nome_produto,
      data_validade: p.data_vencimento,
      sub_categoria: 'Regularizado',
      situacao: 'Ativo'
    }));

    return NextResponse.json({
      success: true,
      anvisa_produtos,
      total: anvisa_produtos.length
    });
  } catch (error: any) {
    console.error('Erro sync-cnpj-db:', error);
    return NextResponse.json({ error: 'Falha interna ao consultar tabela' }, { status: 500 });
  }
}
