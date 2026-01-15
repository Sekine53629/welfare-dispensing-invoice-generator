# VBAモジュールインポート手順

バッチ書類生成システムのVBAモジュールをExcelにインポートする手順です。

## 自動インポート（推奨）

PowerShellスクリプトを使用して自動インポートします。

### 実行方法

```powershell
cd scripts
powershell -ExecutionPolicy Bypass -File Import-VBAModules.ps1
```

### スクリプトの動作

1. `.xlsm`ファイルを自動検出
2. 以下のモジュールを**新規インポート**（既存がある場合はスキップ）:
   - `CsvCacheModule.bas`
   - `BatchDocumentGenerator.bas`
3. 以下のモジュールを**更新**（既存を削除して再インポート）:
   - `PlaceholderModule.bas`
4. Excelファイルを保存
5. Excelを開いたまま終了（手動でテスト可能）

## 手動インポート

PowerShellが使えない場合は、手動でインポートできます。

### 手順

1. **Excelを開く**
   - `許認可表書き差込保存マクロ20250829.xlsm` を開く

2. **VBAエディタを開く**
   - `Alt+F11` を押す

3. **モジュールをインポート**
   - メニュー: ファイル → ファイルのインポート
   - 以下のファイルを選択してインポート:
     - `modules/CsvCacheModule.bas`
     - `modules/BatchDocumentGenerator.bas`

4. **PlaceholderModuleを更新**（既にある場合）
   - 左のプロジェクトウィンドウで `PlaceholderModule` を右クリック
   - 「PlaceholderModuleの解放」を選択して削除
   - メニュー: ファイル → ファイルのインポート
   - `modules/PlaceholderModule.bas` を選択してインポート

5. **保存**
   - `Ctrl+S` でワークブックを保存

## テスト実行

インポート後、動作確認を行います。

### 1レコードテスト

1. **イミディエイトウィンドウを開く**
   - VBAエディタで `Ctrl+G` を押す

2. **テストマクロを実行**
   - 以下をイミディエイトウィンドウに入力して Enter:
   ```vba
   BatchDocumentGenerator.TestGenerateOneDocument
   ```

3. **結果確認**
   - イミディエイトウィンドウに以下の情報が表示されます:
     - 最初のレコードの内容（店舗ID、店舗名、提出先など）
     - プレースホルダー一覧（25個）
     - プレースホルダーの値

### フルバッチ生成（実際の書類作成）

テストが成功したら、実際のバッチ生成を実行できます。

1. **Sheet 1 で実行**
   - Sheet 1 に戻る

2. **マクロ実行**
   - `Alt+F8` でマクロ一覧を開く
   - `BatchDocumentGenerator.GenerateRenewalDocumentsFromCache` を選択
   - 「実行」をクリック

3. **出力フォルダを選択**
   - ダイアログで出力先フォルダを選択

4. **生成完了**
   - 処理が完了すると、以下の統計が表示されます:
     - 成功件数
     - 失敗件数
     - テンプレート未発見件数

## 生成されるフォルダ構造

```
出力フォルダ/
  YYYYMMDD_HHMMSS/          # タイムスタンプフォルダ
    旭川市保健所_医務薬務課/  # 提出先フォルダ
      0010_閉）大町店_麻薬.docx
      0231_愛野3条店_麻薬.docx
      ...
    稚内保健所_企画総務課/
      0552_稚内新光店_麻薬.docx
      ...
```

## トラブルシューティング

### エラー: "プログラムにアクセスできません"

VBAプロジェクトへのアクセスが無効になっています。

**解決方法**:
1. Excel のオプションを開く
2. セキュリティセンター → セキュリティセンターの設定
3. マクロの設定 → 「VBA プロジェクト オブジェクト モデルへのアクセスを信頼する」にチェック

### エラー: "CSVキャッシュが空です"

CSVキャッシュファイルが生成されていません。

**解決方法**:
```bash
python scripts/generate_renewal_cache_csv.py
```

### テンプレートが見つからない

テンプレートファイルが正しい場所に配置されていません。

**確認方法**:
```powershell
python scripts/list_templates.py
```

期待される配置:
- `template/北海道/麻薬小売業者免許更新申請書.dotm`
- `template/旭川市/麻薬小売業者免許更新申請書.dotm`

## 関連ファイル

- [BATCH-GENERATOR-STATUS.md](BATCH-GENERATOR-STATUS.md) - 実装状況詳細
- [modules/CsvCacheModule.bas](modules/CsvCacheModule.bas) - CSV読み込みモジュール
- [modules/BatchDocumentGenerator.bas](modules/BatchDocumentGenerator.bas) - バッチ生成モジュール
- [modules/PlaceholderModule.bas](modules/PlaceholderModule.bas) - プレースホルダーマッピング
- [output/renewal_cache.csv](output/renewal_cache.csv) - 更新対象CSVキャッシュ
