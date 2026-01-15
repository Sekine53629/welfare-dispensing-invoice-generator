/**
 * テンプレートファイルから共有数式を削除してクリーンなテンプレートを作成し、Base64エンコードするスクリプト
 *
 * 使い方:
 * 1. Node.jsをインストール
 * 2. npm install exceljs
 * 3. node create-clean-template.js
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function createCleanTemplate() {
    console.log('テンプレートファイルを読み込み中...');

    const templatePath = path.join(__dirname, 'tyouzai_excel_v2.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.worksheets[0];

    console.log('共有数式をクリア中...');

    // アプローチ: 全行から数式を削除（共有数式の内部モデルを直接操作）
    const totalRows = worksheet.rowCount;
    console.log(`総行数: ${totalRows}`);

    console.log('すべての行から共有数式を削除中...');
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber >= 11) {
            row.eachCell({ includeEmpty: true }, (cell) => {
                // ExcelJSの内部モデルから共有数式を削除
                if (cell.model) {
                    if (cell.model.sharedFormula !== undefined) {
                        delete cell.model.sharedFormula;
                    }
                    if (cell.model.formula) {
                        delete cell.model.formula;
                    }
                    if (cell.model.result !== undefined && typeof cell.model.result === 'object') {
                        delete cell.model.result;
                    }
                }
                // セルの値も空にする
                cell.value = null;
            });
        }
    });

    console.log('クリーンなテンプレートを保存中...');
    // クリーンなテンプレートをファイルに保存
    const cleanTemplatePath = path.join(__dirname, 'tyouzai_excel_v2_clean.xlsx');
    await workbook.xlsx.writeFile(cleanTemplatePath);

    console.log('Base64エンコード中...');
    // Base64エンコード
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = buffer.toString('base64');

    // Base64文字列をファイルに保存
    const base64Path = path.join(__dirname, 'template_base64.txt');
    fs.writeFileSync(base64Path, base64, 'utf8');

    // JavaScriptファイルとして保存
    const jsPath = path.join(__dirname, 'template-data.js');
    const jsContent = `// クリーンなテンプレートファイル (Base64エンコード済み)\nconst TEMPLATE_BASE64 = '${base64}';\n`;
    fs.writeFileSync(jsPath, jsContent, 'utf8');

    console.log('\n✅ 完了しました！');
    console.log(`クリーンなテンプレート: ${cleanTemplatePath}`);
    console.log(`Base64ファイル: ${base64Path}`);
    console.log(`JavaScriptファイル: ${jsPath}`);
    console.log(`Base64サイズ: ${base64.length} 文字`);
}

createCleanTemplate().catch(error => {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
});
