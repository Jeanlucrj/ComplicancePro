import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkTables() {
  const tables = [
    'anvisa_produtos_irregulares',
    'anvisa_parecer_aval_medicamentos',
    'anvisa_situacao_documento',
    'anvisa_empresas'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table} check failed: ${error.message} (${error.code})`);
    } else {
      console.log(`Table ${table} EXITS. Data: ${data.length > 0 ? 'YES' : 'EMPTY'}`);
    }
  }
}

checkTables();
