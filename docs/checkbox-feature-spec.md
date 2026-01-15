# チェックボックス機能仕様書

## 概要

患者リストに各患者の請求可否を選択できるチェックボックスを追加します。
他の公費（21/15/16/54）で全額カバーされる可能性がある患者を、ユーザーが手動で除外できるようにします。

---

## 背景・目的

### 問題点
- CSVには公費21/15/16/54の**登録情報**のみ記載
- 実際にどの公費が使用されたかは不明
- 例: 精神科で風邪薬のみ処方 → 21に全額請求 → 12への請求なし

### 解決策
- デフォルトで全患者を請求対象とする
- 実レセプトを確認し、12への請求がない患者をチェックOFFで除外
- Excel出力時はチェックON患者のみ出力

---

## 機能仕様

### 1. デフォルト状態

**すべての患者にチェックON**
```javascript
// PatientDataクラス
this.isIncluded = true; // デフォルトでチェックON
```

理由:
- 大多数の患者は12への請求が発生する
- チェックOFFにする患者は少数
- デフォルトONの方がユーザーの手間が少ない

### 2. UI表示

#### 患者リストテーブル
```html
<table id="patient-table">
  <thead>
    <tr>
      <th><input type="checkbox" id="select-all" checked></th> <!-- 全選択 -->
      <th>No</th>
      <th>患者氏名</th>
      <th>カナ</th>
      <th>生年月日</th>
      <th>住所</th>
      <th>来局日</th>
      <th>医療機関</th>
      <th>社保併用</th>
      <th>自立支援</th>
      <th>重障</th>
      <th>状態</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><input type="checkbox" class="patient-checkbox" data-patient-id="0" checked></td>
      <td>1</td>
      <td>佐藤花子</td>
      <td>サトウハナコ</td>
      <td>1960/05/10</td>
      <td>北海道旭川市...</td>
      <td>2025/02(3)</td>
      <td>旭川中央病院</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td><span class="badge badge-success">請求</span></td>
    </tr>
    <tr class="has-other-kohi"> <!-- 他公費ありの場合、背景色変更 -->
      <td><input type="checkbox" class="patient-checkbox" data-patient-id="1" checked></td>
      <td>2</td>
      <td>鈴木太郎</td>
      <td>スズキタロウ</td>
      <td>1967/08/15</td>
      <td>北海道旭川市...</td>
      <td>2025/02(5)</td>
      <td>旭川歯科医院</td>
      <td>-</td>
      <td><span class="badge badge-info">自立</span></td>
      <td>-</td>
      <td>
        <span class="badge badge-warning">要確認</span>
        <span class="badge badge-success">請求</span>
      </td>
    </tr>
  </tbody>
</table>
```

#### 警告表示（他公費ありの場合）
- 行の背景色を薄い黄色に変更（`.has-other-kohi`）
- 状態列に「要確認」バッジを表示
- ツールチップで詳細表示

```html
<!-- ツールチップ例 -->
<span class="badge badge-warning" title="公費21（精神通院）あり - 実レセプト確認推奨">
  要確認
</span>
```

### 3. 全選択/全解除機能

```javascript
// 全選択チェックボックス
document.getElementById('select-all').addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  document.querySelectorAll('.patient-checkbox').forEach(checkbox => {
    checkbox.checked = isChecked;
    updatePatientIncluded(checkbox.dataset.patientId, isChecked);
  });
  updateStatistics();
});
```

### 4. 個別チェックボックス

```javascript
// 個別チェックボックス
document.querySelectorAll('.patient-checkbox').forEach(checkbox => {
  checkbox.addEventListener('change', (e) => {
    const patientId = e.target.dataset.patientId;
    const isChecked = e.target.checked;
    updatePatientIncluded(patientId, isChecked);
    updateStatistics();
  });
});

function updatePatientIncluded(patientId, isIncluded) {
  currentFilteredPatients.target[patientId].isIncluded = isIncluded;
}
```

### 5. 統計情報の更新

```javascript
function updateStatistics() {
  const includedCount = currentFilteredPatients.target.filter(p => p.isIncluded).length;
  const excludedCount = currentFilteredPatients.target.filter(p => !p.isIncluded).length;

  document.getElementById('stat-included').textContent = includedCount;
  document.getElementById('stat-excluded').textContent = excludedCount;
  document.getElementById('output-count').textContent = includedCount;
}
```

統計カード追加:
```html
<div class="stat-card info">
  <div class="stat-label">請求対象（✓）</div>
  <div id="stat-included" class="stat-value">0</div>
</div>
<div class="stat-card">
  <div class="stat-label">除外（無印）</div>
  <div id="stat-excluded" class="stat-value">0</div>
</div>
```

### 6. Excel出力時のフィルタリング

```javascript
async function handleExcelDownload() {
  if (!currentFilteredPatients || currentFilteredPatients.target.length === 0) {
    showError('請求対象の患者データがありません');
    return;
  }

  // チェックONの患者のみ抽出
  const includedPatients = currentFilteredPatients.target.filter(p => p.isIncluded);

  if (includedPatients.length === 0) {
    showError('チェックされた患者がいません');
    return;
  }

  const config = loadConfig();
  const validation = validateConfig(config);
  if (!validation.valid) {
    showError('設定が不完全です。設定タブで薬局情報を入力してください。');
    return;
  }

  showProgress('Excelファイルを生成中...', 0);

  // Excel生成（チェックON患者のみ）
  const excelBlob = await generateExcel(includedPatients, config, currentTemplateBuffer);

  updateProgress('アーカイブに保存中...', 70);

  // アーカイブ保存
  const { yearMonth } = extractTreatmentYearMonth(includedPatients);
  const fileName = generateFileName(yearMonth, currentBatchNumber);

  await saveArchive({
    folderName: yearMonth,
    fileName: fileName,
    batchNumber: currentBatchNumber,
    patientCount: includedPatients.length, // チェックON患者数
    patients: includedPatients,
    csvFileName: currentCSVFile.name,
    createdDate: new Date(),
  });

  updateProgress('ダウンロード準備中...', 90);

  downloadBlob(excelBlob, fileName);

  updateProgress('完了', 100);
  hideProgress();

  showSuccess(`Excelファイルをダウンロードしました（${includedPatients.length}件）`);
}
```

---

## データモデル変更

### PatientDataクラス

```javascript
export class PatientData {
  constructor(csvRecord) {
    // ... 既存のフィールド

    // フラグ（後で設定）
    this.isAsahikawa = false;
    this.isWelfare = false; // 生活保護（公費12）
    this.hasInsurance = false; // 社保併用
    this.hasJiritsuShien = false; // 自立支援（21/15/16）
    this.hasJusho = false; // 重障（54）
    this.isDuplicate = false; // 重複フラグ
    this.isTarget = false; // 請求対象フラグ

    // 新規追加
    this.isIncluded = true; // チェックボックス状態（デフォルトON）
  }

  /**
   * 他公費があるかチェック
   * @returns {boolean}
   */
  hasOtherKohi() {
    return this.hasJiritsuShien || this.hasJusho;
  }
}
```

---

## CSS スタイル

```css
/* 他公費ありの行 */
.patient-table tbody tr.has-other-kohi {
  background-color: #fffbeb; /* 薄い黄色 */
}

.patient-table tbody tr.has-other-kohi:hover {
  background-color: #fef3c7; /* ホバー時少し濃く */
}

/* チェックボックス列 */
.patient-table th:first-child,
.patient-table td:first-child {
  width: 40px;
  text-align: center;
}

.patient-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

#select-all {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* 要確認バッジ */
.badge-warning {
  background-color: var(--color-warning);
  color: white;
  cursor: help;
}

/* 統計カード（情報） */
.stat-card.info {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-color: var(--color-info);
}
```

---

## ユーザー操作フロー

1. **CSVアップロード**
   - 患者リストが表示される
   - すべてチェックON状態

2. **他公費患者の確認**
   - 黄色い背景の行（他公費あり）を確認
   - 「要確認」バッジを確認

3. **実レセプト確認**
   - ユーザーが実際のレセプトを確認
   - 12への請求がない患者を特定

4. **チェックOFF**
   - 該当患者のチェックボックスをOFF
   - 統計情報が自動更新

5. **Excel出力**
   - チェックON患者のみExcel出力
   - ダウンロード完了メッセージに件数表示

---

## 注意事項・制約

### ユーザーへの注意喚起

患者リスト上部に説明を表示:

```html
<div class="info-box">
  <h3>⚠️ チェックボックスの使い方</h3>
  <p>
    他の公費（自立支援・難病等）で全額カバーされ、
    旭川市（生活保護）への請求が発生しない患者は、
    実レセプトを確認した上でチェックを外してください。
  </p>
  <p>
    デフォルトでは全員にチェックが入っています。
    不明な場合はチェックを入れたまま出力することを推奨します。
  </p>
</div>
```

### データの永続化

**チェック状態は保存しない**
- リセットボタンで状態がクリアされる
- 新しいCSVをアップロードしたらリセット
- 理由: 毎月のデータが異なるため

---

## 実装優先度

### Phase 1（最小限の実装）
- ✅ チェックボックス列の追加
- ✅ デフォルトON状態
- ✅ 個別チェックボックスの動作
- ✅ Excel出力時のフィルタリング

### Phase 2（利便性向上）
- 全選択/全解除ボタン
- 統計情報の更新
- チェック件数の表示

### Phase 3（警告表示）
- 他公費ありの行の背景色変更
- 「要確認」バッジ
- ツールチップ

### Phase 4（高度な機能）
- 公費種別でフィルタ表示
- チェック状態の一時保存（SessionStorage）
- 一括チェックOFF機能（特定条件）

---

## テストケース

### テストデータ
`test_data_202502.csv`を使用

| No | 患者名 | 他公費 | 期待動作 |
|----|--------|--------|---------|
| 1 | 佐藤花子 | なし | チェックON（デフォルト） |
| 2 | 鈴木太郎 | 21（精神通院） | チェックON（デフォルト）+ 要確認表示 |
| 4 | 高橋一郎 | 15（更生医療） | チェックON（デフォルト）+ 要確認表示 |
| 5 | 伊藤恵子 | 54（難病） | チェックON（デフォルト）+ 要確認表示 |
| 6 | 渡辺修 | 21 + 54 | チェックON（デフォルト）+ 要確認表示 |

### テストシナリオ

1. **デフォルト状態**
   - すべての患者がチェックON
   - 統計: 請求対象13件、除外0件

2. **個別チェックOFF**
   - No.2をチェックOFF
   - 統計: 請求対象12件、除外1件

3. **全解除→全選択**
   - 全解除 → 統計: 請求対象0件、除外13件
   - 全選択 → 統計: 請求対象13件、除外0件

4. **Excel出力**
   - No.2, 5をチェックOFF
   - Excel出力 → 11件のExcelファイル
   - メッセージ: 「Excelファイルをダウンロードしました（11件）」

---

## まとめ

この機能により、ユーザーは：
1. デフォルトで全患者を請求対象とする（手間最小）
2. 実レセプトを確認して除外判断できる（柔軟性）
3. 他公費ありの患者を視覚的に識別できる（ミス防止）
4. 最終的にチェックON患者のみExcel出力できる（正確性）

**作成日**: 2025-01-15
**最終更新**: 2025-01-15

