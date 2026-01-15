"""
元のテンプレートファイルをBase64エンコードしてtemplate-data.jsを作成

使い方:
python create-original-template.py
"""

import base64
import os

def create_original_template():
    print('元のテンプレートファイルを読み込み中...')

    template_path = os.path.join(os.path.dirname(__file__), 'tyouzai_excel_v2.xlsx')

    # ファイルを読み込んでBase64エンコード
    with open(template_path, 'rb') as f:
        file_data = f.read()
        base64_data = base64.b64encode(file_data).decode('utf-8')

    # JavaScriptファイルとして保存
    js_path = os.path.join(os.path.dirname(__file__), 'template-data.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('// 元のテンプレートファイル (Base64エンコード済み)\n')
        f.write('const TEMPLATE_BASE64 = \'')
        f.write(base64_data)
        f.write('\';\n')

    print('\n完了しました！')
    print(f'JavaScriptファイル: {js_path}')
    print(f'Base64サイズ: {len(base64_data)} 文字')
    print(f'元のファイルサイズ: {len(file_data)} バイト')

if __name__ == '__main__':
    try:
        create_original_template()
    except Exception as e:
        print(f'❌ エラーが発生しました: {e}')
        import traceback
        traceback.print_exc()
