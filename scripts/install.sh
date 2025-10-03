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

# Yarn のセットアップ（corepack使用）
if command -v corepack &> /dev/null && ! command -v yarn &> /dev/null; then
    log_info "corepack を使用してYarnをセットアップします..."
    corepack enable
    corepack prepare yarn@stable --activate
fi

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
    # 現在のディレクトリがインストール先と同じかチェック
    CURRENT_DIR=$(pwd)
    if [ "$CURRENT_DIR" = "$INSTALL_DIR" ]; then
        log_info "既にインストールディレクトリにいます。ファイルコピーをスキップします"
    else
        # 必要なファイルのみを選択的にコピー
        log_info "必要なファイルをコピーします..."
        
        # アプリケーションディレクトリをクリア（既存ファイルがある場合）
        if [ -d "$INSTALL_DIR" ] && [ "$(ls -A $INSTALL_DIR)" ]; then
            log_info "既存のファイルをバックアップします..."
            sudo mv "$INSTALL_DIR" "$INSTALL_DIR.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
            sudo mkdir -p "$INSTALL_DIR"
        fi
        
        # 必要なファイルとディレクトリをコピー
        sudo cp package.json "$INSTALL_DIR/"
        sudo cp tsconfig.json "$INSTALL_DIR/"
        sudo cp vitest.config.ts "$INSTALL_DIR/"
        sudo cp yarn.lock "$INSTALL_DIR/" 2>/dev/null || true
        sudo cp eslint.config.mjs "$INSTALL_DIR/"
        sudo cp -r src "$INSTALL_DIR/"
        
        # 設定ファイルをコピー（存在する場合）
        [ -f ".env.example" ] && sudo cp .env.example "$INSTALL_DIR/"
        [ -f ".prettierrc.json" ] && sudo cp .prettierrc.json "$INSTALL_DIR/"
        [ -f ".prettierignore" ] && sudo cp .prettierignore "$INSTALL_DIR/"
        [ -f ".yarnrc.yml" ] && sudo cp .yarnrc.yml "$INSTALL_DIR/"
    fi
    
    # 依存関係のインストール
    log_info "依存関係をインストールします..."
    cd "$INSTALL_DIR"
    
    # Yarn の確認・インストール
    if command -v yarn &> /dev/null; then
        log_info "yarn を使用して依存関係をインストールします..."
        # Yarn v4 のセットアップ
        if ! sudo -u "$SERVICE_USER" corepack enable 2>/dev/null; then
            log_warn "corepack の有効化に失敗しました。Yarn v4 のセットアップをスキップします"
        fi
        sudo -u "$SERVICE_USER" yarn install --production
        sudo -u "$SERVICE_USER" yarn build
    elif command -v corepack &> /dev/null; then
        log_info "corepack を使用してyarnを有効化します..."
        sudo corepack enable
        sudo -u "$SERVICE_USER" corepack prepare yarn@stable --activate
        sudo -u "$SERVICE_USER" yarn install --production
        sudo -u "$SERVICE_USER" yarn build
    else
        log_info "npm を使用して依存関係をインストールします..."
        
        # package-lock.json が存在しない場合は npm install を使用
        if [ ! -f "package-lock.json" ]; then
            log_info "package-lock.json が見つかりません。npm install を使用します"
            sudo -u "$SERVICE_USER" npm install --omit=dev
        else
            sudo -u "$SERVICE_USER" npm ci --omit=dev
        fi
        
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
    log_info "環境設定ファイルのテンプレートをコピーします..."
    if [ -f ".env.example" ]; then
        cp ".env.example" "$INSTALL_DIR/.env"
        log_info ".env.example から .env を作成しました"
    elif [ -f "./scripts/.env.example" ]; then
        cp "./scripts/.env.example" "$INSTALL_DIR/.env"
        log_info "scripts/.env.example から .env を作成しました"
    else
        log_warn ".env.example が見つかりません。手動で .env ファイルを作成してください"
        touch "$INSTALL_DIR/.env"
    fi
    
    chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"
    
    log_warn "環境設定ファイル $INSTALL_DIR/.env を編集してください"
else
    log_info "既存の .env ファイルが見つかりました。そのまま使用します"
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