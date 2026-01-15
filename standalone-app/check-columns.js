const ExcelJS = require('exceljs');
const path = require('path');

async function checkColumns() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(__dirname, 'tyouzai_excel_v2.xlsx'));

    const worksheet = workbook.worksheets[0];

    console.log('10行目（列見出し）の内容:');
    const row10 = worksheet.getRow(10);

    for (let i = 1; i <= 13; i++) {
        const cell = row10.getCell(i);
        const letter = String.fromCharCode(64 + i); // A=65, B=66, etc.
        console.log(`${letter}列 (${i}): ${cell.value || '(空)'}`);
    }
}

checkColumns().catch(console.error);
