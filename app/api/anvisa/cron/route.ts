import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

// Pode levar muito tempo, então Next.js Pro/Vercel precisa saber
export const maxDuration = 300; 
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  // Protege o endpoint com um CRON_SECRET (configurável no .env)
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Inicia o processo ETL em background usando Node (Desacoplado da API)
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync-anvisa-opendata.ts');
    
    // spawn a non-blocking process so the API can return 200 immediately
    exec(`npx tsx ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[CRON ETL ERRO] ${error.message}`);
        return;
      }
      if (stderr) console.error(`[CRON ETL STDERR] ${stderr}`);
      console.log(`[CRON ETL SUCESSO]\n${stdout}`);
    });

    return NextResponse.json({ 
      status: 'success', 
      message: 'Pipeline de Dados Abertos (ETL) iniciado em background. Verifique os logs do servidor para o progresso.' 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
