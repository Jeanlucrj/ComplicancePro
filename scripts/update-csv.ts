/**
 * scripts/update-csv.ts
 * 
 * Atualiza os CSVs locais da ANVISA em tmp/ para uso como fallback
 * quando a API direta (consultas.anvisa.gov.br) estiver indisponível.
 *
 * Fontes (todas abertas, sem Cloudflare):
 *  - Registrados (Grau 2): https://dados.anvisa.gov.br/dados/TA_COSMETICOS.csv
 *  - Regularizados/Isentos (Grau 1): API CKAN dados.anvisa.gov.br
 *  - Medicamentos: https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv
 *
 * Uso:
 *   npx tsx scripts/update-csv.ts              (atualiza todos)
 *   npx tsx scripts/update-csv.ts --cosmetico  (só cosméticos)
 *   npx tsx scripts/update-csv.ts --medicamento
 *   npx tsx scripts/update-csv.ts --isentos    (baixa dataset CKAN de regularizados)
 *
 * Log: scripts/csv-update.log
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const TMP_DIR    = path.join(process.cwd(), 'tmp');
const LOG_FILE   = path.join(process.cwd(), 'scripts', 'csv-update.log');
const LOG_MAX_MB = 2; // rotaciona o log quando passar de 2 MB

// Garante que tmp/ existe
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Logger ─────────────────────────────────────────────────────────────────────

const sessionStart = new Date();
const logLines: string[] = [];

function ts() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(msg: string) {
    const line = `[${ts()}] ${msg}`;
    console.log(msg);
    logLines.push(line);
}

function logWarn(msg: string) {
    const line = `[${ts()}] ⚠️  ${msg}`;
    console.warn(msg);
    logLines.push(line);
}

function logError(msg: string) {
    const line = `[${ts()}] ❌ ${msg}`;
    console.error(msg);
    logLines.push(line);
}

function flushLog() {
    try {
        // Rotaciona se muito grande
        if (fs.existsSync(LOG_FILE)) {
            const size = fs.statSync(LOG_FILE).size;
            if (size > LOG_MAX_MB * 1024 * 1024) {
                const rotated = LOG_FILE.replace('.log', `.${sessionStart.toISOString().substring(0, 10)}.bak.log`);
                fs.renameSync(LOG_FILE, rotated);
                fs.appendFileSync(LOG_FILE, `[${ts()}] Log rotacionado → ${path.basename(rotated)}\n`);
            }
        }

        const separator = '─'.repeat(60);
        const header = [
            '',
            separator,
            `  BeautyProcure — Atualização de CSVs ANVISA`,
            `  Início: ${sessionStart.toLocaleString('pt-BR')}`,
            `  Término: ${new Date().toLocaleString('pt-BR')}`,
            `  Duração: ${Math.round((Date.now() - sessionStart.getTime()) / 1000)}s`,
            separator,
        ].join('\n');

        fs.appendFileSync(LOG_FILE, header + '\n' + logLines.join('\n') + '\n', 'utf-8');
    } catch (e) {
        console.warn('Não foi possível salvar o log:', (e as Error).message);
    }
}

// ── Utilitários ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function countLines(filePath: string): number {
    try {
        const content = fs.readFileSync(filePath, { encoding: 'latin1' });
        return content.split('\n').length;
    } catch {
        return 0;
    }
}

function downloadFile(url: string, destPath: string): Promise<{ bytes: number }> {
    return new Promise((resolve, reject) => {
        const destTmp = destPath + '.tmp';
        const file = fs.createWriteStream(destTmp);
        let bytes = 0;
        let lastLog = Date.now();
        const agent = new https.Agent({ rejectUnauthorized: false });

        const handleResponse = (res: http.IncomingMessage) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                try { fs.unlinkSync(destTmp); } catch {}
                return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                file.close();
                try { fs.unlinkSync(destTmp); } catch {}
                return reject(new Error(`HTTP ${res.statusCode}`));
            }

            const total = parseInt(res.headers['content-length'] || '0', 10);
            res.on('data', (chunk: Buffer) => {
                bytes += chunk.length;
                const now = Date.now();
                if (now - lastLog > 3000) {
                    const pct = total ? `${((bytes / total) * 100).toFixed(0)}%` : '';
                    process.stdout.write(`\r  ⬇  ${formatBytes(bytes)}${total ? ` / ${formatBytes(total)} (${pct})` : ''}`);
                    lastLog = now;
                }
            });

            res.pipe(file);
            file.on('finish', () => {
                process.stdout.write(`\r  ✅ ${formatBytes(bytes)} baixados                      \n`);
                file.close(() => {
                    fs.renameSync(destTmp, destPath);
                    resolve({ bytes });
                });
            });
            res.on('error', (err: Error) => {
                file.close();
                try { fs.unlinkSync(destTmp); } catch {}
                reject(err);
            });
        };

        const req = url.startsWith('https')
            ? https.get(url, { agent }, handleResponse)
            : http.get(url, handleResponse);

        req.on('error', (err: Error) => {
            file.close();
            try { fs.unlinkSync(destTmp); } catch {}
            reject(err);
        });
        req.setTimeout(120000, () => {
            req.destroy();
            reject(new Error(`Timeout (120s)`));
        });
    });
}

// ── Funções de Download ────────────────────────────────────────────────────────

async function baixarCosmeticosRegistrados() {
    const dest = path.join(TMP_DIR, 'cosmeticos.csv');
    const url = 'https://dados.anvisa.gov.br/dados/TA_COSMETICOS.csv';
    const fallback = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_COSMETICO.csv';

    log(`\n📦 Baixando Cosméticos Registrados (Grau 2)...`);
    log(`   Fonte: ${url}`);

    try {
        const { bytes } = await downloadFile(url, dest);
        const lines = countLines(dest);
        log(`   ✅ cosmeticos.csv — ${formatBytes(bytes)} — ${lines.toLocaleString('pt-BR')} linhas`);
    } catch (e1) {
        logWarn(`Fonte principal falhou: ${(e1 as Error).message}`);
        log(`   🔄 Tentando fallback: ${fallback}`);
        try {
            const { bytes } = await downloadFile(fallback, dest);
            const lines = countLines(dest);
            log(`   ✅ cosmeticos.csv (fallback) — ${formatBytes(bytes)} — ${lines.toLocaleString('pt-BR')} linhas`);
        } catch (e2) {
            logError(`Fallback também falhou: ${(e2 as Error).message}`);
        }
    }
}

async function baixarMedicamentos() {
    const dest = path.join(TMP_DIR, 'medicamentos.csv');
    const url = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv';

    log(`\n💊 Baixando Medicamentos Registrados...`);
    log(`   Fonte: ${url}`);

    try {
        const { bytes } = await downloadFile(url, dest);
        const lines = countLines(dest);
        log(`   ✅ medicamentos.csv — ${formatBytes(bytes)} — ${lines.toLocaleString('pt-BR')} linhas`);
    } catch (e) {
        logError(`medicamentos.csv falhou: ${(e as Error).message}`);
    }
}

async function baixarCosmeticosRegularizados() {
    log(`\n🧴 Baixando Cosméticos Regularizados/Isentos (Grau 1)...`);

    const dest = path.join(TMP_DIR, 'cosmeticos_regularizados.csv');

    // Tenta CSVs diretos primeiro
    const directUrls = [
        'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_COSMETICO_REGULARIZADOS.csv',
        'https://dados.anvisa.gov.br/dados/TA_COSMETICO_REGULARIZADOS.csv',
        'https://dados.anvisa.gov.br/dados/TA_COSMETICOS_ISENTOS.csv',
    ];

    for (const url of directUrls) {
        try {
            log(`   Testando: ${url}`);
            const { bytes } = await downloadFile(url, dest);
            const lines = countLines(dest);
            log(`   ✅ cosmeticos_regularizados.csv — ${formatBytes(bytes)} — ${lines.toLocaleString('pt-BR')} linhas`);
            return;
        } catch (_) { /* tenta próxima */ }
    }

    // Fallback: CKAN API
    log(`   ℹ️  CSVs diretos não disponíveis. Tentando via CKAN API...`);

    const sslAgent = new https.Agent({ rejectUnauthorized: false });
    const fetchJson = (url: string): Promise<any> => new Promise((resolve, reject) => {
        https.get(url, { agent: sslAgent }, (res) => {
            let data = '';
            res.on('data', (c: Buffer) => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
            res.on('error', reject);
        }).on('error', reject);
    });

    let resourceId: string | null = null;
    try {
        const pkg = await fetchJson('https://dados.anvisa.gov.br/api/3/action/package_show?id=cosmeticos-produtos-regularizados');
        const csvRes = (pkg.result?.resources || []).find((r: any) =>
            r.format?.toUpperCase() === 'CSV' || r.url?.toLowerCase().includes('.csv')
        );
        resourceId = csvRes?.id || null;
        if (resourceId) log(`   📋 CKAN resource_id: ${resourceId}`);
    } catch (e) {
        logWarn(`CKAN package lookup falhou: ${(e as Error).message}`);
    }

    if (!resourceId) {
        logWarn(`Regularizados indisponíveis nesta execução. API em tempo real será usada como fallback.`);
        return;
    }

    const allRows: string[] = [];
    let offset = 0;
    const pageSize = 5000;
    let total = 0;
    let headers: string[] = [];

    try {
        while (true) {
            const apiUrl = `https://dados.anvisa.gov.br/api/3/action/datastore_search?resource_id=${resourceId}&limit=${pageSize}&offset=${offset}`;
            const page = await fetchJson(apiUrl);
            if (!page.success) break;
            const records: any[] = page.result?.records || [];
            total = page.result?.total || total;

            if (headers.length === 0 && records.length > 0) {
                headers = Object.keys(records[0]).filter(k => k !== '_id');
                allRows.push(headers.join(';'));
            }
            for (const row of records) {
                allRows.push(headers.map(h => String(row[h] ?? '')).join(';'));
            }

            process.stdout.write(`\r   ⬇  ${allRows.length - 1}/${total} registros...`);
            if (records.length < pageSize) break;
            offset += pageSize;
        }

        if (allRows.length > 1) {
            fs.writeFileSync(dest, allRows.join('\n'), 'utf-8');
            const saved = allRows.length - 1;
            process.stdout.write('\n');
            log(`   ✅ cosmeticos_regularizados.csv (CKAN) — ${saved.toLocaleString('pt-BR')} registros`);
        } else {
            logWarn(`Nenhum dado retornado do CKAN para regularizados`);
        }
    } catch (e) {
        logError(`CKAN download falhou: ${(e as Error).message}`);
    }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const all = args.length === 0;
    const doCosmReg    = all || args.includes('--cosmetico') || args.includes('--registrados');
    const doCosmIsento = all || args.includes('--cosmetico') || args.includes('--isentos') || args.includes('--regularizados');
    const doMed        = all || args.includes('--medicamento');

    log('╔══════════════════════════════════════════════════════╗');
    log('║        BeautyProcure — Atualização de CSVs ANVISA    ║');
    log('╚══════════════════════════════════════════════════════╝');
    log(`Início : ${sessionStart.toLocaleString('pt-BR')}`);
    log(`Destino: ${TMP_DIR}`);
    log(`Log    : ${LOG_FILE}`);

    if (doCosmReg)    await baixarCosmeticosRegistrados();
    if (doCosmIsento) await baixarCosmeticosRegularizados();
    if (doMed)        await baixarMedicamentos();

    const durSec = Math.round((Date.now() - sessionStart.getTime()) / 1000);
    log(`\n✅ Atualização concluída em ${durSec}s — ${new Date().toLocaleString('pt-BR')}`);

    // Estado atual dos arquivos CSV
    log('\n📋 Estado dos arquivos:');
    const csvFiles = ['cosmeticos.csv', 'cosmeticos_regularizados.csv', 'medicamentos.csv'];
    for (const f of csvFiles) {
        const fp = path.join(TMP_DIR, f);
        if (fs.existsSync(fp)) {
            const stat = fs.statSync(fp);
            const lines = countLines(fp);
            const age = Math.round((Date.now() - stat.mtimeMs) / 60000);
            log(`   ${f.padEnd(38)} ${formatBytes(stat.size).padStart(9)}  ${lines.toLocaleString('pt-BR').padStart(10)} linhas  (modificado há ${age < 60 ? age + 'min' : Math.round(age/60) + 'h'})`);
        } else {
            log(`   ${f.padEnd(38)} [não existe]`);
        }
    }

    // Salva JSON de última atualização
    fs.writeFileSync(
        path.join(TMP_DIR, 'last-update.json'),
        JSON.stringify({
            updated_at: new Date().toISOString(),
            duration_sec: durSec,
            files: csvFiles.map(f => {
                const fp = path.join(TMP_DIR, f);
                if (!fs.existsSync(fp)) return { name: f, exists: false };
                const stat = fs.statSync(fp);
                return { name: f, exists: true, size_bytes: stat.size, modified_at: stat.mtime.toISOString() };
            }),
        }, null, 2),
        'utf-8'
    );

    flushLog();
}

main().catch(e => {
    logError(`Erro fatal: ${e.message}`);
    flushLog();
    process.exit(1);
});


