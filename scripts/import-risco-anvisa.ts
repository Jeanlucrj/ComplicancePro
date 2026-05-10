/**
 * scripts/import-risco-anvisa.ts
 *
 * Importa situações críticas do TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV
 * para a tabela anvisa_risco no Supabase.
 *
 * Uso:
 *   npx tsx scripts/import-risco-anvisa.ts
 *   npx tsx scripts/import-risco-anvisa.ts --file="C:/caminho/arquivo.csv"
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 500;

// ── Mapeamento de situações → nível de risco ──────────────────────────────────

// Apenas pendências ativas Em exigência
const SITUACOES_RISCO: Record<string, string> = {
    'em exigência':            'MEDIO',
    'em exigência da inspeção':'MEDIO',
    'em exigência prorrogada': 'MEDIO',
};

function classificarRisco(situacao: string): string | null {
    const s = situacao.toLowerCase().trim();
    for (const [key, nivel] of Object.entries(SITUACOES_RISCO)) {
        if (s.includes(key)) return nivel;
    }
    return null;
}

function parseLinha(line: string): string[] {
    return line.split(';').map(v => v.replace(/^"|"$/g, '').trim());
}

// ── Upsert em lote via Supabase ───────────────────────────────────────────────

async function upsertBatch(batch: Record<string, any>[]): Promise<{ inseridas: number; erros: number }> {
    const { error } = await supabase
        .from('anvisa_risco')
        .upsert(batch, { onConflict: 'expediente' });

    if (error) {
        console.error('[upsertBatch] erro:', error.message);
        return { inseridas: 0, erros: batch.length };
    }
    return { inseridas: batch.length, erros: 0 };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
    const CSV_PATH = fileArg ||
        path.join(process.cwd(), 'Arquivos CSV', 'TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV');

    if (!fs.existsSync(CSV_PATH)) {
        console.error('❌ Arquivo não encontrado:', CSV_PATH);
        process.exit(1);
    }

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║   BeautyProcure — Radar de Risco Regulatório ANVISA         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('Arquivo:', CSV_PATH);
    console.log('Destino: Supabase → tabela anvisa_risco');

    const rl = readline.createInterface({
        input: fs.createReadStream(CSV_PATH, { encoding: 'latin1' }),
        crlfDelay: Infinity,
    });

    let lidas = 0, criticas = 0, inseridas = 0, erros = 0;
    let batch: Record<string, any>[] = [];
    const start = Date.now();

    for await (const line of rl) {
        lidas++;
        const cols = parseLinha(line);
        if (cols.length < 10) continue;

        const situacao = cols[9] || '';
        const nivel = classificarRisco(situacao);
        if (!nivel) continue;

        const cnpj = (cols[2] || '').replace(/\D/g, '').substring(0, 14);
        if (!cnpj || cnpj.length < 11) continue;

        criticas++;

        const expediente = (cols[0] || '').substring(0, 50);

        const data = {
            expediente: expediente || `${cnpj}-${criticas}`,
            cnpj,
            razao_social: (cols[3] || '').substring(0, 255),
            cod_processo: (cols[4] || '').substring(0, 20),
            tipo_processo: (cols[5] || '').substring(0, 500),
            num_registro: (cols[6] || '').substring(0, 50),
            data_protocolo: (cols[7] || '').substring(0, 30),
            situacao: situacao.substring(0, 200),
            nivel_risco: nivel,
            data_situacao: (cols[10] || '').substring(0, 30),
            data_vencimento: (cols[20] || '').substring(0, 30),
        };

        batch.push(data);

        if (batch.length >= BATCH_SIZE) {
            const res = await upsertBatch(batch);
            inseridas += res.inseridas;
            erros += res.erros;
            batch = [];
        }

        if (lidas % 500000 === 0) {
            const elapsed = Math.round((Date.now() - start) / 1000);
            const pct = ((lidas / 16227863) * 100).toFixed(1);
            console.log(`  📊 ${pct}% | ${(lidas/1000000).toFixed(1)}M lidas | ${criticas.toLocaleString('pt-BR')} críticos | ${inseridas.toLocaleString('pt-BR')} salvos | ${elapsed}s`);
        }
    }

    // flush restante
    if (batch.length > 0) {
        const res = await upsertBatch(batch);
        inseridas += res.inseridas;
        erros += res.erros;
    }

    const dur = Math.round((Date.now() - start) / 1000);
    console.log(`\n✅ Concluído em ${dur}s`);
    console.log(`   Total lidas:          ${lidas.toLocaleString('pt-BR')}`);
    console.log(`   Críticos filtrados:   ${criticas.toLocaleString('pt-BR')}`);
    console.log(`   Salvos no Supabase:   ${inseridas.toLocaleString('pt-BR')}`);
    console.log(`   Erros:                ${erros}`);
}

main().catch(e => { console.error('❌ Erro fatal:', e.message); process.exit(1); });
