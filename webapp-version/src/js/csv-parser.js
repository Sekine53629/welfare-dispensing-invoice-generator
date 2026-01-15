/**
 * ============================================================================
 * Module: csv-parser.js
 * Description: CSV解析モジュール (Papa Parse使用)
 *              不完全なシングルクォート処理とカンマを含むフィールドに対応
 * Author: 関根 sekine53629
 * Version: 2.0.0
 * Created: 2025-02-15
 * ============================================================================
 */

import Papa from 'papaparse';
import { fixKana, trimSpaces, fixKanaAndTrim, removeLeading01 } from './utils.js';

/**
 * CSVレコードクラス
 */
export class CSVRecord {
  constructor(fields, rowNumber) {
    this.fields = fields; // 配列 (70要素)
    this.rowNumber = rowNumber;
    this.isValid = true;
  }

  /**
   * 指定列のフィールド値を取得
   * @param {number} columnIndex - 列番号 (1-70)
   * @returns {string} フィールド値
   */
  getField(columnIndex) {
    if (columnIndex >= 1 && columnIndex <= 70) {
      return this.fields[columnIndex - 1] || '';
    }
    return '';
  }

  /**
   * 患者氏名を取得
   * @returns {string}
   */
  getPatientName() {
    return this.getField(10);
  }

  /**
   * 患者カナ氏名を取得
   * @returns {string}
   */
  getPatientKana() {
    return this.getField(11);
  }

  /**
   * 生年月日を取得
   * @returns {string}
   */
  getBirthDate() {
    return this.getField(12);
  }

  /**
   * 住所を取得
   * @returns {string}
   */
  getAddress() {
    return this.getField(38);
  }

  /**
   * 保険者番号を取得
   * @returns {string}
   */
  getInsurerNumber() {
    return this.getField(23);
  }

  /**
   * 公費種別番号を取得 (3つ)
   * @returns {Array<string>}
   */
  getPublicCodes() {
    return [
      this.getField(22), // 第一公費種別番号
      this.getField(26), // 第二公費種別番号
      this.getField(30), // 第三公費種別番号
    ];
  }

  /**
   * 医療機関コードを取得
   * @returns {string}
   */
  getMedicalCode() {
    return this.getField(65);
  }

  /**
   * 受給者番号を取得
   * @returns {string}
   */
  getRecipientNumber() {
    return this.getField(58);
  }

  /**
   * 診療年月日を取得
   * @returns {string}
   */
  getTreatmentDate() {
    return this.getField(56);
  }

  /**
   * 医療機関名を取得
   * @returns {string}
   */
  getMedicalInstitution() {
    return this.getField(34);
  }
}

/**
 * CSVファイルを解析
 * @param {File} file - CSVファイル
 * @param {Object} options - オプション
 * @returns {Promise<Array<CSVRecord>>} パース済みレコード配列
 */
export async function parseCSVFile(file, options = {}) {
  return new Promise((resolve, reject) => {
    const config = {
      // Papa Parse 設定
      delimiter: ',',
      newline: '\r\n',
      quoteChar: "'",
      escapeChar: "'",
      header: false,
      dynamicTyping: false,
      preview: 0,
      encoding: 'Shift-JIS',
      worker: false,
      comments: false,
      step: undefined,
      complete: (results) => {
        try {
          const records = processCSVResults(results);
          resolve(records);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(new Error(`CSV解析エラー: ${error.message}`));
      },
      skipEmptyLines: true,
      fastMode: false,
      beforeFirstChunk: undefined,
      chunk: undefined,
      ...options,
    };

    // ファイル読み込み
    Papa.parse(file, config);
  });
}

/**
 * Papa Parseの結果を処理
 * @param {Object} results - Papa Parseの結果
 * @returns {Array<CSVRecord>} CSVRecordの配列
 */
function processCSVResults(results) {
  const records = [];
  let rowNumber = 0;

  for (const row of results.data) {
    rowNumber++;

    // 1行目（列番号）と8行目（項目名）をスキップ
    if (rowNumber === 1 || rowNumber === 8) {
      continue;
    }

    // 空行スキップ
    if (!row || row.length === 0 || row.every((field) => !field)) {
      continue;
    }

    // フィールドをクリーニング
    const cleanedFields = row.map((field) => cleanField(field || ''));

    // 70列に満たない場合は空文字で埋める
    while (cleanedFields.length < 70) {
      cleanedFields.push('');
    }

    // CSVRecordオブジェクト作成
    const record = new CSVRecord(cleanedFields, rowNumber);

    // フィールド数チェック
    if (cleanedFields.length < 65) {
      console.warn(`警告: 行 ${rowNumber} のフィールド数が不足（${cleanedFields.length}列）`);
      record.isValid = false;
    }

    records.push(record);
  }

  return records;
}

/**
 * フィールド値のクリーニング
 * @param {string} fieldValue - フィールド値
 * @returns {string} クリーニング済み文字列
 */
function cleanField(fieldValue) {
  let result = fieldValue;

  // 先頭・末尾の空白削除
  result = result.trim();

  // シングルクォート削除
  result = result.replace(/'/g, '');

  return result;
}

/**
 * CSVデータを2次元配列として返す（互換性用）
 * @param {File} file - CSVファイル
 * @returns {Promise<Array<Array<string>>>} 2次元配列
 */
export async function parseCSVFileAsArray(file) {
  const records = await parseCSVFile(file);
  return records.map((record) => record.fields);
}

/**
 * CSVレコードをデバッグ出力
 * @param {CSVRecord} record - CSVレコード
 */
export function debugPrintRecord(record) {
  console.log(`--- Record Row: ${record.rowNumber} ---`);
  record.fields.forEach((field, index) => {
    if (field !== '') {
      console.log(`  [${index + 1}] = ${field}`);
    }
  });
}

/**
 * CSVファイルをテキストとして読み込み（エンコーディング指定）
 * @param {File} file - ファイル
 * @param {string} encoding - エンコーディング (Shift-JIS, UTF-8)
 * @returns {Promise<string>} ファイル内容
 */
export async function readFileAsText(file, encoding = 'Shift-JIS') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target.result);
    };

    reader.onerror = (error) => {
      reject(new Error(`ファイル読み込みエラー: ${error}`));
    };

    // エンコーディング指定
    reader.readAsText(file, encoding);
  });
}

/**
 * CSVの統計情報を取得
 * @param {Array<CSVRecord>} records - レコード配列
 * @returns {Object} 統計情報
 */
export function getCSVStatistics(records) {
  return {
    totalRecords: records.length,
    validRecords: records.filter((r) => r.isValid).length,
    invalidRecords: records.filter((r) => !r.isValid).length,
    asahikawaRecords: records.filter((r) =>
      r.getAddress().includes('旭川市')
    ).length,
    publicCode12Records: records.filter((r) =>
      r.getPublicCodes().includes('12')
    ).length,
  };
}

export default {
  parseCSVFile,
  parseCSVFileAsArray,
  CSVRecord,
  debugPrintRecord,
  readFileAsText,
  getCSVStatistics,
};
