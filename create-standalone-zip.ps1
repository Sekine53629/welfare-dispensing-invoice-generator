# スタンドアロン版ZIPパッケージ作成スクリプト
# Version: 2.4.0

$source = "standalone-app"
$dest = "welfare-invoice-generator-standalone-v2.5.0-clean"
$zipPath = "welfare-invoice-generator-standalone-v2.5.0.zip"

Write-Host "=== スタンドアロン版ZIPパッケージ作成 ===" -ForegroundColor Green

# 作業用ディレクトリ作成
Write-Host "作業用ディレクトリ作成中..." -ForegroundColor Yellow
if (Test-Path $dest) {
    Remove-Item $dest -Recurse -Force
}
New-Item -ItemType Directory -Path $dest | Out-Null

# 必要なファイルのみコピー
Write-Host "ファイルコピー中..." -ForegroundColor Yellow
Copy-Item "$source\index.html" -Destination $dest
Copy-Item "$source\app.js" -Destination $dest
Copy-Item "$source\template-data.js" -Destination $dest
Copy-Item "$source\README.md" -Destination $dest
Copy-Item "$source\MANUAL.html" -Destination $dest
Copy-Item "$source\photo" -Destination "$dest\photo" -Recurse

# コピーされたファイル一覧表示
Write-Host "`nコピーされたファイル:" -ForegroundColor Cyan
Get-ChildItem $dest | Format-Table Name, Length -AutoSize

# ZIP作成
Write-Host "`nZIPファイル作成中..." -ForegroundColor Yellow
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$dest\*" -DestinationPath $zipPath -Force

# 作業用ディレクトリ削除
Write-Host "作業用ディレクトリ削除中..." -ForegroundColor Yellow
Remove-Item $dest -Recurse -Force

# ZIP情報表示
if (Test-Path $zipPath) {
    $zipInfo = Get-Item $zipPath
    $sizeMB = [math]::Round($zipInfo.Length / 1MB, 2)

    Write-Host "`n=== 作成完了 ===" -ForegroundColor Green
    Write-Host "ファイル名: $($zipInfo.Name)" -ForegroundColor Cyan
    Write-Host "サイズ: $sizeMB MB" -ForegroundColor Cyan
    Write-Host "パス: $($zipInfo.FullName)" -ForegroundColor Cyan

    # ZIP内容確認
    Write-Host "`nZIP内容:" -ForegroundColor Cyan
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipInfo.FullName)
    $zip.Entries | Format-Table FullName, Length -AutoSize
    $zip.Dispose()
} else {
    Write-Host "`nエラー: ZIPファイルの作成に失敗しました" -ForegroundColor Red
}
