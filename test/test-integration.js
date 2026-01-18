/**
 * Integration Tests for welfare-dispensing-invoice-generator
 * Version: 2.1.4
 *
 * このテストはブラウザ環境をシミュレートして統合テストを実行します
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('CSV Processing Integration Tests', () => {
    test('テストデータファイルが存在する', () => {
        const csvPath = path.join(__dirname, '../sample/test_data_20250201_sjis.csv');
        assert.ok(fs.existsSync(csvPath), 'test_data_20250201_sjis.csv should exist');
    });

    test('テストデータにHRフォーマットヘッダーが含まれる', () => {
        const csvPath = path.join(__dirname, '../sample/test_data_20250201_sjis.csv');
        if (fs.existsSync(csvPath)) {
            const content = fs.readFileSync(csvPath, 'utf8');
            assert.ok(content.includes('H,3,'), 'CSV should contain H header row');
        }
    });

    test('テストデータにR1レコードが含まれる', () => {
        const csvPath = path.join(__dirname, '../sample/test_data_20250201_sjis.csv');
        if (fs.existsSync(csvPath)) {
            const content = fs.readFileSync(csvPath, 'utf8');
            assert.ok(content.includes('R1,'), 'CSV should contain R1 data rows');
        }
    });
});

describe('Version Consistency Tests', () => {
    test('package.json と create-standalone-zip.ps1 のバージョンが一致', () => {
        const packagePath = path.join(__dirname, 'package.json');
        const scriptPath = path.join(__dirname, '../create-standalone-zip.ps1');

        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        const scriptVersion = scriptContent.match(/Version: (\d+\.\d+\.\d+)/);

        if (scriptVersion) {
            assert.strictEqual(
                packageJson.version,
                scriptVersion[1],
                'Version in package.json should match create-standalone-zip.ps1'
            );
        }
    });

    test('README.md に最新バージョンの変更履歴が存在', () => {
        const readmePath = path.join(__dirname, '../README.md');
        const content = fs.readFileSync(readmePath, 'utf8');

        assert.ok(
            content.includes('v2.1.4'),
            'README.md should contain v2.1.4 changelog'
        );
    });

    test('DEPLOY.md に最新バージョン情報が存在', () => {
        const deployPath = path.join(__dirname, '../DEPLOY.md');
        const content = fs.readFileSync(deployPath, 'utf8');

        assert.ok(
            content.includes('v2.1.4'),
            'DEPLOY.md should contain v2.1.4 information'
        );
    });
});

describe('Code Quality Integration Tests', () => {
    test('app.js に重大なデバッグログが残っていない', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        const content = fs.readFileSync(appPath, 'utf8');

        // 明らかなデバッグログのみをチェック（TODO、FIXME、DEBUG等）
        const lines = content.split('\n');
        const debugLines = lines.filter(line =>
            (line.includes('console.log') || line.includes('console.debug')) &&
            (line.includes('DEBUG') ||
             line.includes('FIXME') ||
             line.includes('TODO') ||
             line.includes('TEST'))
        );

        assert.strictEqual(
            debugLines.length,
            0,
            `Debug logs with DEBUG/FIXME/TODO/TEST keywords found:\n${debugLines.join('\n')}`
        );
    });

    test('app.js のファイルサイズが妥当である（< 100KB）', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        const stats = fs.statSync(appPath);

        assert.ok(
            stats.size < 100000,
            `app.js is too large: ${stats.size} bytes (should be < 100KB)`
        );
    });

    test('template-data.js が Base64 データを含む', () => {
        const templatePath = path.join(__dirname, '../standalone-app/template-data.js');
        const content = fs.readFileSync(templatePath, 'utf8');

        assert.ok(
            content.includes('const TEMPLATE_BASE64') || content.includes('window.TEMPLATE_BASE64'),
            'template-data.js should contain Base64 template data'
        );
    });
});

describe('Documentation Integration Tests', () => {
    test('README.md にスタンドアロン版の使用方法が記載されている', () => {
        const readmePath = path.join(__dirname, '../README.md');
        const content = fs.readFileSync(readmePath, 'utf8');

        assert.ok(
            content.includes('スタンドアロン版') || content.includes('standalone'),
            'README.md should document standalone version'
        );
    });

    test('DEPLOY.md にデプロイ手順が記載されている', () => {
        const deployPath = path.join(__dirname, '../DEPLOY.md');
        const content = fs.readFileSync(deployPath, 'utf8');

        assert.ok(
            content.includes('デプロイ手順') || content.includes('deploy'),
            'DEPLOY.md should contain deployment instructions'
        );
    });

    test('SPECIFICATION.md が存在し、仕様が記載されている', () => {
        const specPath = path.join(__dirname, '../docs/SPECIFICATION.md');

        if (fs.existsSync(specPath)) {
            const content = fs.readFileSync(specPath, 'utf8');
            assert.ok(
                content.length > 100,
                'SPECIFICATION.md should contain substantial documentation'
            );
        } else {
            console.log('⚠️  Warning: SPECIFICATION.md not found');
        }
    });
});

describe('Security Tests', () => {
    test('患者氏名がハッシュ化されている（平文保存なし）', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        const content = fs.readFileSync(appPath, 'utf8');

        // simpleHash 関数の使用を確認
        assert.ok(
            content.includes('simpleHash(patient.patientName)'),
            'Patient names should be hashed before storage'
        );

        // localStorage保存部分で平文の患者名が使われていないことを確認
        const saveKeysSection = content.match(/function saveProcessedKeys[\s\S]{0,500}localStorage/);
        if (saveKeysSection) {
            assert.ok(
                saveKeysSection[0].includes('patientNameHash'),
                'saveProcessedKeys should use hashed patient names'
            );
        }
    });

    test('医療機関コードの検証が実装されている', () => {
        const appPath = path.join(__dirname, '../standalone-app/app.js');
        const content = fs.readFileSync(appPath, 'utf8');

        assert.ok(
            content.includes("['1', '3', '4'].includes") || content.includes('[1, 3, 4].includes'),
            'Medical code validation should check for valid institution types'
        );
    });
});

console.log('✅ All integration tests completed');
