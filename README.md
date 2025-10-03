# GitHub Webhook サーバー

🚀 TypeScript で構築されたセキュアで堅牢な GitHub webhook サーバーです。自動デプロイメントに対応しています。

## 機能

- ✅ **セキュア**: GitHub webhook 署名検証
- 🎯 **ターゲット指定**: 特定のブランチのみデプロイ
- 📝 **詳細ログ**: タイムスタンプ付きの構造化ログ
- 🔧 **設定可能**: 環境変数ベースの設定
- 🛡️ **型安全**: 完全な TypeScript 実装
- 🚨 **エラーハンドリング**: 包括的なエラーハンドリングと復旧
- 💾 **ヘルスチェック**: 内蔵ヘルスチェックエンドポイント
- 🔄 **グレースフルシャットダウン**: 適切なプロセス終了処理
- ⚡ **Yarn v4**: 最新の Yarn PnP 対応

## クイックスタート

### 1. インストール

```bash
# リポジトリのクローン
git clone <your-repo-url>
cd github-webhook-server

# 依存関係のインストール（Yarn v4）
yarn install

# 環境変数テンプレートのコピー
cp .env.example .env
```

### 2. 設定

`.env` ファイルを編集して設定を行います：

```bash
# 必須: GitHub webhook シークレット
WEBHOOK_SECRET=your_github_webhook_secret_here

# オプション: サーバー設定
PORT=3000
NODE_ENV=production

# デプロイ設定
PROJECT_PATH=/path/to/your/project
DEPLOY_COMMAND=git pull && yarn install && yarn build

# セキュリティ: 許可されたブランチ（カンマ区切り）
ALLOWED_BRANCHES=main,master

# デバッグ: 詳細ログの有効化
ENABLE_DETAILED_LOGS=false
```

## ファイル構成

```
github-webhook-server/
├── src/                      # ソースコード
│   ├── index.ts             # エントリーポイント
│   └── server.ts            # サーバー実装
├── tests/                   # テストファイル
│   ├── server.test.ts       # サーバーのユニットテスト
│   ├── integration.test.ts  # 統合テスト
│   ├── config.test.ts       # 設定テスト
│   └── utils.test.ts        # ユーティリティテスト
├── scripts/                 # デプロイ・運用スクリプト
│   ├── github-webhook.service  # systemd サービス設定
│   ├── install.sh           # 自動インストールスクリプト
│   ├── uninstall.sh         # アンインストールスクリプト
│   ├── .env.example         # 環境変数テンプレート
│   └── README.md            # Linux サービス設定ガイド
├── package.json             # パッケージ設定
├── tsconfig.json            # TypeScript 設定
├── eslint.config.mjs        # ESLint 設定
├── vitest.config.ts         # Vitest 設定
├── .env.example             # 環境変数テンプレート
└── README.md                # このファイル
```

## Linux サービスとしてのデプロイ

本番環境では systemd サービスとして実行することを推奨します。

### 自動インストール

```bash
# プロジェクトルートで実行
sudo ./scripts/install.sh
```

このスクリプトは以下を自動実行します：
- 専用ユーザー (`webhook`) の作成
- アプリケーションファイルのコピー
- 依存関係のインストール
- systemd サービスの登録
- 権限設定

### 手動設定

詳細な設定方法は [`scripts/README.md`](scripts/README.md) を参照してください。

```bash
# サービス開始
sudo systemctl start github-webhook

# 自動起動設定
sudo systemctl enable github-webhook

# ステータス確認
sudo systemctl status github-webhook

# ログ確認
sudo journalctl -u github-webhook -f
```

## 開発

### 1. 開発サーバー起動

```bash
# TypeScript 開発サーバー（ホットリロード）
yarn dev

# 本番ビルド
yarn build

# 本番サーバー起動
yarn start
```

### 2. テスト

## テスト

このプロジェクトは **95%以上のテストカバレッジ** を維持しています。

### テスト構成

- **ユニットテスト**: 個別の関数とモジュールのテスト
- **統合テスト**: HTTPエンドポイントとワークフローのテスト
- **設定テスト**: 環境変数と設定のテスト
- **セキュリティテスト**: 署名検証とセキュリティ機能のテスト

### テスト実行方法

```bash
# すべてのテストを実行
yarn test:run

# カバレッジレポート付きでテスト実行
yarn test:coverage

# テストUIでインタラクティブに実行
yarn test:ui

# 特定のテストファイルのみ実行
yarn test server.test.ts

# ウォッチモードでテスト実行
yarn test:watch
```

### カバレッジレポート

テスト実行後、カバレッジレポートは以下で確認できます：

- `coverage/index.html` - HTML形式の詳細レポート
- `coverage/coverage-summary.json` - JSON形式のサマリー

要求されるカバレッジ閾値：

- **Statements**: 95%以上
- **Branches**: 95%以上
- **Functions**: 95%以上
- **Lines**: 95%以上

### 4. 本番環境

```bash
# プロジェクトのビルド
yarn build

# サーバーの起動
yarn start
```

## API エンドポイント

### `POST /webhook`

GitHub イベント用のメイン webhook エンドポイント。

**ヘッダー:**

- `x-github-event`: イベント種別（例: "push"）
- `x-hub-signature-256`: 検証用 HMAC 署名

### `GET /health`

サーバーステータスを返すヘルスチェックエンドポイント。

**レスポンス:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "version": "1.0.0",
  "nodeVersion": "v20.0.0",
  "platform": "linux"
}
```

### `GET /`

基本的なサーバー情報を返すルートエンドポイント。

## GitHub Webhook 設定

1. GitHub リポジトリの設定に移動
2. "Webhooks" セクションに移動
3. "Add webhook" をクリック
4. Payload URL を設定: `https://your-domain.com/webhook`
5. Content type を設定: `application/json`
6. Secret を設定: （`.env` の `WEBHOOK_SECRET` と同じ値）
7. イベントを選択: "Push" イベント
8. webhook がアクティブであることを確認

## セキュリティ考慮事項

- ✅ 本番環境では必ず HTTPS を使用
- ✅ 強力でランダムな webhook シークレットを設定
- ✅ ファイアウォールを設定してアクセスを制限
- ✅ 特定のブランチ制限を使用
- ✅ 最小限の必要な権限で実行
- ✅ 不審な活動についてログを監視

## デプロイメント

### PM2 を使用

```bash
# PM2 をグローバルにインストール
yarn global add pm2

# アプリケーションの起動
pm2 start dist/index.js --name "webhook-server"

# PM2 設定の保存
pm2 save

# PM2 スタートアップスクリプトの設定
pm2 startup
```

### Docker を使用

```dockerfile
FROM node:20-alpine

# Yarn v4 のセットアップ
RUN corepack enable

WORKDIR /app

# 依存関係のインストール
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases/
RUN yarn install --immutable

# ソースコードのコピーとビルド
COPY . .
RUN yarn build

# 本番環境用の設定
EXPOSE 3000
USER node

CMD ["node", "dist/index.js"]
```

## トラブルシューティング

### よくある問題

1. **署名エラー**
   - `WEBHOOK_SECRET` が GitHub webhook シークレットと一致しているか確認
   - webhook が `x-hub-signature-256` ヘッダーを送信しているか確認

2. **デプロイ失敗**
   - `PROJECT_PATH` が存在し、アクセス可能であるか確認
   - `DEPLOY_COMMAND` の権限を確認
   - `ENABLE_DETAILED_LOGS=true` でデプロイログを確認

3. **ブランチがデプロイされない**
   - `ALLOWED_BRANCHES` にブランチ名が含まれているか確認
   - GitHub webhook が push イベント用に設定されているか確認

### ログ

デバッグ用に詳細ログを有効化：

```bash
ENABLE_DETAILED_LOGS=true
```

## Yarn v4 の利点

このプロジェクトは Yarn v4 を使用しており、以下の利点があります：

- 🚀 **高速インストール**: PnP（Plug'n'Play）による高速な依存関係解決
- 💾 **ディスク効率**: `.yarn/cache` による効率的なキャッシュ
- 🔒 **ゼロインストール**: Git にキャッシュを含めることで、`yarn install` 不要の環境構築
- 📦 **モジュール解決**: より効率的なモジュール解決システム

## 貢献

1. リポジトリをフォーク
2. フィーチャーブランチを作成
3. 変更を実装
4. 該当する場合はテストを追加
5. リンティングとフォーマットを実行
6. プルリクエストを提出

## ライセンス

MIT License - 詳細は LICENSE ファイルを参照してください。
