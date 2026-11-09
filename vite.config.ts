import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로로 빌드해야 Capacitor, Tauri, 테스트 링크 어디서든 열린다
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
