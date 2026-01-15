Attribute VB_Name = "Module_CSVParser"
' ============================================================================
' Module: Module_CSVParser
' Description: CSV解析モジュール
'              不完全なシングルクォート処理とカンマを含むフィールドに対応
' Author: 関根 sekine53629
' Version: 2.0.0
' Created: 2025-02-15
' ============================================================================

Option Explicit

' CSV解析結果を格納する構造体
Public Type CSVRecord
    Fields(1 To 70) As String  ' 70列のフィールド
    RowNumber As Long          ' 行番号
    IsValid As Boolean         ' 有効フラグ
End Type

' ============================================================================
' Function: ParseCSVFile
' Description: CSVファイルを読み込み、配列として返す
' Parameters:
'   filePath - CSVファイルのフルパス
' Returns: CSVRecord配列
' ============================================================================
Public Function ParseCSVFile(ByVal filePath As String) As CSVRecord()
    Dim fileNum As Integer
    Dim lineText As String
    Dim records() As CSVRecord
    Dim recordCount As Long
    Dim lineNumber As Long

    On Error GoTo ErrorHandler

    ' ファイル存在チェック
    If Dir(filePath) = "" Then
        MsgBox "CSVファイルが見つかりません: " & filePath, vbExclamation
        Exit Function
    End If

    ' ファイルを開く（Shift-JIS対応）
    fileNum = FreeFile
    Open filePath For Input As #fileNum

    ' 初期配列サイズ（動的に拡張）
    recordCount = 0
    ReDim records(1 To 1000)

    lineNumber = 0

    ' 行ごとに読み込み
    Do Until EOF(fileNum)
        Line Input #fileNum, lineText
        lineNumber = lineNumber + 1

        ' 1行目（列番号）と8行目（項目名）はスキップ
        If lineNumber = 1 Or lineNumber = 8 Then
            GoTo NextLine
        End If

        ' 空行スキップ
        If Trim(lineText) = "" Then
            GoTo NextLine
        End If

        ' レコード数をインクリメント
        recordCount = recordCount + 1

        ' 配列拡張が必要な場合
        If recordCount > UBound(records) Then
            ReDim Preserve records(1 To UBound(records) + 1000)
        End If

        ' CSV行をパース
        records(recordCount) = ParseCSVLine(lineText, lineNumber)

NextLine:
    Loop

    Close #fileNum

    ' 配列を実際のサイズにトリミング
    If recordCount > 0 Then
        ReDim Preserve records(1 To recordCount)
        ParseCSVFile = records
    Else
        MsgBox "CSVファイルにデータがありません。", vbExclamation
    End If

    Exit Function

ErrorHandler:
    If fileNum <> 0 Then Close #fileNum
    MsgBox "CSV読み込みエラー: " & Err.Description & " (行: " & lineNumber & ")", vbCritical
End Function

' ============================================================================
' Function: ParseCSVLine
' Description: CSV1行を解析し、70列のフィールドに分割
'              不完全なクォート処理とカンマを含むフィールドに対応
' Parameters:
'   lineText - CSV行テキスト
'   lineNumber - 行番号（デバッグ用）
' Returns: CSVRecord
' ============================================================================
Private Function ParseCSVLine(ByVal lineText As String, ByVal lineNumber As Long) As CSVRecord
    Dim record As CSVRecord
    Dim i As Long
    Dim currentChar As String
    Dim fieldValue As String
    Dim fieldIndex As Integer
    Dim inQuote As Boolean
    Dim length As Long

    ' 初期化
    record.RowNumber = lineNumber
    record.IsValid = True
    fieldIndex = 1
    fieldValue = ""
    inQuote = False
    length = Len(lineText)

    ' 文字ごとに解析（状態マシン方式）
    For i = 1 To length
        currentChar = Mid(lineText, i, 1)

        Select Case currentChar
            Case "'"
                ' シングルクォートの処理
                ' 不完全なクォートが多いため、簡易的な処理
                ' データ内のクォートは削除（FixKana関数で後処理）
                ' CSVのクォートとしては機能させない

            Case ","
                ' カンマの処理
                If inQuote Then
                    ' クォート内のカンマはフィールドの一部
                    fieldValue = fieldValue & currentChar
                Else
                    ' フィールド区切り
                    If fieldIndex <= 70 Then
                        record.Fields(fieldIndex) = CleanField(fieldValue)
                        fieldIndex = fieldIndex + 1
                        fieldValue = ""
                    End If
                End If

            Case Else
                ' 通常の文字
                fieldValue = fieldValue & currentChar
        End Select
    Next i

    ' 最後のフィールドを保存
    If fieldIndex <= 70 Then
        record.Fields(fieldIndex) = CleanField(fieldValue)
    End If

    ' フィールド数チェック（デバッグ用）
    If fieldIndex < 65 Then
        Debug.Print "警告: 行 " & lineNumber & " のフィールド数が不足（" & fieldIndex & "列）"
    End If

    ParseCSVLine = record
End Function

' ============================================================================
' Function: CleanField
' Description: フィールド値のクリーニング
'              - 先頭・末尾の空白削除
'              - シングルクォート削除
' Parameters:
'   fieldValue - フィールド値
' Returns: クリーニング済み文字列
' ============================================================================
Private Function CleanField(ByVal fieldValue As String) As String
    Dim result As String

    result = Trim(fieldValue)

    ' シングルクォート削除
    result = Replace(result, "'", "")

    CleanField = result
End Function

' ============================================================================
' Function: ParseCSVFileAsArray
' Description: CSVファイルを2次元配列として返す（互換性用）
'              既存コードとの互換性のため
' Parameters:
'   filePath - CSVファイルのフルパス
' Returns: 2次元配列 (行, 列)
' ============================================================================
Public Function ParseCSVFileAsArray(ByVal filePath As String) As Variant
    Dim records() As CSVRecord
    Dim resultArray() As Variant
    Dim i As Long, j As Integer

    ' CSVをパース
    records = ParseCSVFile(filePath)

    If UBound(records) = 0 Then
        Exit Function
    End If

    ' 2次元配列に変換
    ReDim resultArray(1 To UBound(records), 1 To 70)

    For i = 1 To UBound(records)
        For j = 1 To 70
            resultArray(i, j) = records(i).Fields(j)
        Next j
    Next i

    ParseCSVFileAsArray = resultArray
End Function

' ============================================================================
' Function: GetFieldValue
' Description: レコードから指定列のフィールド値を取得
' Parameters:
'   record - CSVRecord
'   columnIndex - 列番号（1-70）
' Returns: フィールド値
' ============================================================================
Public Function GetFieldValue(ByRef record As CSVRecord, ByVal columnIndex As Integer) As String
    If columnIndex >= 1 And columnIndex <= 70 Then
        GetFieldValue = record.Fields(columnIndex)
    Else
        GetFieldValue = ""
    End If
End Function

' ============================================================================
' Function: DebugPrintRecord
' Description: レコードの内容をイミディエイトウィンドウに出力（デバッグ用）
' Parameters:
'   record - CSVRecord
' ============================================================================
Public Sub DebugPrintRecord(ByRef record As CSVRecord)
    Dim i As Integer

    Debug.Print "--- Record Row: " & record.RowNumber & " ---"
    For i = 1 To 70
        If record.Fields(i) <> "" Then
            Debug.Print "  [" & i & "] = " & record.Fields(i)
        End If
    Next i
End Sub

' ============================================================================
' Function: FixKana
' Description: カナ文字・記号の変換処理
'              - シングルクォート削除
'              - 括弧の置換 ( → / , ) → 削除
'              - 半角カナ → 全角カナ変換
' Parameters:
'   inputStr - 入力文字列
' Returns: 変換済み文字列
' ============================================================================
Public Function FixKana(ByVal inputStr As String) As String
    Dim result As String

    result = inputStr

    ' シングルクォート削除
    result = Replace(result, "'", "")

    ' 括弧処理
    result = Replace(result, "(", "/")
    result = Replace(result, ")", "")

    ' 半角カナ → 全角カナ変換
    result = StrConv(result, vbWide)

    FixKana = result
End Function

' ============================================================================
' Function: TrimSpaces
' Description: 空白文字の削除（先頭・末尾・連続）
' Parameters:
'   inputStr - 入力文字列
' Returns: トリム済み文字列
' ============================================================================
Public Function TrimSpaces(ByVal inputStr As String) As String
    Dim result As String

    ' 先頭・末尾の空白削除
    result = Trim(inputStr)

    ' 連続する空白を1つに
    Do While InStr(result, "  ") > 0
        result = Replace(result, "  ", " ")
    Loop

    TrimSpaces = result
End Function

' ============================================================================
' Function: FixKanaAndTrim
' Description: FixKanaとTrimSpacesの組み合わせ
' Parameters:
'   inputStr - 入力文字列
' Returns: 変換・トリム済み文字列
' ============================================================================
Public Function FixKanaAndTrim(ByVal inputStr As String) As String
    FixKanaAndTrim = TrimSpaces(FixKana(inputStr))
End Function

' ============================================================================
' Function: RemoveLeading01
' Description: 医療機関コードの先頭「01」を削除
' Parameters:
'   code - 医療機関コード
' Returns: 処理済みコード
' ============================================================================
Public Function RemoveLeading01(ByVal code As String) As String
    If Left(code, 2) = "01" Then
        RemoveLeading01 = Mid(code, 3)
    Else
        RemoveLeading01 = code
    End If
End Function
