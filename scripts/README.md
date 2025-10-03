# GitHub Webhook Server - Linux サービス設定

このディレクトリには、GitHub Webhook ServerをLinuxサービス（systemd）として実行するためのファイルが含まれています。

## ファイル構成

### `github-webhook.service`
systemd サービス設定ファイル。以下の機能を提供します：

- **自動起動**: システム起動時にサービスを自動開始
- **プロセス管理**: クラッシュ時の自動再起動
- **セキュリティ**: 専用ユーザーでの実行、ファイルシステム保護
- **ログ管理**: systemd journal との統合
- **リソース制限**: CPU・メモリ使用量の制御

### `install.sh`
自動インストールスクリプト。以下の作業を自動化します：

- 専用ユーザー・グループの作成
- アプリケーションファイルのコピー
- 依存関係のインストール（yarn/npm）
- 権限設定
- systemd サービスの登録
- 環境設定ファイルの作成

### `uninstall.sh`
自動アンインストールスクリプト。以下の作業を実行します：

- サービスの停止・無効化
- アプリケーションファイルの削除
- ユーザー・グループの削除
- 設定ファイルの削除

## インストール手順

### 1. 前提条件
```bash
# Node.js のインストール（Ubuntu/Debian）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# yarn のインストール（推奨）
npm install -g yarn
```

### 2. 自動インストール
```bash
# プロジェクトルートで実行
sudo ./scripts/install.sh
```

### 3. 環境設定の編集
```bash
sudo nano /opt/github-webhook-server/.env
```

必要な設定項目：
```env
WEBHOOK_SECRET=your-github-webhook-secret
PROJECT_PATH=/path/to/your/project
DEPLOY_COMMAND=git pull && npm install && pm2 restart app
ALLOWED_BRANCHES=main,master
PORT=3000
```

### 4. サービスの開始
```bash
# サービス開始
sudo systemctl start github-webhook

# 自動起動設定
sudo systemctl enable github-webhook

# ステータス確認
sudo systemctl status github-webhook
```

## サービス管理

### 基本操作
```bash
# サービス開始
sudo systemctl start github-webhook

# サービス停止
sudo systemctl stop github-webhook

# サービス再起動
sudo systemctl restart github-webhook

# サービス再読み込み
sudo systemctl reload github-webhook

# 自動起動有効化
sudo systemctl enable github-webhook

# 自動起動無効化
sudo systemctl disable github-webhook
```

### ログ確認
```bash
# リアルタイムログ
sudo journalctl -u github-webhook -f

# 最新ログ
sudo journalctl -u github-webhook -n 50

# エラーログのみ
sudo journalctl -u github-webhook -p err

# 日付指定
sudo journalctl -u github-webhook --since "2024-01-01" --until "2024-01-02"
```

### ステータス確認
```bash
# 詳細ステータス
sudo systemctl status github-webhook

# プロセス確認
ps aux | grep github-webhook

# ポート使用状況
sudo netstat -tlnp | grep :3000
```

## セキュリティ設定

### ファイアウォール
```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### SSL/TLS 対応
本番環境では Nginx や Apache をリバースプロキシとして使用することを推奨：

```nginx
# /etc/nginx/sites-available/webhook
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## トラブルシューティング

### よくある問題

1. **ポート使用エラー**
   ```bash
   # ポート使用状況確認
   sudo lsof -i :3000
   
   # 別のポートに変更
   sudo nano /opt/github-webhook-server/.env
   # PORT=3001 に変更
   sudo systemctl restart github-webhook
   ```

2. **権限エラー**
   ```bash
   # ファイル権限確認
   ls -la /opt/github-webhook-server/
   
   # 権限修正
   sudo chown -R webhook:webhook /opt/github-webhook-server/
   ```

3. **Node.js バージョン問題**
   ```bash
   # Node.js バージョン確認
   node --version
   
   # 最新LTSにアップデート
   sudo apt update && sudo apt upgrade nodejs
   ```

### ログによる問題診断
```bash
# エラーログの確認
sudo journalctl -u github-webhook -p err -n 20

# 設定検証
sudo systemctl verify github-webhook.service

# 環境変数確認
sudo systemctl show github-webhook --property=Environment
```

## アンインストール

```bash
# 完全削除
sudo ./scripts/uninstall.sh
```

このスクリプトは以下を実行します：
- サービスの停止・削除
- アプリケーションファイルの削除
- ユーザー・グループの削除
- ログファイルの削除