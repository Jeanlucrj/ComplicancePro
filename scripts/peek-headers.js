const fs = require('fs');

function peek(filename) {
    const fd = fs.openSync(filename, 'r');
    const buffer = Buffer.alloc(2000);
    fs.readSync(fd, buffer, 0, 2000, 0);
    fs.closeSync(fd);
    
    // extrair primeira linha (até \n)
    const content = buffer.toString('utf8');
    const firstLine = content.split('\n')[0];
    console.log(`\n\n--- ${filename} ---`);
    console.log(firstLine);
}

peek('c:/Users/User/.gemini/antigravity/scratch/BeautyProcure/Arquivos CSV/TA_CONSULTA_PARECER_AVAL_MEDICAMENTOS.CSV');
peek('c:/Users/User/.gemini/antigravity/scratch/BeautyProcure/Arquivos CSV/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_INTERNACIONAL.CSV');
peek('c:/Users/User/.gemini/antigravity/scratch/BeautyProcure/Arquivos CSV/TA_CONSULTA_PRODUTOS_IRREGULARES_RESULTADO.CSV');
peek('c:/Users/User/.gemini/antigravity/scratch/BeautyProcure/Arquivos CSV/TA_CONSULTA_FUNCIONAMENTO_EMPRESA_NACIONAL.CSV');
peek('c:/Users/User/.gemini/antigravity/scratch/BeautyProcure/Arquivos CSV/TA_CONSULTA_SITUACAO_DOCUMENTO_TECNICO.CSV');
