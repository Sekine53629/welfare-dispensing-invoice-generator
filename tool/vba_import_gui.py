#!/usr/bin/env python3
"""
VBAモジュール インポート GUI ツール
- ドラッグ&ドロップで.basファイルを追加
- UTF-8/Shift-JIS自動変換
- Excelワークブック選択
- 一括インポート
"""

import sys
import os
import subprocess
from pathlib import Path
from typing import List
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinterdnd2 import DND_FILES, TkinterDnD
import chardet

class VBAImportGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("VBA Module Importer")
        self.root.geometry("800x600")

        # データ
        self.bas_files = []  # [(path, encoding, status)]
        self.excel_path = None

        self.setup_ui()

    def setup_ui(self):
        # メインフレーム
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # グリッド設定
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(2, weight=1)

        # ========================================
        # セクション1: Excelワークブック選択
        # ========================================
        excel_frame = ttk.LabelFrame(main_frame, text="対象Excelワークブック", padding="10")
        excel_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        excel_frame.columnconfigure(1, weight=1)

        ttk.Label(excel_frame, text="ワークブック:").grid(row=0, column=0, sticky=tk.W, padx=(0, 10))

        self.excel_path_var = tk.StringVar(value="未選択")
        excel_label = ttk.Label(excel_frame, textvariable=self.excel_path_var, foreground="gray")
        excel_label.grid(row=0, column=1, sticky=(tk.W, tk.E))

        excel_btn = ttk.Button(excel_frame, text="参照...", command=self.select_excel)
        excel_btn.grid(row=0, column=2, padx=(10, 0))

        # ========================================
        # セクション2: BASファイルリスト
        # ========================================
        bas_frame = ttk.LabelFrame(main_frame, text="VBAモジュールファイル (.bas)", padding="10")
        bas_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        bas_frame.columnconfigure(0, weight=1)

        # ドラッグ&ドロップ案内
        drop_label = ttk.Label(bas_frame, text="⬇ .basファイルをここにドラッグ&ドロップ",
                               foreground="blue", font=("", 10, "bold"))
        drop_label.grid(row=0, column=0, pady=(0, 10))

        # ファイルリスト
        list_frame = ttk.Frame(bas_frame)
        list_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)

        # Treeview
        columns = ("file", "encoding", "status")
        self.tree = ttk.Treeview(list_frame, columns=columns, show="headings", height=10)
        self.tree.heading("file", text="ファイル名")
        self.tree.heading("encoding", text="エンコーディング")
        self.tree.heading("status", text="ステータス")

        self.tree.column("file", width=300)
        self.tree.column("encoding", width=150)
        self.tree.column("status", width=200)

        self.tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # スクロールバー
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.tree.configure(yscrollcommand=scrollbar.set)

        # ボタン
        btn_frame = ttk.Frame(bas_frame)
        btn_frame.grid(row=2, column=0, pady=(10, 0))

        ttk.Button(btn_frame, text="ファイル追加...", command=self.add_files).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="選択削除", command=self.remove_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="全削除", command=self.clear_all).pack(side=tk.LEFT, padx=5)

        # ドラッグ&ドロップ設定
        self.tree.drop_target_register(DND_FILES)
        self.tree.dnd_bind('<<Drop>>', self.drop_files)

        # ========================================
        # セクション3: ログ表示
        # ========================================
        log_frame = ttk.LabelFrame(main_frame, text="ログ", padding="10")
        log_frame.grid(row=2, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)

        self.log_text = tk.Text(log_frame, height=10, wrap=tk.WORD, state=tk.DISABLED)
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        log_scrollbar = ttk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        log_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.log_text.configure(yscrollcommand=log_scrollbar.set)

        # ========================================
        # セクション4: 実行ボタン
        # ========================================
        action_frame = ttk.Frame(main_frame)
        action_frame.grid(row=3, column=0, sticky=(tk.W, tk.E))

        self.import_btn = ttk.Button(action_frame, text="▶ インポート実行",
                                      command=self.execute_import, style="Accent.TButton")
        self.import_btn.pack(side=tk.RIGHT, padx=5)

        ttk.Button(action_frame, text="終了", command=self.root.quit).pack(side=tk.RIGHT, padx=5)

    def log(self, message, level="INFO"):
        """ログ出力"""
        self.log_text.configure(state=tk.NORMAL)

        colors = {
            "INFO": "black",
            "SUCCESS": "green",
            "WARNING": "orange",
            "ERROR": "red"
        }

        tag = f"tag_{level}"
        self.log_text.tag_config(tag, foreground=colors.get(level, "black"))

        self.log_text.insert(tk.END, f"[{level}] {message}\n", tag)
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)
        self.root.update()

    def select_excel(self):
        """Excelワークブック選択"""
        file_path = filedialog.askopenfilename(
            title="Excelワークブックを選択",
            filetypes=[("Excelマクロ有効ワークブック", "*.xlsm"), ("全ファイル", "*.*")]
        )

        if file_path:
            self.excel_path = Path(file_path)
            self.excel_path_var.set(self.excel_path.name)
            self.log(f"Excelワークブック選択: {self.excel_path.name}", "SUCCESS")

    def detect_encoding(self, file_path: Path) -> str:
        """エンコーディング検出"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                f.read()
            return 'UTF-8'
        except UnicodeDecodeError:
            pass

        try:
            with open(file_path, 'r', encoding='shift_jis') as f:
                f.read()
            return 'Shift-JIS'
        except UnicodeDecodeError:
            pass

        try:
            with open(file_path, 'rb') as f:
                result = chardet.detect(f.read())
            return result['encoding'] if result['encoding'] else 'Unknown'
        except:
            return 'Unknown'

    def add_files(self):
        """ファイル追加ダイアログ"""
        file_paths = filedialog.askopenfilenames(
            title="BASファイルを選択",
            filetypes=[("VBA Module", "*.bas"), ("全ファイル", "*.*")]
        )

        for path in file_paths:
            self.add_bas_file(Path(path))

    def add_bas_file(self, file_path: Path):
        """BASファイルをリストに追加"""
        # 重複チェック
        for existing_path, _, _ in self.bas_files:
            if existing_path == file_path:
                self.log(f"既に追加済み: {file_path.name}", "WARNING")
                return

        # エンコーディング検出
        encoding = self.detect_encoding(file_path)

        # リストに追加
        self.bas_files.append((file_path, encoding, "待機中"))

        # Treeviewに追加
        self.tree.insert("", tk.END, values=(file_path.name, encoding, "待機中"))

        self.log(f"追加: {file_path.name} ({encoding})", "INFO")

    def drop_files(self, event):
        """ドラッグ&ドロップ処理"""
        files = self.root.tk.splitlist(event.data)

        for file in files:
            file_path = Path(file)

            if file_path.suffix.lower() == '.bas':
                self.add_bas_file(file_path)
            else:
                self.log(f"スキップ（.basではない）: {file_path.name}", "WARNING")

    def remove_selected(self):
        """選択したファイルを削除"""
        selected = self.tree.selection()

        if not selected:
            messagebox.showwarning("警告", "削除するファイルを選択してください")
            return

        for item in selected:
            values = self.tree.item(item, 'values')
            file_name = values[0]

            # リストから削除
            self.bas_files = [(p, e, s) for p, e, s in self.bas_files if p.name != file_name]

            # Treeviewから削除
            self.tree.delete(item)

            self.log(f"削除: {file_name}", "INFO")

    def clear_all(self):
        """全ファイルをクリア"""
        if messagebox.askyesno("確認", "全てのファイルをクリアしますか？"):
            self.bas_files.clear()
            self.tree.delete(*self.tree.get_children())
            self.log("全ファイルをクリアしました", "INFO")

    def convert_to_shift_jis(self, file_path: Path) -> bool:
        """UTF-8からShift-JISに変換"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            with open(file_path, 'w', encoding='shift_jis', errors='replace') as f:
                f.write(content)

            return True
        except Exception as e:
            self.log(f"変換エラー: {file_path.name} - {e}", "ERROR")
            return False

    def execute_import(self):
        """インポート実行"""
        # バリデーション
        if not self.excel_path:
            messagebox.showerror("エラー", "Excelワークブックを選択してください")
            return

        if not self.excel_path.exists():
            messagebox.showerror("エラー", f"ワークブックが見つかりません:\n{self.excel_path}")
            return

        if not self.bas_files:
            messagebox.showerror("エラー", "インポートするBASファイルがありません")
            return

        self.log("=" * 50, "INFO")
        self.log("インポート処理開始", "INFO")
        self.log("=" * 50, "INFO")

        # フェーズ1: エンコーディング変換
        self.log("\nフェーズ1: エンコーディング変換", "INFO")

        for i, (file_path, encoding, _) in enumerate(self.bas_files):
            if encoding == 'UTF-8':
                self.log(f"{file_path.name}: UTF-8 → Shift-JIS 変換中...", "INFO")

                if self.convert_to_shift_jis(file_path):
                    self.bas_files[i] = (file_path, 'Shift-JIS', '変換完了')
                    self.update_tree_item(file_path.name, encoding='Shift-JIS', status='変換完了')
                    self.log(f"{file_path.name}: 変換成功", "SUCCESS")
                else:
                    self.bas_files[i] = (file_path, encoding, '変換失敗')
                    self.update_tree_item(file_path.name, status='変換失敗')
            elif encoding == 'Shift-JIS':
                self.log(f"{file_path.name}: すでにShift-JIS", "INFO")
                self.bas_files[i] = (file_path, encoding, '変換不要')
                self.update_tree_item(file_path.name, status='変換不要')
            else:
                self.log(f"{file_path.name}: エンコーディング不明、そのまま続行", "WARNING")
                self.bas_files[i] = (file_path, encoding, '未変換')
                self.update_tree_item(file_path.name, status='未変換')

        # フェーズ2: インポート実行
        self.log("\nフェーズ2: Excelへインポート", "INFO")

        try:
            success = self.import_to_excel()

            if success:
                self.log("\n" + "=" * 50, "SUCCESS")
                self.log("インポート完了！", "SUCCESS")
                self.log("=" * 50, "SUCCESS")
                messagebox.showinfo("成功", "全てのモジュールを正常にインポートしました！")
            else:
                self.log("\n" + "=" * 50, "ERROR")
                self.log("インポート失敗", "ERROR")
                self.log("=" * 50, "ERROR")
                messagebox.showerror("エラー", "インポート処理でエラーが発生しました")

        except Exception as e:
            self.log(f"例外発生: {e}", "ERROR")
            messagebox.showerror("エラー", f"予期しないエラー:\n{e}")

    def update_tree_item(self, file_name, encoding=None, status=None):
        """Treeviewアイテムを更新"""
        for item in self.tree.get_children():
            values = list(self.tree.item(item, 'values'))
            if values[0] == file_name:
                if encoding:
                    values[1] = encoding
                if status:
                    values[2] = status
                self.tree.item(item, values=values)
                break

    def import_to_excel(self) -> bool:
        """Excelへインポート（PowerShell経由）"""
        try:
            import win32com.client as win32

            # Excel起動
            self.log("Excelを起動中...", "INFO")
            excel = win32.Dispatch("Excel.Application")
            excel.Visible = True
            excel.DisplayAlerts = False

            # ワークブックを開く
            self.log(f"ワークブックを開いています: {self.excel_path.name}", "INFO")
            wb = excel.Workbooks.Open(str(self.excel_path.absolute()))
            vb_project = wb.VBProject

            # モジュールをインポート
            success_count = 0

            for file_path, encoding, status in self.bas_files:
                try:
                    module_name = file_path.stem

                    # 既存モジュール削除
                    for vb_comp in vb_project.VBComponents:
                        if vb_comp.Name == module_name:
                            self.log(f"既存モジュールを削除: {module_name}", "INFO")
                            vb_project.VBComponents.Remove(vb_comp)
                            break

                    # モジュールインポート
                    vb_project.VBComponents.Import(str(file_path.absolute()))
                    self.log(f"インポート成功: {file_path.name}", "SUCCESS")
                    self.update_tree_item(file_path.name, status='インポート成功')
                    success_count += 1

                except Exception as e:
                    self.log(f"インポート失敗: {file_path.name} - {e}", "ERROR")
                    self.update_tree_item(file_path.name, status='インポート失敗')

            # 保存
            self.log("ワークブックを保存中...", "INFO")
            wb.Save()

            self.log(f"インポート結果: {success_count}/{len(self.bas_files)} 成功", "INFO")

            excel.DisplayAlerts = True

            return success_count == len(self.bas_files)

        except Exception as e:
            self.log(f"Excel処理エラー: {e}", "ERROR")
            return False

def main():
    root = TkinterDnD.Tk()
    app = VBAImportGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
