/**
 * ============================================================================
 * Module: app.js
 * Description: メインアプリケーションロジック
 * Author: 関根 sekine53629
 * Version: 2.0.0
 * Created: 2025-02-15
 * ============================================================================
 */

import { parseCSVFile } from './csv-parser.js';
import { filterPatients, getFilterStatistics } from './data-filter.js';
import { generateExcel, loadTemplateFile } from './excel-generator.js';
import {
  extractTreatmentYearMonth,
  generateFileName,
  generateFolderName,
  saveArchive,
  getProcessedKeysForMonth,
  getAllArchives,
  clearAllArchives,
} from './archive-manager.js';
import { loadConfig, saveConfig, clearConfig, validateConfig } from './config-manager.js';
import { downloadBlob, formatFileSize, formatErrorMessage } from './utils.js';

// グローバル状態
let currentCSVFile = null;
let currentRecords = [];
let currentFilteredPatients = null;
let currentTemplateBuffer = null;
let currentBatchNumber = 1;

// 組み込みテンプレートパス
const EMBEDDED_TEMPLATE_PATH = './template/tyouzai_excel_v2.xlsx';

/**
 * アプリケーション初期化
 */
async function initializeApp() {
  // 設定読み込み
  loadSettings();

  // 組み込みテンプレートを自動読み込み
  await loadEmbeddedTemplate();

  // イベントリスナー設定
  setupEventListeners();

  // アーカイブ一覧表示
  displayArchiveList();

  console.log('アプリケーション初期化完了');
}

/**
 * 組み込みテンプレートを読み込み
 */
async function loadEmbeddedTemplate() {
  try {
    console.log('組み込みテンプレートを読み込み中...');
    const response = await fetch(EMBEDDED_TEMPLATE_PATH);
    if (!response.ok) {
      throw new Error(`テンプレートの読み込みに失敗: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    currentTemplateBuffer = arrayBuffer;
    console.log('✅ 組み込みテンプレート読み込み完了');
  } catch (error) {
    console.error('テンプレート読み込みエラー:', error);
    showError('組み込みテンプレートの読み込みに失敗しました。ページをリロードしてください。');
  }
}

/**
 * 設定を読み込み
 */
function loadSettings() {
  const config = loadConfig();
  document.getElementById('pharmacy-name').value = config.pharmacyName || '';
  document.getElementById('medical-code').value = config.medicalCode || '';
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ファイル選択
  document.getElementById('file-select-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', handleFileSelect);

  // ドラッグ&ドロップ
  const dropZone = document.getElementById('drop-zone');
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleFileDrop);

  // 請求回数選択
  document.querySelectorAll('input[name="batch"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      currentBatchNumber = parseInt(e.target.value);
    });
  });

  // 設定保存
  document.getElementById('settings-form').addEventListener('submit', handleSettingsSave);
  document.getElementById('clear-settings-btn').addEventListener('click', handleSettingsClear);

  // Excelダウンロード（組み込みテンプレート使用のため、template-file イベントは削除）
  document.getElementById('download-excel-btn').addEventListener('click', handleExcelDownload);

  // リセット
  document.getElementById('reset-btn').addEventListener('click', handleReset);

  // アーカイブクリア
  document.getElementById('clear-archive-btn').addEventListener('click', handleArchiveClear);

  // モーダルクローズ
  document.querySelectorAll('.modal-close, .modal-close-btn').forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });

  // 検索
  document.getElementById('search-input').addEventListener('input', handleSearch);
}

/**
 * タブ切り替え
 */
function switchTab(tabName) {
  // タブボタンの切り替え
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // タブコンテンツの切り替え
  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });

  // アーカイブタブの場合は一覧を更新
  if (tabName === 'archive') {
    displayArchiveList();
  }
}

/**
 * ファイル選択処理
 */
async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    await processCSVFile(file);
  }
}

/**
 * ドラッグオーバー処理
 */
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

/**
 * ドラッグリーブ処理
 */
function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

/**
 * ファイルドロップ処理
 */
async function handleFileDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) {
    await processCSVFile(file);
  } else {
    showError('CSVファイルを選択してください');
  }
}

/**
 * CSVファイル処理
 */
async function processCSVFile(file) {
  try {
    currentCSVFile = file;

    // ファイル情報は新UIでは後で表示（data-viewで）

    // プログレスバー表示
    showProgress('CSVファイルを解析中...', 0);

    // CSV解析
    const records = await parseCSVFile(file);
    currentRecords = records;

    updateProgress('データをフィルタリング中...', 30);

    // 調剤年月日から年月を抽出
    const { yearMonth } = extractTreatmentYearMonth(
      records.map((r) => ({ treatmentDate: r.getField(56) }))
    );

    // 2回目請求の場合は処理済みキーを取得
    let processedKeys = new Set();
    if (currentBatchNumber === 2) {
      processedKeys = await getProcessedKeysForMonth(yearMonth);
    }

    updateProgress('患者データを抽出中...', 60);

    // フィルタリング
    const filterResult = filterPatients(records, processedKeys);
    currentFilteredPatients = filterResult;

    updateProgress('完了', 100);
    hideProgress();

    // ファイルステータス更新（新UIでは不要）

    // 統計情報表示
    displayStatistics(filterResult);

    // 患者リスト表示
    displayPatientList(filterResult.target);

    // 画面切り替え: upload-view → data-view
    document.getElementById('upload-view').style.display = 'none';
    document.getElementById('data-view').style.display = 'block';

    // ヘッダー情報更新
    document.getElementById('current-file-name').textContent = currentCSVFile.name;
    document.getElementById('current-batch-label').textContent =
      currentBatchNumber === 1 ? '1回目請求' : '2回目請求（重複除外）';

    // 出力情報更新
    document.getElementById('output-count').textContent = filterResult.target.length;
  } catch (error) {
    hideProgress();
    showError(`CSVファイルの処理中にエラーが発生しました: ${formatErrorMessage(error)}`);
    console.error('CSV処理エラー:', error);
  }
}

/**
 * 統計情報表示
 */
function displayStatistics(filterResult) {
  const stats = getFilterStatistics(filterResult);

  // コンパクトUIでは3つの統計のみ表示
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-target').textContent = stats.target;
  document.getElementById('stat-duplicate').textContent = stats.duplicate;
}

/**
 * 患者リスト表示
 */
function displayPatientList(patients) {
  const tbody = document.getElementById('patient-table-body');
  tbody.innerHTML = '';

  patients.forEach((patient, index) => {
    const row = document.createElement('tr');

    // 状態バッジ生成
    const statusBadges = [];
    if (patient.hasJiritsuShien) {
      statusBadges.push('<span class="badge badge-info">自立</span>');
    }
    if (patient.hasJusho) {
      statusBadges.push('<span class="badge badge-warning">重障</span>');
    }
    statusBadges.push('<span class="badge badge-success">請求</span>');

    row.innerHTML = `
      <td><input type="checkbox" class="patient-checkbox" data-patient-id="${index}" checked></td>
      <td>${index + 1}</td>
      <td>${patient.patientName}</td>
      <td>${patient.patientKana}</td>
      <td>${patient.birthDate}</td>
      <td>${patient.treatmentDate}</td>
      <td>${patient.medicalInstitution}</td>
      <td>${statusBadges.join(' ')}</td>
    `;

    // 他公費ありの場合は背景色変更
    if (patient.hasJiritsuShien || patient.hasJusho) {
      row.classList.add('has-other-kohi');
    }

    tbody.appendChild(row);
  });

  // チェックボックスイベント設定
  setupCheckboxListeners();
}

/**
 * チェックボックスイベント設定
 */
function setupCheckboxListeners() {
  // 全選択チェックボックス
  const selectAll = document.getElementById('select-all');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.patient-checkbox').forEach((checkbox) => {
        checkbox.checked = isChecked;
        updatePatientIncluded(checkbox.dataset.patientId, isChecked);
      });
      updateOutputCount();
    });
  }

  // 個別チェックボックス
  document.querySelectorAll('.patient-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const patientId = e.target.dataset.patientId;
      const isChecked = e.target.checked;
      updatePatientIncluded(patientId, isChecked);
      updateOutputCount();

      // 全選択チェックボックスの状態更新
      const allCheckboxes = document.querySelectorAll('.patient-checkbox');
      const allChecked = Array.from(allCheckboxes).every((cb) => cb.checked);
      if (selectAll) {
        selectAll.checked = allChecked;
      }
    });
  });
}

/**
 * 患者の含める/除外フラグ更新
 */
function updatePatientIncluded(patientId, isIncluded) {
  if (currentFilteredPatients && currentFilteredPatients.target[patientId]) {
    currentFilteredPatients.target[patientId].isIncluded = isIncluded;
  }
}

/**
 * 出力件数更新
 */
function updateOutputCount() {
  if (!currentFilteredPatients) return;

  const includedCount = currentFilteredPatients.target.filter((p) => p.isIncluded !== false).length;
  document.getElementById('output-count').textContent = includedCount;
}

/**
 * 検索処理
 */
function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll('#patient-table-body tr');

  rows.forEach((row) => {
    const name = row.cells[2].textContent.toLowerCase(); // チェックボックス追加で列がずれた
    const kana = row.cells[3].textContent.toLowerCase();
    const match = name.includes(searchTerm) || kana.includes(searchTerm);
    row.style.display = match ? '' : 'none';
  });
}

/**
 * 設定保存処理
 */
function handleSettingsSave(e) {
  e.preventDefault();

  const config = {
    pharmacyName: document.getElementById('pharmacy-name').value,
    medicalCode: document.getElementById('medical-code').value,
  };

  const validation = validateConfig(config);
  if (!validation.valid) {
    showError(validation.errors.join('\n'));
    return;
  }

  if (saveConfig(config)) {
    showSuccess('設定を保存しました');
  } else {
    showError('設定の保存に失敗しました');
  }
}

/**
 * 設定クリア処理
 */
function handleSettingsClear() {
  if (confirm('設定をクリアしますか？')) {
    clearConfig();
    document.getElementById('pharmacy-name').value = '';
    document.getElementById('medical-code').value = '';
    showSuccess('設定をクリアしました');
  }
}

/**
 * Excelダウンロード処理
 * 組み込みテンプレートを使用（handleTemplateSelect関数は削除）
 */
async function handleExcelDownload() {
  try {
    if (!currentFilteredPatients || currentFilteredPatients.target.length === 0) {
      showError('請求対象の患者データがありません');
      return;
    }

    // チェックONの患者のみ抽出
    const includedPatients = currentFilteredPatients.target.filter((p) => p.isIncluded !== false);

    if (includedPatients.length === 0) {
      showError('チェックされた患者がいません');
      return;
    }

    const config = loadConfig();
    const validation = validateConfig(config);
    if (!validation.valid) {
      showError('設定が不完全です。設定タブで薬局情報を入力してください。');
      return;
    }

    showProgress('Excelファイルを生成中...', 0);

    // Excel生成（チェックON患者のみ）
    const excelBlob = await generateExcel(includedPatients, config, currentTemplateBuffer);

    updateProgress('アーカイブに保存中...', 70);

    // アーカイブ保存
    const { yearMonth } = extractTreatmentYearMonth(includedPatients);
    const fileName = generateFileName(yearMonth, currentBatchNumber);

    await saveArchive({
      folderName: yearMonth,
      fileName: fileName,
      batchNumber: currentBatchNumber,
      patientCount: includedPatients.length, // チェックON患者数
      patients: includedPatients,
      csvFileName: currentCSVFile.name,
      createdDate: new Date(),
    });

    updateProgress('ダウンロード準備中...', 90);

    // ダウンロード
    downloadBlob(excelBlob, fileName);

    updateProgress('完了', 100);
    hideProgress();

    showSuccess(`Excelファイルをダウンロードしました（${includedPatients.length}件）`);
  } catch (error) {
    hideProgress();
    showError(`Excelファイルの生成中にエラーが発生しました: ${formatErrorMessage(error)}`);
    console.error('Excel生成エラー:', error);
  }
}

/**
 * リセット処理
 */
function handleReset() {
  currentCSVFile = null;
  currentRecords = [];
  currentFilteredPatients = null;
  document.getElementById('file-input').value = '';

  // 画面切り替え: data-view → upload-view
  document.getElementById('data-view').style.display = 'none';
  document.getElementById('upload-view').style.display = 'block';

  // テーブルクリア
  document.getElementById('patient-table-body').innerHTML = '';
}

/**
 * アーカイブクリア処理
 */
async function handleArchiveClear() {
  if (confirm('全ての処理履歴を削除しますか？この操作は取り消せません。')) {
    if (await clearAllArchives()) {
      showSuccess('全ての履歴を削除しました');
      displayArchiveList();
    } else {
      showError('履歴の削除に失敗しました');
    }
  }
}

/**
 * アーカイブ一覧表示
 */
async function displayArchiveList() {
  const archives = await getAllArchives();
  const listContainer = document.getElementById('archive-list');

  if (archives.length === 0) {
    listContainer.innerHTML = '<p class="empty-state">処理履歴がありません</p>';
    return;
  }

  listContainer.innerHTML = '';
  archives.forEach((archive) => {
    const item = document.createElement('div');
    item.className = 'archive-item';
    item.innerHTML = `
      <div class="archive-info">
        <h4>${archive.fileName}</h4>
        <div class="archive-meta">
          <span>📁 ${archive.folderName}</span>
          <span>📊 ${archive.patientCount}件</span>
          <span>🗓️ ${new Date(archive.createdDate).toLocaleString('ja-JP')}</span>
        </div>
      </div>
      <div class="archive-actions">
        <button class="btn btn-secondary btn-small" onclick="viewArchive('${archive.id}')">詳細</button>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

/**
 * プログレスバー表示
 */
function showProgress(text, percent) {
  document.getElementById('progress-container').style.display = 'block';
  document.getElementById('progress-text').textContent = text;
  document.getElementById('progress-fill').style.width = `${percent}%`;
}

/**
 * プログレスバー更新
 */
function updateProgress(text, percent) {
  document.getElementById('progress-text').textContent = text;
  document.getElementById('progress-fill').style.width = `${percent}%`;
}

/**
 * プログレスバー非表示
 */
function hideProgress() {
  setTimeout(() => {
    document.getElementById('progress-container').style.display = 'none';
  }, 500);
}

/**
 * エラーモーダル表示
 */
function showError(message) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-modal').style.display = 'flex';
}

/**
 * 成功モーダル表示
 */
function showSuccess(message) {
  document.getElementById('success-message').textContent = message;
  document.getElementById('success-modal').style.display = 'flex';
}

/**
 * モーダル閉じる
 */
function closeModal() {
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.style.display = 'none';
  });
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', initializeApp);

// グローバル関数のエクスポート（HTML onclick用）
window.viewArchive = async (archiveId) => {
  // アーカイブ詳細表示（今後実装）
  console.log('Archive ID:', archiveId);
};
