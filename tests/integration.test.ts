import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createServer } from '../src/server.js';
import { createSignature, createValidPayload, setupTestEnv } from './utils.test.js';
import type { Application } from 'express';

// 統合テスト - 実際のHTTPリクエスト/レスポンスをテスト

describe('GitHub Webhook Server - 統合テスト', () => {
  let app: Application;
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数のセットアップ
    process.env = { 
      ...originalEnv, 
      ...setupTestEnv()
    };

    // ログ出力を抑制
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    app = createServer();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('エンドツーエンドテスト', () => {
    it('完全なWebhookフローを処理する', async () => {
      const payload = createValidPayload({
        ref: 'refs/heads/main',
        commits: [
          {
            id: 'abc123',
            message: 'テストコミット',
            author: {
              name: 'テストユーザー',
              email: 'test@example.com',
            },
          },
        ],
      });

      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString, process.env.WEBHOOK_SECRET!);

      const response = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', signature)
        .set('User-Agent', 'GitHub-Hookshot/abc123')
        .send(payloadString);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'デプロイが正常にトリガーされました',
        timestamp: expect.any(String),
      });

      // レスポンスヘッダーの確認
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('複数の同時リクエストを処理する', async () => {
      const payload = createValidPayload();
      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString, process.env.WEBHOOK_SECRET!);

      // 複数の同時リクエストを送信
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Event', 'push')
            .set('X-Hub-Signature-256', signature)
            .send(payloadString)
        );

      const responses = await Promise.all(requests);

      // すべてのリクエストが成功することを確認
      responses.forEach((response: request.Response) => {
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          message: 'デプロイが正常にトリガーされました',
        });
      });
    });

    it('大きなペイロードを処理する', async () => {
      const largePayload = createValidPayload({
        commits: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: `commit-${i}`,
            message: `コミット ${i} - ${'x'.repeat(1000)}`, // 長いメッセージ
            author: {
              name: 'テストユーザー',
              email: 'test@example.com',
            },
          })),
      });

      const payloadString = JSON.stringify(largePayload);
      const signature = createSignature(payloadString, process.env.WEBHOOK_SECRET!);

      const response = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', signature)
        .send(payloadString);

      expect(response.status).toBe(200);
    });

    it('異なるブランチからのプッシュを適切に処理する', async () => {
      const branches = ['main', 'master', 'develop', 'feature/test'];

      for (const branch of branches) {
        const payload = createValidPayload({
          ref: `refs/heads/${branch}`,
        });

        const payloadString = JSON.stringify(payload);
        const signature = createSignature(payloadString, process.env.WEBHOOK_SECRET!);

        const response = await request(app)
          .post('/webhook')
          .set('Content-Type', 'application/json')
          .set('X-GitHub-Event', 'push')
          .set('X-Hub-Signature-256', signature)
          .send(payloadString);

        if (['main', 'master'].includes(branch)) {
          expect(response.status).toBe(200);
          expect(response.body).toMatchObject({
            message: 'デプロイが正常にトリガーされました',
          });
        } else {
          expect(response.status).toBe(200);
          expect(response.body).toMatchObject({
            message: `ブランチ ${branch} へのプッシュを無視しました`,
          });
        }
      }
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なJSONを適切に処理する', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', 'sha256=invalid')
        .send('{"invalid": json}'); // 無効なJSON

      expect(response.status).toBe(400);
    });

    it('存在しないエンドポイントに対して404を返す', async () => {
      const endpoints = ['/invalid', '/webhook/invalid', '/api/webhook'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'ページが見つかりません' });
      }
    });

    it('異なるHTTPメソッドを適切に処理する', async () => {
      const methods = ['get', 'put', 'patch', 'delete'] as const;

      for (const method of methods) {
        const response = await request(app)[method]('/webhook');
        expect(response.status).toBe(404);
      }
    });
  });

  describe('セキュリティテスト', () => {
    it('署名なしのリクエストを拒否する', async () => {
      const payload = createValidPayload();
      const payloadString = JSON.stringify(payload);

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .send(payloadString);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: '無効な署名です' });
    });

    it('間違った秘密鍵による署名を拒否する', async () => {
      const payload = createValidPayload();
      const payloadString = JSON.stringify(payload);
      const wrongSignature = createSignature(payloadString, 'wrong-secret');

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', wrongSignature)
        .send(payloadString);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: '無効な署名です' });
    });

    it('古い署名形式を拒否する', async () => {
      const payload = createValidPayload();
      const payloadString = JSON.stringify(payload);

      // SHA1署名（古い形式）を使用
      const sha1Signature =
        'sha1=' + crypto.createHmac('sha1', 'test-secret').update(payloadString).digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature', sha1Signature) // 古いヘッダー
        .send(payloadString);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: '無効な署名です' });
    });
  });

  describe('パフォーマンステスト', () => {
    it('リクエスト処理時間が許容範囲内である', async () => {
      const payload = createValidPayload();
      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString, process.env.WEBHOOK_SECRET!);

      const startTime = Date.now();

      const response = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', signature)
        .send(payloadString);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(processingTime).toBeLessThan(1000); // 1秒以内
    });
  });
});
