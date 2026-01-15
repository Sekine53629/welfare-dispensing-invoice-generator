/**
 * ============================================================================
 * Module: archive-manager.js
 * Description: アーカイブ管理モジュール (IndexedDB使用)
 *              重複チェック・処理履歴管理・5年間保管
 * Author: 関根 sekine53629
 * Version: 2.0.0
 * Created: 2025-02-15
 * ============================================================================
 */

import localforage from 'localforage';
import { formatDateYYYYMMDD, generateHash } from './utils.js';

// IndexedDBストア設定
const ARCHIVE_STORE = localforage.createInstance({
  name: 'tyouzai_archive',
  storeName: 'archives',
});

const PROCESSED_KEYS_STORE = localforage.createInstance({
  name: 'tyouzai_processed',
  storeName: 'processed_keys',
});

/**
 * 調剤年月日からフォルダ名を生成
 * @param {string} treatmentDate - 診療年月日 (例: "2025/02(10)")
 * @returns {string} フォルダ名 (例: "2025-02")
 */
export function generateFolderName(treatmentDate) {
  // "2025/02(10)" → "2025-02"
  const match = treatmentDate.match(/(\d{4})\/(\d{2})/);
  if (match) {
    const [, year, month] = match;
    return `${year}-${month}`;
  }
  // フォールバック: 現在の年月
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * ファイル名を生成
 * @param {string} folderName - フォルダ名 (例: "2025-02")
 * @param {number} batchNumber - 請求回数 (1 or 2)
 * @param {Date} createdDate - 作成日
 * @returns {string} ファイル名 (例: "tyouzai_2025-02_batch1_20250122.xlsx")
 */
export function generateFileName(folderName, batchNumber, createdDate = new Date()) {
  const dateStr = formatDateYYYYMMDD(createdDate);
  return `tyouzai_${folderName}_batch${batchNumber}_${dateStr}.xlsx`;
}

/**
 * 調剤年月日を解析
 * @param {Array<PatientData>} patients - 患者データ配列
 * @returns {{yearMonth: string, mostCommon: string}} 最も多い年月
 */
export function extractTreatmentYearMonth(patients) {
  if (patients.length === 0) {
    const now = new Date();
    return {
      yearMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      mostCommon: '',
    };
  }

  // 年月の出現回数をカウント
  const yearMonthCount = {};
  patients.forEach((patient) => {
    const folderName = generateFolderName(patient.treatmentDate);
    yearMonthCount[folderName] = (yearMonthCount[folderName] || 0) + 1;
  });

  // 最も多い年月を取得
  let mostCommon = '';
  let maxCount = 0;
  Object.entries(yearMonthCount).forEach(([yearMonth, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = yearMonth;
    }
  });

  return {
    yearMonth: mostCommon,
    mostCommon: mostCommon,
  };
}

/**
 * アーカイブデータを保存
 * @param {{
 *   folderName: string,
 *   fileName: string,
 *   batchNumber: number,
 *   patientCount: number,
 *   patients: Array<PatientData>,
 *   csvFileName: string,
 *   createdDate: Date
 * }} archiveData
 * @returns {Promise<string>} アーカイブID
 */
export async function saveArchive(archiveData) {
  const archiveId = await generateHash(
    `${archiveData.folderName}_${archiveData.fileName}_${Date.now()}`
  );

  const archive = {
    id: archiveId,
    folderName: archiveData.folderName,
    fileName: archiveData.fileName,
    batchNumber: archiveData.batchNumber,
    patientCount: archiveData.patientCount,
    csvFileName: archiveData.csvFileName,
    createdDate: archiveData.createdDate || new Date(),
    patients: archiveData.patients.map((p) => ({
      uniqueKey: p.getUniqueKey(),
      name: p.patientName,
      kana: p.patientKana,
      treatmentDate: p.treatmentDate,
      recipientNumber: p.recipientNumber,
    })),
  };

  await ARCHIVE_STORE.setItem(archiveId, archive);

  // 処理済みキーを保存（重複チェック用）
  const processedKeysId = `${archiveData.folderName}_batch${archiveData.batchNumber}`;
  const processedKeys = new Set();
  archive.patients.forEach((p) => {
    processedKeys.add(p.uniqueKey);
  });
  await PROCESSED_KEYS_STORE.setItem(processedKeysId, Array.from(processedKeys));

  return archiveId;
}

/**
 * 処理済みキーを取得（重複チェック用）
 * @param {string} folderName - フォルダ名
 * @param {number} batchNumber - 請求回数
 * @returns {Promise<Set<string>>} 処理済みキーのSet
 */
export async function getProcessedKeys(folderName, batchNumber) {
  const processedKeysId = `${folderName}_batch${batchNumber}`;
  const keys = await PROCESSED_KEYS_STORE.getItem(processedKeysId);
  return new Set(keys || []);
}

/**
 * 指定月の処理済みキーを取得
 * @param {string} yearMonth - 年月 (例: "2025-02")
 * @returns {Promise<Set<string>>} 処理済みキーのSet
 */
export async function getProcessedKeysForMonth(yearMonth) {
  // バッチ1の処理済みキーを取得
  const batch1Keys = await getProcessedKeys(yearMonth, 1);
  return batch1Keys;
}

/**
 * 全アーカイブを取得
 * @returns {Promise<Array<Object>>} アーカイブ配列
 */
export async function getAllArchives() {
  const archives = [];
  await ARCHIVE_STORE.iterate((value) => {
    archives.push(value);
  });

  // 作成日でソート（新しい順）
  archives.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

  return archives;
}

/**
 * 指定月のアーカイブを取得
 * @param {string} yearMonth - 年月 (例: "2025-02")
 * @returns {Promise<Array<Object>>} アーカイブ配列
 */
export async function getArchivesByMonth(yearMonth) {
  const allArchives = await getAllArchives();
  return allArchives.filter((archive) => archive.folderName === yearMonth);
}

/**
 * アーカイブを削除
 * @param {string} archiveId - アーカイブID
 * @returns {Promise<boolean>} 成功フラグ
 */
export async function deleteArchive(archiveId) {
  try {
    await ARCHIVE_STORE.removeItem(archiveId);
    return true;
  } catch (error) {
    console.error('アーカイブ削除エラー:', error);
    return false;
  }
}

/**
 * 全アーカイブを削除
 * @returns {Promise<boolean>} 成功フラグ
 */
export async function clearAllArchives() {
  try {
    await ARCHIVE_STORE.clear();
    await PROCESSED_KEYS_STORE.clear();
    return true;
  } catch (error) {
    console.error('アーカイブクリアエラー:', error);
    return false;
  }
}

/**
 * 5年以上前のアーカイブを削除
 * @returns {Promise<number>} 削除件数
 */
export async function cleanOldArchives() {
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  let deletedCount = 0;
  const allArchives = await getAllArchives();

  for (const archive of allArchives) {
    const createdDate = new Date(archive.createdDate);
    if (createdDate < fiveYearsAgo) {
      await deleteArchive(archive.id);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * アーカイブ統計情報を取得
 * @returns {Promise<{
 *   totalArchives: number,
 *   totalPatients: number,
 *   oldestDate: Date,
 *   newestDate: Date,
 *   byMonth: Object
 * }>}
 */
export async function getArchiveStatistics() {
  const allArchives = await getAllArchives();

  if (allArchives.length === 0) {
    return {
      totalArchives: 0,
      totalPatients: 0,
      oldestDate: null,
      newestDate: null,
      byMonth: {},
    };
  }

  const stats = {
    totalArchives: allArchives.length,
    totalPatients: allArchives.reduce((sum, a) => sum + a.patientCount, 0),
    oldestDate: new Date(Math.min(...allArchives.map((a) => new Date(a.createdDate)))),
    newestDate: new Date(Math.max(...allArchives.map((a) => new Date(a.createdDate)))),
    byMonth: {},
  };

  // 月別集計
  allArchives.forEach((archive) => {
    const month = archive.folderName;
    if (!stats.byMonth[month]) {
      stats.byMonth[month] = {
        count: 0,
        patients: 0,
        batches: [],
      };
    }
    stats.byMonth[month].count++;
    stats.byMonth[month].patients += archive.patientCount;
    stats.byMonth[month].batches.push(archive.batchNumber);
  });

  return stats;
}

/**
 * 次の請求回数を判定
 * @param {string} yearMonth - 年月 (例: "2025-02")
 * @returns {Promise<number>} 請求回数 (1 or 2)
 */
export async function getNextBatchNumber(yearMonth) {
  const archives = await getArchivesByMonth(yearMonth);

  // その月にバッチ1があるかチェック
  const hasBatch1 = archives.some((a) => a.batchNumber === 1);

  return hasBatch1 ? 2 : 1;
}

export default {
  generateFolderName,
  generateFileName,
  extractTreatmentYearMonth,
  saveArchive,
  getProcessedKeys,
  getProcessedKeysForMonth,
  getAllArchives,
  getArchivesByMonth,
  deleteArchive,
  clearAllArchives,
  cleanOldArchives,
  getArchiveStatistics,
  getNextBatchNumber,
};
