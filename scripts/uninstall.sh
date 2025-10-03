#!/bin/bash

# GitHub Webhook Server アンインストールスクリプト
# 使用方法: sudo ./uninstall.sh

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
INSTALL_DIR="/opt/github-webhook-server"
LOG_DIR="/var/log/github-webhook"

log_warn "GitHub Webhook Server をアンインストールします"
read -p "本当に続行しますか? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "アンインストールを中止しました"
    exit 0
fi

# サービスの停止と無効化
log_info "サービスを停止しています..."
if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME"
    log_info "サービスを停止しました"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME"; then
    systemctl disable "$SERVICE_NAME"
    log_info "自動起動を無効化しました"
fi

# サービスファイルの削除
if [ -f "/etc/systemd/system/$SERVICE_NAME.service" ]; then
    rm "/etc/systemd/system/$SERVICE_NAME.service"
    systemctl daemon-reload
    log_info "サービスファイルを削除しました"
fi

# アプリケーションディレクトリの削除
if [ -d "$INSTALL_DIR" ]; then
    log_info "アプリケーションディレクトリを削除しています: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
fi

# ログディレクトリの削除
if [ -d "$LOG_DIR" ]; then
    log_info "ログディレクトリを削除しています: $LOG_DIR"
    rm -rf "$LOG_DIR"
fi

# ユーザーの削除
if id "$SERVICE_USER" &>/dev/null; then
    log_info "ユーザー '$SERVICE_USER' を削除しています..."
    userdel "$SERVICE_USER"
fi

log_info "GitHub Webhook Server のアンインストールが完了しました"