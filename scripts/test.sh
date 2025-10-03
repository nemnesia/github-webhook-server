#!/bin/bash

# テスト実行スクリプト

set -e

echo "🧪 GitHub Webhook Server テスト実行"
echo "=================================="

# 依存関係のインストール確認
if [ ! -d "node_modules" ]; then
  echo "📦 依存関係をインストール中..."
  yarn install
fi

# TypeScript型チェック
echo "🔍 TypeScript型チェック中..."
yarn type-check

# リンティング
echo "📝 コードリンティング中..."
yarn lint

# ユニットテスト実行
echo "🧪 ユニットテスト実行中..."
yarn test:run

# カバレッジレポート生成
echo "📊 カバレッジレポート生成中..."
yarn test:coverage

echo ""
echo "✅ すべてのテストが完了しました！"
echo "📊 カバレッジレポートは ./coverage/index.html で確認できます"