/**
 * ============================================================================
 * Module: csv-parser.js
 * Description: CSV解析モジュール (Papa Parse使用)
 *              不完全なシングルクォート処理とカンマを含むフィールドに対応
 * Author: 関根 sekine53629
 * Version: 2.1.0
 * Created: 2025-02-15
 * Updated: 2026-01-20 - ANSI/CP932エンコーディング優先モード追加
 * ============================================================================
 */

import Papa from 'papaparse';
import Encoding from 'encoding-japanese';
import { fixKana, trimSpaces, fixKanaAndTrim, removeLeading01 } from './utils.js';

// エンコーディングモード設定
// 'auto': 自動検出
// 'ansi-first': ANSI/Shift-JIS優先（2026年1月以降の本番データ向け）
// 'utf8-first': UTF-8優先（従来動作）
let currentEncodingMode = 'ansi-first';

/**
 * エンコーディングモードを設定
 * @param {string} mode - 'auto' | 'ansi-first' | 'utf8-first'
 */
export function setEncodingMode(mode) {
  if (['auto', 'ansi-first', 'utf8-first'].includes(mode)) {
    currentEncodingMode = mode;
    localStorage.setItem('encoding-mode', mode);
    console.log('📋 エンコーディングモード変更:', mode);
  }
}

/**
 * 現在のエンコーディングモードを取得
 * @returns {string}
 */
export function getEncodingMode() {
  return currentEncodingMode;
}

/**
 * 保存されたエンコーディングモードを読み込み
 */
export function loadEncodingMode() {
  const saved = localStorage.getItem('encoding-mode');
  if (saved && ['auto', 'ansi-first', 'utf8-first'].includes(saved)) {
    currentEncodingMode = saved;
  }
}

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
   * 診療年月日を取得（YYYYMMDD形式）
   * @returns {string}
   */
  getTreatmentDate() {
    // 列56: 最終受診日 (YYYYMMDD format: '20250210')
    // VBA implementation uses column 56 (Module1.bas line 171)
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
  // STEP 1: ファイルをバイナリとして読み込み、エンコーディング検出
  const { text, encoding } = await readFileWithEncoding(file);

  console.log('📊 使用エンコーディング:', encoding);

  // STEP 2: 前処理：不完全なシングルクォートを削除
  const cleanedText = preprocessCSVText(text);

  // STEP 3: Papa Parseでパース
  return new Promise((resolve, reject) => {
    const config = {
      // Papa Parse 設定
      delimiter: ',',
      newline: '\r\n',
      quoteChar: '"',        // ダブルクォート（シングルクォートは前処理で削除済み）
      escapeChar: '"',
      header: false,
      dynamicTyping: false,
      preview: 0,
      worker: false,
      comments: false,
      step: undefined,
      complete: (results) => {
        try {
          const records = processCSVResults(results);
          // エンコーディング情報を付加
          records._encoding = encoding;
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

    // 前処理済みテキストをパース
    Papa.parse(cleanedText, config);
  });
}

/**
 * CSVテキストの前処理：不完全なシングルクォートを削除
 * @param {string} text - CSV生テキスト
 * @returns {string} クリーニング済みテキスト
 */
function preprocessCSVText(text) {
  if (!text) return '';

  // すべてのシングルクォート（'）を削除
  // 理由：実際のCSVでは不完全なクォート（開始なし・終了のみ）が存在し、
  //       Papa Parseが誤ってフィールドを結合してしまうため
  let cleaned = text.replace(/'/g, '');

  return cleaned;
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
  if (!fieldValue) return '';

  let result = String(fieldValue);

  // すべてのクォート文字を削除（シングル、ダブル、バッククォート）
  result = result.replace(/['"`]/g, '');

  // 先頭・末尾の空白削除
  result = result.trim();

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
 * CSVファイルをバイナリ読み込みしてエンコーディング検出
 * v2.1.0: ANSI/CP932優先モード対応
 * @param {File} file - ファイル
 * @returns {Promise<{text: string, encoding: string}>} ファイル内容とエンコーディング
 */
export async function readFileWithEncoding(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const codes = new Uint8Array(event.target.result);
        let text = null;
        let encoding = null;

        console.log('========================================');
        console.log('📄 CSV読み込み開始:', file.name);
        console.log('ファイルサイズ:', codes.length, 'bytes');
        console.log('📋 エンコーディングモード:', currentEncodingMode);

        // 1. BOM検出（UTF-8 with BOM）- 全モード共通で最優先
        if (codes.length >= 3 && codes[0] === 0xEF && codes[1] === 0xBB && codes[2] === 0xBF) {
          console.log('✅ UTF-8 BOM検出');
          const decoder = new TextDecoder('utf-8');
          text = decoder.decode(codes.slice(3));
          encoding = 'UTF-8 (BOM付き)';
        }
        // モードに応じた検出順序
        else if (currentEncodingMode === 'ansi-first') {
          // ANSI優先モード: Shift-JIS/CP932を先に試行
          text = tryDecodeAsShiftJIS(codes);
          if (text) {
            encoding = 'ANSI (Shift-JIS/CP932)';
            console.log('✅ ANSI/Shift-JISとして正常にデコード');
          } else {
            // UTF-8フォールバック
            text = tryDecodeAsUTF8(codes);
            if (text) {
              encoding = 'UTF-8 (BOMなし)';
              console.log('✅ UTF-8フォールバック成功');
            }
          }
        }
        else if (currentEncodingMode === 'utf8-first') {
          // UTF-8優先モード（従来の動作）
          text = tryDecodeAsUTF8(codes);
          if (text) {
            encoding = 'UTF-8 (BOMなし)';
            console.log('✅ UTF-8として正常にデコード');
          } else {
            // Shift-JISフォールバック
            text = tryDecodeAsShiftJIS(codes);
            if (text) {
              encoding = 'Shift-JIS (フォールバック)';
              console.log('✅ Shift-JISフォールバック成功');
            }
          }
        }
        else {
          // 自動検出モード: encoding-japaneseの検出結果を信頼
          const detectedEncoding = Encoding.detect(codes);
          console.log('🔍 encoding-japanese検出結果:', detectedEncoding);

          if (detectedEncoding === 'UTF8') {
            text = tryDecodeAsUTF8(codes);
            encoding = 'UTF-8 (自動検出)';
          } else {
            text = tryDecodeAsShiftJIS(codes);
            encoding = detectedEncoding ? `${detectedEncoding} (自動検出)` : 'Shift-JIS (推定)';
          }
        }

        // 最終フォールバック
        if (!text) {
          console.warn('⚠️ 全てのエンコーディング試行失敗、強制Shift-JIS変換');
          const unicodeArray = Encoding.convert(codes, {
            to: 'UNICODE',
            from: 'SJIS'
          });
          text = Encoding.codeToString(unicodeArray);
          encoding = 'Shift-JIS (強制変換)';
        }

        console.log('📊 使用エンコーディング:', encoding);
        console.log('変換後テキスト（最初の200文字）:', text.substring(0, 200));
        console.log('========================================');

        resolve({ text, encoding });
      } catch (error) {
        reject(new Error(`エンコーディング変換エラー: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('ファイル読み込みエラー'));
    };

    // バイナリとして読み込み
    reader.readAsArrayBuffer(file);
  });
}

/**
 * UTF-8としてデコードを試行
 * @param {Uint8Array} codes - バイト配列
 * @returns {string|null} デコード成功時はテキスト、失敗時はnull
 */
function tryDecodeAsUTF8(codes) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const text = decoder.decode(codes);

    // 文字化けチェック
    if (!hasGarbledText(text)) {
      return text;
    }
    console.log('⚠️ UTF-8でデコードしたが文字化けを検出');
    return null;
  } catch (error) {
    console.log('ℹ️ UTF-8デコード失敗（不正なバイトシーケンス）');
    return null;
  }
}

/**
 * Shift-JIS/CP932としてデコードを試行
 * @param {Uint8Array} codes - バイト配列
 * @returns {string|null} デコード成功時はテキスト、失敗時はnull
 */
function tryDecodeAsShiftJIS(codes) {
  try {
    const detectedEncoding = Encoding.detect(codes);
    const unicodeArray = Encoding.convert(codes, {
      to: 'UNICODE',
      from: detectedEncoding || 'SJIS'
    });

    const text = Encoding.codeToString(unicodeArray);

    // 文字化けチェック
    if (!hasGarbledText(text)) {
      return text;
    }
    console.log('⚠️ Shift-JISでデコードしたが文字化けを検出');
    return null;
  } catch (error) {
    console.log('ℹ️ Shift-JISデコード失敗:', error.message);
    return null;
  }
}

/**
 * 文字化けチェック（□や�の検出）
 * @param {string} text - チェック対象テキスト
 * @returns {boolean} 文字化けが含まれる場合true
 */
function hasGarbledText(text) {
  if (!text) return true;

  // 最初の1000文字をチェック（全文チェックはパフォーマンス上避ける）
  const sample = text.substring(0, 1000);

  // 文字化け判定パターン
  // □（U+25A1）: 豆腐文字
  // �（U+FFFD）: リプレースメント文字
  // 連続する?（エンコーディングエラー）
  const garbledPattern = /[\u25A1\uFFFD]|(\?{3,})/;

  return garbledPattern.test(sample);
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
  readFileWithEncoding,
  getCSVStatistics,
  setEncodingMode,
  getEncodingMode,
  loadEncodingMode,
};
