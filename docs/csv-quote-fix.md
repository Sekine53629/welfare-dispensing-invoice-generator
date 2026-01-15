# CSVパース時のシングルクォート除去修正

## 問題

CSVデータに含まれるシングルクォート（`'`）がパース後も残っていた。

### 具体的な問題データ

```
1	0412901'	佐藤 花子'	昭和35年5月10日'	'20250203'	旭川中央病院'	請求
2	0412902'	鈴木 太郎'	昭和42年8月15日'	'20250205'	医療法人社団旭川歯科医院'	請求
```

**観察**:
- 受給者番号の末尾にクォート: `0412901'`
- 氏名の末尾にクォート: `佐藤 花子'`
- 日付の前後にクォート: `'20250203'`
- 医療機関名の末尾にクォート: `旭川中央病院'`

---

## 原因分析

### 1. Papa Parseの設定問題

**変更前**:
```javascript
const config = {
  quoteChar: "'",   // シングルクォートをクォート文字として認識
  escapeChar: "'",  // シングルクォートをエスケープ文字として認識
  // ...
};
```

**問題点**:
- Papa Parseがシングルクォートを**クォート文字**として扱う
- しかし、CSVデータのクォート文字は**不完全**（開始クォートがない、終了クォートだけ）
- 例: `0412901'` → 開始クォートなし、終了クォートだけ → パースエラー回避のためクォートがそのまま残る

### 2. cleanField()の処理順問題

**変更前**:
```javascript
function cleanField(fieldValue) {
  let result = fieldValue;

  // 先頭・末尾の空白削除
  result = result.trim();

  // シングルクォート削除
  result = result.replace(/'/g, '');

  return result;
}
```

**問題点**:
- クォート削除は行っているが、Papa Parseがクォートを含んだ状態でパースしているため不完全
- 処理順序が`trim() → クォート削除`だが、`クォート削除 → trim()`の方が適切

---

## 修正内容

### 修正1: Papa Parse設定変更

**ファイル**: `csv-parser.js`

**変更後**:
```javascript
const config = {
  delimiter: ',',
  newline: '\r\n',
  quoteChar: '"',        // ダブルクォートをクォート文字に変更
  escapeChar: '"',       // ダブルクォートをエスケープ文字に変更
  header: false,
  dynamicTyping: false,
  // ...
};
```

**効果**:
- シングルクォートは**通常の文字**として扱われる
- ダブルクォートのみがクォート文字として認識される
- CSVデータ内のシングルクォートがそのままフィールド値に含まれる
- `cleanField()`でシングルクォートを削除できる

---

### 修正2: cleanField()の改善

**ファイル**: `csv-parser.js`

**変更後**:
```javascript
/**
 * フィールド値のクリーニング
 * @param {string} fieldValue - フィールド値
 * @returns {string} クリーニング済み文字列
 */
function cleanField(fieldValue) {
  if (!fieldValue) return '';

  let result = String(fieldValue);

  // すべてのクォート文字を削除（シングル、ダブル、バッククォート）
  result = result.replace(/['"`]/g, '');

  // 先頭・末尾の空白削除
  result = result.trim();

  return result;
}
```

**変更点**:
1. **null/undefined チェック追加**: `if (!fieldValue) return '';`
2. **String型変換**: `String(fieldValue)`で確実に文字列化
3. **すべてのクォート削除**: `/['"`]/g` でシングル・ダブル・バッククォート全削除
4. **処理順序変更**: クォート削除 → trim（クォート削除を先に）

---

### 修正3: utils.jsのfixKana()改善

**ファイル**: `utils.js`

**変更後**:
```javascript
/**
 * カナ文字・記号の変換処理
 * - すべてのクォート削除（シングル、ダブル、バッククォート）
 * - 括弧の置換 ( → / , ) → 削除
 * - 半角カナ → 全角カナ変換
 * @param {string} inputStr - 入力文字列
 * @returns {string} 変換済み文字列
 */
export function fixKana(inputStr) {
  if (!inputStr) return '';

  let result = String(inputStr);

  // すべてのクォート文字を削除（シングル、ダブル、バッククォート）
  result = result.replace(/['"`]/g, '');

  // 括弧処理
  result = result.replace(/\(/g, '/');
  result = result.replace(/\)/g, '');

  // 半角カナ → 全角カナ変換
  result = convertHankakuToZenkaku(result);

  return result;
}
```

**変更点**:
1. **null/undefined チェック追加**
2. **String型変換**
3. **すべてのクォート削除**: シングル・ダブル・バッククォート全削除

---

### 修正4: utils.jsのtrimSpaces()改善

**ファイル**: `utils.js`

**変更後**:
```javascript
/**
 * 空白文字の削除（先頭・末尾・連続）
 * @param {string} inputStr - 入力文字列
 * @returns {string} トリム済み文字列
 */
export function trimSpaces(inputStr) {
  if (!inputStr) return '';

  let result = String(inputStr);

  // 先頭・末尾の空白削除
  result = result.trim();

  // 連続する空白を1つに
  result = result.replace(/\s+/g, ' ');

  return result;
}
```

**変更点**:
1. **null/undefined チェック追加**
2. **String型変換**

---

### 修正5: fixKanaAndTrim()改善

**ファイル**: `utils.js`

**変更後**:
```javascript
/**
 * fixKanaとtrimSpacesの組み合わせ
 * @param {string} inputStr - 入力文字列
 * @returns {string} 変換・トリム済み文字列
 */
export function fixKanaAndTrim(inputStr) {
  if (!inputStr) return '';
  return trimSpaces(fixKana(inputStr));
}
```

**変更点**:
1. **null/undefined チェック追加**

---

## 処理フロー

### Before（修正前）

```
CSVファイル
  ↓
Papa Parse（quoteChar: "'"）
  - シングルクォートをクォート文字として認識
  - 不完全なクォートが残る
  ↓
cleanField()
  - trim()
  - replace(/'/g, '')  ← クォート削除
  ↓
fixKanaAndTrim()
  - fixKana() → replace(/'/g, '')  ← 再度クォート削除
  - trimSpaces()
  ↓
結果: 一部のクォートが残る可能性
```

### After（修正後）

```
CSVファイル
  ↓
Papa Parse（quoteChar: "\""）
  - シングルクォートは通常文字として扱う
  - フィールド値にそのまま含まれる
  ↓
cleanField()
  - null/undefinedチェック
  - String()変換
  - replace(/['"`]/g, '')  ← すべてのクォート削除
  - trim()
  ↓
fixKanaAndTrim()
  - null/undefinedチェック
  - fixKana() → replace(/['"`]/g, '')  ← ダブルチェック
  - trimSpaces()
  ↓
結果: すべてのクォートが確実に削除される
```

---

## テスト

### 入力データ

```csv
1,0412901',佐藤 花子',昭和35年5月10日','20250203',旭川中央病院',請求
```

### 期待される出力

**受給者番号（列1）**: `0412901` （クォートなし）
**氏名（列2）**: `佐藤 花子` （クォートなし）
**生年月日（列3）**: `昭和35年5月10日` （クォートなし）
**診療日（列4）**: `20250203` （クォートなし）
**医療機関名（列5）**: `旭川中央病院` （クォートなし）

### 検証方法

1. ブラウザで開発者ツールを開く（F12）
2. Consoleタブを開く
3. CSVアップロード後、以下を実行:
   ```javascript
   console.log(currentFilteredPatients.target[0]);
   ```
4. 各フィールドにクォートが含まれていないことを確認

---

## 影響範囲

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| **csv-parser.js** | Papa Parse設定変更、cleanField()改善 |
| **utils.js** | fixKana()、trimSpaces()、fixKanaAndTrim()改善 |

### 影響を受ける処理

1. **CSVパース** - すべてのフィールドでクォート削除が確実に
2. **データクリーニング** - より堅牢なnull/undefinedチェック
3. **Excel出力** - クォートのないクリーンなデータが書き込まれる

---

## 副次的な効果

### 1. null/undefinedに対する安全性向上

すべてのクリーニング関数が`null`や`undefined`を安全に処理できるようになった。

### 2. 型安全性向上

`String()`変換により、数値や他の型が渡されても安全に処理される。

### 3. ダブルクォート・バッククォートにも対応

将来的にダブルクォート（`"`）やバッククォート（`` ` ``）が混入した場合も対応可能。

---

## まとめ

### 修正前の問題

✗ シングルクォートが残る
✗ null/undefinedでエラーの可能性
✗ Papa Parse設定が不適切

### 修正後

✅ すべてのクォート文字を確実に削除
✅ null/undefinedを安全に処理
✅ Papa Parse設定を最適化
✅ ダブル・バッククォートにも対応
✅ 型安全性が向上

---

**Document Version**: 1.0
**Last Updated**: 2025-02-15
**Author**: 関根 (sekine53629)
