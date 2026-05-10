import { NextRequest, NextResponse } from 'next/server';
import { enriquecerFornecedor, mapearSituacaoReceita } from '@/lib/enrichment';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/enriquecer?cnpj=XXXXXXXXXXXXXXXX
 * 
 * Consulta dados reais da Receita Federal (BrasilAPI) e ANVISA (portal público),
 * e opcionalmente atualiza o registro do fornecedor no Supabase com os dados reais.
 * 
 * Query params:
 *   cnpj      - CNPJ do fornecedor (obrigatório, com ou sem formatação)
 *   salvar    - 'true' para atualizar o fornecedor no banco com os dados extraídos
 */
export async function GET(request: NextRequest) {
  try {
    const cnpj = request.nextUrl.searchParams.get('cnpj');
    const salvar = request.nextUrl.searchParams.get('salvar') === 'true';
    const forceAPI = request.nextUrl.searchParams.get('forceAPI') === 'true';
    const forceLive = request.nextUrl.searchParams.get('forceLive') === 'true';
    const userId = request.nextUrl.searchParams.get('userId');
    let tipo = (request.nextUrl.searchParams.get('tipo') || 'ambos') as 'cosmetico' | 'medicamento' | 'ambos';

    if (!cnpj) {
      return NextResponse.json({ error: 'Parâmetro "cnpj" é obrigatório.' }, { status: 400 });
    }

    // REGRA DE NEGÓCIO: o tipo do usuário logado tinha prioridade absoluta, 
    // mas isso impedia de ver medicamentos em empresas de farma se o usuário fosse de cosméticos.
    // Removendo a trava para permitir busca flexível.
    /*
    if (userId) {
      try {
        const { data: perfil } = await supabaseAdmin
          .from('fornecedores')
          .select('tipo_anvisa')
          .eq('user_id', userId)
          .eq('is_perfil', true)
          .limit(1)
          .single();

        if (perfil?.tipo_anvisa && perfil.tipo_anvisa !== 'ambos') {
          tipo = perfil.tipo_anvisa as 'cosmetico' | 'medicamento' | 'ambos';
          console.log(`[enriquecer] Tipo do usuário ${userId}: ${tipo} (sobrepõe parâmetro da URL)`);
        }
      } catch {
        // perfil não encontrado
      }
    }
    */

    console.log(`[enriquecer] Iniciando consulta para CNPJ: ${cnpj}, salvar: ${salvar}, tipo: ${tipo}`);

    const resultado = await enriquecerFornecedor(cnpj, tipo, forceAPI, forceLive);

    const resposta: any = {
      cnpj: cnpj.replace(/\D/g, ''),
      consultado_em: new Date().toISOString(),
      receita_federal: null,
      anvisa: resultado.anvisa,
      anvisa_produtos: resultado.anvisa_produtos || [],
      erros: resultado.erros,
      salvo_no_banco: false,
    };

    if (resultado.receita) {
      const r = resultado.receita;
      resposta.receita_federal = {
        razao_social: r.razao_social,
        nome_fantasia: r.nome_fantasia || r.razao_social,
        situacao_cadastral_codigo: r.situacao_cadastral,
        situacao_cadastral: mapearSituacaoReceita(r.situacao_cadastral),
        data_abertura: r.data_inicio_atividade,
        endereco: `${r.logradouro}, ${r.numero}${r.complemento ? ' ' + r.complemento : ''}`.trim(),
        bairro: r.bairro,
        cidade: r.municipio,
        estado: r.uf,
        cep: r.cep,
        telefone: r.ddd_telefone_1,
        email: r.email,
        cnae_principal: r.cnae_fiscal_descricao,
        porte: r.porte,
        natureza_juridica: r.natureza_juridica,
        socios: Array.isArray(r.qsa) ? r.qsa.map((s: any) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio })) : [],
      };
    }

    if (salvar && resultado.receita) {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const r = resultado.receita;

      try {
        const { data: fornecedores } = await supabaseAdmin
          .from('fornecedores')
          .select('id')
          .eq('cnpj', cnpjLimpo)
          .eq('user_id', userId || '')
          .limit(1);

        if (fornecedores && fornecedores.length > 0) {
          const docId = fornecedores[0].id;
          await supabaseAdmin.from('fornecedores').update({
            razao_social: r.razao_social,
            nome_fantasia: r.nome_fantasia || r.razao_social,
            situacao_receita: mapearSituacaoReceita(r.situacao_cadastral),
            status_anvisa: resultado.anvisa.status === 'REGULAR' ? 'REGULAR' : resultado.anvisa.status === 'NAO_ENCONTRADA' ? 'NAO_CADASTRADA' : 'IRREGULAR',
            estado: r.uf,
            cidade: r.municipio,
            cep: r.cep,
            endereco: `${r.logradouro || ''}, ${r.numero || ''}`.trim(),
            data_abertura: r.data_inicio_atividade,
            email: r.email || undefined,
            telefone: r.ddd_telefone_1 || undefined,
          }).eq('id', docId);
          resposta.salvo_no_banco = true;
          console.log(`[enriquecer] Fornecedor ${cnpjLimpo} atualizado no banco.`);
        } else {
          resposta.erros.push('Fornecedor não encontrado no banco para atualização.');
        }
      } catch (dbErr: any) {
        resposta.erros.push(`Erro ao salvar no banco: ${dbErr.message}`);
      }
    }

    return NextResponse.json(resposta);
  } catch (error: any) {
    console.error("[CRITICAL FATAL API CATCH]:", error);
    return NextResponse.json({
      erros: ["CRITICAL API FAILURE: " + error.message, error.stack]
    }, { status: 500 }); // Returning 500 will trigger the frontend catch and log
  }
}
