import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

// テストユーティリティ関数

/**
 * GitHub webhook の署名を作成する
 */
export function createSignature(payload: string, secret: string = 'test-secret'): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return 'sha256=' + hmac.digest('hex');
}

/**
 * 有効なGitHub webhookペイロードを作成する
 */
export function createValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    ref: 'refs/heads/main',
    repository: {
      name: 'test-repo',
      full_name: 'user/test-repo',
    },
    pusher: {
      name: 'testuser',
      email: 'test@example.com',
    },
    ...overrides,
  };
}

/**
 * 環境変数をテスト用にセットアップする
 */
export function setupTestEnv(overrides: Record<string, string> = {}) {
  return {
    WEBHOOK_SECRET: 'test-secret',
    PROJECT_PATH: '/test/project',
    DEPLOY_COMMAND: 'echo "test deploy"',
    ALLOWED_BRANCHES: 'main,master',
    ENABLE_DETAILED_LOGS: 'false',
    ...overrides,
  };
}

describe('テストユーティリティ', () => {
  describe('createSignature', () => {
    it('正しいHMAC-SHA256署名を生成する', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      const signature = createSignature(payload, secret);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);

      // 同じペイロードと秘密で同じ署名が生成される
      const signature2 = createSignature(payload, secret);
      expect(signature).toBe(signature2);

      // 異なる秘密で異なる署名が生成される
      const signature3 = createSignature(payload, 'different-secret');
      expect(signature).not.toBe(signature3);
    });
  });

  describe('createValidPayload', () => {
    it('デフォルトの有効なペイロードを作成する', () => {
      const payload = createValidPayload();

      expect(payload).toEqual({
        ref: 'refs/heads/main',
        repository: {
          name: 'test-repo',
          full_name: 'user/test-repo',
        },
        pusher: {
          name: 'testuser',
          email: 'test@example.com',
        },
      });
    });

    it('オーバーライドされた値で設定を上書きする', () => {
      const payload = createValidPayload({
        ref: 'refs/heads/develop',
        repository: {
          name: 'custom-repo',
          full_name: 'custom/custom-repo',
        },
      });

      expect(payload.ref).toBe('refs/heads/develop');
      expect(payload.repository.name).toBe('custom-repo');
      expect(payload.repository.full_name).toBe('custom/custom-repo');
      expect(payload.pusher.name).toBe('testuser'); // オーバーライドされていない値は保持
    });
  });

  describe('setupTestEnv', () => {
    it('デフォルトのテスト環境変数を設定する', () => {
      const env = setupTestEnv();

      expect(env).toEqual({
        WEBHOOK_SECRET: 'test-secret',
        PROJECT_PATH: '/test/project',
        DEPLOY_COMMAND: 'echo "test deploy"',
        ALLOWED_BRANCHES: 'main,master',
        ENABLE_DETAILED_LOGS: 'false',
      });
    });

    it('オーバーライドされた環境変数を適用する', () => {
      const env = setupTestEnv({
        PROJECT_PATH: '/custom/path',
        ALLOWED_BRANCHES: 'main,staging',
        CUSTOM_VAR: 'custom-value',
      });

      expect(env.PROJECT_PATH).toBe('/custom/path');
      expect(env.ALLOWED_BRANCHES).toBe('main,staging');
      expect((env as Record<string, string>).CUSTOM_VAR).toBe('custom-value');
      expect(env.WEBHOOK_SECRET).toBe('test-secret'); // オーバーライドされていない値は保持
    });
  });
});
