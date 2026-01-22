/**
 * ============================================================================
 * 生活保護調剤券請求書作成ツール - スタンドアロン版
 * Version: 2.4.0
 * Description: インストール不要、ブラウザで完結する請求書作成ツール
 * ============================================================================
 */

// グローバル変数
let currentCSVFile = null;
let currentRecords = [];
let currentFilteredPatients = null;
let currentBatchNumber = 1;
const ASAHIKAWA_INSURER_NUMBERS = ['12016010', '12012019'];

// 前月分データ用変数（v2.3.0）
let previousMonthPatients = [];
let previousMonthFilteredData = null;

// エンコーディング設定（v2.3.12）
// 2026年1月以降、本番データがANSI（CP932/Shift-JIS）に変更されたため
// 'auto': 自動検出（従来動作）
// 'ansi-first': ANSI/Shift-JIS優先（2026年1月以降の本番データ向け）
// 'utf8-first': UTF-8優先
let currentEncodingMode = 'ansi-first';  // デフォルトをANSI優先に変更

// テンプレートファイルは template-data.js から読み込み（TEMPLATE_BASE64定数）

/**
 * ============================================================================
 * 初期化
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();

    // テンプレートデータ読み込み確認
    if (typeof TEMPLATE_BASE64 !== 'undefined') {
        console.log('✅ テンプレートデータ読み込み成功:', TEMPLATE_BASE64.substring(0, 50) + '...');
    } else {
        console.error('❌ テンプレートデータが読み込まれていません');
    }

    console.log('アプリケーション起動完了');
});

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

    // Excelダウンロード
    document.getElementById('download-excel-btn').addEventListener('click', handleExcelDownload);

    // リセット
    document.getElementById('reset-btn').addEventListener('click', handleReset);

    // 設定保存
    document.getElementById('settings-form').addEventListener('submit', handleSettingsSave);
    document.getElementById('clear-settings-btn').addEventListener('click', handleSettingsClear);

    // テンプレートファイル選択（廃止：組み込みテンプレートを使用）
    // document.getElementById('template-file-input').addEventListener('change', handleTemplateFileSelect);

    // アーカイブクリア
    document.getElementById('clear-archive-btn').addEventListener('click', handleArchiveClear);

    // モーダルクローズ
    document.querySelectorAll('.modal-close').forEach((btn) => {
        btn.addEventListener('click', closeAllModals);
    });

    // 全選択/全解除
    document.getElementById('select-all').addEventListener('change', handleSelectAll);

    // 前月分CSV追加（v2.3.0）
    document.getElementById('add-previous-month-btn').addEventListener('click', () => {
        document.getElementById('previous-csv-input').click();
    });
    document.getElementById('previous-csv-input').addEventListener('change', handlePreviousMonthFileSelect);

    // 前月分全選択/全解除
    document.getElementById('select-all-previous').addEventListener('change', handleSelectAllPrevious);
}

/**
 * タブ切り替え
 */
function switchTab(tabName) {
    // タブボタンの切り替え
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // タブコンテンツの切り替え
    document.querySelectorAll('.tab-content').forEach((content) => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    const targetTab = document.getElementById(`tab-${tabName}`);
    targetTab.classList.add('active');
    targetTab.style.display = 'block';

    // アーカイブタブの場合、履歴を表示
    if (tabName === 'archive') {
        displayArchiveList();
    }
}

/**
 * ============================================================================
 * ファイル処理
 * ============================================================================
 */

/**
 * ファイル選択処理
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processCSVFile(file);
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
function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
        processCSVFile(file);
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

        showProgress('CSVファイルを解析中...', 0);

        // CSV解析
        const records = await parseCSVFile(file);
        currentRecords = records;

        updateProgress('データをフィルタリング中...', 30);

        // データフィルタリング
        const filterResult = filterPatients(records, currentBatchNumber);
        currentFilteredPatients = filterResult;

        updateProgress('完了', 100);
        hideProgress();

        // 画面切り替え
        document.getElementById('upload-view').style.display = 'none';
        document.getElementById('data-view').style.display = 'block';

        // ヘッダー情報更新
        const encodingInfo = records._encoding ? ` (${records._encoding})` : '';
        document.getElementById('current-file-name').textContent = currentCSVFile.name + encodingInfo;
        document.getElementById('current-batch-label').textContent =
            currentBatchNumber === 1 ? '1回目請求' : '2回目請求（重複除外）';

        // 統計情報表示
        displayStatistics(filterResult);

        // 患者リスト表示
        displayPatientList(filterResult.target);

        // 出力件数更新
        updateOutputCount();

    } catch (error) {
        hideProgress();
        console.error('CSV処理エラー:', error);
        showError(`CSVファイルの処理中にエラーが発生しました:\n${error.message}\n\nブラウザのコンソールで詳細を確認してください（F12キー）`);
    }
}

/**
 * CSVパース（複数エンコーディング自動検出対応）
 * v2.3.11: UTF-8/Shift-JIS自動判定、文字化け検出機能
 * v2.3.12: ANSI/CP932優先モード追加（2026年1月以降の本番データ対応）
 */
async function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const codes = new Uint8Array(e.target.result);
                let text = null;
                let usedEncoding = null;

                console.log('========================================');
                console.log('📄 CSV読み込み開始:', file.name);
                console.log('ファイルサイズ:', codes.length, 'bytes');
                console.log('📋 エンコーディングモード:', currentEncodingMode);

                // 1. BOM検出（UTF-8 with BOM）- 全モード共通で最優先
                if (codes.length >= 3 && codes[0] === 0xEF && codes[1] === 0xBB && codes[2] === 0xBF) {
                    console.log('✅ UTF-8 BOM検出');
                    // BOMを除外してUTF-8デコード
                    const decoder = new TextDecoder('utf-8');
                    text = decoder.decode(codes.slice(3));
                    usedEncoding = 'UTF-8 (BOM付き)';
                }
                // モードに応じた検出順序
                else if (currentEncodingMode === 'ansi-first') {
                    // ANSI優先モード: 強制的にShift-JIS/CP932として処理
                    // （Encoding.detectの誤検出を防ぐためforceShiftJIS=true）
                    text = tryDecodeAsShiftJIS(codes, true);
                    if (text) {
                        usedEncoding = 'ANSI';
                        console.log('✅ ANSIとして正常にデコード');
                    } else {
                        // UTF-8フォールバック
                        text = tryDecodeAsUTF8(codes);
                        if (text) {
                            usedEncoding = 'UTF-8 (BOMなし)';
                            console.log('✅ UTF-8フォールバック成功');
                        }
                    }
                }
                else if (currentEncodingMode === 'utf8-first') {
                    // UTF-8優先モード（従来の動作）
                    text = tryDecodeAsUTF8(codes);
                    if (text) {
                        usedEncoding = 'UTF-8 (BOMなし)';
                        console.log('✅ UTF-8として正常にデコード');
                    } else {
                        // Shift-JISフォールバック
                        text = tryDecodeAsShiftJIS(codes);
                        if (text) {
                            usedEncoding = 'Shift-JIS (フォールバック)';
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
                        usedEncoding = 'UTF-8 (自動検出)';
                    } else {
                        text = tryDecodeAsShiftJIS(codes);
                        usedEncoding = detectedEncoding ? `${detectedEncoding} (自動検出)` : 'Shift-JIS (推定)';
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
                    usedEncoding = 'Shift-JIS (強制変換)';
                }

                // デコード結果の確認
                console.log('📊 使用エンコーディング:', usedEncoding);
                console.log('変換後テキスト（最初の200文字）:', text.substring(0, 200));
                console.log('========================================');

                // Papa Parseで解析（header: false で配列として取得）
                Papa.parse(text, {
                    header: false,
                    skipEmptyLines: true,
                    delimiter: ',',
                    quoteChar: "'",        // シングルクォートをクォート文字として認識
                    escapeChar: "'",       // エスケープもシングルクォート
                    complete: (results) => {
                        // エラーフィルタリング（重要でない警告を除外）
                        const criticalErrors = results.errors.filter(e =>
                            e.code !== 'TooManyFields' && e.code !== 'TooFewFields'
                        );
                        if (criticalErrors.length > 0) {
                            console.warn('CSV解析警告:', criticalErrors);
                        }

                        // 配列を列番号付きオブジェクトに変換（既存コードとの互換性のため）
                        const dataWithKeys = results.data.map(row => {
                            const obj = {};
                            row.forEach((value, index) => {
                                obj[String(index + 1)] = value;  // 1-indexed
                            });
                            return obj;
                        });

                        console.log('✅ CSV解析完了:', dataWithKeys.length, '件 (エンコーディング:', usedEncoding + ')');
                        console.log('最初の行サンプル:', dataWithKeys[0]);

                        // エンコーディング情報を結果に付加
                        dataWithKeys._encoding = usedEncoding;

                        resolve(dataWithKeys);
                    },
                    error: (error) => {
                        console.error('❌ CSV解析エラー:', error);
                        reject(error);
                    }
                });
            } catch (error) {
                console.error('❌ エンコーディング変換エラー:', error);
                reject(error);
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
 * Shift-JIS/CP932（ANSI）としてデコードを試行
 * @param {Uint8Array} codes - バイト配列
 * @param {boolean} forceShiftJIS - 強制的にShift-JISとして処理（検出結果を無視）
 * @returns {string|null} デコード成功時はテキスト、失敗時はnull
 */
function tryDecodeAsShiftJIS(codes, forceShiftJIS = false) {
    try {
        // ANSI優先モードまたは強制指定の場合、検出結果を無視してSJISとして処理
        let fromEncoding = 'SJIS';

        if (!forceShiftJIS) {
            const detectedEncoding = Encoding.detect(codes);
            console.log('🔍 encoding-japanese検出結果:', detectedEncoding);
            // 検出結果がSJIS系の場合のみ使用、それ以外はSJIS強制
            if (detectedEncoding === 'SJIS' || detectedEncoding === 'UTF8') {
                fromEncoding = detectedEncoding;
            }
        }

        console.log('📝 変換元エンコーディング:', fromEncoding);

        const unicodeArray = Encoding.convert(codes, {
            to: 'UNICODE',
            from: fromEncoding
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
 * エンコーディングモードを設定
 * @param {string} mode - 'auto' | 'ansi-first' | 'utf8-first'
 */
function setEncodingMode(mode) {
    currentEncodingMode = mode;
    console.log('📋 エンコーディングモード変更:', mode);

    // 設定を保存
    saveSettings();

    // UI更新
    updateEncodingModeDisplay();
}

/**
 * エンコーディングモード表示を更新
 */
function updateEncodingModeDisplay() {
    const radioButtons = document.querySelectorAll('input[name="encoding-mode"]');
    radioButtons.forEach(radio => {
        radio.checked = (radio.value === currentEncodingMode);
    });
}

/**
 * ============================================================================
 * データフィルタリング
 * ============================================================================
 */

/**
 * 患者データフィルタリング
 */
function filterPatients(records, batchNumber) {
    console.log('フィルタリング開始:', records.length, '件');

    // HR形式対応: ヘッダー行をスキップ
    // - 「項目解析結果」行（行8）
    // - 薬局情報ヘッダー行（1列目が非データ）
    const dataRecords = records.filter(row => {
        const firstCol = (row['1'] || '').toString().trim();

        // 項目解析結果行を除外
        if (firstCol === '項目解析結果') return false;

        // 空行を除外
        if (firstCol === '') return false;

        // データ行は元号形式で始まる（R1, H31, S64など）
        // または数字のみ（テスト用マスキングデータ）
        const isEraFormat = /^[RHS]\d+/.test(firstCol);  // R1, H31, S64
        const isNumericOnly = /^\d+$/.test(firstCol);     // 1, 2, 3 (テスト用)

        return isEraFormat || isNumericOnly;
    });
    console.log('データ行抽出:', dataRecords.length, '件（ヘッダー行除外後）');

    const patients = dataRecords.map(row => createPatientData(row));
    console.log('患者データ作成完了:', patients.length, '件');

    // 旭川市フィルタリング
    const asahikawa = patients.filter(patient => {
        const insurerNumber = patient.insurerNumber || '';
        const address = patient.address || '';

        // 保険者番号チェック（優先）
        if (ASAHIKAWA_INSURER_NUMBERS.includes(insurerNumber)) {
            patient.isAsahikawa = true;
            return true;
        }

        // 住所チェック（フォールバック）
        if (address.includes('旭川市')) {
            patient.isAsahikawa = true;
            return true;
        }

        patient.isAsahikawa = false;
        return false;
    });

    console.log('旭川市抽出:', asahikawa.length, '件');

    let duplicate = [];

    // 2回目請求の場合、重複フラグ設定（除外はしない）
    if (batchNumber === 2) {
        const processedKeys = getProcessedKeysForMonth();
        asahikawa.forEach(patient => {
            // 年月を診療年月日から抽出（例: "2025/02/03" → "2025/02"）
            const yearMonth = patient.treatmentDate ? patient.treatmentDate.substring(0, 7) : '';
            // 患者氏名をハッシュ化
            const patientNameHash = simpleHash(patient.patientName);
            // 年月 + 患者氏名ハッシュ + 医療機関コードで重複チェック
            const uniqueKey = `${yearMonth}_${patientNameHash}_${patient.medicalCode}`;
            if (processedKeys.has(uniqueKey)) {
                patient.isDuplicate = true;
                patient.isIncluded = false;  // 重複データは初期状態でチェックオフ
                duplicate.push(patient);
            } else {
                patient.isDuplicate = false;
                patient.isIncluded = true;   // 通常データは初期状態でチェックオン
            }
        });
    } else {
        // 1回目請求の場合は全てチェックオン
        asahikawa.forEach(patient => {
            patient.isDuplicate = false;
            patient.isIncluded = true;
        });
    }

    return {
        all: patients,
        asahikawa: asahikawa,
        target: asahikawa,  // 重複も含めた全データを表示
        duplicate: duplicate
    };
}

/**
 * 患者データ作成
 * CSVファイルの列構造に基づく（1行目: 列番号, 2行目以降: データ）
 */
function createPatientData(row) {
    // デバッグ: 最初の行のキーを表示
    if (!createPatientData.keysLogged) {
        console.log('CSVのカラム:', Object.keys(row));
        console.log('サンプルデータ:', row);
        createPatientData.keysLogged = true;
    }

    // CSV列番号でアクセス（Papa Parse headerモードでは1行目が列名になる）
    // 1行目が "1", "2", "3", ... "70" の場合、row["10"]でアクセス
    const patientName = fixKanaAndTrim(row['10'] || '');     // 10列目: 患者氏名
    const patientKana = fixKanaAndTrim(row['11'] || '');     // 11列目: 患者カナ氏名
    const birthDate = (row['12'] || '').replace(/\s/g, '');  // 12列目: 生年月日（全スペース削除）
    const medicalInstitution = fixKanaAndTrim(row['34'] || ''); // 34列目: 医療機関名
    const medicalCode = fixKanaAndTrim(row['65'] || '');     // 65列目: 医療機関コード
    const address = fixKanaAndTrim(row['38'] || '');         // 38列目: 住所
    const treatmentDate = (row['56'] || '').replace(/\s/g, ''); // 56列目: 診療年月日（全スペース削除）
    const recipientNumber = fixKanaAndTrim(row['58'] || ''); // 58列目: 受給者番号
    const insurerNumber = fixKanaAndTrim(row['23'] || '');   // 23列目: 保険者番号
    const insuranceType = row['17'] || '';                    // 17列目: 保険区分（公費単独 or その他）
    const publicExpenseNumber1 = row['22'] || '';             // 22列目: 第一公費種別番号
    const publicExpenseNumber2 = row['26'] || '';             // 26列目: 第二公費種別番号
    const publicExpenseNumber3 = row['30'] || '';             // 30列目: 第三公費種別番号

    const patient = {
        recipientNumber: recipientNumber,
        patientName: patientName,
        patientKana: patientKana,
        birthDate: birthDate,
        treatmentDate: treatmentDate,
        medicalInstitution: medicalInstitution,
        medicalCode: removeLeading01(medicalCode),  // 医療機関コード（先頭01削除）
        insuranceType: insuranceType,  // 保険区分
        publicExpenseNumber1: publicExpenseNumber1,
        publicExpenseNumber2: publicExpenseNumber2,
        publicExpenseNumber3: publicExpenseNumber3,
        publicCodes: [publicExpenseNumber1, publicExpenseNumber2, publicExpenseNumber3],  // 公費コード配列
        address: address,
        insurerNumber: insurerNumber,
        isAsahikawa: false,
        isDuplicate: false,
        isIncluded: true,
        otherKohiList: []
    };

    // 他公費検出
    detectOtherKohi(patient);

    return patient;
}

/**
 * 他公費検出
 */
function detectOtherKohi(patient) {
    const kohiMap = {
        '21': '精',
        '15': '更',
        '16': '育',
        '54': '難'
    };

    // 3つの公費番号をチェック
    [patient.publicExpenseNumber1, patient.publicExpenseNumber2, patient.publicExpenseNumber3].forEach(kohiNum => {
        if (kohiMap[kohiNum]) {
            patient.otherKohiList.push(kohiMap[kohiNum]);
        }
    });
}

/**
 * 全角カナ変換・トリム
 * 半角カナ→全角カナ変換（濁点・半濁点含む完全対応）
 */
function fixKanaAndTrim(str) {
    if (!str) return '';

    // 型安全性: 文字列に正規化
    str = String(str);

    // 半角カナ→全角カナ変換マップ
    const kanaMap = {
        'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
        'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
        'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
        'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
        'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
        'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
        'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
        'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
        'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
        'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
        'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
        'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
        'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
        'ｰ': 'ー', '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・'
    };

    // 正規表現で一括置換（パフォーマンス改善）
    // 2文字パターン（濁点・半濁点）を優先
    const pattern2 = /ｶﾞ|ｷﾞ|ｸﾞ|ｹﾞ|ｺﾞ|ｻﾞ|ｼﾞ|ｽﾞ|ｾﾞ|ｿﾞ|ﾀﾞ|ﾁﾞ|ﾂﾞ|ﾃﾞ|ﾄﾞ|ﾊﾞ|ﾋﾞ|ﾌﾞ|ﾍﾞ|ﾎﾞ|ﾊﾟ|ﾋﾟ|ﾌﾟ|ﾍﾟ|ﾎﾟ|ｳﾞ|ﾜﾞ|ｦﾞ/g;
    let result = str.replace(pattern2, match => kanaMap[match] || match);

    // 1文字パターン
    const pattern1 = /ｱ|ｲ|ｳ|ｴ|ｵ|ｶ|ｷ|ｸ|ｹ|ｺ|ｻ|ｼ|ｽ|ｾ|ｿ|ﾀ|ﾁ|ﾂ|ﾃ|ﾄ|ﾅ|ﾆ|ﾇ|ﾈ|ﾉ|ﾊ|ﾋ|ﾌ|ﾍ|ﾎ|ﾏ|ﾐ|ﾑ|ﾒ|ﾓ|ﾔ|ﾕ|ﾖ|ﾗ|ﾘ|ﾙ|ﾚ|ﾛ|ﾜ|ｦ|ﾝ|ｧ|ｨ|ｩ|ｪ|ｫ|ｯ|ｬ|ｭ|ｮ|ｰ|｡|｢|｣|､|･/g;
    result = result.replace(pattern1, match => kanaMap[match] || match);

    return result.trim();
}

/**
 * 医療機関コードの先頭「01」を削除
 * @param {string} code - 医療機関コード
 * @returns {string} 処理済みコード
 */
function removeLeading01(code) {
    if (!code) return '';
    const str = String(code).trim();
    if (str.startsWith('01')) {
        return str.substring(2);
    }
    return str;
}

/**
 * 簡易ハッシュ関数（患者氏名用）
 * @param {string} str - ハッシュ化する文字列
 * @returns {string} ハッシュ値（16進数文字列）
 */
function simpleHash(str) {
    if (!str) return '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(16);
}

/**
 * 処理済みキー取得（2回目請求用）
 */
function getProcessedKeysForMonth() {
    const archived = JSON.parse(localStorage.getItem('processed-keys') || '[]');
    return new Set(archived);
}

/**
 * 処理済みキー保存
 */
function saveProcessedKeys(patients) {
    const keys = patients.map(p => {
        // 年月を診療年月日から抽出（例: "2025/02/03" → "2025/02"）
        const yearMonth = p.treatmentDate ? p.treatmentDate.substring(0, 7) : '';
        // 患者氏名をハッシュ化
        const patientNameHash = simpleHash(p.patientName);
        // 年月 + 患者氏名ハッシュ + 医療機関コードで保存
        return `${yearMonth}_${patientNameHash}_${p.medicalCode}`;
    });
    const existing = JSON.parse(localStorage.getItem('processed-keys') || '[]');
    const merged = [...new Set([...existing, ...keys])];

    try {
        localStorage.setItem('processed-keys', JSON.stringify(merged));
    } catch (e) {
        // localStorage容量上限エラーのハンドリング
        if (e.name === 'QuotaExceededError') {
            console.warn('localStorage容量上限到達。古いデータを削除します。');
            // 最新1000件のみ保持
            const trimmed = merged.slice(-1000);
            try {
                localStorage.setItem('processed-keys', JSON.stringify(trimmed));
                console.log('古いデータを削除して保存しました:', trimmed.length, '件');
            } catch (e2) {
                console.error('localStorage保存失敗:', e2);
            }
        } else {
            console.error('localStorage保存エラー:', e);
        }
    }
}

/**
 * ============================================================================
 * 表示処理
 * ============================================================================
 */

/**
 * 統計情報表示
 */
function displayStatistics(filterResult) {
    const stats = {
        total: filterResult.all.length,
        target: filterResult.target.length,
        duplicate: filterResult.duplicate.length
    };

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

    // DocumentFragmentで一括DOM操作（パフォーマンス改善）
    const fragment = document.createDocumentFragment();

    patients.forEach((patient, index) => {
        const row = document.createElement('tr');

        // 他公費ありの場合、背景色変更
        if (patient.otherKohiList.length > 0) {
            row.classList.add('has-other-kohi');
        }

        // 重複の場合
        if (patient.isDuplicate) {
            row.classList.add('duplicate');
        }

        // バッジ生成
        let badges = '';
        patient.otherKohiList.forEach(kohi => {
            badges += `<span class="badge badge-warning">${kohi}</span>`;
        });
        if (!patient.isDuplicate) {
            badges += '<span class="badge badge-success">請求</span>';
        } else {
            badges += '<span class="badge badge-danger">重複</span>';
        }

        row.innerHTML = `
            <td><input type="checkbox" class="patient-checkbox" data-index="${index}" ${patient.isIncluded ? 'checked' : ''}></td>
            <td>${index + 1}</td>
            <td>${patient.recipientNumber}</td>
            <td>${patient.patientName}</td>
            <td>${patient.birthDate}</td>
            <td>${patient.treatmentDate}</td>
            <td>${patient.medicalInstitution}</td>
            <td>${badges}</td>
        `;

        fragment.appendChild(row);
    });

    // 1回のDOM操作で全行を追加
    tbody.appendChild(fragment);

    // チェックボックスイベント設定
    document.querySelectorAll('.patient-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // 前月分追加ボタン表示（v2.3.7: データ読み込み後に表示）
    const previousSection = document.getElementById('previous-month-upload-section');
    if (previousSection) {
        previousSection.style.display = 'block';
        console.log('✅ 前月分CSV追加ボタンを表示しました');
    }
}

/**
 * 全選択/全解除処理
 */
function handleSelectAll(e) {
    const checked = e.target.checked;
    document.querySelectorAll('.patient-checkbox').forEach(checkbox => {
        checkbox.checked = checked;
        const index = parseInt(checkbox.dataset.index);
        if (currentFilteredPatients && currentFilteredPatients.target[index]) {
            currentFilteredPatients.target[index].isIncluded = checked;
        }
    });
    updateOutputCount();
}

/**
 * チェックボックス変更処理
 */
function handleCheckboxChange(e) {
    const index = parseInt(e.target.dataset.index);
    const checked = e.target.checked;

    if (currentFilteredPatients && currentFilteredPatients.target[index]) {
        currentFilteredPatients.target[index].isIncluded = checked;
    }

    updateOutputCount();
}

/**
 * 出力件数更新
 */
function updateOutputCount() {
    if (!currentFilteredPatients) return;

    let includedCount = currentFilteredPatients.target.filter(p => p.isIncluded !== false).length;

    // 前月分データも含める（v2.3.0）
    if (previousMonthFilteredData && previousMonthFilteredData.asahikawa) {
        const previousIncludedCount = previousMonthFilteredData.asahikawa.filter(p => p.isIncluded === true).length;
        includedCount += previousIncludedCount;
    }

    document.getElementById('output-count').textContent = includedCount;
}

/**
 * ============================================================================
 * Excel生成
 * ============================================================================
 */

/**
 * Excelダウンロード処理
 */
async function handleExcelDownload() {
    try {
        if (!currentFilteredPatients || currentFilteredPatients.target.length === 0) {
            showError('請求対象の患者データがありません');
            return;
        }

        // チェックONの患者のみ抽出
        let includedPatients = currentFilteredPatients.target.filter(p => p.isIncluded !== false);

        // 前月分データ統合（v2.3.0）
        if (previousMonthFilteredData && previousMonthFilteredData.asahikawa) {
            const previousIncluded = previousMonthFilteredData.asahikawa.filter(p => p.isIncluded === true);
            includedPatients = includedPatients.concat(previousIncluded);
            console.log(`前月分データ統合: ${previousIncluded.length} 件追加、合計 ${includedPatients.length} 件`);
        }

        if (includedPatients.length === 0) {
            showError('請求対象の患者が選択されていません');
            return;
        }

        showProgress('Excelファイルを生成中...', 0);

        // テンプレート取得
        updateProgress('テンプレートを読み込み中...', 20);
        const templateBuffer = await loadTemplate();

        updateProgress('データを書き込み中...', 50);

        // Excel生成
        const excelBlob = await generateExcel(includedPatients, templateBuffer);

        updateProgress('完了', 100);
        hideProgress();

        // ファイル名生成
        const fileName = generateFileName(includedPatients, currentBatchNumber);

        // ダウンロード
        downloadBlob(excelBlob, fileName);

        // 処理済みキー保存（1回目のみ）
        if (currentBatchNumber === 1) {
            saveProcessedKeys(includedPatients);
        }

        // アーカイブ保存
        saveArchive(includedPatients, fileName);

        showSuccess(`Excelファイルを生成しました（${includedPatients.length}件）`);

    } catch (error) {
        hideProgress();
        console.error('Excel生成エラー:', error);
        console.error('エラースタック:', error.stack);
        showError(`Excelファイルの生成中にエラーが発生しました:\n${error.message}\n\nエラー詳細はコンソールを確認してください（F12キー）`);
    }
}

/**
 * テンプレート読み込み（ハードコーディングされたBase64から読み込み）
 */
async function loadTemplate() {
    if (typeof TEMPLATE_BASE64 === 'undefined') {
        throw new Error('テンプレートデータが見つかりません。template-data.jsが読み込まれていることを確認してください。');
    }

    console.log('組み込みテンプレートを読み込み中...');

    // Base64をArrayBufferに変換
    const binaryString = atob(TEMPLATE_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('テンプレート読み込み成功: クリーン版テンプレート');
    return bytes.buffer;
}

/**
 * Excel生成（テンプレート使用）
 */
async function generateExcel(patients, templateBuffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);

    const worksheet = workbook.worksheets[0];

    console.log('患者データ書き込み中...');

    // 薬局名と医療機関コードを設定から取得
    const pharmacyName = localStorage.getItem('pharmacy-name') || '';
    const medicalCode = localStorage.getItem('medical-code') || '';

    // 患者データをグループ化（同一患者の複数来局日を統合）
    const groupedPatients = groupPatientsByRecipient(patients);

    console.log(`患者データ書き込み開始: ${groupedPatients.length} 件`);

    // 患者データ書き込み（11行目から開始）
    groupedPatients.forEach((patientGroup, index) => {
        const rowNum = 11 + index;
        const row = worksheet.getRow(rowNum);

        // 代表データ（最初のレコード）
        const patient = patientGroup.records[0];

        // A列: 番号
        row.getCell(1).value = index + 1;

        // B列: 薬局名
        row.getCell(2).value = pharmacyName || '';

        // C列: コード（調剤薬局医療機関コード、int型8桁固定）
        const pharmacyCodeCell = row.getCell(3);
        pharmacyCodeCell.value = parseInt(formatMedicalCode(medicalCode), 10) || 0;
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

    console.log('患者データ書き込み完了');

    // v2.3.3: データ書き込み後にテーブル作成（既存ヘッダー行を利用）
    // テーブル範囲: A10:M(最終行)
    const tableHeaderRow = 10;
    const tableDataStartRow = 11;
    const tableLastRow = tableDataStartRow + groupedPatients.length - 1;

    console.log(`テーブル作成: 範囲=A${tableHeaderRow}:M${tableLastRow}, データ件数=${groupedPatients.length}`);

    // データが1件以上ある場合のみテーブル作成
    if (groupedPatients.length > 0) {
        try {
            // v2.3.6: rows配列を明示的に定義してデータ行を指定
            // ExcelJSはcolumnsだけでなくrowsも必要とする
            const tableRows = [];
            for (let i = 0; i < groupedPatients.length; i++) {
                const rowNum = tableDataStartRow + i;
                const row = worksheet.getRow(rowNum);
                // 各セルの値を配列として取得
                tableRows.push([
                    row.getCell(1).value,   // 番号
                    row.getCell(2).value,   // 調剤薬局名
                    row.getCell(3).value,   // コード（調剤薬局）
                    row.getCell(4).value,   // 診療医療機関名
                    row.getCell(5).value,   // コード（診療医療機関）
                    row.getCell(6).value,   // 受給者番号
                    row.getCell(7).value,   // 氏名
                    row.getCell(8).value,   // 氏名カナ
                    row.getCell(9).value,   // 生年月日
                    row.getCell(10).value,  // 調剤年月日
                    row.getCell(11).value,  // 社保
                    row.getCell(12).value,  // 自立支援
                    row.getCell(13).value,  // 難病
                ]);
            }

            worksheet.addTable({
                name: '調剤請求',
                ref: `A${tableHeaderRow}:M${tableLastRow}`,
                headerRow: true,
                totalsRow: false,
                style: {
                    theme: 'TableStyleMedium6',  // 青色のテーブルデザイン（中間）6
                    showRowStripes: true,
                },
                columns: [
                    { name: '番号', filterButton: true },
                    { name: '調剤薬局名', filterButton: true },
                    { name: 'コード', filterButton: true },
                    { name: '診療医療機関名', filterButton: true },
                    { name: 'コード', filterButton: true },
                    { name: '受給者番号', filterButton: true },
                    { name: '氏名', filterButton: true },
                    { name: '氏名カナ', filterButton: true },
                    { name: '生年月日', filterButton: true },
                    { name: '調剤年月日', filterButton: true },
                    { name: '社保', filterButton: true },
                    { name: '自立支援', filterButton: true },
                    { name: '難病', filterButton: true },
                ],
                rows: tableRows,  // データ行を明示的に指定
            });
            console.log(`✅ テーブル作成完了: 調剤請求 (rows定義付き、${tableRows.length}行)`);
        } catch (error) {
            console.error('❌ テーブル作成エラー:', error);
            console.error('エラー詳細:', error.message);
        }
    }

    console.log('✅ Excel生成完了（テーブル機能含む）');

    // v2.3.3: テーブルXML整合性確保のため、一度書き込み→再読み込み→再書き込み
    try {
        console.log('テーブルXML整合性チェック中...');
        const tempBuffer = await workbook.xlsx.writeBuffer();

        // 再読み込みして整合性を確保
        const tempWorkbook = new ExcelJS.Workbook();
        await tempWorkbook.xlsx.load(tempBuffer);

        // 最終バッファ生成
        const finalBuffer = await tempWorkbook.xlsx.writeBuffer();
        console.log('✅ テーブルXML整合性確認完了');

        return new Blob([finalBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    } catch (error) {
        console.error('❌ テーブルXML整合性チェックエラー:', error);
        // フォールバック: 整合性チェックなしで生成
        const buffer = await workbook.xlsx.writeBuffer();
        return new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    }
}

/**
 * ファイル名生成
 */
function generateFileName(patients, batchNumber) {
    const pharmacyName = localStorage.getItem('pharmacy-name') || '薬局';
    const treatmentDate = patients[0]?.treatmentDate || '';

    // 年月を取得（treatmentDateが空の場合は現在の年月を使用）
    let yearMonth = '';
    if (treatmentDate) {
        yearMonth = treatmentDate.substring(0, 7).replace('/', '').replace('-', '');
    } else {
        const now = new Date();
        yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const batchLabel = batchNumber === 1 ? '1回目' : '2回目';

    return `調剤券_旭川市_${yearMonth}_${pharmacyName}_${batchLabel}.xlsx`;
}

/**
 * ============================================================================
 * ユーティリティ
 * ============================================================================
 */

/**
 * Blobダウンロード
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * リセット処理
 */
function handleReset() {
    if (confirm('データをクリアして新規作成しますか？')) {
        document.getElementById('file-input').value = '';
        document.getElementById('data-view').style.display = 'none';
        document.getElementById('upload-view').style.display = 'block';
        document.getElementById('patient-table-body').innerHTML = '';

        currentCSVFile = null;
        currentRecords = [];
        currentFilteredPatients = null;

        // 前月分データクリア（v2.3.8）
        previousMonthPatients = [];
        previousMonthFilteredData = null;
        document.getElementById('previous-csv-input').value = '';
        document.getElementById('previous-month-upload-section').style.display = 'none';
        document.getElementById('previous-month-data-section').style.display = 'none';
        document.getElementById('previous-month-table-body').innerHTML = '';
        document.getElementById('previous-month-status').textContent = '';
        document.getElementById('add-previous-month-btn').textContent = '📁 前月分CSVファイルを選択';
    }
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
 * すべてのモーダルを閉じる
 */
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

/**
 * ============================================================================
 * 設定管理
 * ============================================================================
 */

/**
 * 設定読み込み
 */
function loadSettings() {
    const pharmacyName = localStorage.getItem('pharmacy-name') || '';
    const medicalCode = localStorage.getItem('medical-code') || '';

    document.getElementById('pharmacy-name').value = pharmacyName;
    document.getElementById('medical-code').value = medicalCode;

    // エンコーディングモード読み込み（v2.3.12）
    const savedEncodingMode = localStorage.getItem('encoding-mode');
    if (savedEncodingMode && ['auto', 'ansi-first', 'utf8-first'].includes(savedEncodingMode)) {
        currentEncodingMode = savedEncodingMode;
    }
    // UI初期化（DOMが準備できている場合）
    setTimeout(() => {
        updateEncodingModeDisplay();
    }, 0);

    // テンプレートファイルは組み込みのため、ステータス初期化不要
}

/**
 * 設定保存（エンコーディングモードなど）
 */
function saveSettings() {
    localStorage.setItem('encoding-mode', currentEncodingMode);
}

/**
 * 設定保存
 */
function handleSettingsSave(e) {
    e.preventDefault();

    const pharmacyName = document.getElementById('pharmacy-name').value.trim();
    const medicalCode = document.getElementById('medical-code').value.trim();

    if (!pharmacyName) {
        showError('薬局名は必須です');
        return;
    }

    if (medicalCode && !/^\d{10}$/.test(medicalCode)) {
        showError('医療機関コードは10桁の数字で入力してください');
        return;
    }

    localStorage.setItem('pharmacy-name', pharmacyName);
    localStorage.setItem('medical-code', medicalCode);

    showSuccess('設定を保存しました');
}

/**
 * 設定クリア
 */
function handleSettingsClear() {
    if (confirm('設定をクリアしますか？')) {
        localStorage.removeItem('pharmacy-name');
        localStorage.removeItem('medical-code');

        document.getElementById('pharmacy-name').value = '';
        document.getElementById('medical-code').value = '';

        // テンプレートファイルは組み込みのため、クリア不要

        showSuccess('設定をクリアしました');
    }
}

/**
 * テンプレートファイル選択（廃止：組み込みテンプレートを使用）
 */
// function handleTemplateFileSelect() は削除されました
// テンプレートはtemplate-data.jsから読み込まれます

/**
 * ============================================================================
 * アーカイブ管理
 * ============================================================================
 */

/**
 * アーカイブ保存
 */
function saveArchive(patients, fileName) {
    try {
        console.log('アーカイブ保存開始');
        console.log('currentCSVFile:', currentCSVFile);
        console.log('fileName:', fileName);

        const archives = JSON.parse(localStorage.getItem('archives') || '[]');

        // currentCSVFileが存在するか確認
        const csvFileName = (currentCSVFile && currentCSVFile.name) ? currentCSVFile.name : '-';
        console.log('csvFileName:', csvFileName);

        const archive = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            fileName: fileName,
            csvFileName: csvFileName,
            batchNumber: currentBatchNumber,
            patientCount: patients.length,
            pharmacyName: localStorage.getItem('pharmacy-name') || '薬局'
        };

        archives.unshift(archive);

        // 最新50件のみ保持
        if (archives.length > 50) {
            archives.splice(50);
        }

        localStorage.setItem('archives', JSON.stringify(archives));
        console.log('アーカイブ保存完了:', archive);

    } catch (error) {
        console.error('アーカイブ保存失敗:', error);
        console.error('エラースタック:', error.stack);
    }
}

/**
 * アーカイブ一覧表示
 */
function displayArchiveList() {
    const listContainer = document.getElementById('archive-list');
    const archives = JSON.parse(localStorage.getItem('archives') || '[]');

    if (archives.length === 0) {
        listContainer.innerHTML = '<div class="archive-empty">📦 処理履歴はありません</div>';
        return;
    }

    listContainer.innerHTML = archives.map(archive => {
        const date = new Date(archive.timestamp);
        const dateStr = date.toLocaleString('ja-JP');

        return `
            <div class="archive-item">
                <div class="archive-info">
                    <div class="archive-title">${archive.fileName}</div>
                    <div class="archive-meta">
                        📅 ${dateStr} |
                        📄 ${archive.csvFileName} |
                        ${archive.batchNumber === 1 ? '1回目' : '2回目'}請求 |
                        ${archive.patientCount}件
                    </div>
                </div>
                <div class="archive-actions">
                    <button class="btn btn-danger btn-small" onclick="deleteArchive('${archive.id}')">
                        削除
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * アーカイブ削除
 */
function deleteArchive(id) {
    if (confirm('この履歴を削除しますか？')) {
        const archives = JSON.parse(localStorage.getItem('archives') || '[]');
        const filtered = archives.filter(a => a.id !== id);
        localStorage.setItem('archives', JSON.stringify(filtered));
        displayArchiveList();
        showSuccess('履歴を削除しました');
    }
}

/**
 * アーカイブ全クリア
 */
function handleArchiveClear() {
    if (confirm('すべての処理履歴をクリアしますか？この操作は取り消せません。')) {
        localStorage.removeItem('archives');
        localStorage.removeItem('processed-keys');
        displayArchiveList();
        showSuccess('すべての処理履歴をクリアしました');
    }
}

/**
 * ============================================================================
 * Excel生成ヘルパー関数（webapp版と同じ実装）
 * ============================================================================
 */

/**
 * 医療機関コードをフォーマット（下8桁を文字列として取得）
 * @param {string} code - 医療機関コード
 * @returns {string} フォーマット済みコード
 */
function formatMedicalCode(code) {
    if (!code) return '';

    // シングルクォートと前後の空白を削除
    let cleaned = removeAllQuotes(String(code).trim());

    // 先頭の01を全て削除（複数ある場合も対応）
    while (cleaned.startsWith('01') && cleaned.length > 2) {
        cleaned = cleaned.substring(2);
    }

    // 下8桁を取得
    if (cleaned.length > 8) {
        cleaned = cleaned.slice(-8);
    }

    // 医療機関種別コード検証（先頭1文字が1:病院/3:歯科/4:薬局）
    const firstChar = cleaned.charAt(0);
    if (cleaned.length >= 8 && !['1', '3', '4'].includes(firstChar)) {
        console.warn(`医療機関コードの形式が不正です: ${code} → ${cleaned} (先頭: ${firstChar})`);
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
 * @param {Array} patients - 患者データ配列
 * @returns {Array} グループ化されたデータ（月ごとに分割）
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

/**
 * ============================================================================
 * 前月分データ処理機能（v2.3.0）
 * ============================================================================
 */

/**
 * 前月分CSVファイル選択処理
 */
function handlePreviousMonthFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processPreviousMonthCSV(file);
    }
}

/**
 * 前月分CSVファイル処理
 */
async function processPreviousMonthCSV(file) {
    try {
        console.log('前月分CSVファイル処理開始:', file.name);

        // ステータス表示
        document.getElementById('previous-month-status').textContent = '📊 読み込み中...';

        // CSV解析（当月分と同じ処理）
        const records = await parseCSVFile(file);
        console.log(`前月分CSVから ${records.length} 件のレコードを読み込みました`);

        // 前月分データをフィルタ・重複チェック
        const filteredData = filterPreviousMonthPatients(records);

        // グローバル変数に保存
        previousMonthPatients = records;
        previousMonthFilteredData = filteredData;

        // ステータス更新
        document.getElementById('previous-month-status').textContent =
            `✅ 読み込み完了: ${filteredData.asahikawa.length}件の旭川市データを抽出しました`;

        // ボタンテキスト変更（追加済み表示）
        document.getElementById('add-previous-month-btn').textContent = '✅ 前月分CSV追加済み（再選択可能）';

        // UI更新
        displayPreviousMonthData(filteredData);
        updateOutputCount();

        console.log('前月分データ処理完了');
    } catch (error) {
        document.getElementById('previous-month-status').textContent =
            `❌ エラー: ${error.message}`;
        showError(`前月分CSVの処理中にエラーが発生しました:\n${error.message}`);
        console.error('前月分CSV処理エラー:', error);
    }
}

/**
 * 前月分患者データフィルタ（月遅れ請求用）
 * @param {Array} records - CSVレコード配列（当月分と同じ形式）
 * @returns {Object} フィルタ済みデータ
 *
 * 月遅れデータは重複チェックの対象外。
 * 調剤日が前月のデータは、同一患者・同一医療機関でも別請求として扱う。
 */
function filterPreviousMonthPatients(records) {
    console.log('前月分データフィルタリング開始:', records.length, '件');

    // HR形式対応: ヘッダー行をスキップ（当月分と同じ処理）
    const dataRecords = records.filter(row => {
        const firstCol = (row['1'] || '').toString().trim();

        // 項目解析結果行を除外
        if (firstCol === '項目解析結果') return false;

        // 空行を除外
        if (firstCol === '') return false;

        // データ行は元号形式で始まる（R1, H31, S64など）
        // または数字のみ（テスト用マスキングデータ）
        const isEraFormat = /^[RHS]\d+/.test(firstCol);  // R1, H31, S64
        const isNumericOnly = /^\d+$/.test(firstCol);     // 1, 2, 3 (テスト用)

        return isEraFormat || isNumericOnly;
    });
    console.log('前月分データ行抽出:', dataRecords.length, '件（ヘッダー行除外後）');

    // 患者データ作成
    const patients = dataRecords.map(row => createPatientData(row));
    console.log('前月分患者データ作成完了:', patients.length, '件');

    // 旭川市フィルタのみ実施（重複チェックなし）
    const asahikawa = patients.filter(patient => {
        const insurerNumber = patient.insurerNumber || '';
        const address = patient.address || '';

        // 保険者番号チェック（優先）
        if (ASAHIKAWA_INSURER_NUMBERS.includes(insurerNumber)) {
            patient.isAsahikawa = true;
            patient.isIncluded = false;  // デフォルトオフ（99%は請求済みのため）
            patient.isPreviousMonth = true;  // 前月分フラグ
            return true;
        }

        // 住所チェック（フォールバック）
        if (address.includes('旭川市')) {
            patient.isAsahikawa = true;
            patient.isIncluded = false;  // デフォルトオフ
            patient.isPreviousMonth = true;
            return true;
        }

        return false;
    });

    console.log(`前月分（月遅れ請求）: 旭川市抽出 ${asahikawa.length} 件（全て請求対象）`);

    return {
        all: patients,
        asahikawa: asahikawa,
        duplicate: [],  // 月遅れは重複チェックしない
        unbilled: asahikawa  // 全て未請求扱い
    };
}

/**
 * 前月分データ表示（月遅れ請求用）
 */
function displayPreviousMonthData(filteredData) {
    // 前月分データセクションを表示
    document.getElementById('previous-month-data-section').style.display = 'block';

    // 統計情報更新（デフォルトオフのため、請求対象は0）
    document.getElementById('stat-previous-total').textContent = filteredData.all.length;
    document.getElementById('stat-previous-asahikawa').textContent = filteredData.asahikawa.length;
    document.getElementById('stat-previous-duplicate').textContent = '0';  // 重複チェックなし
    // 初期状態では全てチェックオフなので0件
    const initialIncluded = filteredData.asahikawa.filter(p => p.isIncluded).length;
    document.getElementById('stat-previous-unbilled').textContent = initialIncluded;

    // テーブル表示
    displayPreviousMonthTable(filteredData.asahikawa);
}

/**
 * 前月分患者リストテーブル表示
 */
function displayPreviousMonthTable(patients) {
    const tbody = document.getElementById('previous-month-table-body');
    tbody.innerHTML = '';

    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #999;">前月分データがありません</td></tr>';
        return;
    }

    // DocumentFragment使用で高速化
    const fragment = document.createDocumentFragment();

    patients.forEach((patient, index) => {
        const row = document.createElement('tr');

        // チェックボックス
        const checkboxCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = patient.isIncluded;
        checkbox.dataset.previousIndex = index;
        checkbox.addEventListener('change', (e) => {
            patient.isIncluded = e.target.checked;
            updateOutputCount();
        });
        checkboxCell.appendChild(checkbox);
        row.appendChild(checkboxCell);

        // No.
        const noCell = document.createElement('td');
        noCell.textContent = index + 1;
        row.appendChild(noCell);

        // 受給者番号
        const recipientCell = document.createElement('td');
        recipientCell.textContent = patient.recipientNumber || '-';
        row.appendChild(recipientCell);

        // 氏名
        const nameCell = document.createElement('td');
        nameCell.textContent = patient.patientName || '-';
        row.appendChild(nameCell);

        // 生年月日
        const birthCell = document.createElement('td');
        birthCell.textContent = patient.birthDate || '-';
        row.appendChild(birthCell);

        // 調剤年月日
        const dateCell = document.createElement('td');
        dateCell.textContent = patient.treatmentDate || '-';
        row.appendChild(dateCell);

        // 医療機関
        const clinicCell = document.createElement('td');
        clinicCell.textContent = patient.medicalInstitution || '-';
        clinicCell.style.fontSize = '0.75rem';
        row.appendChild(clinicCell);

        // フラグ（月遅れは全て「月遅れ請求」バッジ）
        const flagCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge badge-warning';
        badge.textContent = '月遅れ請求';
        badge.style.backgroundColor = '#c29958';
        badge.style.color = 'white';
        flagCell.appendChild(badge);
        row.appendChild(flagCell);

        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

/**
 * 前月分全選択/全解除
 */
function handleSelectAllPrevious(e) {
    const isChecked = e.target.checked;
    if (previousMonthFilteredData && previousMonthFilteredData.asahikawa) {
        previousMonthFilteredData.asahikawa.forEach(patient => {
            patient.isIncluded = isChecked;
        });

        // チェックボックスUI更新
        document.querySelectorAll('[data-previous-index]').forEach(checkbox => {
            checkbox.checked = isChecked;
        });

        updateOutputCount();
    }
}

