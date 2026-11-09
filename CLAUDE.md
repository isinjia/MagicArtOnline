# Magic Art Online

## 게임 설명
<!-- 장르, 핵심 루프, 화면 비율, 조작 방식을 한 문단으로 적는다. 모든 세션이 이 내용을 기준으로 작업한다. -->

## 스택
- Vite + TypeScript + Phaser 3 (2D)
- 모바일 패키징: Capacitor (프로토타입 이후 도입)
- PC 패키징: Tauri (프로토타입 이후 도입)

## 명령
- `pnpm install` 의존성 설치
- `pnpm dev` 개발 서버
- `pnpm build` 타입체크 + 프로덕션 빌드
- `pnpm preview` 빌드 결과 미리보기

## 구조
- `src/main.ts` 게임 설정과 씬 등록
- `src/scenes/` Phaser 씬
- `public/` 정적 에셋

## 작업 규칙
- 변경 후 `pnpm build`가 통과해야 한다.
- 화면 변경은 브라우저에서 띄워 확인한다.
