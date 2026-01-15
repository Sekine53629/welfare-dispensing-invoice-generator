/**
 * ============================================================================
 * Module: data-filter.js
 * Description: データフィルタリングモジュール
 *              旭川市・生活保護・公費判定・重複チェック
 * Author: 関根 sekine53629
 * Version: 2.0.0
 * Created: 2025-02-15
 * ============================================================================
 */

import { fixKanaAndTrim, removeLeading01 } from './utils.js';

/**
 * 患者データクラス
 */
export class PatientData {
  constructor(csvRecord) {
    this.record = csvRecord;
    this.rowNumber = csvRecord.rowNumber;

    // 基本情報
    this.patientName = fixKanaAndTrim(csvRecord.getPatientName());
    this.patientKana = fixKanaAndTrim(csvRecord.getPatientKana());
    this.birthDate = fixKanaAndTrim(csvRecord.getBirthDate());
    this.address = fixKanaAndTrim(csvRecord.getAddress());
    this.age = csvRecord.getField(13);
    this.gender = csvRecord.getField(14);

    // 保険者情報
    this.insurerNumber = fixKanaAndTrim(csvRecord.getInsurerNumber());

    // 医療機関情報
    this.medicalInstitution = fixKanaAndTrim(csvRecord.getMedicalInstitution());
    this.medicalCode = removeLeading01(fixKanaAndTrim(csvRecord.getMedicalCode()));

    // 診療情報
    this.treatmentDate = fixKanaAndTrim(csvRecord.getTreatmentDate());
    this.recipientNumber = fixKanaAndTrim(csvRecord.getRecipientNumber());

    // 公費種別番号（3つ）
    this.publicCodes = csvRecord.getPublicCodes().map(code => fixKanaAndTrim(code));

    // フラグ（後で設定）
    this.isAsahikawa = false;
    this.isWelfare = false; // 生活保護（公費12）
    this.hasInsurance = false; // 社保併用
    this.hasJiritsuShien = false; // 自立支援（21/15/16）
    this.hasJusho = false; // 重障（54）
    this.isDuplicate = false; // 重複フラグ
    this.isTarget = false; // 請求対象フラグ
  }

  /**
   * 一意のキーを生成（重複チェック用）
   * @returns {string}
   */
  getUniqueKey() {
    return `${this.recipientNumber}_${this.treatmentDate}_${this.patientName}`;
  }

  /**
   * 患者情報を文字列で取得
   * @returns {string}
   */
  toString() {
    return `${this.patientName} (${this.patientKana}) - ${this.address}`;
  }
}

/**
 * CSVレコードを患者データに変換
 * @param {Array<CSVRecord>} records - CSVレコード配列
 * @returns {Array<PatientData>}
 */
export function convertToPatientData(records) {
  return records.map(record => new PatientData(record));
}

/**
 * 旭川市フィルター（保険者番号優先）
 * @param {Array<PatientData>} patients - 患者データ配列
 * @returns {Array<PatientData>}
 */
export function filterAsahikawa(patients) {
  // 旭川市の保険者番号（複数）
  const asahikawaInsurerNumbers = ['12016010', '12012019'];

  return patients.filter(patient => {
    // 優先1: 保険者番号による判定
    if (asahikawaInsurerNumbers.includes(patient.insurerNumber)) {
      patient.isAsahikawa = true;
      return true;
    }

    // 優先2: 住所による判定（フォールバック）
    if (patient.address && patient.address.includes('旭川市')) {
      patient.isAsahikawa = true;
      return true;
    }

    patient.isAsahikawa = false;
    return false;
  });
}

/**
 * 生活保護フィルター（公費番号12）
 * @param {Array<PatientData>} patients - 患者データ配列
 * @returns {Array<PatientData>}
 */
export function filterWelfare(patients) {
  return patients.filter(patient => {
    patient.isWelfare = patient.publicCodes.includes('12');
    return patient.isWelfare;
  });
}

/**
 * 公費種別による判定フラグを設定
 * @param {Array<PatientData>} patients - 患者データ配列
 */
export function setPublicCodeFlags(patients) {
  patients.forEach(patient => {
    // 自立支援医療（21/15/16）
    patient.hasJiritsuShien = patient.publicCodes.some(code =>
      ['21', '15', '16'].includes(code)
    );

    // 重度障害（54）
    patient.hasJusho = patient.publicCodes.includes('54');

    // 社保併用チェック（公費が12以外にもある場合）
    const otherCodes = patient.publicCodes.filter(code => code !== '' && code !== '12');
    patient.hasInsurance = otherCodes.length > 0;
  });
}

/**
 * 重複チェック
 * @param {Array<PatientData>} patients - 患者データ配列
 * @param {Set<string>} processedKeys - 処理済みキーのSet
 * @returns {Array<PatientData>} 重複を除外した配列
 */
export function checkDuplicates(patients, processedKeys) {
  return patients.filter(patient => {
    const key = patient.getUniqueKey();
    patient.isDuplicate = processedKeys.has(key);
    return !patient.isDuplicate;
  });
}

/**
 * 請求対象フラグを設定
 * @param {Array<PatientData>} patients - 患者データ配列
 */
export function setTargetFlag(patients) {
  patients.forEach(patient => {
    patient.isTarget = patient.isAsahikawa &&
                      patient.isWelfare &&
                      !patient.isDuplicate;
  });
}

/**
 * フィルタリング統合処理
 * @param {Array<CSVRecord>} records - CSVレコード配列
 * @param {Set<string>} processedKeys - 処理済みキー（2回目請求の場合）
 * @returns {{
 *   all: Array<PatientData>,
 *   asahikawa: Array<PatientData>,
 *   welfare: Array<PatientData>,
 *   target: Array<PatientData>,
 *   duplicate: Array<PatientData>
 * }}
 */
export function filterPatients(records, processedKeys = new Set()) {
  // 1. CSVレコードを患者データに変換
  let patients = convertToPatientData(records);

  // 2. 旭川市フィルター
  const asahikawaPatients = filterAsahikawa([...patients]);

  // 3. 生活保護フィルター
  const welfarePatients = filterWelfare(asahikawaPatients);

  // 4. 公費フラグ設定
  setPublicCodeFlags(welfarePatients);

  // 5. 重複チェック
  const nonDuplicatePatients = checkDuplicates(welfarePatients, processedKeys);

  // 6. 請求対象フラグ設定
  setTargetFlag(nonDuplicatePatients);

  // 重複患者リスト
  const duplicatePatients = welfarePatients.filter(p => p.isDuplicate);

  return {
    all: patients,
    asahikawa: asahikawaPatients,
    welfare: welfarePatients,
    target: nonDuplicatePatients,
    duplicate: duplicatePatients,
  };
}

/**
 * フィルタリング統計情報
 * @param {{
 *   all: Array<PatientData>,
 *   asahikawa: Array<PatientData>,
 *   welfare: Array<PatientData>,
 *   target: Array<PatientData>,
 *   duplicate: Array<PatientData>
 * }} filterResult
 * @returns {Object}
 */
export function getFilterStatistics(filterResult) {
  return {
    total: filterResult.all.length,
    asahikawa: filterResult.asahikawa.length,
    welfare: filterResult.welfare.length,
    target: filterResult.target.length,
    duplicate: filterResult.duplicate.length,
    jiritsuShien: filterResult.target.filter(p => p.hasJiritsuShien).length,
    jusho: filterResult.target.filter(p => p.hasJusho).length,
    insurance: filterResult.target.filter(p => p.hasInsurance).length,
  };
}

export default {
  PatientData,
  convertToPatientData,
  filterAsahikawa,
  filterWelfare,
  setPublicCodeFlags,
  checkDuplicates,
  setTargetFlag,
  filterPatients,
  getFilterStatistics,
};
