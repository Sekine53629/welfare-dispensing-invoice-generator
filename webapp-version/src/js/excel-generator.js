/**
 * ============================================================================
 * Module: excel-generator.js
 * Description: Excel生成モジュール (ExcelJS使用)
 *              テンプレートベースでExcelファイルを生成
 * Author: 関根 sekine53629
 * Version: 2.0.0
 * Created: 2025-02-15
 * ============================================================================
 */

import ExcelJS from 'exceljs';
import { fixKanaAndTrim, removeLeading01 } from './utils.js';

/**
 * Excelファイルを生成
 * @param {Array<PatientData>} patients - 患者データ配列
 * @param {Object} config - 設定 {pharmacyName, medicalCode}
 * @param {ArrayBuffer} templateBuffer - テンプレートExcelファイル（オプション）
 * @returns {Promise<Blob>} Excelファイル（Blob）
 */
export async function generateExcel(patients, config, templateBuffer = null) {
  const workbook = new ExcelJS.Workbook();

  // テンプレートがある場合は読み込み、なければ新規作成
  if (templateBuffer) {
    await workbook.xlsx.load(templateBuffer);
  } else {
    // デフォルトテンプレート作成
    const worksheet = workbook.addWorksheet('請求書');
    setupDefaultTemplate(worksheet);
  }

  const worksheet = workbook.getWorksheet(1);

  // データ転記開始行
  const START_ROW = 11;

  // 患者データを転記
  patients.forEach((patient, index) => {
    const rowNum = START_ROW + index;
    const row = worksheet.getRow(rowNum);

    // 列の配置（テンプレートに合わせる）
    row.getCell(2).value = config.pharmacyName; // 薬局名
    row.getCell(3).value = removeLeading01(config.medicalCode); // 薬局医療機関コード
    row.getCell(4).value = patient.medicalInstitution; // 診療医療機関名
    row.getCell(5).value = patient.medicalCode; // 診療医療機関コード
    row.getCell(6).value = patient.recipientNumber; // 受給者番号
    row.getCell(7).value = patient.patientName; // 患者氏名
    row.getCell(8).value = patient.patientKana; // 患者カナ氏名
    row.getCell(9).value = patient.birthDate; // 生年月日
    row.getCell(10).value = patient.treatmentDate; // 診療年月日

    // フラグ
    row.getCell(12).value = patient.hasJiritsuShien ? '◯' : ''; // 自立支援
    row.getCell(13).value = patient.hasJusho ? '◯' : ''; // 重障

    row.commit();
  });

  // Excelファイルを生成
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * デフォルトテンプレートをセットアップ
 * @param {ExcelJS.Worksheet} worksheet - ワークシート
 */
function setupDefaultTemplate(worksheet) {
  // ヘッダー行（1-10行目）
  worksheet.mergeCells('A1:M1');
  worksheet.getCell('A1').value = '調剤券請求書';
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.getRow(1).height = 30;

  // 項目行（10行目）
  const headers = [
    '',
    '薬局名',
    '薬局コード',
    '医療機関名',
    '医療機関コード',
    '受給者番号',
    '患者氏名',
    '患者カナ氏名',
    '生年月日',
    '診療年月日',
    '',
    '自立支援',
    '重障',
  ];

  const headerRow = worksheet.getRow(10);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  headerRow.height = 25;

  // 列幅設定
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 20; // 薬局名
  worksheet.getColumn(3).width = 12; // 薬局コード
  worksheet.getColumn(4).width = 25; // 医療機関名
  worksheet.getColumn(5).width = 12; // 医療機関コード
  worksheet.getColumn(6).width = 15; // 受給者番号
  worksheet.getColumn(7).width = 18; // 患者氏名
  worksheet.getColumn(8).width = 18; // 患者カナ氏名
  worksheet.getColumn(9).width = 18; // 生年月日
  worksheet.getColumn(10).width = 15; // 診療年月日
  worksheet.getColumn(11).width = 5;
  worksheet.getColumn(12).width = 10; // 自立支援
  worksheet.getColumn(13).width = 10; // 重障
}

/**
 * テンプレートファイルを読み込み
 * @param {File} file - テンプレートファイル
 * @returns {Promise<ArrayBuffer>}
 */
export async function loadTemplateFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Excelファイルの検証
 * @param {Blob} blob - Excelファイル
 * @returns {Promise<boolean>} 有効フラグ
 */
export async function validateExcel(blob) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    return workbook.worksheets.length > 0;
  } catch (error) {
    console.error('Excel検証エラー:', error);
    return false;
  }
}

/**
 * ExcelからCSVに変換（デバッグ用）
 * @param {Blob} excelBlob - ExcelファイルBlob
 * @returns {Promise<string>} CSV文字列
 */
export async function excelToCSV(excelBlob) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await excelBlob.arrayBuffer());

  const worksheet = workbook.getWorksheet(1);
  const csvLines = [];

  worksheet.eachRow((row) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      let value = cell.value || '';
      // カンマを含む場合はクォートで囲む
      if (String(value).includes(',')) {
        value = `"${value}"`;
      }
      values.push(value);
    });
    csvLines.push(values.join(','));
  });

  return csvLines.join('\n');
}

export default {
  generateExcel,
  loadTemplateFile,
  validateExcel,
  excelToCSV,
};
