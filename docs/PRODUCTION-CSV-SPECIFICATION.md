# Production CSV Specification (本番CSVデータ仕様)

**Document Version**: 1.0
**Last Updated**: 2026-01-15
**Author**: Claude Code Analysis based on VBA Module1.bas

## Overview

This document specifies the production CSV format based on reverse-engineering the VBA implementation in `archive/Module1.bas`. This analysis resolves discrepancies between the VBA and JavaScript implementations.

---

## CSV File Format

### Basic Structure
- **Total Columns**: 70 (A1:BR)
- **Header Row**: Row 1 (column numbers: 1, 2, 3, ..., 70)
- **Data Rows**: Starting from row 2
- **Row 8**: Item names row (項目解析結果) - should be skipped during parsing
- **Encoding**: Shift-JIS

### Quote Handling
- **String fields**: Enclosed in single quotes `'...'` OR incomplete quotes (closing only: `....'`)
- **Numeric fields**: No quotes
- **Preprocessing Required**: Remove ALL single quotes before parsing to avoid field merging

---

## Column Mapping (VBA → Excel Output)

Based on `ExportTyouzaiken()` subroutine (lines 82-189):

| Excel Column | Description | CSV Column | VBA Code Line | Processing Function | Notes |
|--------------|-------------|------------|---------------|---------------------|-------|
| A (1) | 連番 | - | - | Auto-numbered | - |
| B (2) | 薬局名 | - | 165 | - | From `ThisWorkbook.Sheets(1).Cells(1, 2)` |
| C (3) | 薬局医療機関コード | - | 161 | `RemoveLeading01()` | From `ThisWorkbook.Sheets(1).Cells(2, 2)` |
| D (4) | 医療機関名 | 34 | 166 | `TrimSpaces(FixKana())` | - |
| E (5) | 診療医療機関コード | 65 | 162 | `RemoveLeading01(TrimSpaces(FixKana()))` | - |
| F (6) | 受給者番号 | 58 | 167 | `TrimSpaces(FixKana())` | - |
| G (7) | 患者氏名 | 10 | 168 | `FixKanaAndTrim()` | - |
| H (8) | 患者カナ氏名 | 11 | 169 | `FixKanaAndTrim()` | - |
| I (9) | 生年月日 | 12 | 170 | `TrimSpaces(FixKana())` | - |
| **J (10)** | **診療年月日** | **56** | **171** | `TrimSpaces(FixKana())` | **⚠️ Column 56, NOT 57!** |
| K (11) | 公費１（自立支援）フラグ | 22, 26, 30 | 145-150 | Conditional | "◯" if code = 21/15/16 |
| L (12) | 公費２（重障）フラグ | 22, 26, 30 | 152-158 | Conditional | "◯" if code = 54 |
| M (13) | 公費３フラグ | - | - | - | Not implemented in VBA |

---

## Critical Discovery: Treatment Date Column

### ⚠️ JavaScript Implementation Error

**VBA Implementation** (Line 171):
```vba
ws.Cells(rowNum, 10).Value = TrimSpaces(FixKana(csvData(i, 56))) ' 診療年月日
```

**JavaScript Implementation** ([csv-parser.js:111](webapp-version/src/js/csv-parser.js#L111)):
```javascript
getTreatmentDate() {
  // 列57: 月内受診日（フォーマット済み: '2025/02(12)'）
  return this.getField(57);
}
```

### Issue
- **VBA uses Column 56**
- **JavaScript uses Column 57**
- This creates a 1-column offset in treatment date reading

### Column 56 vs 57 Content Analysis

Based on sample CSV (`sample/調剤券請求書CSV202502.csv`):

| Row | Column 56 | Column 57 | Column 58 |
|-----|-----------|-----------|-----------|
| 2 | `20250210` | `2025/02(10)` | `0412859'` |
| 3 | `20250207` | `2025/02(7)` | `0412860'` |
| 4 | `20250205` | `2025/02(5)` | `0412861'` |
| 5 | `20250210` | `2025/02(10)` | `0412862'` |

**Column 56**: Raw YYYYMMDD format (最終受診日 or 月内初回受診日)
**Column 57**: Formatted display format `YYYY/MM(日数)` (月内受診日)
**Column 58**: Recipient number (受給者番号)

### VBA Behavior
- VBA reads column 56 (`20250210`)
- Applies `TrimSpaces(FixKana())` which removes quotes
- Writes to Excel as-is without date formatting

### Recommended Fix
**Change JavaScript to use Column 56 to match VBA implementation:**

```javascript
getTreatmentDate() {
  // 列56: 最終受診日 (YYYYMMDD format: '20250210')
  return this.getField(56);
}
```

Then in Excel generation, format column 56 data as needed.

---

## Complete CSV Column Layout (1-70)

Based on VBA code analysis and sample data header row (row 8):

| Column | Field Name (Japanese) | VBA Usage | Notes |
|--------|----------------------|-----------|-------|
| 1 | レセプト種別 | - | - |
| 2 | レコード番号 | - | - |
| 3 | 薬局コード | - | Single-quoted |
| 4-9 | - | - | - |
| 10 | 患者氏名 | ✓ (line 168) | String with quotes |
| 11 | 患者氏名（カナ） | ✓ (line 169) | String with quotes |
| 12 | 生年月日 | ✓ (line 170) | String with quotes |
| 13 | 年齢 | - | - |
| 14 | 性別 | - | - |
| 15-21 | - | - | - |
| 22 | 第一公費種別番号 | ✓ (line 142) | Used for flag detection |
| 23 | 保険者番号 | - | - |
| 24-25 | - | - | - |
| 26 | 第二公費種別番号 | ✓ (line 142) | Used for flag detection |
| 27-29 | - | - | - |
| 30 | 第三公費種別番号 | ✓ (line 142) | Used for flag detection |
| 31-33 | - | - | - |
| 34 | 医療機関名 | ✓ (line 166) | String with quotes |
| 35-37 | - | - | - |
| 38 | 患者住所 | ✓ (line 136) | Used for 旭川市 filtering |
| 39-55 | - | - | - |
| **56** | **診療年月日（月内最終受診日）** | **✓ (line 171)** | **YYYYMMDD format** |
| 57 | 月内受診日（表示用） | - | Formatted: `2025/02(12)` |
| 58 | 受給者番号 | ✓ (line 167) | String with quotes |
| 59-64 | - | - | - |
| 65 | 医療機関コード | ✓ (line 162) | String with quotes |
| 66-70 | - | - | - |

---

## Data Processing Functions

### VBA Functions (Lines 191-210)

#### 1. `FixKana(inputStr As String)`
**Purpose**: Remove single quotes and convert half-width kana to full-width

**Implementation**:
```vba
Function FixKana(inputStr As String) As String
    Dim result As String
    result = Application.WorksheetFunction.Substitute(inputStr, "'", "") ' シングルクォートを削除
    result = Application.WorksheetFunction.Substitute(result, "(", "/")
    result = Application.WorksheetFunction.Substitute(result, ")", "")
    result = StrConv(result, vbWide) ' 半角カナを全角に変換
    FixKana = result
End Function
```

**Operations**:
1. Remove single quotes `'` → empty string
2. Convert `(` → `/`
3. Remove `)` → empty string
4. Convert half-width kana to full-width (`vbWide`)

#### 2. `TrimSpaces(inputStr As String)`
**Purpose**: Remove extra spaces

**Implementation**:
```vba
Function TrimSpaces(inputStr As String) As String
    TrimSpaces = Application.WorksheetFunction.Trim(inputStr)
End Function
```

#### 3. `RemoveLeading01(code As String)`
**Purpose**: Remove leading "01" from medical codes

**Implementation**:
```vba
Function RemoveLeading01(code As String) As String
    If Left(code, 2) = "01" Then
        RemoveLeading01 = Mid(code, 3)
    Else
        RemoveLeading01 = code
    End If
End Function
```

#### 4. `FixKanaAndTrim()`
**Purpose**: Combined processing (not shown in VBA, likely combines FixKana + TrimSpaces)

**JavaScript Equivalent**:
```javascript
export function fixKanaAndTrim(inputStr) {
  if (!inputStr) return '';
  return trimSpaces(fixKana(inputStr));
}
```

---

## Filtering Logic

### 1. Address Filter (Line 136-139)
**Purpose**: Only process patients in 旭川市

```vba
tempAddress = FixKanaAndTrim(csvData(i, 38))
If InStr(tempAddress, "旭川市") = 0 Then GoTo SkipRow
```

**JavaScript Equivalent**:
```javascript
if (!patient.address.includes('旭川市')) {
  continue; // Skip this patient
}
```

### 2. Public Expense Code Filter (Lines 142-158)
**Purpose**: Detect 自立支援 (21/15/16) and 重障 (54) flags

```vba
publicCodes = Array(csvData(i, 22), csvData(i, 26), csvData(i, 30))

' 自立支援判定
For Each code In publicCodes
    If code = "21" Or code = "15" Or code = "16" Then
        ws.Cells(rowNum, 12).Value = "◯"
        Exit For
    End If
Next code

' 重障判定
For Each code In publicCodes
    If code = "54" Then
        ws.Cells(rowNum, 13).Value = "◯"
        Exit For
    End If
Next code
```

**JavaScript Equivalent**:
```javascript
const publicCodes = [
  csvRecord.getField(22),
  csvRecord.getField(26),
  csvRecord.getField(30)
];

const hasJiritsuShien = publicCodes.some(code => ['21', '15', '16'].includes(code));
const hasJusho = publicCodes.includes('54');
```

---

## JavaScript Implementation Corrections

### Required Changes

#### 1. [csv-parser.js:111](webapp-version/src/js/csv-parser.js#L111) - Change Column 57 → 56

**Current (WRONG)**:
```javascript
getTreatmentDate() {
  // 列57: 月内受診日（フォーマット済み: '2025/02(12)'）
  return this.getField(57);
}
```

**Corrected**:
```javascript
getTreatmentDate() {
  // 列56: 最終受診日 (YYYYMMDD format: '20250210')
  // VBA implementation uses column 56 (Module1.bas line 171)
  return this.getField(56);
}
```

#### 2. [excel-generator.js](webapp-version/src/js/excel-generator.js) - Update Treatment Date Formatting

**Current**: Expects formatted date like `2025/02(12)` from column 57

**Required**: Parse YYYYMMDD format from column 56

**Add Helper Function**:
```javascript
/**
 * Parse YYYYMMDD format to Date object
 * @param {string} dateStr - YYYYMMDD format (e.g., '20250210')
 * @returns {Date|string}
 */
function parseYYYYMMDD(dateStr) {
  if (!dateStr) return '';

  const cleaned = removeAllQuotes(String(dateStr).trim());
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  return cleaned; // Return as-is if parsing fails
}
```

**Update Treatment Date Cell**:
```javascript
// J列: 診療年月日（YYYYMMDD → 日付型）
const treatmentDateCell = row.getCell(10);
const parsedDate = parseYYYYMMDD(patient.treatmentDate);
if (parsedDate instanceof Date) {
  treatmentDateCell.value = parsedDate;
  treatmentDateCell.numFmt = 'yyyy/mm/dd';
} else {
  treatmentDateCell.value = parsedDate;
  treatmentDateCell.numFmt = '@';
}
```

#### 3. Handle Multiple Visit Dates

**VBA Limitation**: VBA only records a single treatment date (column 56)

**JavaScript Enhancement**: If grouping patients by recipient number, you can consolidate multiple treatment dates:

```javascript
// If patient has multiple visits
if (patientGroup.treatmentDates.length > 1) {
  // Sort dates
  const sortedDates = patientGroup.treatmentDates.sort();

  // Format as '2025/2/7, 2025/2/10, 2025/2/25'
  const formattedDates = sortedDates.map(d => {
    const dateObj = parseYYYYMMDD(d);
    return `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
  }).join(', ');

  treatmentDateCell.value = formattedDates;
  treatmentDateCell.numFmt = '@';
} else {
  // Single visit - use Date type
  const parsedDate = parseYYYYMMDD(patient.treatmentDate);
  treatmentDateCell.value = parsedDate;
  treatmentDateCell.numFmt = 'yyyy/mm/dd';
}
```

---

## Test Data Issues

### `test_data_202502_sjis.csv`
**Status**: ❌ Contains data errors

**Issues**:
- Rows 6, 8, 10 have 71 columns (extra comma)
- Does not match production CSV format

**Recommendation**: Do NOT use for testing

### `調剤券請求書CSV202502.csv`
**Status**: ✅ Correct production format

**Validation**:
- All rows have exactly 70 columns
- Contains proper incomplete single quotes
- Matches VBA expectations

**Recommendation**: Use this file for testing

---

## Comparison: VBA vs JavaScript

| Feature | VBA Implementation | JavaScript Implementation | Status |
|---------|-------------------|---------------------------|--------|
| Treatment Date Column | Column 56 | Column 57 | ❌ Fix Required |
| Quote Removal | `Substitute(inputStr, "'", "")` | `text.replace(/'/g, '')` | ✅ Equivalent |
| Half-width → Full-width | `StrConv(result, vbWide)` | `convertHankakuToZenkaku()` | ✅ Equivalent |
| Leading 01 Removal | `RemoveLeading01()` | `removeLeading01()` | ✅ Equivalent |
| Address Filter | `InStr(tempAddress, "旭川市")` | `address.includes('旭川市')` | ✅ Equivalent |
| Public Code Detection | `Array(22, 26, 30)` + loop | `publicCodes.some()` | ✅ Equivalent |
| Multiple Visit Handling | ❌ Not implemented | ✅ Implemented | JavaScript Enhancement |
| Date Formatting | String output | Date object + formatting | JavaScript Enhancement |

---

## Production CSV Specification Summary

### Format
- **70 columns** (A:BR)
- **Shift-JIS encoding**
- **Incomplete single quotes** (closing only, no opening)
- **Row 1**: Column numbers
- **Row 8**: Item names (skip during parsing)
- **Data rows**: Start from row 2

### Critical Columns
| Column | Field | Format | Processing |
|--------|-------|--------|------------|
| 10 | 患者氏名 | String with `'` | `FixKanaAndTrim()` |
| 11 | 患者カナ氏名 | String with `'` | `FixKanaAndTrim()` |
| 12 | 生年月日 | String with `'` | `TrimSpaces(FixKana())` |
| 22, 26, 30 | 公費種別番号 | Numeric | Flag detection |
| 34 | 医療機関名 | String with `'` | `TrimSpaces(FixKana())` |
| 38 | 患者住所 | String | Address filter |
| **56** | **診療年月日** | **YYYYMMDD** | **⚠️ Use this column!** |
| 57 | 月内受診日（表示用） | `YYYY/MM(DD)` | ❌ Don't use |
| 58 | 受給者番号 | String with `'` | `TrimSpaces(FixKana())` |
| 65 | 医療機関コード | String with `'` | `RemoveLeading01()` |

### Preprocessing
1. Read CSV as Shift-JIS text
2. Remove ALL single quotes: `text.replace(/'/g, '')`
3. Parse with Papa Parse (`quoteChar: '"'`)
4. Skip row 1 (column numbers) and row 8 (item names)

### Filtering
1. **Address filter**: Only `旭川市` patients
2. **Public expense filter**: Only patients with code 12 (生活保護)

### Flags
- **K column (自立支援)**: Code 21, 15, or 16 → "◯"
- **L column (重障)**: Code 54 → "◯"

---

## Action Items

### Immediate Fixes Required

1. **[csv-parser.js:111](webapp-version/src/js/csv-parser.js#L111)**
   - Change `getTreatmentDate()` from column 57 → column 56

2. **[excel-generator.js](webapp-version/src/js/excel-generator.js)**
   - Add `parseYYYYMMDD()` helper function
   - Update treatment date cell writing logic
   - Handle YYYYMMDD format instead of `YYYY/MM(DD)` format

3. **[standalone-app/app.js](standalone-app/app.js)**
   - Apply same fixes as above

4. **Testing**
   - Test with `調剤券請求書CSV202502.csv` (correct format)
   - Verify column 56 contains YYYYMMDD dates
   - Verify Excel output J column shows correct dates

---

**Document Status**: Analysis complete, awaiting implementation of fixes.
