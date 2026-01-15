Sub SetupTemplate()
    Dim ws As Worksheet
    Dim newWb As Workbook
    Dim templatePath As String
    Dim saveFolder As String
    Dim fDialog As FileDialog
    Dim callingWs As Worksheet
    Dim fDialog As FileDialog
    Dim folderPath As String


    ' 呼び出し元のシートを設定
    Set callingWs = ThisWorkbook.Sheets(1)
    
    ' 必須項目（薬局名・医療機関コード）の確認
    If callingWs.Cells(1, 2).Value = "" Or callingWs.Cells(2, 2).Value = "" Then
        MsgBox "薬局名または医療機関コードが入力されていません。", vbExclamation
        Exit Sub
    End If
    
    ' 新しいブックを作成
    Set newWb = Workbooks.Add

    ' 作成直後のシートを削除して空にする
    Application.DisplayAlerts = False
    
    ' シート2をコピー
    ThisWorkbook.Sheets(2).Copy Before:=newWb.Sheets(1)
    
    newWb.Sheets(2).Delete
    Application.DisplayAlerts = True
    
    ' フォルダ選択ダイアログを開く
    Set fDialog = Application.FileDialog(msoFileDialogFolderPicker)

    With fDialog
        .Title = "テンプレートを保存するフォルダを選択してください"
        .AllowMultiSelect = False ' 複数選択を無効化
        
        ' ユーザーがフォルダを選択した場合
        If .Show = -1 Then
            folderPath = .SelectedItems(1) ' 選択したフォルダのパスを取得
            MsgBox "選択されたフォルダ: " & folderPath, vbInformation
        Else
            MsgBox "フォルダが選択されませんでした。処理を中止します。", vbExclamation
            Exit Sub
        End If
    End With
    
    ' ドキュメントフォルダ内のOfficeカスタムテンプレートフォルダを取得
    templatePath = folderPath & "tyouzai_excel_2.xltx"
    
    ' フォルダ選択ダイアログを開く
    Set fDialog = Application.FileDialog(msoFileDialogFolderPicker)

    With fDialog
        .Title = "請求ファイルを保存するフォルダを選択してください"
        .AllowMultiSelect = False ' 複数選択を無効化
        
        ' ユーザーがフォルダを選択した場合
        If .Show = -1 Then
            saveFolder = .SelectedItems(1) ' 選択したフォルダのパスを取得
            MsgBox "選択されたフォルダ: " & saveFolder, vbInformation
        Else
            MsgBox "フォルダが選択されませんでした。処理を中止します。", vbExclamation
            Exit Sub
        End If
    End With
    
    ' テンプレートとして保存
    newWb.SaveAs FileName:=templatePath, FileFormat:=xlOpenXMLTemplate
    newWb.Close False
    
    ' 呼び出し元エクセルに保存したファイルのパスを記録
    ThisWorkbook.Sheets(1).Cells(3, 2).Value = templatePath
    ThisWorkbook.Sheets(1).Cells(4, 2).Value = saveFolder
    
    ' 完了メッセージ
    MsgBox "設定が完了しました。保存場所: " & templatePath, vbInformation
End Sub

Sub ExportTyouzaiken()
    Dim ws As Worksheet
    Dim csvWs As Worksheet
    Dim newWb As Workbook
    Dim csvFilePath As String
    Dim csvData As Variant
    Dim i As Long, rowNum As Long, lastRow As Long
    Dim templatePath As String, saveFolder As String
    Dim saveFileName As String, savePath As String
    Dim fDialog As FileDialog
    Dim callingWs As Worksheet
    Dim tempAddress As String
    Dim publicCodes As Variant, code As Variant
    Dim currentDate As String
    
    ' 呼び出し元のシートを設定
    templatePath = ThisWorkbook.Sheets(1).Cells(3, 2).Value ' テンプレートファイルのパス
    saveFolder = ThisWorkbook.Sheets(1).Cells(4, 2).Value ' 保存フォルダのパス
    
    ' テンプレートファイルの存在チェック
    If Dir(templatePath) = "" Then
        MsgBox "テンプレートファイルが見つかりません。", vbExclamation
        Exit Sub
    End If
    
    ' テンプレートファイルを開く
    Set newWb = Workbooks.Open(templatePath)
    Set ws = newWb.Sheets(1) ' 編集対象のシート（シート1）
    
    rowNum = 11 ' 転記開始行
    
    ' CSVファイルのパスを指定
    csvFilePath = Application.GetOpenFilename("CSV Files (*.csv), *.csv", , "CSVファイルを選択")
    If csvFilePath = "False" Then
        MsgBox "CSVファイルが選択されませんでした。", vbExclamation
        Exit Sub
    End If
    
    ' CSVファイルを開く
    Workbooks.Open csvFilePath
    Set csvWs = ActiveSheet
    
    ' データの最終行を取得
    lastRow = csvWs.Cells(csvWs.Rows.Count, 1).End(xlUp).Row
    
    ' データを配列に読み込む
    csvData = csvWs.Range("A2:BR" & lastRow).Value
    
    ' CSVファイルを閉じる
    Workbooks(csvWs.Parent.Name).Close False
    
    ' CSVデータをシートに転記
    For i = 1 To UBound(csvData, 1)
        If csvData(i, 1) <> "" Then
            tempAddress = FixKanaAndTrim(csvData(i, 38)) ' 38列目: 患者住所
            
            ' 旭川市以外をスキップ
            If InStr(tempAddress, "旭川市") = 0 Then GoTo SkipRow
            
            ' 公費種別番号取得
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
            
            ' 医療機関コードの処理（頭の01を削除）
            ws.Cells(rowNum, 3).Value = RemoveLeading01(ThisWorkbook.Sheets(1).Cells(2, 2).Value) ' 医療機関コード
            ws.Cells(rowNum, 5).Value = RemoveLeading01(TrimSpaces(FixKana(csvData(i, 65)))) ' 医療機関コード
            
            ' データ転記
            ws.Cells(rowNum, 2).Value = ThisWorkbook.Sheets(1).Cells(1, 2).Value ' 薬局名
            ws.Cells(rowNum, 4).Value = TrimSpaces(FixKana(csvData(i, 34))) ' 医療機関名
            ws.Cells(rowNum, 6).Value = TrimSpaces(FixKana(csvData(i, 58))) ' 受給者番号
            ws.Cells(rowNum, 7).Value = FixKanaAndTrim(csvData(i, 10)) ' 患者氏名
            ws.Cells(rowNum, 8).Value = FixKanaAndTrim(csvData(i, 11)) ' 患者カナ氏名
            ws.Cells(rowNum, 9).Value = TrimSpaces(FixKana(csvData(i, 12))) ' 生年月日
            ws.Cells(rowNum, 10).Value = TrimSpaces(FixKana(csvData(i, 56))) ' 診療年月日
            
            rowNum = rowNum + 1 ' 行番号を進める
        End If
SkipRow:
    Next i
    
    ' 作成日付を取得し、ファイル名に組み込む
    currentDate = Format(Date, "yyyymmdd")
    saveFileName = currentDate & "_tyouzai_excel_v2.xlsx"
    savePath = saveFolder & "" & saveFileName
    
    ' 編集後のファイルを保存
    newWb.SaveAs FileName:=savePath, FileFormat:=xlOpenXMLWorkbook
    newWb.Close False
    
    ' 完了メッセージ
    MsgBox "データの転記と保存が完了しました。保存場所: " & savePath, vbInformation
End Sub

Function FixKana(inputStr As String) As String
    Dim result As String
    result = Application.WorksheetFunction.Substitute(inputStr, "'", "") ' シングルクォートを削除
    result = Application.WorksheetFunction.Substitute(result, "(", "/")
    result = Application.WorksheetFunction.Substitute(result, ")", "")
    result = StrConv(result, vbWide) ' 半角カナを全角に変換
    FixKana = result
End Function

Function TrimSpaces(inputStr As String) As String
    TrimSpaces = Application.WorksheetFunction.Trim(inputStr) ' スペース削除
End Function

Function RemoveLeading01(code As String) As String
    If Left(code, 2) = "01" Then
        RemoveLeading01 = Mid(code, 3)
    Else
        RemoveLeading01 = code
    End If
End Function

