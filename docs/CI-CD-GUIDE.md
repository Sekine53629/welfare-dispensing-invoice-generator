# CI/CDガイド - welfare-dispensing-invoice-generator

## 概要

このプロジェクトには完全な自動化されたCI/CDパイプラインが実装されています。

## 自動化されたワークフロー

### テスト自動化

すべてのプッシュとプルリクエストで自動的に実行されます：

```yaml
# .github/workflows/test-and-deploy.yml
on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]
  workflow_dispatch:  # 手動実行も可能
```

### ジョブ構成

#### 1. Test Job (Ubuntu)

```bash
# ユニットテスト: 16テスト
- simpleHash() 関数テスト (5)
- fixKanaAndTrim() 関数テスト (4)
- ファイル構造テスト (5)
- 重複チェックキーフォーマットテスト (2)

# 統合テスト: 14テスト
- CSV処理テスト (3)
- バージョン整合性テスト (3)
- コード品質テスト (3)
- ドキュメントテスト (3)
- セキュリティテスト (2)
```

**実行時間**: 約20秒

#### 2. Build Job (Windows)

```powershell
# ZIPパッケージ作成
powershell -ExecutionPolicy Bypass -File create-standalone-zip.ps1

# 成果物:
# - welfare-invoice-generator-standalone-v2.1.4.zip (約0.04MB)
# - 含まれるファイル:
#   - app.js (49,677 bytes)
#   - index.html (40,398 bytes)
#   - template-data.js (38,875 bytes)
#   - README.md (10,072 bytes)
```

**実行時間**: 約1分

#### 3. Validate Code Job (Ubuntu)

```bash
# ESLintによるコード品質チェック
eslint app.js --config .eslintrc.json

# TODO/FIXMEコメント検索
grep -rn "TODO\|FIXME" standalone-app/ webapp-version/

# ファイルサイズチェック
stat app.js  # < 100KB であること
```

**実行時間**: 約10秒

## ローカル開発フロー

### 1. 機能開発

```bash
# ブランチ作成
git checkout -b feature/new-feature

# 開発作業
# ... コード編集 ...

# テスト実行
cd test
npm test                  # ユニットテストのみ
npm run test:integration  # 統合テストのみ
npm run test:all          # すべてのテスト
```

### 2. コミット前チェック

```bash
# 必須: テストをすべて実行
cd test && npm run test:all

# 期待される結果:
# tests 30 (16 unit + 14 integration)
# pass 30
# fail 0
```

### 3. プッシュ

```bash
# ステージング
git add .

# コミット
git commit -m "feat: 新機能の説明"

# プッシュ
git push origin feature/new-feature
```

### 4. GitHub Actions確認

1. GitHubリポジトリの「Actions」タブを開く
2. 最新のワークフロー実行を確認
3. 各ジョブ（test, build, validate-code）が成功していることを確認

### 5. プルリクエスト

```bash
# GitHub UIでプルリクエスト作成
# → 自動的にテストが実行される
# → すべてのチェックが成功したらマージ可能
```

## リリースプロセス

### バージョンアップ手順

#### 1. バージョン番号決定

セマンティックバージョニング（SemVer）に従う：

- **MAJOR**: 破壊的変更 (例: 2.0.0 → 3.0.0)
- **MINOR**: 新機能追加 (例: 2.1.4 → 2.2.0)
- **PATCH**: バグ修正 (例: 2.1.4 → 2.1.5)

#### 2. バージョン番号更新

```bash
# 以下のファイルを更新
1. create-standalone-zip.ps1  (line 2: Version)
2. test/package.json          (line 3: version)
3. README.md                  (変更履歴セクション)
4. DEPLOY.md                  (ヘッダー、変更点セクション)
```

#### 3. テスト実行

```bash
cd test
npm run test:all
# → すべてのテストが成功することを確認
```

#### 4. コミット＆プッシュ

```bash
git add .
git commit -m "chore: bump version to v2.1.5"
git push origin master
```

#### 5. タグ作成

```bash
# タグ作成
git tag v2.1.5

# タグプッシュ
git push --tags
```

#### 6. 自動リリース

タグをプッシュすると、GitHub Actionsが自動的に：

1. ZIPパッケージをビルド
2. GitHub Releasesにリリースを作成
3. ZIPファイルを添付

## トラブルシューティング

### テスト失敗

```bash
# 詳細ログで実行
npm test -- --reporter=spec

# 特定のテストファイルのみ
node --test test-unit.js

# 構文チェック
node -c test-unit.js
```

### ビルド失敗

```bash
# PowerShellスクリプトを手動実行
powershell -ExecutionPolicy Bypass -File create-standalone-zip.ps1

# ZIPの内容確認
powershell -Command "Expand-Archive welfare-invoice-generator-standalone-v2.1.4.zip -DestinationPath temp"
ls temp
```

### GitHub Actions失敗

1. **Actionsタブ**で失敗したワークフローを開く
2. **失敗したジョブ**をクリック
3. **ログ**を確認してエラー原因を特定

よくあるエラー：

- **テスト失敗**: ローカルで`npm run test:all`を実行して修正
- **ビルド失敗**: create-standalone-zip.ps1のバージョン番号確認
- **バージョン不一致**: package.jsonとcreate-standalone-zip.ps1のバージョンを合わせる

## ベストプラクティス

### 1. プッシュ前のチェックリスト

- [ ] ローカルで`npm run test:all`が成功
- [ ] バージョン番号が一致（package.json, create-standalone-zip.ps1, README.md, DEPLOY.md）
- [ ] 変更履歴がREADME.mdとDEPLOY.mdに記載されている
- [ ] DEBUG/FIXME/TODOコメントが残っていない

### 2. コミットメッセージ規約

Conventional Commits形式を推奨：

```
feat: 新機能追加
fix: バグ修正
docs: ドキュメント更新
test: テスト追加・修正
refactor: リファクタリング
chore: ビルド・ツール関連の変更
```

例：
```bash
git commit -m "feat: 患者氏名ハッシュ化機能を追加"
git commit -m "fix: 重複チェックロジックの月単位対応"
git commit -m "docs: CI/CDガイドを追加"
```

### 3. プルリクエスト

**タイトル**: 何を変更したか明確に

**説明テンプレート**:
```markdown
## 変更内容
- 患者氏名ハッシュ化機能を追加
- 重複チェックキーを年月+氏名ハッシュ+医療機関コードに変更

## テスト結果
- ユニットテスト: 16/16 成功
- 統合テスト: 14/14 成功

## 影響範囲
- standalone-app/app.js
- test/test-unit.js

## 備考
- v2.1.4としてリリース予定
```

### 4. コードレビュー

レビュアーがチェックすべき項目：

- [ ] テストが追加されているか
- [ ] ドキュメントが更新されているか
- [ ] console.logデバッグが残っていないか
- [ ] セキュリティ上の問題がないか
- [ ] パフォーマンスへの影響がないか

## メトリクス

### コード品質指標

- **テストカバレッジ**: 主要機能（simpleHash, fixKanaAndTrim, 重複チェック）
- **テスト実行時間**: < 1分
- **ビルド時間**: < 2分
- **app.jsファイルサイズ**: < 100KB

### CI/CD指標

- **ビルド成功率**: 目標 > 95%
- **テスト成功率**: 目標 100%
- **デプロイ頻度**: 必要に応じて（通常週1回程度）

## セキュリティ

### 自動チェック

統合テストでセキュリティ要件を検証：

```javascript
// 患者氏名ハッシュ化テスト
test('患者氏名がハッシュ化されている（平文保存なし）', () => {
    // localStorage保存時に平文の患者名が使われていないことを確認
});

// 医療機関コード検証テスト
test('医療機関コードの検証が実装されている', () => {
    // 先頭文字が1/3/4であることを検証
});
```

### 手動チェック

リリース前に確認：

- [ ] 患者データがハッシュ化されている
- [ ] エラーメッセージに個人情報が含まれていない
- [ ] localStorageに平文の個人情報が保存されていない

## ロールバック手順

問題が発生した場合：

### 1. 前バージョンに戻す

```bash
# 前のタグをチェックアウト
git checkout v2.1.3

# 新しいブランチ作成
git checkout -b hotfix/rollback-to-2.1.3

# 修正をコミット
git commit -m "hotfix: rollback to v2.1.3 due to critical bug"

# プッシュ
git push origin hotfix/rollback-to-2.1.3
```

### 2. GitHub Releasesから旧版をダウンロード

1. GitHubの「Releases」タブを開く
2. 安定版（例: v2.1.3）を探す
3. ZIPファイルをダウンロード
4. ユーザーに配布

## サポート

### ドキュメント

- [テスト環境README](../test/README.md)
- [デプロイガイド](../DEPLOY.md)
- [仕様書](../docs/SPECIFICATION.md)

### 問い合わせ

- **GitHub Issues**: バグ報告・機能要望
- **GitHub Discussions**: 質問・議論
- **開発者**: 関根 (sekine53629)

---

**最終更新**: 2026-01-17
**バージョン**: 2.1.4
