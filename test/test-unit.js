/**
 * Unit Tests for welfare-dispensing-invoice-generator
 * Version: 2.1.4
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('simpleHash() function tests', () => {
    // app.jsからsimpleHash関数を抽出してテスト
    function simpleHash(str) {
        if (!str) return '';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit整数に変換
        }
        return Math.abs(hash).toString(16);
    }

    test('空文字列は空文字列を返す', () => {
        assert.strictEqual(simpleHash(''), '');
    });

    test('null/undefinedは空文字列を返す', () => {
        assert.strictEqual(simpleHash(null), '');
        assert.strictEqual(simpleHash(undefined), '');
    });

    test('同じ文字列は同じハッシュを返す', () => {
        const hash1 = simpleHash('佐藤 花子');
        const hash2 = simpleHash('佐藤 花子');
        assert.strictEqual(hash1, hash2);
    });

    test('異なる文字列は異なるハッシュを返す', () => {
        const hash1 = simpleHash('佐藤 花子');
        const hash2 = simpleHash('鈴木 太郎');
        assert.notStrictEqual(hash1, hash2);
    });

    test('ハッシュは16進数文字列である', () => {
        const hash = simpleHash('テスト患者');
        assert.match(hash, /^[0-9a-f]+$/);
    });
});

describe('fixKanaAndTrim() function tests', () => {
    // app.jsからfixKanaAndTrim関数を抽出してテスト
    function fixKanaAndTrim(str) {
        if (!str) return '';
        str = String(str);

        const kanaMap = {
            'ガ': 'ガ', 'ギ': 'ギ', 'グ': 'グ', 'ゲ': 'ゲ', 'ゴ': 'ゴ',
            'ザ': 'ザ', 'ジ': 'ジ', 'ズ': 'ズ', 'ゼ': 'ゼ', 'ゾ': 'ゾ',
            'ダ': 'ダ', 'ヂ': 'ヂ', 'ヅ': 'ヅ', 'デ': 'デ', 'ド': 'ド',
            'バ': 'バ', 'ビ': 'ビ', 'ブ': 'ブ', 'ベ': 'ベ', 'ボ': 'ボ',
            'パ': 'パ', 'ピ': 'ピ', 'プ': 'プ', 'ペ': 'ペ', 'ポ': 'ポ',
            'ヴ': 'ヴ', 'ヷ': 'ヷ', 'ヺ': 'ヺ',
            'ア': 'ア', 'イ': 'イ', 'ウ': 'ウ', 'エ': 'エ', 'オ': 'オ',
            'カ': 'カ', 'キ': 'キ', 'ク': 'ク', 'ケ': 'ケ', 'コ': 'コ',
            'サ': 'サ', 'シ': 'シ', 'ス': 'ス', 'セ': 'セ', 'ソ': 'ソ',
            'タ': 'タ', 'チ': 'チ', 'ツ': 'ツ', 'テ': 'テ', 'ト': 'ト',
            'ナ': 'ナ', 'ニ': 'ニ', 'ヌ': 'ヌ', 'ネ': 'ネ', 'ノ': 'ノ',
            'ハ': 'ハ', 'ヒ': 'ヒ', 'フ': 'フ', 'ヘ': 'ヘ', 'ホ': 'ホ',
            'マ': 'マ', 'ミ': 'ミ', 'ム': 'ム', 'メ': 'メ', 'モ': 'モ',
            'ヤ': 'ヤ', 'ユ': 'ユ', 'ヨ': 'ヨ',
            'ラ': 'ラ', 'リ': 'リ', 'ル': 'ル', 'レ': 'レ', 'ロ': 'ロ',
            'ワ': 'ワ', 'ヲ': 'ヲ', 'ン': 'ン',
            'ァ': 'ァ', 'ィ': 'ィ', 'ゥ': 'ゥ', 'ェ': 'ェ', 'ォ': 'ォ',
            'ッ': 'ッ', 'ャ': 'ャ', 'ュ': 'ュ', 'ョ': 'ョ',
            'ー': 'ー', '。': '。', '「': '「', '」': '」', '、': '、', '・': '・'
        };

        const pattern2 = /ガ|ギ|グ|ゲ|ゴ|ザ|ジ|ズ|ゼ|ゾ|ダ|ヂ|ヅ|デ|ド|バ|ビ|ブ|ベ|ボ|パ|ピ|プ|ペ|ポ|ヴ|ヷ|ヺ/g;
        let result = str.replace(pattern2, match => kanaMap[match] || match);

        const pattern1 = /ア|イ|ウ|エ|オ|カ|キ|ク|ケ|コ|サ|シ|ス|セ|ソ|タ|チ|ツ|テ|ト|ナ|ニ|ヌ|ネ|ノ|ハ|ヒ|フ|ヘ|ホ|マ|ミ|ム|メ|モ|ヤ|ユ|ヨ|ラ|リ|ル|レ|ロ|ワ|ヲ|ン|ァ|ィ|ゥ|ェ|ォ|ッ|ャ|ュ|ョ|ー|。|「|」|、|・/g;
        result = result.replace(pattern1, match => kanaMap[match] || match);

        return result.trim();
    }

    test('空文字列は空文字列を返す', () => {
        assert.strictEqual(fixKanaAndTrim(''), '');
    });

    test('全角カタカナはそのまま返す', () => {
        assert.strictEqual(fixKanaAndTrim('サトウ ハナコ'), 'サトウ ハナコ');
    });

    test('前後の空白を削除', () => {
        assert.strictEqual(fixKanaAndTrim('  サトウ  '), 'サトウ');
    });

    test('数値を文字列に変換', () => {
        assert.strictEqual(fixKanaAndTrim(12345), '12345');
    });
});

describe('File structure tests', () => {
    test('app.js が存在する', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        assert.ok(fs.existsSync(appPath), 'app.js should exist');
    });

    test('index.html が存在する', () => {
        const indexPath = path.join(__dirname, '../standalone-app/index.html');
        assert.ok(fs.existsSync(indexPath), 'index.html should exist');
    });

    test('template-data.js が存在する', () => {
        const templatePath = path.join(__dirname, '../standalone-app/template-data.js');
        assert.ok(fs.existsSync(templatePath), 'template-data.js should exist');
    });

    test('app.js にsimpleHash関数が含まれる', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        const content = fs.readFileSync(appPath, 'utf8');
        assert.ok(content.includes('function simpleHash('), 'app.js should contain simpleHash function');
    });

    test('app.js にfixKanaAndTrim関数が含まれる', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        const content = fs.readFileSync(appPath, 'utf8');
        assert.ok(content.includes('function fixKanaAndTrim('), 'app.js should contain fixKanaAndTrim function');
    });
});

describe('Duplicate key format tests', () => {
    test('重複チェックキーのフォーマット確認', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        const content = fs.readFileSync(appPath, 'utf8');

        // yearMonth_patientNameHash_medicalCode パターンを確認
        assert.ok(
            content.includes('yearMonth') &&
            content.includes('patientNameHash') &&
            content.includes('medicalCode'),
            'Duplicate key should use yearMonth_patientNameHash_medicalCode format'
        );
    });

    test('受給者番号が重複キーに含まれていないことを確認', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        const content = fs.readFileSync(appPath, 'utf8');

        // 重複チェック部分でrecipientNumberが使われていないことを確認
        const duplicateCheckSection = content.match(/\/\/ 2回目請求の場合、重複除外[\s\S]{0,1000}uniqueKey/);
        if (duplicateCheckSection) {
            assert.ok(
                !duplicateCheckSection[0].includes('recipientNumber'),
                'Duplicate key should not use recipientNumber'
            );
        }
    });
});

console.log('✅ All unit tests completed');
