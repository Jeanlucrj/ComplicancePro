import fs from 'fs';
import csvParser from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 50;
const MAX_ROWS = 10000; // Limite de 10.000 para amostra

async function testExistence() {
   const { error } = await supabase.from('anvisa_situacao_documento_tecnico').select('id').limit(1);
   if (error && error.code === 'PGRST205') {
       console.error("ERRO: A tabela anvisa_situacao_documento_tecnico não existe no banco! Por favor crie ela no Painel.");
       process.exit(1);
   }
}

async function ingestSampleCsv() {
  const filePath = 'c:/Users/User/.gemini/antigravity/scratch/BeautyProcure/Arquivos CSV/TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV';
  const tableName = 'anvisa_situacao_documento_tecnico';
  
  // Headers customizados se não tiver Header na gigante:
  const parserOpts = { separator: ';', headers: Array.from({length: 22}, (_, i) => `col_${String(i+1).padStart(2, '0')}`) };

  console.log(`\n\nStarting SAMPLE ingestion for: ${filePath} -> ${tableName}`);
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

        // --- TRAVA DE MÁXIMO DE ROWS PARA A AMOSTRA ---
        if (rowCount >= MAX_ROWS) {
          stream.destroy(); // Fecha a stream imediatamente
          console.log(`\n\nLimite de amostra de ${MAX_ROWS} atingido. Stream encerrada para proteção!`);
          resolve(true);
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

testExistence().then(() => ingestSampleCsv());
