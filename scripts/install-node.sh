#!/bin/bash

# Node.js インストールスクリプト
# 使用方法: sudo ./install-node.sh

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

# 変数定義
NODE_VERSION="22.20.0"
NODE_DISTRO="linux-x64"
NODE_FILENAME="node-v${NODE_VERSION}-${NODE_DISTRO}.tar.gz"
NODE_DIRNAME="node-v${NODE_VERSION}-${NODE_DISTRO}"
INSTALL_DIR="/usr/local/node-v${NODE_VERSION}"

log_info "Node.js v${NODE_VERSION} のインストールを開始します..."

# 既存インストールの確認
if [ -d "$INSTALL_DIR" ]; then
    log_warn "既存のNode.js インストールが見つかりました: $INSTALL_DIR"
    read -p "上書きしますか? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "インストールをキャンセルしました"
        exit 0
    fi
    rm -rf "$INSTALL_DIR"
fi

cd /tmp

# 古いファイルのクリーンアップ
log_info "作業ディレクトリをクリーンアップします..."
rm -f "$NODE_FILENAME"
rm -rf "$NODE_DIRNAME"

# Node.js のダウンロードとインストール
log_info "Node.js v${NODE_VERSION} をダウンロードします..."
curl -OL "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_FILENAME}"

log_info "アーカイブを展開します..."
tar -xzf "$NODE_FILENAME"

log_info "ファイルを ${INSTALL_DIR} にコピーします..."
cp -r "$NODE_DIRNAME" "$INSTALL_DIR"

# シンボリックリンクの作成
log_info "シンボリックリンクを作成します..."
ln -sf "$INSTALL_DIR/bin/node" /usr/local/bin/node
ln -sf "$INSTALL_DIR/bin/npm" /usr/local/bin/npm
ln -sf "$INSTALL_DIR/bin/npx" /usr/local/bin/npx
ln -sf "$INSTALL_DIR/bin/corepack" /usr/local/bin/corepack

ln -sf /usr/local/bin/node /usr/bin/node
ln -sf /usr/local/bin/npm /usr/bin/npm
ln -sf /usr/local/bin/npx /usr/bin/npx
ln -sf /usr/local/bin/corepack /usr/bin/corepack

# クリーンアップ
log_info "一時ファイルをクリーンアップします..."
rm -f "$NODE_FILENAME"
rm -rf "$NODE_DIRNAME"

# インストール確認
log_info "インストールを確認します..."
node_version=$(node --version 2>/dev/null || echo "エラー")
npm_version=$(npm --version 2>/dev/null || echo "エラー")

if [ "$node_version" = "エラー" ] || [ "$npm_version" = "エラー" ]; then
    log_error "インストールに失敗しました"
    exit 1
fi

log_info "Node.js インストールが完了しました！"
log_info "Node.js バージョン: $node_version"
log_info "npm バージョン: $npm_version"
log_info "インストール場所: $INSTALL_DIR"
