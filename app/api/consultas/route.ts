import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const LIMITES: Record<string, number | null> = {
  pro: 50,
  enterprise: null, // null = ilimitado
};

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 });
  }

  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const plano: string = userData?.user?.user_metadata?.plano || 'pro';
    const limite = LIMITES[plano] ?? 50;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count, error } = await supabaseAdmin
      .from('consultas')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', inicioMes.toISOString());

    if (error) throw error;

    const usadas = count ?? 0;

    return NextResponse.json({
      usadas,
      limite,
      restantes: limite === null ? null : Math.max(0, limite - usadas),
      plano,
    });
  } catch (error: any) {
    console.error('[consultas] Erro:', error.message);
    return NextResponse.json({ usadas: 0, limite: 50, restantes: 50, plano: 'pro' });
  }
}
