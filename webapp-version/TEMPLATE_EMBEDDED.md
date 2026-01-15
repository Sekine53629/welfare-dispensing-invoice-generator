# 組み込みテンプレートについて

## 概要

旭川市公式の調剤券請求用Excelテンプレート（`tyouzai_excel_v2.xlsx`）をWebアプリに組み込みました。

## 実装内容

### 1. テンプレートファイル配置

**ファイルパス**: `webapp-version/template/tyouzai_excel_v2.xlsx`

公式ダウンロードURL:
https://www.city.asahikawa.hokkaido.jp/kurashi/135/189/190/d080493_d/fil/tyouzai_excel_v2.xlsx

### 2. 自動読み込み

アプリケーション起動時に、組み込みテンプレートを自動的に読み込みます。

**実装箇所**: `src/js/app.js`

```javascript
// 組み込みテンプレートパス
const EMBEDDED_TEMPLATE_PATH = './template/tyouzai_excel_v2.xlsx';

// 初期化時に自動読み込み
async function initializeApp() {
  await loadEmbeddedTemplate();
  // ...
}

// fetchでテンプレートを読み込み
async function loadEmbeddedTemplate() {
  const response = await fetch(EMBEDDED_TEMPLATE_PATH);
  const arrayBuffer = await response.arrayBuffer();
  currentTemplateBuffer = arrayBuffer;
}
```

### 3. UI変更

**設定タブ**のテンプレート選択部分を、情報表示のみに変更：

- ❌ 削除: ファイル選択input (`<input type="file">`)
- ❌ 削除: テンプレート選択イベントリスナー (`handleTemplateSelect`)
- ✅ 追加: 組み込みテンプレート使用中の表示
- ✅ 追加: 公式ダウンロードリンク

### 4. メリット

#### ユーザー視点
- ✅ **テンプレート選択不要**: 毎回ファイルを選ぶ手間が不要
- ✅ **常に最新版**: 組み込み時点の公式テンプレート使用
- ✅ **ミス防止**: 誤ったテンプレートの選択を防止
- ✅ **即座に使用可能**: アプリ起動後すぐに請求書作成可能

#### 開発・運用視点
- ✅ **シンプルな構成**: テンプレート管理の複雑さ解消
- ✅ **エラー削減**: テンプレート未選択エラーの撲滅
- ✅ **一貫性**: すべてのユーザーが同じテンプレートを使用

## ファイル構成

```
webapp-version/
├── index.html              # テンプレート情報表示（選択機能削除）
├── template/
│   └── tyouzai_excel_v2.xlsx  # 組み込みテンプレート（新規追加）
└── src/
    ├── js/
    │   └── app.js          # 自動読み込み処理追加
    └── css/
        └── components.css  # info-box.success スタイル追加
```

## テンプレート更新方法

旭川市が公式テンプレートを更新した場合：

1. **新しいテンプレートをダウンロード**
   ```bash
   curl -o webapp-version/template/tyouzai_excel_v2.xlsx \
     "https://www.city.asahikawa.hokkaido.jp/kurashi/135/189/190/d080493_d/fil/tyouzai_excel_v2.xlsx"
   ```

2. **ファイルを上書き**（ファイル名は同じ）
   - `webapp-version/template/tyouzai_excel_v2.xlsx`

3. **ブラウザキャッシュクリア**
   - Ctrl+Shift+R（強制リロード）で新しいテンプレートが読み込まれる

## 注意事項

⚠️ **ブラウザのキャッシュ**

テンプレートファイルはブラウザにキャッシュされる可能性があります。
テンプレート更新後は、ユーザーにハードリフレッシュ（Ctrl+Shift+R）を案内してください。

⚠️ **ローカルファイル実行**

`file://` プロトコルでは、セキュリティ制約によりfetchが機能しない場合があります。
必ずHTTPサーバー経由で実行してください：

```bash
# 簡易HTTPサーバー起動例
cd webapp-version
python -m http.server 8000
# http://localhost:8000 でアクセス
```

⚠️ **テンプレート形式**

旭川市の公式テンプレート形式が大幅に変更された場合、
`src/js/excel-generator.js` のデータ書き込みロジックも更新が必要です。

## 変更ファイル一覧

### 新規作成
- `webapp-version/template/tyouzai_excel_v2.xlsx`

### 変更
- `webapp-version/index.html` - テンプレート選択UI → 情報表示
- `webapp-version/src/js/app.js` - 自動読み込み処理追加
- `webapp-version/src/css/components.css` - `info-box.success` スタイル追加

### 削除コード
- `handleTemplateSelect()` 関数（app.js）
- テンプレートファイル選択input（index.html）
- テンプレート選択イベントリスナー（app.js）

## 検証方法

1. **ブラウザのコンソールを開く**（F12）
2. **初期化ログを確認**
   ```
   組み込みテンプレートを読み込み中...
   ✅ 組み込みテンプレート読み込み完了
   ```
3. **設定タブを確認**
   - 「✅ 旭川市公式テンプレートを使用」が表示される
   - ファイル選択inputが存在しない
4. **CSVアップロード → Excel出力**
   - テンプレート未選択エラーが発生しない
   - 正常にExcelファイルが生成される
