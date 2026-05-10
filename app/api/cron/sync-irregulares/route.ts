import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ok: false,
    error: 'Bloqueado por tamanho: Devido aos Gigabytes da Anvisa, acione via terminal local rodando "npm run import:anvisa".'
  }, { status: 400 });
}
