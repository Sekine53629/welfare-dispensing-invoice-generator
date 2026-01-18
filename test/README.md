# テスト環境 - welfare-dispensing-invoice-generator

## 概要

このディレクトリには、welfare-dispensing-invoice-generator プロジェクトの自動テストスイートが含まれています。

## テストの種類

### 1. ユニットテスト (`test-unit.js`)

個別の関数をテストします：

- **simpleHash()**: 患者氏名のハッシュ化関数
- **fixKanaAndTrim()**: 半角カナ→全角カナ変換関数
- **ファイル構造**: 必要なファイルが存在するか確認
- **重複チェックキー**: 正しいフォーマットか確認

### 2. 統合テスト (`test-integration.js`)

システム全体の動作をテストします：

- **CSV処理**: HRフォーマットの解析
- **バージョン整合性**: package.json, README.md, DEPLOY.md のバージョン一致
- **コード品質**: デバッグログ残留、ファイルサイズチェック
- **ドキュメント**: 必要なドキュメントが存在し、内容が充実しているか
- **セキュリティ**: 患者氏名ハッシュ化、医療機関コード検証

## 実行方法

### ローカル環境

```bash
# テストディレクトリに移動
cd test

# 依存関係インストール（初回のみ）
npm install

# ユニットテストのみ実行
npm test

# 統合テストのみ実行
npm run test:integration

# すべてのテスト実行
npm run test:all
```

### GitHub Actions（CI/CD）

プッシュまたはプルリクエスト時に自動的に実行されます：

```yaml
# .github/workflows/test-and-deploy.yml で定義
on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]
```

## テスト結果の確認

### ローカル実行

```bash
$ npm test
✅ All unit tests completed
✓ simpleHash() function tests (5 tests)
✓ fixKanaAndTrim() function tests (4 tests)
✓ File structure tests (5 tests)
✓ Duplicate key format tests (2 tests)

Tests passed: 16/16
```

### GitHub Actions

1. GitHubリポジトリの「Actions」タブを開く
2. 最新のワークフロー実行を確認
3. 各ジョブ（test, build, validate-code）の結果を確認

## テストカバレッジ

| カテゴリ | テスト数 | カバレッジ |
|---------|---------|-----------|
| ユニットテスト | 16 | 関数レベル |
| 統合テスト | 12 | システムレベル |
| セキュリティテスト | 2 | セキュリティ要件 |
| **合計** | **30** | **主要機能** |

## テスト追加ガイド

### 新しいユニットテストの追加

```javascript
// test-unit.js に追加
describe('新しい関数のテスト', () => {
    test('テストケース1', () => {
        // テストコード
        assert.strictEqual(actual, expected);
    });
});
```

### 新しい統合テストの追加

```javascript
// test-integration.js に追加
describe('新しい統合テスト', () => {
    test('テストケース1', () => {
        // ファイル読み込み、複数モジュール連携テスト
        assert.ok(condition, 'エラーメッセージ');
    });
});
```

## CI/CDパイプライン

### ワークフロー構成

```
┌─────────────┐
│  git push   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  GitHub Actions Workflow            │
│                                     │
│  1. test (Ubuntu)                   │
│     - ユニットテスト実行             │
│     - 統合テスト実行                 │
│     - テスト結果アップロード          │
│                                     │
│  2. build (Windows)                 │
│     - ZIPパッケージ作成              │
│     - アーティファクトアップロード     │
│     - リリース作成（タグ付き時）      │
│                                     │
│  3. validate-code (Ubuntu)          │
│     - ESLint実行                    │
│     - TODO/FIXMEチェック            │
│     - ファイルサイズチェック          │
└─────────────────────────────────────┘
```

### リリースプロセス

1. **開発**: feature ブランチで開発
2. **テスト**: ローカルで `npm run test:all` 実行
3. **プッシュ**: masterブランチにプッシュ
4. **自動テスト**: GitHub Actionsが自動実行
5. **タグ作成**: `git tag v2.1.4 && git push --tags`
6. **自動リリース**: ZIPファイルが自動的にGitHub Releasesに公開

## トラブルシューティング

### テスト失敗時の対処

```bash
# 詳細ログを表示
npm test -- --reporter=spec

# 特定のテストのみ実行
node --test test-unit.js

# テストファイルの構文チェック
node -c test-unit.js
```

### よくあるエラー

**Error: Cannot find module**
```bash
# 依存関係を再インストール
rm -rf node_modules
npm install
```

**Assertion failed**
```bash
# app.js を確認し、テストが期待する実装になっているか確認
cat ../standalone-app/app.js | grep -A5 "simpleHash"
```

## ベストプラクティス

1. **テスト駆動開発（TDD）**: 機能実装前にテストを書く
2. **高速実行**: テストは5秒以内に完了すべき
3. **独立性**: 各テストは他のテストに依存しない
4. **明確な命名**: テスト名は何をテストするか明確に
5. **エッジケース**: 境界値、null、空文字列などもテスト

## 参考資料

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ESLint Rules](https://eslint.org/docs/rules/)
