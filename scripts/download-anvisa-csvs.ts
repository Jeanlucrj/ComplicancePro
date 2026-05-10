import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

import https from 'https';

// URLs diretas dos arquivos solicitados
const TARGET_FILES: Record<string, string> = {
  'DADOS_ABERTOS_COSMETICO.csv': 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_COSMETICO.csv',
  'DADOS_ABERTOS_MEDICAMENTOS.csv': 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv',
  'TA_CONSULTA_FUNCIONAMENTO_EMPRESA_INTERNACIONAL.CSV': 'https://dados.anvisa.gov.br/dados/CONSULTAS/EMPRESA_FISCALIZACAO_PRODUTO/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_INTERNACIONAL.CSV',
  'TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV': 'https://dados.anvisa.gov.br/dados/CONSULTAS/EMPRESA_FISCALIZACAO_PRODUTO/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV',
  'TA_CONSULTA_PARECER_AVAL_MEDICAMENTOS.CSV': 'https://dados.anvisa.gov.br/dados/CONSULTAS/DOCUMENTOS/TA_CONSULTA_PARECER_AVAL_MEDICAMENTOS.CSV',
  'TA_CONSULTA_PRODUTOS_IRREGULARES_RESULTADO.CSV': 'https://dados.anvisa.gov.br/dados/CONSULTAS/EMPRESA_FISCALIZACAO_PRODUTO/TA_CONSULTA_PRODUTOS_IRREGULARES_RESULTADO.CSV',
  'TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV': 'https://dados.anvisa.gov.br/dados/CONSULTAS/DOCUMENTOS/TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV'
};

const OUTPUT_DIR = path.join(process.cwd(), 'Arquivos CSV');

// Configura um agente HTTPS para ignorar erros de certificado (comum em sites do governo)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function downloadFile(url: string, filename: string) {
  const filePath = path.join(OUTPUT_DIR, filename);
  console.log(`[+] Baixando ${filename}...`);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      httpsAgent: httpsAgent,
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ ${filename} baixado com sucesso.`);
        resolve(true);
      });
      writer.on('error', (err) => {
        console.error(`❌ Erro ao salvar ${filename}:`, err);
        reject(err);
      });
    });
  } catch (error: any) {
    console.error(`❌ Erro na requisição de ${filename}: ${error.message}`);
  }
}

export async function runDownload() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Diretório '${OUTPUT_DIR}' criado.`);
  }

  console.log('\n🚀 Iniciando download dos arquivos da Anvisa...\n');

  for (const [filename, url] of Object.entries(TARGET_FILES)) {
    await downloadFile(url, filename);
  }
  
  console.log('\n🎉 Todos os downloads finalizados!');
}

if (require.main === module) {
  runDownload();
}
