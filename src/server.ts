import 'dotenv/config';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// 型定義
interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

interface GitHubWebhookPayload {
  ref?: string;
  repository?: {
    name: string;
    full_name: string;
  };
  pusher?: {
    name: string;
    email: string;
  };
}

interface DeployResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

// 設定を動的に取得する関数
function getConfig() {
  return {
    secret: process.env.WEBHOOK_SECRET,
    projectPath: process.env.PROJECT_PATH || process.cwd(),
    deployCommand: process.env.DEPLOY_COMMAND || 'yarn install && yarn build',
    allowedBranches: process.env.ALLOWED_BRANCHES?.split(',') || ['main', 'master'],
    enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS === 'true',
  } as const;
}

// バリデーション
function validateConfig(): void {
  const config = getConfig();
  if (!config.secret) {
    throw new Error('WEBHOOK_SECRET 環境変数が必要です');
  }

  console.log('📋 設定を読み込みました:');
  console.log(`  プロジェクトパス: ${config.projectPath}`);
  console.log(`  デプロイコマンド: ${config.deployCommand}`);
  console.log(`  許可されたブランチ: ${config.allowedBranches.join(', ')}`);
}

// ユーティリティ関数
function createLogger(prefix: string) {
  return {
    info: (message: string, ...args: unknown[]) =>
      console.log(`${new Date().toISOString()} [${prefix}] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) =>
      console.warn(`${new Date().toISOString()} [${prefix}] ⚠️  ${message}`, ...args),
    error: (message: string, ...args: unknown[]) =>
      console.error(`${new Date().toISOString()} [${prefix}] ❌ ${message}`, ...args),
  };
}

const logger = createLogger('WEBHOOK');

// 署名検証
function verifySignature(req: WebhookRequest): boolean {
  const config = getConfig();
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    logger.warn('署名ヘッダーが見つかりません');
    return false;
  }

  if (!req.rawBody) {
    logger.warn('生のリクエストボディが見つかりません');
    return false;
  }

  const hmac = crypto.createHmac('sha256', config.secret!);
  hmac.update(req.rawBody);
  const expected = 'sha256=' + hmac.digest('hex');

  try {
    // バッファ長を揃える必要がある
    if (signature.length !== expected.length) {
      logger.warn('無効な署名です');
      return false;
    }
    
    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!isValid) {
      logger.warn('無効な署名です');
    }
    return isValid;
  } catch (error) {
    logger.error('署名検証に失敗しました:', error);
    return false;
  }
}

// ブランチチェック
function isAllowedBranch(ref: string): boolean {
  const config = getConfig();
  const branch = ref.replace('refs/heads/', '');
  return config.allowedBranches.includes(branch);
}

// デプロイ実行
async function executeDeployment(): Promise<DeployResult> {
  const config = getConfig();
  try {
    logger.info('🚀 デプロイを開始します...');
    logger.info(`実行コマンド: cd ${config.projectPath} && ${config.deployCommand}`);

    const { stdout, stderr } = await execAsync(
      `cd ${config.projectPath} && ${config.deployCommand}`,
      { timeout: 300000 } // 5分のタイムアウト
    );

    if (config.enableDetailedLogs) {
      logger.info('デプロイ標準出力:', stdout);
      if (stderr) {
        logger.warn('デプロイ標準エラー:', stderr);
      }
    }

    logger.info('✅ デプロイが正常に完了しました');
    return { success: true, stdout, stderr };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '不明なデプロイエラー';
    logger.error('❌ デプロイに失敗しました:', errorMessage);

    return {
      success: false,
      error: errorMessage,
      stdout: error instanceof Error && 'stdout' in error ? String(error.stdout) : undefined,
      stderr: error instanceof Error && 'stderr' in error ? String(error.stderr) : undefined,
    };
  }
}

// Webhook ハンドラー
async function handleWebhook(req: WebhookRequest, res: Response): Promise<void> {
  try {
    // 署名検証
    if (!verifySignature(req)) {
      res.status(403).json({ error: '無効な署名です' });
      return;
    }

    const event = req.headers['x-github-event'] as string;
    const payload = req.body as GitHubWebhookPayload;

    logger.info(`📨 ${event} イベントを受信しました`);

    if (event !== 'push') {
      logger.info(`${event} イベントは無視します`);
      res.status(200).json({ message: `${event} イベントを無視しました` });
      return;
    }

    // ブランチチェック
    if (payload.ref && !isAllowedBranch(payload.ref)) {
      const branch = payload.ref.replace('refs/heads/', '');
      logger.info(`ブランチ ${branch} へのプッシュは無視します`);
      res.status(200).json({ message: `ブランチ ${branch} へのプッシュを無視しました` });
      return;
    }

    // デプロイ情報をログ出力
    if (payload.repository && payload.pusher) {
      logger.info(`📦 リポジトリ: ${payload.repository.full_name}`);
      logger.info(`👤 プッシュユーザー: ${payload.pusher.name} <${payload.pusher.email}>`);
    }

    // デプロイ実行（非同期）
    executeDeployment().catch(error => {
      logger.error('未処理のデプロイエラー:', error);
    });

    res.status(200).json({
      message: 'デプロイが正常にトリガーされました',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Webhook ハンドラーエラー:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
}

// ヘルスチェックエンドポイント
function handleHealthCheck(req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
    nodeVersion: process.version,
    platform: process.platform,
  });
}

// サーバー作成
export function createServer(): Application {
  // 設定検証
  validateConfig();

  const app = express();

  // ミドルウェア
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: WebhookRequest, res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // JSON パースエラーハンドラー
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: '無効なJSONです' });
      return;
    }
    next(error);
  });

  // ルート
  app.post('/webhook', handleWebhook);
  app.get('/health', handleHealthCheck);
  app.get('/', (req, res) => {
    res.json({ message: 'GitHub Webhook サーバーが稼働中です' });
  });

  // 404ハンドラー
  app.use((req, res) => {
    res.status(404).json({ error: 'ページが見つかりません' });
  });

  // エラーハンドラー
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('未処理エラー:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  });

  return app;
}
