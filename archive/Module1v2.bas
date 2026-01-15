Sub ImportCSVAndTransferDataAndSaveWithKanaFixAndAddressCheck()
    Dim ws As Worksheet
    Dim csvWs As Worksheet
    Dim newWb As Workbook
    Dim csvFilePath As String
    Dim csvData As Variant
    Dim i As Long
    Dim rowNum As Long
    Dim lastRow As Long
    Dim folderPath As String
    Dim saveFileName As String
    Dim savePath As String
    Dim fDialog As FileDialog
    Dim callingWs As Worksheet
    Dim tempAddress As String
    
    ' 呼び出し元のシート2を設定
    Set callingWs = ThisWorkbook.Sheets(2)
    
    ' CSVファイルのパスを指定
    csvFilePath = Application.GetOpenFilename("CSV Files (*.csv), *.csv", , "CSVファイルを選択")
    
    If csvFilePath = "False" Then
        MsgBox "CSVファイルが選択されませんでした。"
        Exit Sub
    End If
    
    ' CSVファイルを開く
    Workbooks.Open csvFilePath
    Set csvWs = ActiveSheet
    
    ' データの最終行を取得
    lastRow = csvWs.Cells(csvWs.Rows.Count, 1).End(xlUp).Row
    
    ' データを配列に読み込む
    csvData = csvWs.Range("A2:BR" & lastRow).Value ' 1行目は無視し、2行目から読み込む
    
    ' CSVファイルを閉じる
    Workbooks(csvWs.Parent.Name).Close False
    
    ' 調剤請求書（旭川市）のシートを指定
    Set ws = ThisWorkbook.Sheets("調剤請求書（旭川市）")
    
    ' 転記開始行は11行目
    rowNum = 11
    
    ' CSVデータをシートに転記
    For i = 1 To UBound(csvData, 1) ' 1行目（CSVの2行目）から読み込む
        If csvData(i, 1) <> "" Then ' 空でない行を処理
            ' 患者の住所を取得して「旭川市」が含まれているか確認
            tempAddress = FixKanaAndTrim(csvData(i, 38)) ' AL列: 患者住所
            
            ' 住所に「旭川市」が含まれていない場合はスキップ
            If InStr(tempAddress, "旭川市") = 0 Then
                ' 住所に「旭川市」が含まれていない場合は次の患者に進む
                GoTo NextPatient
            End If
            
            ' 各データを変換処理（全角変換、シングルクォートとスペースの削除）
            ws.Cells(rowNum, 2).Value = ThisWorkbook.Worksheets(1).Cells(1, 2) ' 薬局名
            ws.Cells(rowNum, 3).Value = Format(ThisWorkbook.Worksheets(1).Cells(2, 2), "@") ' 医療機関コード(薬局)
            ws.Cells(rowNum, 4).Value = FixKanaAndTrim(csvData(i, 34)) ' 医療機関名
            
            If csvData(i, 65) <> "'（なし） （なし） （なし）'" Then
                ws.Cells(rowNum, 5).Value = FixKanaAndTrim(csvData(i, 65)) ' 医療機関コード
            Else
                ws.Cells(rowNum, 5).Value = FixKanaAndTrim(csvData(i, 66))
            End If
            
            ws.Cells(rowNum, 6).Value = FixKanaAndTrim(csvData(i, 51)) ' 生保受給者番号
            ws.Cells(rowNum, 7).Value = FixKanaAndTrim(csvData(i, 10)) ' 患者氏名
            ws.Cells(rowNum, 8).Value = FixKanaAndTrim(csvData(i, 11)) ' 患者氏名（カナ）
            ws.Cells(rowNum, 9).Value = FixKanaAndTrim(csvData(i, 12))
            ws.Cells(rowNum, 10).Value = FixKanaAndTrim(csvData(i, 57)) ' 薬局月初回来局日
            
            ' 行番号を進める
            rowNum = rowNum + 1
        End If
        
NextPatient:
    Next i
    
    ' 新しいブックを作成し、調剤請求書シートのみをコピー
    Set newWb = Workbooks.Add
    ws.Copy Before:=newWb.Sheets(1)
    
    ' 元のワークブックに戻す
    ThisWorkbook.Activate
    
    ' フォルダ選択ダイアログを表示
    Set fDialog = Application.FileDialog(msoFileDialogFolderPicker)
    fDialog.Title = "保存するフォルダを選択してください"
    
    If fDialog.Show = -1 Then
        folderPath = fDialog.SelectedItems(1)
    Else
        MsgBox "保存フォルダが選択されませんでした。処理を中止します。"
        Exit Sub
    End If
    
    ' 保存先のファイル名を設定
    saveFileName = "tyouzai_excel.xlsx"
    savePath = folderPath & "\" & saveFileName
    
    ' 新しいファイルとして保存
    newWb.SaveAs Filename:=savePath, FileFormat:=xlOpenXMLWorkbook
    newWb.Close False
    
    ' 呼び出し元シート2のB11:M500をクリア
    callingWs.Range("B11:M500").ClearContents
    
    ' 完了メッセージ
    MsgBox "データの転記と保存が完了しました。保存場所: " & savePath, vbInformation
End Sub

' 半角カナを全角に変換し、シングルクォートと半角スペースを削除する関数
Function FixKanaAndTrim(inputStr As Variant) As String
    Dim result As String
    result = Application.WorksheetFunction.Substitute(inputStr, "'", "") ' シングルクォートを削除
    result = Application.WorksheetFunction.Substitute(result, " ", "") ' 半角スペースを削除
    result = Application.WorksheetFunction.Substitute(result, "(", "/")
    result = Application.WorksheetFunction.Substitute(result, ")", "") ' 半角スペースを削除
    result = StrConv(result, vbWide) ' 半角カナを全角に変換
    FixKanaAndTrim = result
End Function
