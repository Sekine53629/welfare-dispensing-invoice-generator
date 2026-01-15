/**
 * ============================================================================
 * Module: utils.js
 * Description: ユーティリティ関数
 * Author: 関根 sekine53629
 * Version: 2.0.0
 * Created: 2025-02-15
 * ============================================================================
 */

/**
 * カナ文字・記号の変換処理
 * - すべてのクォート削除（シングル、ダブル、バッククォート）
 * - 括弧の置換 ( → / , ) → 削除
 * - 半角カナ → 全角カナ変換
 * @param {string} inputStr - 入力文字列
 * @returns {string} 変換済み文字列
 */
export function fixKana(inputStr) {
  if (!inputStr) return '';

  let result = String(inputStr);

  // すべてのクォート文字を削除（シングル、ダブル、バッククォート）
  result = result.replace(/['"`]/g, '');

  // 括弧処理
  result = result.replace(/\(/g, '/');
  result = result.replace(/\)/g, '');

  // 半角カナ → 全角カナ変換
  result = convertHankakuToZenkaku(result);

  return result;
}

/**
 * 空白文字の削除（先頭・末尾・連続）
 * @param {string} inputStr - 入力文字列
 * @returns {string} トリム済み文字列
 */
export function trimSpaces(inputStr) {
  if (!inputStr) return '';

  let result = String(inputStr);

  // 先頭・末尾の空白削除
  result = result.trim();

  // 連続する空白を1つに
  result = result.replace(/\s+/g, ' ');

  return result;
}

/**
 * fixKanaとtrimSpacesの組み合わせ
 * @param {string} inputStr - 入力文字列
 * @returns {string} 変換・トリム済み文字列
 */
export function fixKanaAndTrim(inputStr) {
  if (!inputStr) return '';
  return trimSpaces(fixKana(inputStr));
}

/**
 * 医療機関コードの先頭「01」を削除
 * @param {string} code - 医療機関コード
 * @returns {string} 処理済みコード
 */
export function removeLeading01(code) {
  if (code && code.startsWith('01')) {
    return code.substring(2);
  }
  return code;
}

/**
 * 半角カナ → 全角カナ変換
 * @param {string} str - 入力文字列
 * @returns {string} 変換済み文字列
 */
export function convertHankakuToZenkaku(str) {
  // 半角カナ → 全角カナのマッピング
  const kanaMap = {
    ガ: 'ガ',
    ギ: 'ギ',
    グ: 'グ',
    ゲ: 'ゲ',
    ゴ: 'ゴ',
    ザ: 'ザ',
    ジ: 'ジ',
    ズ: 'ズ',
    ゼ: 'ゼ',
    ゾ: 'ゾ',
    ダ: 'ダ',
    ヂ: 'ヂ',
    ヅ: 'ヅ',
    デ: 'デ',
    ド: 'ド',
    バ: 'バ',
    ビ: 'ビ',
    ブ: 'ブ',
    ベ: 'ベ',
    ボ: 'ボ',
    パ: 'パ',
    ピ: 'ピ',
    プ: 'プ',
    ペ: 'ペ',
    ポ: 'ポ',
    ヴ: 'ヴ',
    ヷ: 'ヷ',
    ヺ: 'ヺ',
    ア: 'ア',
    イ: 'イ',
    ウ: 'ウ',
    エ: 'エ',
    オ: 'オ',
    カ: 'カ',
    キ: 'キ',
    ク: 'ク',
    ケ: 'ケ',
    コ: 'コ',
    サ: 'サ',
    シ: 'シ',
    ス: 'ス',
    セ: 'セ',
    ソ: 'ソ',
    タ: 'タ',
    チ: 'チ',
    ツ: 'ツ',
    テ: 'テ',
    ト: 'ト',
    ナ: 'ナ',
    ニ: 'ニ',
    ヌ: 'ヌ',
    ネ: 'ネ',
    ノ: 'ノ',
    ハ: 'ハ',
    ヒ: 'ヒ',
    フ: 'フ',
    ヘ: 'ヘ',
    ホ: 'ホ',
    マ: 'マ',
    ミ: 'ミ',
    ム: 'ム',
    メ: 'メ',
    モ: 'モ',
    ヤ: 'ヤ',
    ユ: 'ユ',
    ヨ: 'ヨ',
    ラ: 'ラ',
    リ: 'リ',
    ル: 'ル',
    レ: 'レ',
    ロ: 'ロ',
    ワ: 'ワ',
    ヲ: 'ヲ',
    ン: 'ン',
    ァ: 'ァ',
    ィ: 'ィ',
    ゥ: 'ゥ',
    ェ: 'ェ',
    ォ: 'ォ',
    ッ: 'ッ',
    ャ: 'ャ',
    ュ: 'ュ',
    ョ: 'ョ',
    '。': '。',
    '、': '、',
    '・': '・',
    '゛': '゛',
    '゜': '゜',
    '「': '「',
    '」': '」',
    'ー': 'ー',
  };

  let result = str;
  for (const [hankaku, zenkaku] of Object.entries(kanaMap)) {
    result = result.replace(new RegExp(hankaku, 'g'), zenkaku);
  }

  return result;
}

/**
 * 日付を YYYYMMDD 形式にフォーマット
 * @param {Date} date - 日付オブジェクト
 * @returns {string} YYYYMMDD形式の文字列
 */
export function formatDateYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 日付を YYYY/MM/DD 形式にフォーマット
 * @param {Date} date - 日付オブジェクト
 * @returns {string} YYYY/MM/DD形式の文字列
 */
export function formatDateYYYYMMDDSlash(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * ファイル名から無効な文字を削除
 * @param {string} fileName - ファイル名
 * @returns {string} サニタイズ済みファイル名
 */
export function sanitizeFileName(fileName) {
  // Windows/Macで無効な文字を削除
  return fileName.replace(/[<>:"/\\|?*]/g, '_');
}

/**
 * Blobをダウンロード
 * @param {Blob} blob - Blobオブジェクト
 * @param {string} fileName - ファイル名
 */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 * @param {number} bytes - バイト数
 * @returns {string} フォーマット済み文字列 (例: "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * SHA-256ハッシュ値を生成
 * @param {string} text - ハッシュ化するテキスト
 * @returns {Promise<string>} ハッシュ値（16進数文字列）
 */
export async function generateHash(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * ディープクローン（オブジェクトの深いコピー）
 * @param {Object} obj - コピー元オブジェクト
 * @returns {Object} コピー済みオブジェクト
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 配列を指定サイズのチャンクに分割
 * @param {Array} array - 配列
 * @param {number} chunkSize - チャンクサイズ
 * @returns {Array<Array>} チャンク配列
 */
export function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * sleep関数（指定ミリ秒待機）
 * @param {number} ms - ミリ秒
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * エラーメッセージを整形
 * @param {Error} error - エラーオブジェクト
 * @returns {string} 整形済みメッセージ
 */
export function formatErrorMessage(error) {
  if (error.stack) {
    console.error(error.stack);
  }
  return error.message || 'エラーが発生しました';
}

export default {
  fixKana,
  trimSpaces,
  fixKanaAndTrim,
  removeLeading01,
  convertHankakuToZenkaku,
  formatDateYYYYMMDD,
  formatDateYYYYMMDDSlash,
  sanitizeFileName,
  downloadBlob,
  formatFileSize,
  generateHash,
  deepClone,
  chunkArray,
  sleep,
  formatErrorMessage,
};
