import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import request from 'supertest';
import { exec } from 'node:child_process';
import { createServer } from '../src/server.js';
import { createSignature } from './utils.test.js';
import type { Application } from 'express';

// child_process.exec をモック化
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

// console.log, console.warn, console.error をモック化（ログ出力を抑制）
vi.mock('console', () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockExec = exec as MockedFunction<typeof exec>;

describe('GitHub Webhook Server', () => {
  let app: Application;
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数のリセット
    process.env = {
      ...originalEnv,
      WEBHOOK_SECRET: 'test-secret',
      PROJECT_PATH: '/test/project',
      DEPLOY_COMMAND: 'echo "test deploy"',
      ALLOWED_BRANCHES: 'main,master',
      ENABLE_DETAILED_LOGS: 'false',
    };

    // モックのリセット
    vi.clearAllMocks();
    
    // ログ出力を抑制
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // アプリケーションの作成
    app = createServer();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('設定検証', () => {
    it('WEBHOOK_SECRETが設定されていない場合エラーを投げる', async () => {
      // 環境変数を削除
      delete process.env.WEBHOOK_SECRET;
      
      // モジュールキャッシュをリセット
      vi.resetModules();
      
      // サーバーモジュールを再インポート
      const { createServer: createServerNew } = await import('../src/server.js');
      
      expect(() => createServerNew()).toThrow('WEBHOOK_SECRET 環境変数が必要です');
    });
  });

  describe('GET /', () => {
    it('基本的なサーバー情報を返す', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'GitHub Webhook サーバーが稼働中です',
      });
    });
  });

  describe('GET /health', () => {
    it('ヘルスチェック情報を返す', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        nodeVersion: expect.any(String),
        platform: expect.any(String),
      });
    });
  });

  describe('POST /webhook', () => {
    const validPayload = {
      ref: 'refs/heads/main',
      repository: {
        name: 'test-repo',
        full_name: 'user/test-repo',
      },
      pusher: {
        name: 'testuser',
        email: 'test@example.com',
      },
    };

    it('有効な署名でpushイベントを受け付ける', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = createSignature(payload);

      // execのモック設定（成功）
      mockExec.mockImplementation(((command: string, options: any, callback: any) => {
        (callback as (error: null, stdout: string, stderr: string) => void)(
          null,
          'デプロイ成功',
          ''
        );
        return {} as any; // ChildProcessのモック
      }) as any);

      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .set('x-hub-signature-256', signature)
        .set('content-type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'デプロイが正常にトリガーされました',
        timestamp: expect.any(String),
      });
    });

    it('無効な署名を拒否する', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .set('x-hub-signature-256', 'sha256=invalid-signature')
        .send(validPayload);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: '無効な署名です' });
    });

    it('署名ヘッダーが無い場合を拒否する', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .send(validPayload);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: '無効な署名です' });
    });

    it('pushイベント以外を無視する', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = createSignature(payload);

      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'issues')
        .set('x-hub-signature-256', signature)
        .set('content-type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'issues イベントを無視しました' });
    });

    it('許可されていないブランチを無視する', async () => {
      const payload = JSON.stringify({
        ...validPayload,
        ref: 'refs/heads/develop',
      });
      const signature = createSignature(payload);

      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .set('x-hub-signature-256', signature)
        .set('content-type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'ブランチ develop へのプッシュを無視しました' });
    });

    it('デプロイコマンドが実行される', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = createSignature(payload);

      // execのモック設定
      mockExec.mockImplementation(((command: string, options: any, callback: any) => {
        expect(command).toBe('cd /test/project && echo "test deploy"');
        (callback as (error: null, stdout: string, stderr: string) => void)(
          null,
          'デプロイ成功',
          ''
        );
        return {} as any; // ChildProcessのモック
      }) as any);

      await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .set('x-hub-signature-256', signature)
        .set('content-type', 'application/json')
        .send(payload);

      // 少し待ってからexecが呼ばれたことを確認
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockExec).toHaveBeenCalledTimes(1);
    });

    it('デプロイ失敗をログに記録する', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = createSignature(payload);

      // execのモック設定（失敗）
      mockExec.mockImplementation(((command: string, options: any, callback: any) => {
        const error = new Error('デプロイ失敗') as Error & {
          stdout?: string;
          stderr?: string;
        };
        error.stdout = '';
        error.stderr = 'エラー詳細';
        (callback as (error: Error) => void)(error);
        return {} as any; // ChildProcessのモック
      }) as any);

      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .set('x-hub-signature-256', signature)
        .set('content-type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'デプロイが正常にトリガーされました',
      });
    });

    it('ALLOWED_BRANCHES設定が複数ブランチに対応する', async () => {
      process.env.ALLOWED_BRANCHES = 'main,master,staging';
      app = createServer();

      const payload = JSON.stringify({
        ...validPayload,
        ref: 'refs/heads/staging',
      });
      const signature = createSignature(payload);

      mockExec.mockImplementation(((command: string, options: any, callback: any) => {
        (callback as (error: null, stdout: string, stderr: string) => void)(
          null,
          'デプロイ成功',
          ''
        );
        return {} as any; // ChildProcessのモック
      }) as any);

      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .set('x-hub-signature-256', signature)
        .set('content-type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'デプロイが正常にトリガーされました',
      });
    });
  });

  describe('404 ハンドラー', () => {
    it('存在しないエンドポイントに対して404を返す', async () => {
      const response = await request(app).get('/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'ページが見つかりません' });
    });
  });
});
