# デプロイパッケージ - v2.1.0

**最終更新**: 2026-01-15
**バージョン**: 2.1.0
**リリースノート**: CSV列ずれ問題修正、医療機関コード自動取得、診療年月日列番号修正

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

## 🔧 v2.1.0 の主な変更点

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
| `app.js` | 列65（医療機関コード）読み込み追加 | 355 |
| `app.js` | `patient.medicalCode`プロパティ追加 | 371 |
| `app.js` | `removeLeading01()`関数追加 | 418-430 |
| `app.js` | `parseYYYYMMDD()`関数追加 | 1081-1107 |
| `app.js` | `formatMultipleTreatmentDates()`更新 | 1140-1159 |

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
**リリース日**: 2026-01-15
**バージョン**: v2.1.0

---

**🎉 デプロイ準備完了！**
