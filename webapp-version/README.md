# 調剤券請求書作成ツール - Webアプリ版

## 概要
ブラウザ上で動作する生活保護調剤券請求書自動作成ツールです。
完全クライアントサイド実装のため、インターネット接続不要で使用できます。

## 特徴
- ✅ **インストール不要**: ブラウザで即座に使用可能
- ✅ **クロスプラットフォーム**: Windows/Mac/Linux対応
- ✅ **オフライン動作**: 個人情報を外部送信しない
- ✅ **直感的UI**: モダンなインターフェース
- ✅ **高速処理**: 大量データも素早く処理

## 動作環境
- **ブラウザ**: Chrome 90+, Edge 90+, Firefox 88+, Safari 14+
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 20.04+
- **必要な権限**: ファイル読み書き権限

## ディレクトリ構成
```
webapp-version/
├── src/
│   ├── js/                     # JavaScript
│   │   ├── app.js              # メインアプリケーション
│   │   ├── csv-parser.js       # CSVパーサー
│   │   ├── data-filter.js      # データフィルタリング
│   │   ├── excel-generator.js  # Excel生成
│   │   ├── archive-manager.js  # アーカイブ管理
│   │   ├── config-manager.js   # 設定管理
│   │   └── utils.js            # ユーティリティ関数
│   ├── css/                    # スタイルシート
│   │   ├── main.css
│   │   └── components.css
│   └── assets/                 # 静的ファイル
├── templates/
│   └── template.xlsx           # 請求書テンプレート
├── archive/                    # アーカイブデータ（自動生成）
├── tests/                      # テストコード
├── index.html                  # メインHTML
├── package.json                # npm設定
└── README.md
```

## インストール方法

### 方法1: 直接使用（最も簡単）
1. `index.html`をダブルクリック
2. ブラウザで開く
3. すぐに使用可能

### 方法2: 開発環境セットアップ
```bash
cd webapp-version

# 依存パッケージのインストール
npm install

# 開発サーバー起動
npm run dev

# ブラウザで http://localhost:3000 を開く
```

### 方法3: ビルド版作成
```bash
# 本番用ビルド
npm run build

# dist/フォルダに生成されたファイルを配布
```

## 使用方法

### 初回設定
1. `index.html`を開く
2. 「設定」タブをクリック
3. 以下を入力:
   - **薬局名**: 例）○○薬局
   - **医療機関コード**: 10桁（例: 0112345678）
4. 「保存」ボタンをクリック
   - 設定はブラウザのLocalStorageに保存される

### 請求書作成（1回目 - 月中）
1. 「請求書作成」タブを開く
2. 「1回目請求」を選択
3. CSVファイルをドラッグ&ドロップ または ファイル選択
4. 自動処理:
   - データ解析プレビュー表示
   - 旭川市生活保護受給者のみ抽出
   - 公費番号チェック（12番）
   - 自立支援・重障判定
5. 「Excelダウンロード」ボタンをクリック
6. ファイルが自動ダウンロード
   - ファイル名: `YYYYMMDD_tyouzai_excel_v2.xlsx`
7. **重要**: 処理データが自動的にブラウザに保存される

### 請求書作成（2回目 - 月末）
1. 「請求書作成」タブを開く
2. 「2回目請求」を選択
3. CSVファイルをドラッグ&ドロップ
4. 自動処理:
   - 1回目処理済みデータと照合
   - 重複レコードを自動除外
   - 重複件数を表示
5. 「Excelダウンロード」ボタンをクリック
6. 新規分のみの請求書がダウンロード

### アーカイブ管理
1. 「アーカイブ」タブを開く
2. 過去の処理履歴を一覧表示
3. 機能:
   - 📁 **閲覧**: 過去のExcelファイルを再ダウンロード
   - 🔍 **検索**: 日付・患者名で検索
   - 🗑️ **削除**: 5年経過データの削除
   - 📊 **統計**: 月別処理件数グラフ

## 機能詳細

### CSV解析
- **ライブラリ**: Papa Parse
- **対応形式**: Shift-JIS、UTF-8
- **特殊処理**:
  - RFC 4180準拠のCSVパース
  - 不完全なクォートの自動修正
  - カンマを含むフィールドの正しい解析
  - 70列のデータ構造に対応

### データフィルタリング
- **住所フィルター**: 正規表現による「旭川市」検出
- **公費番号フィルター**: 種別番号「12」（生活保護）
- **重複チェック**:
  - 受給者番号 + 診療日 + 氏名のハッシュ値で判定
  - IndexedDBに保存

### Excel生成
- **ライブラリ**: ExcelJS
- **出力形式**: .xlsx (Excel 2007+)
- **機能**:
  - テンプレートベース生成
  - セルスタイル保持
  - 自動列幅調整
  - 印刷設定保持

### データ永続化
- **技術**: IndexedDB (localforage)
- **保存データ**:
  - 設定情報（薬局名、医療機関コード等）
  - 処理履歴（日時、件数、ファイル名）
  - 重複チェック用データ（ハッシュ値）
- **保存期間**: 5年間（自動削除機能あり）

## ユーザーインターフェース

### 画面構成
```
┌─────────────────────────────────┐
│  調剤券請求書作成ツール           │
├─────────────────────────────────┤
│ [設定] [請求書作成] [アーカイブ]  │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────┐          │
│  │ CSVファイルを                │
│  │ ドラッグ&ドロップ            │
│  │ またはクリックして選択        │
│  └───────────────────┘          │
│                                 │
│  ☑ 1回目請求  ☐ 2回目請求       │
│                                 │
│  ┌─ データプレビュー ──┐        │
│  │ 総件数: 100件         │        │
│  │ 旭川市: 50件          │        │
│  │ 生活保護: 40件        │        │
│  │ 重複: 5件（除外）      │        │
│  └──────────────────┘        │
│                                 │
│  [Excelダウンロード]             │
└─────────────────────────────────┘
```

### レスポンシブデザイン
- PC: 横3カラムレイアウト
- タブレット: 横2カラム
- スマホ: 縦1カラム

## 開発者向け情報

### 技術スタック
```json
{
  "frontend": {
    "framework": "Vanilla JavaScript (ES6+)",
    "ui": "HTML5 + CSS3",
    "modules": "ES Modules"
  },
  "libraries": {
    "csv": "Papa Parse 5.4.1",
    "excel": "ExcelJS 4.3.0",
    "storage": "localforage 1.10.0"
  },
  "build": {
    "bundler": "Vite 4.5.0",
    "minifier": "Terser"
  },
  "testing": {
    "framework": "Jest 29.7.0",
    "coverage": "Istanbul"
  }
}
```

### モジュール構成
```javascript
// app.js - メインアプリケーション
import { parseCSV } from './csv-parser.js';
import { filterData } from './data-filter.js';
import { generateExcel } from './excel-generator.js';
import { archiveData } from './archive-manager.js';

// メインフロー
async function processInvoice(file, isSecondBatch) {
  const data = await parseCSV(file);
  const filtered = await filterData(data, isSecondBatch);
  const excel = await generateExcel(filtered);
  await archiveData(data, excel);
  return excel;
}
```

### API仕様

#### CSVParser
```javascript
/**
 * CSVファイルを解析
 * @param {File} file - CSVファイル
 * @returns {Promise<Array>} パース済みデータ
 */
async function parseCSV(file) {
  // 実装
}
```

#### DataFilter
```javascript
/**
 * データフィルタリング
 * @param {Array} data - 元データ
 * @param {boolean} isSecondBatch - 2回目フラグ
 * @returns {Promise<Array>} フィルタ済みデータ
 */
async function filterData(data, isSecondBatch) {
  // 実装
}
```

#### ExcelGenerator
```javascript
/**
 * Excel生成
 * @param {Array} data - データ
 * @returns {Promise<Blob>} Excelファイル
 */
async function generateExcel(data) {
  // 実装
}
```

### テスト実行
```bash
# 全テスト実行
npm test

# カバレッジ計測
npm run test:coverage

# 特定ファイルのみ
npm test csv-parser.test.js

# Watch モード
npm test -- --watch
```

### デバッグ方法
1. ブラウザ開発者ツール（F12）を開く
2. Console タブでエラー確認
3. Sources タブでブレークポイント設定
4. Network タブでファイル読み込み確認
5. Application タブでLocalStorage/IndexedDB確認

## トラブルシューティング

### CSVが読み込めない
- **原因**: ファイル形式エラー
- **解決**:
  1. CSVファイルをテキストエディタで開く
  2. 文字コードがShift-JISまたはUTF-8であることを確認

### Excelが生成できない
- **原因**: ブラウザのメモリ不足
- **解決**: ブラウザを再起動、または小さいファイルで試す

### 重複チェックが動作しない
- **原因**: IndexedDBがクリアされた
- **解決**: 1回目請求を再実行

### データが保存されない
- **原因**: ブラウザのプライベートモード
- **解決**: 通常モードで使用

## セキュリティ
- ✅ すべての処理がクライアントサイドで完結
- ✅ データは外部に送信されない
- ✅ IndexedDBはブラウザごとに隔離
- ✅ HTTPS推奨（ファイルアクセス制限のため）

## ライセンス
MIT License

## 作成者
関根 sekine53629

## バージョン履歴
- **v2.0.0** (2025-02): Webアプリ版初版リリース

## サポート
- GitHub Issues: https://github.com/sekine53629/welfare-dispensing-invoice-generator/issues
- Email: （必要に応じて追加）

## 今後の拡張予定
- [ ] PWA対応（オフラインでもアプリのように使用）
- [ ] PDF直接出力
- [ ] データ分析ダッシュボード
- [ ] 複数薬局管理機能
- [ ] クラウドバックアップ（暗号化）
