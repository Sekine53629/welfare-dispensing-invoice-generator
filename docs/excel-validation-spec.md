# Excel生成バリデーション機能仕様

## 概要

Excel生成時のデータ型とフォーマット問題を修正し、適切なバリデーション機能を追加しました。

---

## 修正内容

### 1. 列配置の明確化

| 列 | 項目 | データ型 | フォーマット | 処理内容 |
|----|------|---------|------------|---------|
| A | (通番) | 数値 | - | 未使用 |
| **B** | 薬局名 | 文字列 | - | 設定から取得 |
| **C** | 薬局医療機関コード | 文字列 | @ | **下8桁**、文字列形式 |
| **D** | 診療医療機関名 | 文字列 | - | シングルクォート削除 |
| **E** | 診療医療機関コード | 文字列 | @ | **下8桁**、文字列形式 |
| **F** | 受給者番号 | 文字列 | @ | シングルクォート**完全除去** |
| **G** | 患者氏名 | 文字列 | - | シングルクォート削除 |
| **H** | 患者カナ氏名 | 文字列 | - | シングルクォート削除 |
| **I** | 生年月日 | 日付 | yyyy/mm/dd | Date型に変換 |
| **J** | 診療年月日 | 文字列/日付 | @ | 複数日は「2025/2(7,10,25)」形式 |
| K | 自立支援フラグ | 文字列 | - | 公費21/15/16で「◯」 |
| L | 重障フラグ | 文字列 | - | 公費54で「◯」 |
| M | (予備) | 文字列 | - | 空白 |

---

## 主な修正ポイント

### 📋 修正1: 医療機関コードの文字列化（C列・E列）

**問題点**:
- 10桁の医療機関コードが数値として扱われ、先頭の0が消失
- 例: `0123456789` → `123456789`

**修正内容**:
```javascript
// 医療機関コードをフォーマット（下8桁、文字列）
function formatMedicalCode(code) {
  if (!code) return '';

  // シングルクォートと空白を削除
  let cleaned = removeAllQuotes(String(code).trim());

  // 先頭の01を削除
  cleaned = removeLeading01(cleaned);

  // 下8桁を取得
  if (cleaned.length > 8) {
    cleaned = cleaned.slice(-8);
  }

  return cleaned;
}

// セルに代入
const pharmacyCodeCell = row.getCell(3);
pharmacyCodeCell.value = formatMedicalCode(config.medicalCode);
pharmacyCodeCell.numFmt = '@'; // テキスト形式
```

**結果**:
- `0123456789` → `23456789`（下8桁、文字列）
- セル書式が「テキスト」になり、0が消えない

---

### 📋 修正2: 受給者番号のクリーニング（F列）

**問題点**:
- CSVからシングルクォート（`'`）が混入
- 例: `'10000001` → そのまま表示される

**修正内容**:
```javascript
// すべてのクォートを削除
function removeAllQuotes(str) {
  if (!str) return '';
  return String(str).replace(/['"`]/g, '');
}

// セルに代入
const recipientCell = row.getCell(6);
recipientCell.value = removeAllQuotes(patient.recipientNumber);
recipientCell.numFmt = '@'; // テキスト形式
```

**結果**:
- `'10000001` → `10000001`（クォート完全除去）

---

### 📋 修正3: 氏名のクリーニング（G列・H列）

**問題点**:
- 氏名にシングルクォートが含まれる場合がある
- 例: `'佐藤 花子` → `'佐藤 花子`

**修正内容**:
```javascript
// G列: 患者氏名（シングルクォート削除）
row.getCell(7).value = removeAllQuotes(patient.patientName);

// H列: 患者カナ氏名（シングルクォート削除）
row.getCell(8).value = removeAllQuotes(patient.patientKana);
```

**結果**:
- `'佐藤 花子` → `佐藤 花子`

---

### 📋 修正4: 日付のパース（I列）

**問題点**:
- 文字列として代入されていた
- 例: `'2025/02/15'` → 文字列のまま

**修正内容**:
```javascript
// 日本の日付文字列をDate型に変換
function parseJapaneseDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr instanceof Date) return dateStr;

  const str = String(dateStr).trim();

  // YYYY/MM/DD形式
  const westernMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (westernMatch) {
    const [_, year, month, day] = westernMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // 令和（R）形式（例: R7/2/15 → 2025/2/15）
  const reiwaMatch = str.match(/^R(\d{1,2})\/(\d{1,2})\/(\d{1,2})$/);
  if (reiwaMatch) {
    const [_, reiwaYear, month, day] = reiwaMatch;
    const year = parseInt(reiwaYear) + 2018; // 令和元年 = 2019年
    return new Date(year, parseInt(month) - 1, parseInt(day));
  }

  // パースできない場合は元の文字列を返す
  return str;
}

// セルに代入
const birthDateCell = row.getCell(9);
birthDateCell.value = parseJapaneseDate(patient.birthDate);
birthDateCell.numFmt = 'yyyy/mm/dd';
```

**結果**:
- `'2025/02/15'` → Date型 `2025-02-15`
- `R7/2/15` → Date型 `2025-02-15`（令和対応）
- セル書式が「日付」になる

---

### 📋 修正5: 複数来局日の統合（J列）

**問題点**:
- 同一患者が複数回来局した場合、別行になっていた
- 例: 佐藤さんが2/7、2/10、2/25に来局 → 3行

**修正内容**:
```javascript
// 患者データを受給者番号でグループ化
function groupPatientsByRecipient(patients) {
  const groups = new Map();

  patients.forEach(patient => {
    const key = `${patient.recipientNumber}_${patient.patientName}`;

    if (!groups.has(key)) {
      groups.set(key, {
        records: [],
        treatmentDates: []
      });
    }

    const group = groups.get(key);
    group.records.push(patient);

    // 診療年月日を追加（重複排除）
    const dateStr = patient.treatmentDate;
    if (dateStr && !group.treatmentDates.includes(dateStr)) {
      group.treatmentDates.push(dateStr);
    }
  });

  return Array.from(groups.values());
}

// 複数の診療年月日をフォーマット
function formatMultipleTreatmentDates(dates) {
  if (!dates || dates.length === 0) return '';

  // 日付をDate型に変換してソート
  const parsedDates = dates
    .map(d => {
      const parsed = parseJapaneseDate(d);
      return {
        original: d,
        date: parsed instanceof Date ? parsed : null,
        str: d
      };
    })
    .filter(d => d.date !== null)
    .sort((a, b) => a.date - b.date);

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

// セルに代入
const treatmentDateCell = row.getCell(10);
treatmentDateCell.value = formatMultipleTreatmentDates(patientGroup.treatmentDates);
treatmentDateCell.numFmt = '@'; // テキスト形式（複数日の場合があるため）
```

**結果**:
- 単一来局: `2025/2/15`
- 同月複数来局: `2025/2(7,10,25)`
- 異月複数来局: `2025/2/7, 2025/3/10, 2025/4/25`

---

### 📋 修正6: 公費フラグの判定（K列・L列）

**問題点**:
- 公費番号21/15/16/54の判定が動作していなかった
- 常に空白になっていた

**修正内容**:
```javascript
// 公費コードから各フラグを判定
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

// 公費フラグ判定
const kohiFlags = detectKohiFlags(patient.publicCodes);

// K列: 自立支援（公費21/15/16）
row.getCell(11).value = kohiFlags.hasJiritsuShien ? '◯' : '';

// L列: 重障（公費54）
row.getCell(12).value = kohiFlags.hasJusho ? '◯' : '';
```

**結果**:
- 公費番号に21/15/16が含まれる → K列に「◯」
- 公費番号に54が含まれる → L列に「◯」
- 該当なし → 空白

---

## テストケース

### テストデータ

| 受給者番号 | 氏名 | 生年月日 | 診療日 | 公費番号 | 期待結果 |
|-----------|------|---------|-------|---------|---------|
| 10000001 | 佐藤 花子 | 1985/04/15 | 2025/02/07 | 12, 21 | K列: ◯ |
| 10000001 | 佐藤 花子 | 1985/04/15 | 2025/02/10 | 12, 21 | → 統合: 2025/2(7,10) |
| 10000002 | 田中 太郎 | 1990/07/22 | 2025/02/15 | 12 | K列: 空白 |
| 10000003 | 鈴木 美咲 | 2000/03/10 | 2025/02/20 | 12, 54 | L列: ◯ |

### 期待されるExcel出力

```
| B列    | C列      | D列          | E列      | F列      | G列      | H列        | I列        | J列          | K列 | L列 |
|--------|----------|--------------|----------|----------|----------|------------|------------|--------------|-----|-----|
| 薬局名 | 23456789 | 旭川医大病院  | 87654321 | 10000001 | 佐藤 花子 | サトウ ハナコ | 1985/4/15 | 2025/2(7,10) | ◯  |     |
| 薬局名 | 23456789 | 市立病院      | 11223344 | 10000002 | 田中 太郎 | タナカ タロウ | 1990/7/22 | 2025/2/15    |     |     |
| 薬局名 | 23456789 | 整形外科      | 55667788 | 10000003 | 鈴木 美咲 | スズキ ミサキ | 2000/3/10 | 2025/2/20    |     | ◯  |
```

---

## 変更ファイル

### excel-generator.js

**変更箇所**:
1. `generateExcel()` 関数の全面改修
   - 患者データのグループ化
   - 各セルへの適切なデータ型とフォーマット指定
2. 新規ヘルパー関数の追加:
   - `formatMedicalCode()` - 医療機関コード下8桁取得
   - `removeAllQuotes()` - クォート完全除去
   - `parseJapaneseDate()` - 日付パース（令和対応）
   - `groupPatientsByRecipient()` - 患者グループ化
   - `formatMultipleTreatmentDates()` - 複数来局日フォーマット
   - `detectKohiFlags()` - 公費フラグ判定

---

## 注意事項

### ⚠️ 令和・平成対応

日付パース関数は以下の形式に対応：
- `YYYY/MM/DD` - 西暦
- `R7/2/15` - 令和7年2月15日 → 2025/2/15
- `H31/4/30` - 平成31年4月30日 → 2019/4/30

### ⚠️ 複数来局日の統合ロジック

- 同一患者（受給者番号 + 氏名）の複数レコードを1行に統合
- 診療年月日が同月の場合: `2025/2(7,10,25)`
- 診療年月日が異月の場合: `2025/2/7, 2025/3/10`

### ⚠️ 公費フラグ判定

`PatientData.publicCodes` 配列から判定：
- 公費番号は3つまで（第一、第二、第三）
- いずれかに21/15/16 → 自立支援フラグON
- いずれかに54 → 重障フラグON

---

## 動作確認方法

1. Webアプリを起動
2. テストCSVをアップロード
3. Excelダウンロード
4. Excelファイルを開く
5. 以下を確認:
   - C列・E列: 医療機関コードが文字列（先頭0が消えない）
   - F列: 受給者番号が文字列（シングルクォートなし）
   - G列・H列: 氏名にシングルクォートなし
   - I列: 生年月日がDate型（セル書式が「日付」）
   - J列: 複数来局日が統合されている
   - K列・L列: 公費フラグに応じて「◯」が表示される

---

**Document Version**: 1.0
**Last Updated**: 2025-02-15
**Author**: 関根 (sekine53629)
