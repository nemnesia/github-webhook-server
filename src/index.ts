import { createServer } from './server.js';
import { Server } from 'node:http';

const app = createServer();
const PORT = Number(process.env.PORT) || 3000;

const server: Server = app.listen(PORT, () => {
  console.log(`🚀 GitHub Webhook サーバーがポート ${PORT} で起動しました`);
  console.log(`📋 環境: ${process.env.NODE_ENV || 'development'}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('📤 SIGTERM シグナルを受信しました。サーバーを正常に終了します...');
  server.close(() => {
    console.log('✅ サーバーが正常に終了しました');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📤 SIGINT シグナルを受信しました。サーバーを正常に終了します...');
  server.close(() => {
    console.log('✅ サーバーが正常に終了しました');
    process.exit(0);
  });
});
