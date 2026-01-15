/**
 * ============================================================================
 * Vite Configuration
 * 調剤券請求書作成ツール - Webアプリ版
 * ============================================================================
 */

import { defineConfig } from 'vite';

export default defineConfig({
  // ルートディレクトリ
  root: '.',

  // 開発サーバー設定
  server: {
    port: 3000,
    open: true, // ブラウザ自動起動
    cors: true,
  },

  // ビルド設定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 本番ビルドでconsole.logを削除
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // ライブラリを分割
          'excel': ['exceljs'],
          'csv': ['papaparse'],
          'storage': ['localforage'],
        },
      },
    },
  },

  // 依存関係の最適化
  optimizeDeps: {
    include: ['exceljs', 'papaparse', 'localforage'],
  },

  // プラグイン設定（必要に応じて追加）
  plugins: [],
});
