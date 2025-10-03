import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // テスト環境の設定
    environment: 'node',

    // グローバル変数を有効化
    globals: true,

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.{js,ts,mjs}',
        '**/index.ts', // エントリーポイントファイルは除外
      ],
      // 95%以上のカバレッジを要求
      thresholds: {
        global: {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },

    // テストファイルのパターン
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.yarn'],

    // タイムアウト設定
    testTimeout: 10000,
    hookTimeout: 10000,

    // 並列実行
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },

  // エイリアス設定
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
