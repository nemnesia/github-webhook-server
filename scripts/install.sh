#!/bin/bash

# GitHub Webhook Server インストールスクリプト
# 使用方法: sudo ./install.sh

set -e

# 色付きログ関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# root権限チェック
if [[ $EUID -ne 0 ]]; then
    log_error "このスクリプトはroot権限で実行する必要があります"
    exit 1
fi

# 設定値
SERVICE_NAME="github-webhook"
SERVICE_USER="webhook"
SERVICE_GROUP="webhook"
INSTALL_DIR="/opt/github-webhook-server"
LOG_DIR="/var/log/github-webhook"

log_info "GitHub Webhook Server のインストールを開始します..."

# Node.jsのインストール確認
if ! command -v node &> /dev/null; then
    log_error "Node.js がインストールされていません"
    log_info "Node.js をインストールしてください: https://nodejs.org/"
    exit 1
fi

log_info "Node.js バージョン: $(node --version)"

# ユーザーとグループの作成
if ! id "$SERVICE_USER" &>/dev/null; then
    log_info "ユーザー '$SERVICE_USER' を作成します..."
    useradd --system --shell /bin/false --home-dir "$INSTALL_DIR" --create-home "$SERVICE_USER"
else
    log_info "ユーザー '$SERVICE_USER' は既に存在します"
fi

# インストールディレクトリの作成と権限設定
log_info "インストールディレクトリを設定します: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
mkdir -p "$LOG_DIR"

# ログディレクトリの権限設定
chown "$SERVICE_USER:$SERVICE_GROUP" "$LOG_DIR"
chmod 755 "$LOG_DIR"

# アプリケーションファイルのコピー
log_info "アプリケーションファイルをコピーします..."
if [ -f "./package.json" ]; then
    cp -r ./* "$INSTALL_DIR/"
    
    # 依存関係のインストール
    log_info "依存関係をインストールします..."
    cd "$INSTALL_DIR"
    
    # yarn がある場合は yarn を使用、なければ npm を使用
    if command -v yarn &> /dev/null; then
        log_info "yarn を使用して依存関係をインストールします..."
        sudo -u "$SERVICE_USER" yarn install --production
        sudo -u "$SERVICE_USER" yarn build
    else
        log_info "npm を使用して依存関係をインストールします..."
        sudo -u "$SERVICE_USER" npm ci --only=production
        sudo -u "$SERVICE_USER" npm run build
    fi
else
    log_error "package.json が見つかりません。正しいディレクトリで実行してください。"
    exit 1
fi

# 権限の設定
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"

# 環境設定ファイルの作成
if [ ! -f "$INSTALL_DIR/.env" ]; then
    log_info "環境設定ファイルのサンプルを作成します..."
    cat > "$INSTALL_DIR/.env" << EOF
# GitHub Webhook 設定
WEBHOOK_SECRET=your-secret-key-here
PROJECT_PATH=/path/to/your/project
DEPLOY_COMMAND=git pull && npm install && pm2 restart app
ALLOWED_BRANCHES=main,master

# サーバー設定
PORT=3000
NODE_ENV=production

# ログ設定
ENABLE_DETAILED_LOGS=false
EOF
    
    chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"
    
    log_warn "環境設定ファイル $INSTALL_DIR/.env を編集してください"
fi

# systemd サービスファイルのコピー
log_info "systemd サービスを設定します..."
if [ -f "./scripts/github-webhook.service" ]; then
    cp "./scripts/github-webhook.service" "/etc/systemd/system/"
    systemctl daemon-reload
    log_info "サービスファイルをインストールしました"
else
    log_error "サービスファイル './scripts/github-webhook.service' が見つかりません"
    exit 1
fi

# ファイアウォール設定の提案
if command -v ufw &> /dev/null; then
    log_info "UFW ファイアウォール設定の提案:"
    log_info "  sudo ufw allow 3000/tcp  # Webhook ポートを開放"
fi

# 使用方法の表示
log_info "インストールが完了しました！"
echo
echo "次の手順:"
echo "1. 環境設定を編集: sudo nano $INSTALL_DIR/.env"
echo "2. サービスを開始: sudo systemctl start $SERVICE_NAME"
echo "3. 自動起動を有効化: sudo systemctl enable $SERVICE_NAME"
echo "4. ステータス確認: sudo systemctl status $SERVICE_NAME"
echo "5. ログ確認: sudo journalctl -u $SERVICE_NAME -f"
echo
echo "設定ファイルのパス:"
echo "  アプリケーション: $INSTALL_DIR"
echo "  環境設定: $INSTALL_DIR/.env"
echo "  ログ: $LOG_DIR"
echo "  サービス設定: /etc/systemd/system/$SERVICE_NAME.service"