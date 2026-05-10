import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const filePath = path.join(process.cwd(), 'tmp', 'medicamentos.xls');

async function checkExcel() {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const output = {
        totalRows: rows.length,
        sample: rows.slice(0, 10)
    };
    fs.writeFileSync('excel_structure.json', JSON.stringify(output, null, 2));
    console.log('✅ excel_structure.json criado!');
}

checkExcel();
