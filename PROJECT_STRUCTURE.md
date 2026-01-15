# プロジェクト構造

## ディレクトリ構成

```
welfare-dispensing-invoice-generator/
│
├── docs/                           # ドキュメント
│   ├── requirements.md             # 要件定義書
│   ├── user-manual-vba.md          # VBA版マニュアル
│   ├── user-manual-webapp.md       # Webアプリ版マニュアル
│   └── api-specification.md        # API仕様書
│
├── vba-version/                    # VBA版実装
│   ├── modules/                    # VBAモジュール
│   │   ├── Module_Main.bas         # メイン制御
│   │   ├── Module_CSVParser.bas    # CSV解析
│   │   ├── Module_DataFilter.bas   # データフィルタリング
│   │   ├── Module_ExcelExport.bas  # Excel出力
│   │   ├── Module_Archive.bas      # アーカイブ管理
│   │   └── Module_Config.bas       # 設定管理
│   │
│   ├── templates/                  # テンプレート
│   │   └── tyouzai_excel_2.xltx    # 請求書テンプレート
│   │
│   ├── archive/                    # アーカイブデータ（.gitignore対象）
│   │   └── .gitkeep
│   │
│   ├── 調剤券請求書作成.xlsm        # メインExcelファイル
│   └── README.md                   # VBA版README
│
├── webapp-version/                 # Webアプリ版実装
│   ├── src/                        # ソースコード
│   │   ├── js/                     # JavaScript
│   │   │   ├── app.js              # メインアプリケーション
│   │   │   ├── csv-parser.js       # CSVパーサー
│   │   │   ├── data-filter.js      # データフィルタリング
│   │   │   ├── excel-generator.js  # Excel生成
│   │   │   ├── archive-manager.js  # アーカイブ管理
│   │   │   ├── config-manager.js   # 設定管理
│   │   │   └── utils.js            # ユーティリティ関数
│   │   │
│   │   ├── css/                    # スタイルシート
│   │   │   ├── main.css            # メインスタイル
│   │   │   └── components.css      # コンポーネントスタイル
│   │   │
│   │   └── assets/                 # 静的ファイル
│   │       └── icons/              # アイコン
│   │
│   ├── templates/                  # テンプレート
│   │   └── template.xlsx           # 請求書テンプレート
│   │
│   ├── archive/                    # アーカイブデータ（.gitignore対象）
│   │   └── .gitkeep
│   │
│   ├── tests/                      # テストコード
│   │   ├── csv-parser.test.js
│   │   ├── data-filter.test.js
│   │   └── excel-generator.test.js
│   │
│   ├── index.html                  # メインHTML
│   ├── package.json                # npm設定
│   └── README.md                   # Webアプリ版README
│
├── shared/                         # 共有リソース
│   ├── docs/                       # 共有ドキュメント
│   │   ├── csv-format.md           # CSV形式仕様書
│   │   └── business-rules.md       # 業務ルール
│   │
│   └── sample-data/                # サンプルデータ
│       ├── 調剤券請求書CSV202502.csv
│       └── expected-output.xlsx
│
├── tool/                           # 開発支援ツール
│   ├── vba_import_gui.py           # VBAインポートGUI (v1)
│   ├── vba_import_gui_v2.py        # VBAインポートGUI (v2)
│   ├── README-VBA-IMPORT.md        # VBAインポート手順
│   └── vba_import_config.json      # インポート設定
│
├── archive/                        # 旧バージョン
│   └── Module1.bas                 # 旧VBAコード
│
├── .gitignore                      # Git除外設定
├── README.md                       # プロジェクトREADME
├── requirements.txt                # Python依存パッケージ
└── PROJECT_STRUCTURE.md            # このファイル
```

---

## VBA版ディレクトリ詳細

### modules/
VBAモジュールを個別のbasファイルとして管理。

**ファイル命名規則**:
- `Module_***.bas`: 機能モジュール
- Attribute VB_Name を含む

**インポート方法**:
1. Excel VBAエディタ（Alt+F11）を開く
2. ファイル → ファイルのインポート
3. 各basファイルを選択

または、`tool/vba_import_gui_v2.py`を使用

### templates/
Excelテンプレートファイル（.xltx形式）

**構造**:
- シート1: 請求書フォーム
- 11行目からデータ転記
- 列定義は要件定義書参照

### archive/
実行時に生成されるアーカイブデータ

**構造例**:
```
archive/
  └── 2025/
      └── 202502/
          ├── batch1_20250220/
          │   ├── source.csv
          │   ├── output.xlsx
          │   └── process.log
          └── batch2_20250228/
```

**注意**: `.gitignore`で除外（個人情報保護）

---

## Webアプリ版ディレクトリ詳細

### src/js/
JavaScriptモジュール

**モジュール設計**:
- ES6モジュール形式（import/export）
- 各ファイルは単一責任の原則

**依存関係**:
```
app.js
  ├── csv-parser.js
  ├── data-filter.js
  ├── excel-generator.js
  ├── archive-manager.js
  ├── config-manager.js
  └── utils.js
```

### src/css/
スタイルシート

**設計方針**:
- BEM命名規則
- レスポンシブデザイン
- CSS Grid / Flexbox使用

### tests/
ユニットテスト

**フレームワーク**: Jest または Mocha
**実行**: `npm test`

### index.html
メインHTML（シングルページアプリケーション）

**構造**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>調剤券請求書作成</title>
  <link rel="stylesheet" href="src/css/main.css">
</head>
<body>
  <div id="app">
    <!-- Vue.js / React等のマウントポイント -->
  </div>
  <script type="module" src="src/js/app.js"></script>
</body>
</html>
```

---

## 共有リソース

### shared/docs/
両バージョン共通のドキュメント

### shared/sample-data/
テスト用サンプルデータ

**ファイル**:
- 実際のCSVデータ（個人情報はダミー化）
- 期待される出力Excel

---

## 開発フロー

### VBA版
1. `vba-version/modules/`で各モジュールを編集
2. `tool/vba_import_gui_v2.py`でExcelにインポート
3. Excelでテスト実行
4. 問題なければコミット

### Webアプリ版
1. `webapp-version/src/`でコード編集
2. `npm run dev`でローカルサーバー起動
3. ブラウザでテスト
4. `npm test`でユニットテスト
5. 問題なければコミット

---

## バージョン管理

### Git管理対象
- ソースコード（.bas, .js, .css, .html）
- ドキュメント（.md）
- 設定ファイル（.json）
- サンプルデータ（個人情報なし）

### Git除外対象（.gitignore）
- アーカイブデータ（`*/archive/**`）
- 一時ファイル（`~$*.xlsx`）
- ビルド成果物（`*/dist/**`）
- 依存パッケージ（`node_modules/`）
- 環境設定（`.env`）

---

## デプロイ

### VBA版
1. `vba-version/調剤券請求書作成.xlsm`を配布
2. ユーザーはマクロを有効化して使用

### Webアプリ版
1. `webapp-version/`をビルド（`npm run build`）
2. 生成された`dist/`をローカルHTMLとして配布
3. または、Webサーバーにホスティング（イントラネット推奨）

---

## ライセンス
MIT License

## 作成者
関根 sekine53629

## 最終更新日
2025-02-15
