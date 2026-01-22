/**
 * ============================================================================
 * Module: excel-generator.js
 * Description: Excel生成モジュール (ExcelJS使用)
 *              テンプレートベースでExcelファイルを生成
 * Author: 関根 sekine53629
 * Version: 2.4.0
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

  // 患者データをグループ化（同一患者の複数来局日を統合）
  const groupedPatients = groupPatientsByRecipient(patients);

  // 患者データを転記
  groupedPatients.forEach((patientGroup, index) => {
    const rowNum = START_ROW + index;
    const row = worksheet.getRow(rowNum);

    // 代表データ（最初のレコード）
    const patient = patientGroup.records[0];

    // B列: 薬局名
    row.getCell(2).value = config.pharmacyName || '';

    // C列: コード（調剤薬局医療機関コード、int型8桁固定）
    const pharmacyCodeCell = row.getCell(3);
    pharmacyCodeCell.value = parseInt(formatMedicalCode(config.medicalCode), 10) || 0;
    pharmacyCodeCell.numFmt = '00000000'; // 8桁固定

    // D列: 診療医療機関名
    row.getCell(4).value = removeAllQuotes(patient.medicalInstitution);

    // E列: コード（診療医療機関コード、int型8桁固定）
    const medicalCodeCell = row.getCell(5);
    medicalCodeCell.value = parseInt(formatMedicalCode(patient.medicalCode), 10) || 0;
    medicalCodeCell.numFmt = '00000000'; // 8桁固定

    // F列: 受給者番号（int型7桁固定）
    const recipientCell = row.getCell(6);
    recipientCell.value = parseInt(removeAllQuotes(patient.recipientNumber), 10) || 0;
    recipientCell.numFmt = '0000000'; // 7桁固定

    // G列: 患者氏名（シングルクォート削除）
    row.getCell(7).value = removeAllQuotes(patient.patientName);

    // H列: 氏名カナ（シングルクォート削除）
    row.getCell(8).value = removeAllQuotes(patient.patientKana);

    // I列: 生年月日（日付型シリアル値、スラッシュ区切り・ゼロ埋めなし）
    const birthDateCell = row.getCell(9);
    birthDateCell.value = parseJapaneseDate(patient.birthDate);
    birthDateCell.numFmt = 'yyyy/m/d';

    // J列: 調剤年月日（月初来局日のみ、日付型）
    const treatmentDateCell = row.getCell(10);
    treatmentDateCell.value = patientGroup.firstTreatmentDate || parseYYYYMMDD(patientGroup.treatmentDates[0]);
    treatmentDateCell.numFmt = 'yyyy/m/d'; // 日付型、スラッシュ区切り、ゼロ埋めなし

    // 公費フラグ判定
    const kohiFlags = detectKohiFlags(patient.publicCodes);

    // 主保険判定（「公費単独」でなければ主保険あり）
    const hasMainInsurance = patient.insuranceType !== '公費単独';

    // K列: 社保（社保・国保など）
    row.getCell(11).value = hasMainInsurance ? '◯' : '';

    // L列: 自立支援（公費21/15/16）
    row.getCell(12).value = kohiFlags.hasJiritsuShien ? '◯' : '';

    // M列: 難病（公費54）
    row.getCell(13).value = kohiFlags.hasJusho ? '◯' : '';

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
    '番号',
    '調剤薬局名',
    'コード',
    '診療医療機関名',
    'コード',
    '受給者番号',
    '氏名',
    '氏名カナ',
    '生年月日',
    '調剤年月日',
    '社保',
    '自立支援',
    '難病',
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
  worksheet.getColumn(1).width = 5;   // 番号
  worksheet.getColumn(2).width = 20;  // 調剤薬局名
  worksheet.getColumn(3).width = 12;  // コード（調剤薬局）
  worksheet.getColumn(4).width = 25;  // 診療医療機関名
  worksheet.getColumn(5).width = 12;  // コード（診療医療機関）
  worksheet.getColumn(6).width = 12;  // 受給者番号
  worksheet.getColumn(7).width = 18;  // 氏名
  worksheet.getColumn(8).width = 18;  // 氏名カナ
  worksheet.getColumn(9).width = 12;  // 生年月日
  worksheet.getColumn(10).width = 12; // 調剤年月日
  worksheet.getColumn(11).width = 6;  // 社保
  worksheet.getColumn(12).width = 10; // 自立支援
  worksheet.getColumn(13).width = 6;  // 難病
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

/**
 * 医療機関コードをフォーマット（下8桁を文字列として取得）
 * @param {string} code - 医療機関コード
 * @returns {string} フォーマット済みコード
 */
function formatMedicalCode(code) {
  if (!code) return '';

  // シングルクォートと前後の空白を削除
  let cleaned = removeAllQuotes(String(code).trim());

  // 先頭の01を削除
  cleaned = removeLeading01(cleaned);

  // 下8桁を取得
  if (cleaned.length > 8) {
    cleaned = cleaned.slice(-8);
  }

  return cleaned;
}

/**
 * すべてのシングルクォート・ダブルクォートを削除
 * @param {string} str - 文字列
 * @returns {string} クリーニング済み文字列
 */
function removeAllQuotes(str) {
  if (!str) return '';
  return String(str).replace(/['"`]/g, '');
}

/**
 * 日本の日付文字列をDate型に変換
 * @param {string} dateStr - 日付文字列（例: '2025/02/15', 'R7/2/15'）
 * @returns {Date|string} Date型または元の文字列
 */
function parseJapaneseDate(dateStr) {
  if (!dateStr) return '';

  // すでにDate型の場合
  if (dateStr instanceof Date) return dateStr;

  const str = String(dateStr).trim();

  // YYYY/MM/DD形式のチェック
  const westernMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (westernMatch) {
    const [_, year, month, day] = westernMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // 令和（R）形式のチェック（例: R7/2/15 → 2025/2/15）
  const reiwaMatch = str.match(/^R(\d{1,2})\/(\d{1,2})\/(\d{1,2})$/);
  if (reiwaMatch) {
    const [_, reiwaYear, month, day] = reiwaMatch;
    const year = parseInt(reiwaYear) + 2018; // 令和元年 = 2019年
    return new Date(year, parseInt(month) - 1, parseInt(day));
  }

  // 平成（H）形式のチェック（例: H31/4/30 → 2019/4/30）
  const heiseiMatch = str.match(/^H(\d{1,2})\/(\d{1,2})\/(\d{1,2})$/);
  if (heiseiMatch) {
    const [_, heiseiYear, month, day] = heiseiMatch;
    const year = parseInt(heiseiYear) + 1988; // 平成元年 = 1989年
    return new Date(year, parseInt(month) - 1, parseInt(day));
  }

  // パースできない場合は元の文字列を返す
  return str;
}

/**
 * YYYYMMDD形式の日付文字列をDate型に変換
 * @param {string} dateStr - YYYYMMDD形式の日付文字列（例: '20250210'）
 * @returns {Date|string} Date型または元の文字列
 */
function parseYYYYMMDD(dateStr) {
  if (!dateStr) return '';

  // すでにDate型の場合
  if (dateStr instanceof Date) return dateStr;

  // シングルクォートと空白を削除
  const cleaned = removeAllQuotes(String(dateStr).trim());

  // YYYYMMDD形式のチェック（例: '20250210'）
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JavaScriptの月は0-indexed
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  // パースできない場合は元の文字列を返す
  return cleaned;
}

/**
 * 患者データを受給者番号＋月でグループ化（月ごとに1行、月初来局日を使用）
 * v2.4.0: 月を跨ぐ場合は複数行に分割、今月分が先・前月分が後
 * @param {Array<PatientData>} patients - 患者データ配列
 * @returns {Array<Object>} グループ化されたデータ（月ごとに分割）
 */
function groupPatientsByRecipient(patients) {
  const groups = new Map();

  patients.forEach(patient => {
    // 必須データ（受給者番号・患者名）のチェック
    if (!patient.recipientNumber || !patient.patientName) {
      console.warn('必須データ不足の患者をスキップ:', patient);
      return;
    }

    // 調剤年月日から年月を抽出
    const treatmentDate = patient.treatmentDate;
    if (!treatmentDate) {
      console.warn('調剤年月日がない患者をスキップ:', patient);
      return;
    }

    // YYYYMMDD形式をパース
    const parsed = parseYYYYMMDD(treatmentDate);
    if (!(parsed instanceof Date)) {
      console.warn('調剤年月日のパースに失敗:', treatmentDate);
      return;
    }

    const yearMonth = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;

    // 受給者番号 + 患者名 + 年月 でグループ化
    const key = `${patient.recipientNumber}_${patient.patientName}_${yearMonth}`;

    if (!groups.has(key)) {
      groups.set(key, {
        records: [],
        treatmentDates: [],
        yearMonth: yearMonth,
        firstTreatmentDate: null
      });
    }

    const group = groups.get(key);
    group.records.push(patient);

    // 調剤年月日を追加（重複排除）
    if (!group.treatmentDates.includes(treatmentDate)) {
      group.treatmentDates.push(treatmentDate);
    }
  });

  // 各グループの月初来局日を決定
  const result = Array.from(groups.values()).map(group => {
    // 日付をソートして最初の日を取得
    const sortedDates = group.treatmentDates
      .map(d => ({ original: d, date: parseYYYYMMDD(d) }))
      .filter(d => d.date instanceof Date)
      .sort((a, b) => a.date - b.date);

    if (sortedDates.length > 0) {
      group.firstTreatmentDate = sortedDates[0].date;
    }

    return group;
  });

  // 今月分が先、前月分が後になるようにソート（年月の降順）
  result.sort((a, b) => {
    // 年月の降順（新しい月が先）
    return b.yearMonth.localeCompare(a.yearMonth);
  });

  return result;
}

/**
 * 複数の診療年月日をフォーマット（YYYYMMDD形式対応）
 * @param {Array<string>} dates - 日付配列（YYYYMMDD形式: '20250210'）
 * @returns {string} フォーマット済み文字列（例: '2025/2(7,10,25)'）
 */
function formatMultipleTreatmentDates(dates) {
  if (!dates || dates.length === 0) return '';

  // 日付をDate型に変換してソート
  const parsedDates = dates
    .map(d => {
      const parsed = parseYYYYMMDD(d); // YYYYMMDD形式をパース
      return {
        original: d,
        date: parsed instanceof Date ? parsed : null,
        str: d
      };
    })
    .filter(d => d.date !== null)
    .sort((a, b) => a.date - b.date);

  if (parsedDates.length === 0) {
    // パースできない日付の場合はカンマ区切りで返す
    return dates.join(', ');
  }

  if (parsedDates.length === 1) {
    // 1つだけの場合は通常の日付形式
    const d = parsedDates[0].date;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  // 複数の場合は「YYYY/M(D,D,D)」形式
  const firstDate = parsedDates[0].date;
  const year = firstDate.getFullYear();
  const month = firstDate.getMonth() + 1;

  // 同じ年月かチェック
  const allSameYearMonth = parsedDates.every(d =>
    d.date.getFullYear() === year && d.date.getMonth() + 1 === month
  );

  if (allSameYearMonth) {
    const days = parsedDates.map(d => d.date.getDate()).join(',');
    return `${year}/${month}(${days})`;
  } else {
    // 異なる年月が混在する場合はカンマ区切り
    return parsedDates.map(d => {
      const date = d.date;
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    }).join(', ');
  }
}

/**
 * 公費コードから各フラグを判定
 * @param {Array<string>} publicCodes - 公費コード配列
 * @returns {Object} フラグオブジェクト {hasJiritsuShien, hasJusho}
 */
function detectKohiFlags(publicCodes) {
  const flags = {
    hasJiritsuShien: false, // 自立支援（21/15/16）
    hasJusho: false         // 重障（54）
  };

  if (!publicCodes || publicCodes.length === 0) return flags;

  publicCodes.forEach(code => {
    const cleaned = String(code).trim();

    // 自立支援: 21（精神通院）、15（更生医療）、16（育成医療）
    if (cleaned === '21' || cleaned === '15' || cleaned === '16') {
      flags.hasJiritsuShien = true;
    }

    // 重障: 54（難病）
    if (cleaned === '54') {
      flags.hasJusho = true;
    }
  });

  return flags;
}

export default {
  generateExcel,
  loadTemplateFile,
  validateExcel,
  excelToCSV,
};
