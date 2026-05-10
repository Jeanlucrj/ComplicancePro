import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function resetTables() {
    console.log("Deletando registros antigos com datas erradas...");
    await supabase.from('anvisa_produtos_irregulares').delete().neq('id', 0);
    // await supabase.from('anvisa_funcionamento_nacional').delete().neq('id', 0);
    // await supabase.from('anvisa_funcionamento_internacional').delete().neq('id', 0);
    console.log("Limpeza concluída para Irregulares!");
}

resetTables();
