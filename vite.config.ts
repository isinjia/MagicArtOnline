import { defineConfig } from 'vite';

// ARTIFACT=1 이면 폰트까지 파일 안에 넣는다 (외부 폰트 파일이 막힌 테스트 링크용)
const inlineAll = process.env.ARTIFACT === '1';

export default defineConfig({
  // 상대 경로로 빌드해야 Capacitor, Tauri, 테스트 링크 어디서든 열린다
  base: './',
  build: {
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: inlineAll ? 10_000_000 : 4096,
    outDir: inlineAll ? 'dist-artifact' : 'dist',
  },
});
