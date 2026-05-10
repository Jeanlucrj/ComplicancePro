import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const COLLECTION_DOU = 'dou_feed';

/**
 * POST /api/dou/sync
 * 
 * Endpoint LEVE chamado pelo botão "Atualizar agora" na UI.
 * NÃO faz scraping — apenas dispara o cron em background e retorna os dados atuais.
 * 
 * O scraping pesado é feito por /api/dou/cron (chamado em background).
 */
export async function POST(request: NextRequest) {
  const isInternalRequest = request.headers.get('x-internal-request') === '1';
  if (!isInternalRequest) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const segmento = url.searchParams.get('segmento') || 'medicamento';

  try {
    // 1. Dispara o cron de scraping em BACKGROUND (fire-and-forget)
    //    O cron vai baixar novos artigos do DOU e salvar no banco.
    //    Não esperamos a resposta — a UI já mostra os dados existentes.
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/dou/cron?segmento=${segmento}`, {
      method: 'POST',
      headers: { 'x-internal-request': '1' },
    }).catch(err => {
      console.warn('[DOU sync] Cron em background falhou:', err.message);
    });

    // 2. Conta registros atuais por categoria
    let catQuery = supabaseAdmin.from('dou_feed').select('*', { count: 'exact', head: true });
    
    if (segmento === 'medicamento') {
      catQuery = catQuery.eq('categoria', 'Medicamento');
    } else if (segmento === 'cosmetico') {
      catQuery = catQuery.ilike('categoria', 'Cosmético%');
    }

    const [totalRes, catRes, latestRes] = await Promise.all([
      supabaseAdmin.from('dou_feed').select('*', { count: 'exact', head: true }),
      catQuery,
      supabaseAdmin.from('dou_feed').select('created_at').order('created_at', { ascending: false }).limit(1),
    ]);

    return NextResponse.json({
      success: true,
      total_registros: totalRes.count || 0,
      registros_segmento: catRes.count || 0,
      segmento,
      ultima_sync: latestRes.data?.[0]?.created_at || null,
      sincronizado_em: new Date().toISOString(),
      itens_salvos: 0, // Cron está rodando em background
      mensagem: `Sincronização em andamento. ${catRes.count || 0} registros de ${segmento} no banco.`,
    });

  } catch (error: any) {
    console.error('[POST /api/dou/sync] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      sincronizado_em: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * GET /api/dou/sync
 * 
 * Retorna metadados da última sincronização.
 */
export async function GET() {
  try {
    const [latest, totalRes] = await Promise.all([
      supabaseAdmin.from('dou_feed').select('created_at').order('created_at', { ascending: false }).limit(1),
      supabaseAdmin.from('dou_feed').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      ultima_sync: latest.data?.[0]?.created_at || null,
      ultima_sincronizacao: latest.data?.[0]?.created_at || null,
      total_registros: totalRes.count || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
