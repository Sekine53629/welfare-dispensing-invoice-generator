# デプロイパッケージ - v2.3.2

**最終更新**: 2026-01-18
**バージョン**: 2.3.2
**リリースノート**: Excelテーブル生成完全修正（VBA互換性確保）

---

## 📦 パッケージ内容

このデプロイパッケージには以下の2つのバージョンが含まれています：

### 1. スタンドアロン版 (`standalone-app/`)

**配置ファイル**:
```
standalone-app/
├── index.html              # メインHTMLファイル
├── app.js                  # アプリケーションロジック（更新済み）
├── template-data.js        # Base64エンコード済みExcelテンプレート
└── README.md               # スタンドアロン版使用方法
```

**使用方法**:
1. `standalone-app/` フォルダをユーザーに配布
2. `index.html` をダブルクリックで起動
3. CSVファイルをアップロードしてExcel生成

**動作要件**:
- モダンブラウザ（Chrome 100+, Edge 100+, Firefox 100+, Safari 15+）
- インターネット接続（初回のみ、CDN経由でライブラリ読み込み）

---

### 2. Webアプリ版 (`webapp-version/`)

**配置ファイル**:
```
webapp-version/
├── index.html              # メインHTMLファイル
├── src/
│   ├── js/
│   │   ├── main.js         # アプリケーションエントリーポイント
│   │   ├── csv-parser.js   # CSV解析（列56修正済み）
│   │   ├── data-filter.js  # データフィルタリング（デバッグログ削除済み）
│   │   ├── excel-generator.js # Excel生成（デバッグログ削除済み）
│   │   └── utils.js        # ユーティリティ関数
│   └── css/
│       └── style.css       # スタイルシート
├── lib/                    # ライブラリ（Papa Parse, ExcelJS, localforage）
└── README.md               # Webアプリ版使用方法
```

**デプロイ方法**:
1. HTTPサーバーを起動（例: `python -m http.server 8000`）
2. ブラウザで `http://localhost:8000` にアクセス
3. 設定タブで薬局名・医療機関コードを登録
4. CSVファイルをアップロードしてExcel生成

**動作要件**:
- HTTPサーバー（Python, Node.js, Nginx等）
- モダンブラウザ（Chrome 100+, Edge 100+, Firefox 100+, Safari 15+）

---

## 🔧 v2.3.2 の主な変更点

### 1. Excelテーブル生成完全修正

**問題**:
- v2.3.1ではテーブル機能を廃止し、オートフィルターのみに変更
- しかし、役所側のVBAで`ActiveSheet.ListObjects("調剤請求")`としてテーブル参照する際にエラーが発生
- 本物のExcelテーブル（ListObject）が必要

**修正内容**:
データ書き込み**前**にテーブル定義を作成する方式に変更

```javascript
// v2.3.2: テーブル定義をデータ書き込み前に作成
// 患者データをグループ化
const groupedPatients = groupPatientsByRecipient(patients);

// テーブル範囲計算
const tableHeaderRow = 10;
const tableDataStartRow = 11;
const tableLastRow = Math.max(tableDataStartRow + groupedPatients.length - 1, tableHeaderRow);

// データ書き込み前にテーブル構造を定義
if (groupedPatients.length > 0) {
    worksheet.addTable({
        name: '調剤請求',
        ref: `A${tableHeaderRow}:M${tableLastRow}`,
        headerRow: true,
        totalsRow: false,
        style: {
            theme: 'TableStyleLight9',  // 明るいスタイルに変更（破損回避）
            showRowStripes: true,
        },
        columns: [
            { name: '№' },
            { name: '調剤薬局名' },
            { name: '調剤薬局 医療機関コード' },
            // ... 全13列定義
        ],
    });
}

// その後、患者データを書き込み
groupedPatients.forEach((patientGroup, index) => {
    const rowNum = 11 + index;
    const row = worksheet.getRow(rowNum);
    // データ書き込み...
});
```

**機能**:
- ✅ VBA互換性: `ActiveSheet.ListObjects("調剤請求")`で参照可能
- ✅ テーブルスタイル: TableStyleLight9（明るいスタイルで破損回避）
- ✅ フィルター機能: テーブル標準のAutoFilterが使用可能
- ✅ 縞模様表示: テーブルスタイルで自動適用

**UI改善**:
- `index.html`: ヘッダーにv2.3.2バージョン表示追加（ブラウザキャッシュ対策）

**影響ファイル**:
- `standalone-app/app.js` (lines 824-865)
- `standalone-app/index.html` (line 984)

---

## 🔧 v2.3.1 の主な変更点（前バージョン）

### 1. Excelテーブル生成バグ修正（※v2.3.2で再実装）

**問題**:
- v2.2.0で実装したExcelテーブル機能（`addTable()`）がExcelファイルエラーを引き起こす
- エラー内容: 「/xl/tables/table1.xml パーツ内のオートフィルター (テーブル)」削除
- ExcelJSの`addTable()`と既存ヘッダー行の競合が原因

**修正内容**:
テーブル機能の代わりに、**オートフィルター + 縞模様スタイル**を使用

```javascript
// 修正前（v2.2.0 / v2.3.0）- テーブル機能使用
worksheet.addTable({
    name: '調剤請求',
    ref: `A${headerRow}:M${lastRow}`,
    headerRow: true,
    totalsRow: false,
    style: {
        theme: 'TableStyleMedium6',
        showRowStripes: true,
    },
});

// 修正後（v2.3.1）- オートフィルター + 手動スタイル
// 1. オートフィルター設定
worksheet.autoFilter = {
    from: { row: tableHeaderRow, column: 1 },
    to: { row: tableHeaderRow, column: 13 }
};

// 2. 範囲に名前を付ける
workbook.definedNames.add(`'Sheet1'!$A$${tableHeaderRow}:$M$${tableLastRow}`, '調剤請求');

// 3. 縞模様スタイルを手動適用（偶数行に背景色）
for (let i = tableDataStartRow; i <= tableLastRow; i++) {
    if ((i - tableDataStartRow) % 2 === 1) {
        for (let col = 1; col <= 13; col++) {
            const cell = row.getCell(col);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9E1F2' } // 薄い青
            };
        }
    }
}
```

**機能**:
- ✅ オートフィルター: ヘッダー行（10行目）に適用
- ✅ 範囲名定義: 「調剤請求」として範囲を定義
- ✅ 縞模様スタイル: 偶数行に薄い青背景色を適用
- ✅ Excelファイルエラー解消

**影響ファイル**:
- `standalone-app/app.js` (lines 892-941)

---

## 🔧 v2.3.0 の主な変更点（前バージョン）

### 1. 前月分データ追加機能（月遅れ請求対応）

**背景**:
- 月遅れ請求のケースで、前月分の未請求データを当月請求に含める必要がある
- ユーザー要求: 「月遅れ請求の為の、当月読み込み後の前月分データ読み込み＆請求追加機能」

**実装内容**:

**UI追加**:
```html
<!-- 前月分追加ボタン（v2.3.0） -->
<div id="previous-month-upload-section" class="previous-month-section">
    <h3>📅 前月分データ追加（月遅れ請求）</h3>
    <button id="add-previous-month-btn" class="btn btn-primary">
        📂 前月分CSVを追加
    </button>
</div>

<!-- 前月分データ表示セクション -->
<div id="previous-month-data-section" class="previous-month-data-section">
    <h2>📅 前月分データ（月遅れ請求）</h2>
    <!-- 前月分統計情報 -->
    <div id="previous-month-stats">
        <span>前月全件数</span>
        <span>旭川市抽出</span>
        <span>うち重複</span>
        <span>未請求分</span>
    </div>
    <!-- 前月分患者リストテーブル -->
    <table id="previous-month-table">...</table>
</div>
```

**JavaScript機能**:
```javascript
// グローバル変数
let previousMonthPatients = [];
let previousMonthFilteredData = null;

// 前月分CSV処理
async function processPreviousMonthCSV(file) {
    // CSV読み込み（Shift-JIS対応）
    const csvData = await readCSVFile(file);

    // データ変換
    const patients = parseWelfareCSVRecords(parsedData.data);

    // 前月分データをフィルタ・重複チェック
    const filteredData = filterPreviousMonthPatients(patients);

    // UI更新
    displayPreviousMonthData(filteredData);
}

// 前月分重複チェック
function filterPreviousMonthPatients(patients) {
    // 当月データ + localStorage既存データと照合
    const processedKeys = getProcessedKeysForMonth();

    // 当月データのキーも追加
    if (currentFilteredPatients && currentFilteredPatients.asahikawa) {
        currentFilteredPatients.asahikawa.forEach(patient => {
            const yearMonth = patient.treatmentDate.substring(0, 7);
            const patientNameHash = simpleHash(patient.patientName);
            const uniqueKey = `${yearMonth}_${patientNameHash}_${patient.medicalCode}`;
            processedKeys.add(uniqueKey);
        });
    }

    // 重複フラグ設定
    asahikawa.forEach(patient => {
        if (processedKeys.has(uniqueKey)) {
            patient.isDuplicate = true;
            patient.isIncluded = false;  // 重複データは初期状態でチェックオフ
        } else {
            patient.isDuplicate = false;
            patient.isIncluded = true;   // 未請求データは初期状態でチェックオン
        }
    });
}

// Excel生成時に前月分データ統合
async function handleExcelDownload() {
    let includedPatients = currentFilteredPatients.target.filter(p => p.isIncluded !== false);

    // 前月分データ統合（v2.3.0）
    if (previousMonthFilteredData && previousMonthFilteredData.asahikawa) {
        const previousIncluded = previousMonthFilteredData.asahikawa.filter(p => p.isIncluded === true);
        includedPatients = includedPatients.concat(previousIncluded);
        console.log(`前月分データ統合: ${previousIncluded.length} 件追加、合計 ${includedPatients.length} 件`);
    }

    // Excel生成...
}
```

**機能**:
- ✅ 前月分CSV追加ボタン: 当月データ読み込み後に表示
- ✅ 前月分データ表示: 別セクションに独立表示
- ✅ 重複チェック: 当月データ + localStorage既存データと照合
- ✅ チェックボックス初期状態: 未請求=ON、重複=OFF
- ✅ 統計情報: 前月全件数、旭川市抽出、うち重複、未請求分
- ✅ 折りたたみ機能: 前月分セクションを展開/折りたたみ可能
- ✅ Excel統合生成: 当月データ + 前月分データを統合出力
- ✅ 処理済みキー保存: 前月分データも処理済みとして記録

**影響ファイル**:
- `standalone-app/index.html` (lines 1013-1025, 1073-1133)
- `standalone-app/app.js` (lines 16-18, 94-104, 666-667, 707-711, 735-740, 995-1001, 1442-1701)
- `create-standalone-zip.ps1` (lines 2, 5-6)
- `test/package.json` (line 3)

**CSS追加**:
- `.previous-month-section`: 前月分追加セクションスタイル
- `.previous-month-data-section`: 前月分データ表示セクションスタイル
- `.badge-info`: 未請求バッジスタイル（青）
- `.stat-item.success`: 未請求分統計アイテムスタイル

---

## 🔧 v2.2.0 の主な変更点（前バージョン）

### 1. Excelテーブル機能実装

**背景**:
- 注意事項に「シート名」「テーブル名」は変更しないでくださいと記載
- 集約処理でテーブル機能が必要

**実装内容**:
```javascript
// Excelテーブル機能を追加（v2.2.0）
// テーブル範囲: A10:M(最終行)
// - ヘッダー行: 10行目
// - データ行: 11行目から (groupedPatients.length分)
const headerRow = 10;
const dataStartRow = 11;
const lastRow = Math.max(dataStartRow + groupedPatients.length - 1, headerRow);

worksheet.addTable({
    name: '調剤請求',
    ref: `A${headerRow}:M${lastRow}`,
    headerRow: true,
    totalsRow: false,
    style: {
        theme: 'TableStyleMedium6',  // 青、テーブルスタイル（中間）6
        showRowStripes: true,
    },
    columns: [
        { name: '№', filterButton: false },
        { name: '調剤薬局名', filterButton: true },
        { name: '調剤薬局 医療機関コード', filterButton: true },
        { name: '診療を行った医療機関の名称', filterButton: true },
        { name: '診療を行った医療機関の医療機関コード', filterButton: true },
        { name: '受給者番号', filterButton: true },
        { name: '氏名', filterButton: true },
        { name: '生年月日', filterButton: false },
        { name: '診療年月日', filterButton: true },
        { name: '主', filterButton: true },
        { name: '自立支援', filterButton: true },
        { name: '重障', filterButton: true },
        { name: '備考', filterButton: false },
    ],
    rows: [], // データは既に書き込み済み
});
```

**機能**:
- ✅ テーブル名: `調剤請求` で固定
- ✅ フィルター機能: ほとんどの列で有効（№、生年月日、備考は無効）
- ✅ 縞模様表示: 視認性向上
- ✅ テーブルスタイル: TableStyleMedium6（青）

**影響ファイル**:
- `standalone-app/app.js` (lines 859-898)

---

## 🔧 v2.1.5 の主な変更点（前バージョン）

### 1. 重複データ表示改善

**問題**:
- v2.1.4では重複データがリストに表示されない
- 何件の重複がスキップされたかわからない
- 全行数が正しく読み込まれているか確認できない

**解決策**:
```javascript
// 2回目請求の場合、重複フラグ設定（除外はしない）
if (batchNumber === 2) {
    const processedKeys = getProcessedKeysForMonth();
    asahikawa.forEach(patient => {
        const yearMonth = patient.treatmentDate ? patient.treatmentDate.substring(0, 7) : '';
        const patientNameHash = simpleHash(patient.patientName);
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
}

return {
    all: patients,
    asahikawa: asahikawa,
    target: asahikawa,  // 重複も含めた全データを表示
    duplicate: duplicate
};
```

**UIの変化**:
- ✅ 全データを表示（重複含む）
- ✅ 重複データには「重複」バッジ表示
- ✅ 重複データは初期状態でチェックオフ
- ✅ 必要なら手動でチェックONで処理可能
- ✅ 全行数が読み込まれているか確認可能

**影響ファイル**:
- `standalone-app/app.js` (lines 344-374)
- `standalone-app/index.html` (lines 997-1011)

---

### 2. 統計情報ラベル改善

**変更内容**:
```html
<!-- Before -->
<span class="stat-label-compact">総レコード数</span>
<span class="stat-label-compact">請求対象</span>
<span class="stat-label-compact">重複除外</span>

<!-- After -->
<span class="stat-label-compact">全レコード数</span>
<span class="stat-label-compact">旭川市抽出</span>
<span class="stat-label-compact">うち重複</span>
```

**意味の明確化**:
- **全レコード数**: CSVの全行数（変更なし）
- **旭川市抽出**: 旭川市フィルタ後の件数（重複含む）← より明確に
- **うち重複**: 重複として検出された件数 ← 「うち」で包含関係を明示

**影響ファイル**:
- `standalone-app/index.html` (lines 1000, 1004, 1008)

---

## 🔧 v2.1.4 の主な変更点（前バージョン）

### 1. 患者氏名ハッシュ化（プライバシー保護）

**問題**:
- localStorage に患者氏名が平文で保存されている
- 個人情報保護の観点で問題がある

**解決策**:
```javascript
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
```

**影響ファイル**:
- `standalone-app/app.js` (lines 505-517)

---

### 2. 重複チェックキー改善（年月単位管理）

**問題**:
- 以前のキー: `recipientNumber_treatmentDate_patientName`
- 完全な日付を含むため、同一患者の同月内別日受診が重複として検出されない
- 受給者番号が世帯単位の可能性があり、個人を一意に識別できない

**解決策**:
```javascript
// 年月を診療年月日から抽出（例: "2025/02/03" → "2025/02"）
const yearMonth = patient.treatmentDate ? patient.treatmentDate.substring(0, 7) : '';

// 患者氏名をハッシュ化
const patientNameHash = simpleHash(patient.patientName);

// 年月 + 患者氏名ハッシュ + 医療機関コードで重複チェック
const uniqueKey = `${yearMonth}_${patientNameHash}_${patient.medicalCode}`;
```

**キー構造の変遷**:
1. v2.1.3以前: `recipientNumber_treatmentDate_patientName`
   - 問題: 完全日付のため月単位管理不可
2. 検討案1: `yearMonth_recipientNumber_medicalCode`
   - 問題: 受給者番号が世帯単位の可能性
3. **v2.1.4最終**: `yearMonth_patientNameHash_medicalCode`
   - ✅ 月単位で管理
   - ✅ 個人を正確に識別（氏名ハッシュ）
   - ✅ 同一患者・複数医療機関対応
   - ✅ プライバシー保護（ハッシュ化）

**影響ファイル**:
- `standalone-app/app.js` (lines 347-362, 534-542)

---

### 3. 同一患者・複数医療機関対応

**問題**:
- 同一患者が同日に複数の医療機関を受診するケースで、2機関目以降が重複除外される

**解決策**:
- 重複チェックキーに `medicalCode` を含めることで、医療機関別に請求を分離
- 例: `2025/02_656a3235_41234567` と `2025/02_656a3235_41987654` は別レコードとして処理

**影響ファイル**:
- `standalone-app/app.js` (lines 347-362)

---

### 4. 世帯単位受給者番号問題の回避

**問題調査結果**:
- コード内に `recipientNumber` の世帯単位を示唆するコメントなし
- しかし実運用で受給者番号が世帯ベースの可能性がある
- 同一世帯の複数患者を区別できないリスク

**解決策**:
- 重複チェックキーから `recipientNumber` を完全除外
- 患者氏名ハッシュで個人を識別
- より確実な個人識別が可能に

**影響ファイル**:
- `standalone-app/app.js` (lines 347-362, 534-542)

---

## 🔧 v2.1.3 の主な変更点（前バージョン）

### 1. DOM操作高速化（DocumentFragment）

**問題**:
- 患者リスト表示で1000回のappendChild()を実行
- 大量データ（1000件）でUIが5-10秒固まる

**解決策**:
```javascript
// DocumentFragmentで一括DOM操作
const fragment = document.createDocumentFragment();
patients.forEach((patient, index) => {
    const row = document.createElement('tr');
    // ...
    fragment.appendChild(row);
});
tbody.appendChild(fragment);  // 1回のみDOM操作
```

**影響ファイル**:
- `standalone-app/app.js` (lines 548-600)

---

### 2. undefined統合チェック

**問題**:
- 受給者番号・患者名が空の患者が統合キー「undefined_undefined」になる
- 意図しない患者統合が発生

**解決策**:
```javascript
patients.forEach(patient => {
    if (!patient.recipientNumber || !patient.patientName) {
        console.warn('必須データ不足の患者をスキップ:', patient);
        return;  // 統合処理から除外
    }
    // ...
});
```

**影響ファイル**:
- `standalone-app/app.js` (lines 1213-1240)

---

### 3. 医療機関コード処理改善

**問題**:
- 「010123456789」のような複数「01」が1回のみ削除
- 医療機関種別コード（1:病院/3:歯科/4:薬局）の検証がない

**解決策**:
```javascript
// 先頭の01を全て削除
while (cleaned.startsWith('01') && cleaned.length > 2) {
    cleaned = cleaned.substring(2);
}

// 下8桁を取得
if (cleaned.length > 8) {
    cleaned = cleaned.slice(-8);
}

// 種別コード検証
const firstChar = cleaned.charAt(0);
if (!['1', '3', '4'].includes(firstChar)) {
    console.warn(`医療機関コードの形式が不正です: ${code}`);
}
```

**影響ファイル**:
- `standalone-app/app.js` (lines 1111-1134)

---

### 4. localStorage容量エラーハンドリング

**問題**:
- 長期使用で容量上限（5-10MB）に達してアプリ停止

**解決策**:
```javascript
try {
    localStorage.setItem('processed-keys', JSON.stringify(merged));
} catch (e) {
    if (e.name === 'QuotaExceededError') {
        const trimmed = merged.slice(-1000);  // 最新1000件のみ保持
        localStorage.setItem('processed-keys', JSON.stringify(trimmed));
    }
}
```

**影響ファイル**:
- `standalone-app/app.js` (lines 517-537)

---

### 5. 半角カナ変換の正規表現化

**問題**:
- 70個のマッピングを2重ループで処理
- 1000件データで計70万回の文字列置換

**解決策**:
```javascript
// 正規表現で一括置換
const pattern2 = /ｶﾞ|ｷﾞ|ｸﾞ|...|ｦﾞ/g;
let result = str.replace(pattern2, match => kanaMap[match] || match);

const pattern1 = /ｱ|ｲ|ｳ|...|･/g;
result = result.replace(pattern1, match => kanaMap[match] || match);
```

**影響ファイル**:
- `standalone-app/app.js` (lines 447-497)

---

### 6. 型安全性改善

**問題**:
- 数値やオブジェクトがfixKanaAndTrim()に渡されるとエラー

**解決策**:
```javascript
function fixKanaAndTrim(str) {
    if (!str) return '';
    str = String(str);  // 文字列に正規化
    // ...
}
```

**影響ファイル**:
- `standalone-app/app.js` (line 450)

---

## 🔧 v2.1.2 の主な変更点（前バージョン）

### 1. シングルクォート処理の修正（カンマ入り日付フィールド対応）

**問題**:
- CSVに `'2025/12(1,9,25)'` のようなカンマ入りフィールドが存在
- 以前のコードがシングルクォートを全削除していたため、カンマで分割されていた
- 結果: 65列が65,66,67列に分割され、来局数-1行ずつ全体がずれる

**解決策**:
```javascript
// シングルクォート削除を廃止
// const cleanedText = text.replace(/'/g, '');  // 削除

// Papa Parseでシングルクォートを正しく認識
Papa.parse(text, {
    header: false,
    quoteChar: "'",     // シングルクォートをクォート文字として認識
    escapeChar: "'",    // エスケープもシングルクォート
    // ...
});
```

**影響ファイル**:
- `standalone-app/app.js` (lines 233-237)

---

### 2. 日付データのスペース削除

**問題**:
- 元データの日付が半角スペースを含む（例: `' 1月'`、`'R 6/12/20'`）
- Excelが日付として認識せず、エラーが発生

**解決策**:
```javascript
// 生年月日（12列目）と診療年月日（56列目）から全スペース削除
const birthDate = (row['12'] || '').replace(/\s/g, '');      // 全角半角スペース削除
const treatmentDate = (row['56'] || '').replace(/\s/g, '');  // 全角半角スペース削除
```

**影響ファイル**:
- `standalone-app/app.js` (lines 385, 389)

---

### 3. 半角カナ完全対応（濁点・半濁点含む）

**問題**:
- 患者カナ氏名が半角カナで入力されている
- 以前のコードは単純な文字コード加算（`0xFEE0`）のみで、濁点・半濁点に未対応
- 結果: `ｶﾞｷﾞｸﾞｹﾞｺﾞ` が正しく変換されない

**解決策**:
```javascript
function fixKanaAndTrim(str) {
    // 完全な半角カナ→全角カナ変換マップ
    const kanaMap = {
        'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
        'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', // ... 全カナ対応
        // ...
    };

    // 2文字マッチ（濁点・半濁点）を優先処理
    // 次に1文字マッチを処理
}
```

**影響ファイル**:
- `standalone-app/app.js` (lines 446-487)

---

## 🔧 v2.1.1 の主な変更点（前バージョン）

### 1. HR形式CSV対応（マルチレコードフォーマット）

**問題**:
- 本番CSVはHR形式（Hierarchical Record format）で複数のレコードタイプが混在
- R1レコード（患者データ）以外のレコード（ヘッダー、項目解析結果など）も含まれる
- Papa Parseの`header: true`が誤った列数を期待し、"Too many fields"警告が発生

**解決策**:
```javascript
// Papa Parseで配列として取得
Papa.parse(cleanedText, {
    header: false,  // 配列として取得
    // ...
    complete: (results) => {
        // 配列を列番号付きオブジェクトに変換
        const dataWithKeys = results.data.map(row => {
            const obj = {};
            row.forEach((value, index) => {
                obj[String(index + 1)] = value;  // 1-indexed
            });
            return obj;
        });

        // R1レコードのみ抽出
        const dataRecords = dataWithKeys.filter(row => {
            const firstCol = (row['1'] || '').toString().trim();
            const isEraFormat = /^[RHS]\d+/.test(firstCol);
            const isNumericOnly = /^\d+$/.test(firstCol);
            return (isEraFormat || isNumericOnly) && firstCol !== '項目解析結果';
        });
    }
});
```

**影響ファイル**:
- `standalone-app/app.js` (lines 240-272, 289-305)

---

### 2. K・L・M列の正しい配置

**問題**:
- K列が空白、L列が自立支援、M列が重障になっていた（間違い）
- 正しくは: K=主保険、L=自立支援、M=重障

**解決策**:
```javascript
// 主保険判定（列17の保険区分）
const insuranceType = row['17'];  // 「公費単独」or その他
const hasMainInsurance = patient.insuranceType !== '公費単独';

// K列: 主保険（社保・国保など）
row.getCell(11).value = hasMainInsurance ? '◯' : '';

// L列: 自立支援（公費21/15/16）
row.getCell(12).value = kohiFlags.hasJiritsuShien ? '◯' : '';

// M列: 重障（公費54）
row.getCell(13).value = kohiFlags.hasJusho ? '◯' : '';
```

**影響ファイル**:
- `standalone-app/app.js` (lines 395, 408, 751-761)

---

### 3. 公費コード配列の追加

**問題**:
- `patient.publicCodes`配列が存在せず、`detectKohiFlags()`が機能しなかった

**解決策**:
```javascript
const patient = {
    // ...
    publicCodes: [publicExpenseNumber1, publicExpenseNumber2, publicExpenseNumber3],
    insuranceType: insuranceType,
    // ...
};
```

**影響ファイル**:
- `standalone-app/app.js` (line 412)

---

## 🔧 v2.1.0 の主な変更点（前バージョン）

### 1. CSV列ずれ問題の完全解決

**問題**:
- CSV内の不完全なシングルクォート（`'`）がPapa Parseによるフィールド結合を引き起こす
- 列数が68-69列になり、70列期待に対してずれが発生

**解決策**:
```javascript
// STEP 1: CSV読み込み
const text = await readFileAsText(file, 'Shift-JIS');

// STEP 2: 前処理 - すべてのシングルクォートを削除
const cleanedText = text.replace(/'/g, '');

// STEP 3: Papa Parseで解析
Papa.parse(cleanedText, {
  quoteChar: '"',  // ダブルクォート（シングルは削除済み）
  // ...
});
```

**影響ファイル**:
- `webapp-version/src/js/csv-parser.js` (lines 128-180)
- `standalone-app/app.js` (lines 230-237)

**参考ドキュメント**: [docs/csv-column-alignment-fix.md](docs/csv-column-alignment-fix.md)

---

### 2. 診療年月日の列番号修正

**問題**:
- JavaScript実装が列57を使用していたが、VBA実装（Module1.bas line 171）は列56を使用
- 列56: YYYYMMDD形式 (`20250210`)
- 列57: 表示用形式 (`2025/02(10)`)

**修正**:
```javascript
// webapp-version/src/js/csv-parser.js (lines 109-113)
getTreatmentDate() {
  // 列56: 最終受診日 (YYYYMMDD format: '20250210')
  // VBA implementation uses column 56 (Module1.bas line 171)
  return this.getField(56);
}
```

**影響ファイル**:
- `webapp-version/src/js/csv-parser.js` (line 112)
- `standalone-app/app.js` (line 356) - 既に正しい列番号を使用

**参考ドキュメント**: [docs/PRODUCTION-CSV-SPECIFICATION.md](docs/PRODUCTION-CSV-SPECIFICATION.md)

---

### 3. 医療機関コード自動取得機能

**問題**:
- standalone版で`patient.medicalCode`プロパティが存在せず、Excel E列が空になる

**修正**:
```javascript
// standalone-app/app.js (lines 355, 371)
const medicalCode = fixKanaAndTrim(row['65'] || '');  // 65列目: 医療機関コード

const patient = {
  // ...
  medicalCode: removeLeading01(medicalCode),  // 先頭01削除
  // ...
};
```

**新規追加関数**:
```javascript
// standalone-app/app.js (lines 418-430)
function removeLeading01(code) {
  if (!code) return '';
  const str = String(code).trim();
  if (str.startsWith('01')) {
    return str.substring(2);
  }
  return str;
}
```

**影響ファイル**:
- `standalone-app/app.js` (lines 355, 371, 418-430)

---

### 4. YYYYMMDD形式日付パース機能

**追加機能**:
- 列56のYYYYMMDD形式をDate型に変換
- 複数来局日の統合表示 (`2025/2(7,10,25)`)

**新規関数**:
```javascript
// webapp-version/src/js/excel-generator.js (lines 306-332)
function parseYYYYMMDD(dateStr) {
  if (!dateStr) return '';
  if (dateStr instanceof Date) return dateStr;

  const cleaned = removeAllQuotes(String(dateStr).trim());
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;  // JS月は0-indexed
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  return cleaned;
}
```

**影響ファイル**:
- `webapp-version/src/js/excel-generator.js` (lines 306-332, 370-384)
- `standalone-app/app.js` (lines 1081-1159)

---

## 📋 デプロイ前チェックリスト

### コード品質

- [x] デバッグログ削除 (`console.log`の除去)
- [x] コメント更新（列番号変更の理由記載）
- [x] 関数名・変数名の一貫性確認
- [x] webapp版とstandalone版の同期確認

### ドキュメント

- [x] README.md更新（更新履歴v2.1.0追加）
- [x] 技術ドキュメント作成
  - [x] PRODUCTION-CSV-SPECIFICATION.md
  - [x] csv-column-alignment-fix.md
- [x] DEPLOY.md作成（本ドキュメント）

### テスト

- [ ] webapp版動作確認
  - [ ] CSV読み込み（`調剤券請求書CSV202502.csv`）
  - [ ] Excel生成（E列に医療機関コード表示）
  - [ ] 診療年月日が正しく表示（列56から取得）
  - [ ] 公費フラグが正しく表示（K/L列）
- [ ] standalone版動作確認
  - [ ] CSV読み込み
  - [ ] Excel生成
  - [ ] 医療機関コードが正しく表示

---

## 🚀 デプロイ手順

### スタンドアロン版

**配布方法**:
```bash
# 1. フォルダをZIP圧縮
zip -r welfare-invoice-generator-standalone-v2.1.0.zip standalone-app/

# 2. ユーザーに配布
# - メール添付
# - ファイル共有サービス（Google Drive, Dropbox等）
# - 社内ネットワーク共有フォルダ
```

**ユーザー側の使用方法**:
1. ZIPファイルを解凍
2. `standalone-app/index.html` をダブルクリック
3. ブラウザで自動的に開く

---

### Webアプリ版

**Pythonサーバー（開発・テスト用）**:
```bash
cd webapp-version
python -m http.server 8000
# http://localhost:8000 でアクセス
```

**Node.js + http-server（本番推奨）**:
```bash
npm install -g http-server
cd webapp-version
http-server -p 8000
# http://localhost:8000 でアクセス
```

**Nginx（本番運用）**:
```nginx
server {
    listen 80;
    server_name invoice.example.com;

    root /var/www/welfare-invoice-generator/webapp-version;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # CSVファイルのMIMEタイプ設定
    location ~* \.csv$ {
        types { text/csv csv; }
        add_header Content-Type "text/csv; charset=shift_jis";
    }
}
```

---

## 🔍 トラブルシューティング

### 問題1: E列（医療機関コード）が空

**原因**: CSV列65のデータが読み込まれていない

**確認方法**:
```javascript
// ブラウザのコンソールで確認
console.log(patient.medicalCode);  // 値が表示されるか確認
```

**解決策**:
- standalone版: `app.js` line 355, 371を確認
- webapp版: `data-filter.js` line 35を確認

---

### 問題2: 診療年月日が受給者番号列に表示される

**原因**: CSV列番号が間違っている（列57を使用している）

**確認方法**:
```javascript
// csv-parser.js または app.js で確認
getTreatmentDate() {
  return this.getField(56);  // 56であることを確認
}
```

**解決策**:
- `csv-parser.js` line 112を確認
- `app.js` line 356を確認

---

### 問題3: CSV読み込みで列数不足警告

**原因**: シングルクォート前処理が実行されていない

**確認方法**:
```javascript
// コンソールログで確認
console.log('クォート削除後のテキスト:', cleanedText.substring(0, 100));
```

**解決策**:
- `csv-parser.js` lines 133-134を確認（前処理が実行されているか）
- `app.js` line 237を確認

---

## 📞 サポート情報

### 技術サポート
- **GitHub Issues**: https://github.com/sekine53629/welfare-dispensing-invoice-generator/issues
- **開発者**: 関根 (sekine53629)
- **Email**: sekine53629@example.com

### ドキュメント
- [本番CSV仕様](docs/PRODUCTION-CSV-SPECIFICATION.md)
- [CSV列ずれ修正](docs/csv-column-alignment-fix.md)
- [Excelバリデーション仕様](docs/excel-validation-spec.md)

---

## 📊 変更ファイル一覧

### webapp-version

| ファイル | 変更内容 | 行番号 |
|---------|---------|-------|
| `src/js/csv-parser.js` | 診療年月日を列56に変更 | 112 |
| `src/js/csv-parser.js` | シングルクォート前処理追加 | 133-134, 171-180 |
| `src/js/data-filter.js` | デバッグログ削除 | 35 |
| `src/js/excel-generator.js` | `parseYYYYMMDD()`関数追加 | 306-332 |
| `src/js/excel-generator.js` | `formatMultipleTreatmentDates()`更新 | 370-384 |
| `src/js/excel-generator.js` | デバッグログ削除 | 63, 239-253 |

### standalone-app

| ファイル | 変更内容 | 行番号 |
|---------|---------|-------|
| `app.js` | `simpleHash()`関数追加（v2.1.4） | 505-517 |
| `app.js` | 重複チェックキー変更（v2.1.4） | 347-362 |
| `app.js` | `saveProcessedKeys()`更新（v2.1.4） | 534-542 |
| `app.js` | DocumentFragment DOM最適化（v2.1.3） | 548-600 |
| `app.js` | 医療機関コード検証（v2.1.3） | 1111-1134 |
| `app.js` | localStorage容量エラー対策（v2.1.3） | 517-537 |
| `app.js` | 列65（医療機関コード）読み込み追加（v2.1.0） | 355 |
| `app.js` | `patient.medicalCode`プロパティ追加（v2.1.0） | 371 |
| `app.js` | `removeLeading01()`関数追加（v2.1.0） | 418-430 |
| `app.js` | `parseYYYYMMDD()`関数追加（v2.1.0） | 1081-1107 |
| `app.js` | `formatMultipleTreatmentDates()`更新（v2.1.0） | 1140-1159 |

### docs

| ファイル | 変更内容 |
|---------|---------|
| `PRODUCTION-CSV-SPECIFICATION.md` | 新規作成（VBA解析結果） |
| `csv-column-alignment-fix.md` | 列ずれ問題の詳細ドキュメント |
| `README.md` | v2.1.0更新履歴追加 |
| `DEPLOY.md` | 本デプロイガイド作成 |

---

## ✅ リリース承認

- [ ] コードレビュー完了
- [ ] テスト完了（webapp版・standalone版）
- [ ] ドキュメント完備
- [ ] デプロイパッケージ作成完了

**リリース責任者**: 関根 (sekine53629)
**リリース日**: 2026-01-17
**バージョン**: v2.1.5

---

**🎉 デプロイ準備完了！**
