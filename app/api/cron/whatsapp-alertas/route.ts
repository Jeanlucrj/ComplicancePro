import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { enviarWhatsApp, formatarMensagemAlertas } from '@/lib/zapi';
import { formatarCNPJ } from '@/utils/formatters';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/whatsapp-alertas
 * Executado diariamente às 08h (ver vercel.json).
 * Para cada usuário com whatsapp_alertas=true e telefone cadastrado,
 * gera os alertas ANVISA e envia via WhatsApp.
 */
export async function GET(request: NextRequest) {
  // Proteção por secret
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hoje = new Date();
  const trintaDias = new Date();
  trintaDias.setDate(hoje.getDate() + 30);

  // 1. Busca usuários com alertas ativos e telefone
  const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });

  if (usersError) {
    console.error('[cron/whatsapp-alertas] Erro ao listar usuários:', usersError);
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const usuariosAtivos = users.filter(
    (u) => u.user_metadata?.whatsapp_alertas === true && u.user_metadata?.telefone
  );

  console.log(`[cron/whatsapp-alertas] ${usuariosAtivos.length} usuários com alertas ativos`);

  let enviados = 0;
  let erros = 0;

  for (const u of usuariosAtivos) {
    try {
      const userId = u.id;
      const telefone = u.user_metadata.telefone as string;

      // 2. Busca fornecedores do usuário
      const { data: fornecedores } = await supabaseAdmin
        .from('fornecedores')
        .select('*')
        .eq('user_id', userId)
        .eq('is_perfil', false);

      if (!fornecedores?.length) continue;

      const alertas: Array<{ tipo: string; titulo: string; descricao: string; severidade: 'error' | 'warning' | 'info' }> = [];

      const cnpjs = fornecedores.map((f: any) => f.cnpj?.replace(/\D/g, '')).filter(Boolean);

      // 3. Status ANVISA / Receita
      for (const f of fornecedores) {
        const nome = f.nome_fantasia || f.razao_social;
        if (f.status_anvisa === 'SUSPENSA' || f.status_anvisa === 'IRREGULAR') {
          alertas.push({
            tipo: 'error', severidade: 'error',
            titulo: 'Restrição ANVISA',
            descricao: `${nome} (${formatarCNPJ(f.cnpj)}) — status ${f.status_anvisa}`,
          });
        }
        if (f.situacao_receita && f.situacao_receita !== 'ATIVA' && f.situacao_receita !== 'DESCONHECIDA') {
          alertas.push({
            tipo: 'warning', severidade: 'warning',
            titulo: 'Irregularidade Receita Federal',
            descricao: `CNPJ ${formatarCNPJ(f.cnpj)} (${nome}) — ${f.situacao_receita}`,
          });
        }
      }

      // 4. Produtos com vencimento próximo
      const { data: produtos } = await supabaseAdmin
        .from('produtos_catalogo')
        .select('nome_produto, data_vencimento, fornecedor_cnpj')
        .eq('user_id', userId);

      for (const p of (produtos || [])) {
        if (!p.data_vencimento) continue;
        const venc = new Date(p.data_vencimento);
        if (venc <= trintaDias && venc >= hoje) {
          const diasRestantes = Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
          alertas.push({
            tipo: 'warning', severidade: 'warning',
            titulo: 'Vencimento próximo',
            descricao: `${p.nome_produto} vence em ${diasRestantes} dia(s) (${venc.toLocaleDateString('pt-BR')})`,
          });
        } else if (venc < hoje) {
          alertas.push({
            tipo: 'error', severidade: 'error',
            titulo: 'Produto vencido',
            descricao: `${p.nome_produto} venceu em ${venc.toLocaleDateString('pt-BR')}`,
          });
        }
      }

      // 5. Irregulares ANVISA
      if (cnpjs.length > 0) {
        const { data: irregulares } = await supabaseAdmin
          .from('anvisa_irregulares')
          .select('cnpj, razao_social, descricao_produto')
          .in('cnpj', cnpjs)
          .limit(5);

        if (irregulares?.length) {
          const cnpjsIrreg = [...new Set(irregulares.map((i: any) => i.cnpj))];
          for (const cnpj of cnpjsIrreg) {
            const f = fornecedores.find((x: any) => x.cnpj?.replace(/\D/g, '') === cnpj);
            const nome = f?.nome_fantasia || f?.razao_social || formatarCNPJ(cnpj);
            const qtd = irregulares.filter((i: any) => i.cnpj === cnpj).length;
            alertas.push({
              tipo: 'error', severidade: 'error',
              titulo: 'Produto Irregular ANVISA',
              descricao: `${nome} — ${qtd} produto(s) irregular(es) na base ANVISA`,
            });
          }
        }
      }

      // 6. AFE sem autorização ativa
      for (const f of fornecedores) {
        const cnpjLimpo = f.cnpj?.replace(/\D/g, '');
        if (!cnpjLimpo) continue;
        const { data: afe } = await supabaseAdmin
          .from('anvisa_afe')
          .select('situacao, tipo_autorizacao')
          .eq('cnpj', cnpjLimpo);

        if (afe && afe.length > 0) {
          const afeAtiva = afe.some((a: any) => a.tipo_autorizacao === 'AFE' && a.situacao === 'Ativa');
          if (!afeAtiva) {
            const nome = f.nome_fantasia || f.razao_social;
            alertas.push({
              tipo: 'error', severidade: 'error',
              titulo: 'AFE/AE sem autorização ativa',
              descricao: `${nome} (${formatarCNPJ(f.cnpj)}) não possui AFE ativa na ANVISA`,
            });
          }
        }
      }

      if (!alertas.length) continue;

      // 7. Busca nome da empresa
      const perfilFornecedor = fornecedores.find((f: any) => f.is_perfil) || fornecedores[0];
      const nomeEmpresa = perfilFornecedor?.nome_fantasia || perfilFornecedor?.razao_social || 'sua empresa';

      // 8. Envia via WhatsApp
      const mensagem = formatarMensagemAlertas(nomeEmpresa, alertas);
      const ok = await enviarWhatsApp(telefone, mensagem);
      if (ok) enviados++; else erros++;

    } catch (err: any) {
      console.error(`[cron/whatsapp-alertas] Erro para usuário ${u.id}:`, err.message);
      erros++;
    }
  }

  console.log(`[cron/whatsapp-alertas] Concluído: ${enviados} enviados, ${erros} erros`);
  return NextResponse.json({ ok: true, enviados, erros, total: usuariosAtivos.length });
}
