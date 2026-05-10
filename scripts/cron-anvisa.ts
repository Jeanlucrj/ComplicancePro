import cron from 'node-cron';
import { execSync } from 'child_process';
import { runDownload } from './download-anvisa-csvs';

console.log('⏳ Iniciando agendador para download e sincronização dos arquivos da Anvisa...');
console.log('O script será executado toda sexta-feira às 00:00 (meia-noite).');
console.log('Mantenha este processo rodando para que o agendamento funcione.');

// '0 0 * * 5' significa toda sexta-feira à meia-noite
cron.schedule('0 0 * * 5', async () => {
  console.log('\n=============================================');
  console.log(`[${new Date().toLocaleString()}] Iniciando execução automática de Sexta-feira`);
  console.log('=============================================');
  
  try {
    await runDownload();
    console.log(`[${new Date().toLocaleString()}] Download concluído. Iniciando sincronização do banco de dados...`);
    
    // Executa as sincronizações com o banco
    const syncCommands = [
      'npm run sync:irregulares',
      'npm run sync:cosmeticos',
      'npm run sync:medicamentos',
      'npm run sync:afe'
    ];

    for (const cmd of syncCommands) {
      console.log(`\n➡️ Executando: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
    }

    console.log(`\n✅ [${new Date().toLocaleString()}] Execução semanal concluída com sucesso!`);
  } catch (error: any) {
    console.error(`❌ [${new Date().toLocaleString()}] Erro durante a execução automática:`, error.message);
  }
});

// Opção para rodar manualmente ao iniciar (para testar)
const args = process.argv.slice(2);
if (args.includes('--run-now')) {
  console.log('\nOpção --run-now detectada. Executando imediatamente...');
  (async () => {
    try {
      await runDownload();
      console.log('Download concluído. Iniciando sincronização...');
      const syncCommands = ['npm run sync:irregulares', 'npm run sync:cosmeticos', 'npm run sync:medicamentos', 'npm run sync:afe'];
      for (const cmd of syncCommands) {
        console.log(`\n➡️ Executando: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
      }
      console.log('\n✅ Tudo sincronizado!');
    } catch(e) {
      console.error(e);
    }
  })();
}
