/**
 * ============================================================================
 * Module: config-manager.js
 * Description: 設定管理モジュール (LocalStorage使用)
 * Author: 関根 sekine53629
 * Version: 2.0.0
 * Created: 2025-02-15
 * ============================================================================
 */

const CONFIG_KEY = 'tyouzai_config';

/**
 * 設定データの構造
 * @typedef {Object} Config
 * @property {string} pharmacyName - 薬局名
 * @property {string} medicalCode - 医療機関コード
 * @property {string} templatePath - テンプレートファイルパス
 * @property {Date} lastUpdated - 最終更新日時
 */

/**
 * デフォルト設定
 * @type {Config}
 */
const DEFAULT_CONFIG = {
  pharmacyName: '',
  medicalCode: '',
  templatePath: '',
  lastUpdated: new Date().toISOString(),
};

/**
 * 設定を読み込む
 * @returns {Config} 設定オブジェクト
 */
export function loadConfig() {
  try {
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
    }
  } catch (error) {
    console.error('設定の読み込みエラー:', error);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 設定を保存
 * @param {Config} config - 設定オブジェクト
 * @returns {boolean} 成功フラグ
 */
export function saveConfig(config) {
  try {
    config.lastUpdated = new Date().toISOString();
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('設定の保存エラー:', error);
    return false;
  }
}

/**
 * 設定をクリア
 * @returns {boolean} 成功フラグ
 */
export function clearConfig() {
  try {
    localStorage.removeItem(CONFIG_KEY);
    return true;
  } catch (error) {
    console.error('設定のクリアエラー:', error);
    return false;
  }
}

/**
 * 設定の検証
 * @param {Config} config - 設定オブジェクト
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateConfig(config) {
  const errors = [];

  if (!config.pharmacyName || config.pharmacyName.trim() === '') {
    errors.push('薬局名が入力されていません');
  }

  if (!config.medicalCode || config.medicalCode.trim() === '') {
    errors.push('医療機関コードが入力されていません');
  } else if (!/^\d{10}$/.test(config.medicalCode)) {
    errors.push('医療機関コードは10桁の数字で入力してください');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  loadConfig,
  saveConfig,
  clearConfig,
  validateConfig,
};
