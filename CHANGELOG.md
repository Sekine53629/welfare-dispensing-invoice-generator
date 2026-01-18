# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.9] - 2026-01-18

### Added
- 前月分CSV追加機能の実装（月遅れ請求対応）
  - 当月分データ読み込み後、前月分データを追加できるようになりました
  - 前月分データは重複チェックの対象外として処理されます
  - UI: data-view内に「前月分CSVファイルを選択」ボタンを配置

### Fixed
- 前月分アップロードボタンがdata-view表示時に見えなかった問題を修正
  - upload-viewからdata-viewに配置を移動
  - 当月分読み込み後、統計情報の下に表示されるように変更

### Changed
- 前月分データ表示セクションのUI改善
  - 統計情報に「月遅れ請求」専用カウンターを追加
  - 前月分データテーブルに「月遅れ請求」バッジを表示

## [2.3.8] - 2026-01-18

### Fixed
- 前月分データ処理のロジック修正
  - 当月分と同じCSV解析処理を使用
  - 旭川市データ抽出フィルタの実装
  - ステータス表示とエラーハンドリングの改善

## [2.3.7] - 2026-01-17

### Added
- クリーン版テンプレート（tyouzai_excel_v2_clean.xlsx）の組み込み
- テーブル機能付きExcel生成機能
  - フィルタリング、ソート、テーブルデザイン適用

### Fixed
- Excel生成時のテーブル範囲エラーを修正
- テーブルXML整合性の確保

## [2.3.0] - 2026-01-15

### Added
- 前月分CSV追加機能の初期実装（試験版）

## [2.0.0] - 2026-01-10

### Added
- スタンドアロン版の初回リリース
- CSVアップロード機能
- Excel自動生成機能
- 旭川市データ自動抽出
- 重複チェック機能（2回目請求）
- 他公費検出機能
