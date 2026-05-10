import fs from 'fs';
import csvParser from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 50;

async function ingest5GbCsv() {
  const filePath = 'c:/Users/User/.gemini/antigravity/scratch/BeautyProcure/Arquivos CSV/TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV';
  const tableName = 'anvisa_situacao_documento_tecnico';
  
  if (!fs.existsSync(filePath)) {
     console.log(`Arquivo 5GB ignorado (Não encontrado no caminho: ${filePath})`);
     return;
  }

  const parserOpts = { separator: ';', headers: Array.from({length: 22}, (_, i) => `col_${String(i+1).padStart(2, '0')}`) };

  console.log(`\n\nStarting FULL ingestion for: ${filePath} -> ${tableName}`);
  console.log(`ATENÇÃO: Este processo irá processar o arquivo completo de 5GB. Pressione Ctrl+C para cancelar se você estiver no plano Free do Supabase.`);
  
  let batch: any[] = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'latin1' })
      .pipe(csvParser(parserOpts))
      .on('data', async (data) => {
        let row: any = {};
        for(const [k, v] of Object.entries(data)) {
           row[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v;
        }

        batch.push(row);
        rowCount++;

        if (batch.length >= BATCH_SIZE) {
          stream.pause();
          const p = batch;
          batch = [];
          supabase.from(tableName).insert(p).then(({ error }) => {
            if (error) console.error(`Error inserting batch:`, error.message);
            process.stdout.write(`\rInserted ${rowCount} rows...`);
            stream.resume();
          });
        }
      })
      .on('end', async () => {
         if (batch.length > 0) {
            await supabase.from(tableName).insert(batch);
            process.stdout.write(`\rInserted ${rowCount} rows...`);
         }
         console.log(`\nCompleted ${tableName}. Total rows: ${rowCount}`);
         resolve(true);
      })
      .on('error', reject);
  });
}

ingest5GbCsv();
