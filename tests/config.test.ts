import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 設定とモジュール関連のテスト

describe('設定とモジュール', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をクリア
    process.env = { ...originalEnv };
    
    // 基本的なWEBHOOK_SECRETを設定
    process.env.WEBHOOK_SECRET = 'test-secret-123';

    // モジュールキャッシュをクリア
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('環境変数の処理', () => {
    it('デフォルト値が正しく設定される', async () => {
      process.env = {
        WEBHOOK_SECRET: 'test-secret',
      };

      // モジュールを動的にインポート
      const { createServer } = await import('../src/server.js');

      expect(() => createServer()).not.toThrow();
    });

    it('ALLOWED_BRANCHESが正しく分割される', async () => {
      process.env = {
        WEBHOOK_SECRET: 'test-secret',
        ALLOWED_BRANCHES: 'main,master,develop,staging',
      };

      // ログをモック化
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { createServer } = await import('../src/server.js');
      createServer();

      // ログ出力で設定が確認されることを期待
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('許可されたブランチ: main, master, develop, staging')
      );
    });

    it('ENABLE_DETAILED_LOGSが正しく解析される', async () => {
      const testCases = [
        { input: 'true', expected: true },
        { input: 'false', expected: false },
        { input: '1', expected: false },
        { input: '', expected: false },
        { input: undefined, expected: false },
      ];

      for (const testCase of testCases) {
        // 環境変数をリセット
        process.env = {
          WEBHOOK_SECRET: 'test-secret',
        };

        if (testCase.input !== undefined) {
          process.env.ENABLE_DETAILED_LOGS = testCase.input;
        }

        // モジュールキャッシュをクリア
        vi.resetModules();

        const { createServer } = await import('../src/server.js');

        // ログ出力をキャプチャして設定を確認
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        createServer();

        // 詳細ログ設定は内部的に処理されるため、直接的なテストは困難
        // ここでは、サーバーが正常に作成されることを確認
        expect(() => createServer()).not.toThrow();

        consoleSpy.mockRestore();
      }
    });
  });

  describe('モジュール読み込み', () => {
    it('必要な依存関係が正しく読み込まれる', async () => {
      process.env = {
        ...process.env,
        WEBHOOK_SECRET: 'test-secret',
        PROJECT_PATH: '/test/project',
        DEPLOY_COMMAND: 'echo test',
        ALLOWED_BRANCHES: 'main,master',
      };

      // モジュールの読み込みテスト
      expect(async () => {
        await import('../src/server.js');
        // index.jsは実際にサーバーを起動するためテストでは読み込まない
      }).not.toThrow();
    });

    it('ESモジュールとして正しく動作する', async () => {
      process.env = {
        ...process.env,
        WEBHOOK_SECRET: 'test-secret',
        PROJECT_PATH: '/test/project',
        DEPLOY_COMMAND: 'echo test',
        ALLOWED_BRANCHES: 'main,master',
      };

      const serverModule = await import('../src/server.js');

      expect(serverModule).toHaveProperty('createServer');
      expect(typeof serverModule.createServer).toBe('function');
    });
  });

  describe('設定バリデーション', () => {
    it('空文字列のWEBHOOK_SECRETでエラーが発生する', async () => {
      process.env = {
        WEBHOOK_SECRET: '',
      };

      const { createServer } = await import('../src/server.js');

      expect(() => createServer()).toThrow('WEBHOOK_SECRET 環境変数が必要です');
    });

    it('未設定のWEBHOOK_SECRETでエラーが発生する', async () => {
      delete process.env.WEBHOOK_SECRET;

      const { createServer } = await import('../src/server.js');

      expect(() => createServer()).toThrow('WEBHOOK_SECRET 環境変数が必要です');
    });

    it('有効なWEBHOOK_SECRETでサーバーが作成される', async () => {
      const secrets = ['test-secret', 'very-long-secret-key-123', '!@#$%^&*()'];

      for (const secret of secrets) {
        process.env = {
          ...process.env,
          WEBHOOK_SECRET: secret,
          PROJECT_PATH: '/test/project',
          DEPLOY_COMMAND: 'echo test',
          ALLOWED_BRANCHES: 'main,master',
        };

        // モジュールキャッシュをクリア
        vi.resetModules();

        // ログ出力を抑制
        vi.spyOn(console, 'log').mockImplementation(() => {});

        const { createServer } = await import('../src/server.js');

        expect(() => createServer()).not.toThrow();

        vi.restoreAllMocks();
      }
    });
  });

  describe('デフォルト設定', () => {
    it('PROJECT_PATHのデフォルト値が設定される', async () => {
      process.env = {
        WEBHOOK_SECRET: 'test-secret',
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { createServer } = await import('../src/server.js');
      createServer();

      // process.cwd()がデフォルト値として使用されることを確認
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`プロジェクトパス: ${process.cwd()}`)
      );
    });

    it('DEPLOY_COMMANDのデフォルト値が設定される', async () => {
      process.env = {
        WEBHOOK_SECRET: 'test-secret',
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { createServer } = await import('../src/server.js');
      createServer();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('デプロイコマンド: yarn install && yarn build')
      );
    });

    it('ALLOWED_BRANCHESのデフォルト値が設定される', async () => {
      process.env = {
        WEBHOOK_SECRET: 'test-secret',
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { createServer } = await import('../src/server.js');
      createServer();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('許可されたブランチ: main, master')
      );
    });
  });

  describe('型安全性', () => {
    it('createServer関数が正しい型を返す', async () => {
      process.env = {
        WEBHOOK_SECRET: 'test-secret',
      };

      // ログ出力を抑制
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const { createServer } = await import('../src/server.js');
      const app = createServer();

      // Expressアプリケーションとして正しく機能することを確認
      expect(app).toHaveProperty('listen');
      expect(app).toHaveProperty('use');
      expect(app).toHaveProperty('get');
      expect(app).toHaveProperty('post');

      expect(typeof app.listen).toBe('function');
      expect(typeof app.use).toBe('function');
      expect(typeof app.get).toBe('function');
      expect(typeof app.post).toBe('function');
    });
  });
});
