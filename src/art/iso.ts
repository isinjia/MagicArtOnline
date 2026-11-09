/**
 * 쿼터뷰(아이소메트릭) 도트 그리기 도구.
 * 경로 그리기 대신 1픽셀 열 단위로 채워 안티에일리어싱 없이 또렷하게 그린다.
 */
export const TW = 20; // 타일 폭
export const TH = 10; // 타일 높이
export const INK = '#2a1d17';

export interface Iso {
  /** 격자 좌표의 위쪽 꼭짓점을 화면 좌표로 */
  at(gx: number, gy: number): { x: number; y: number };
}

export function makeIso(originX: number, originY: number): Iso {
  return {
    at: (gx, gy) => ({ x: Math.round(originX + ((gx - gy) * TW) / 2), y: Math.round(originY + ((gx + gy) * TH) / 2) }),
  };
}

/** 마름모 바닥 타일 하나 */
export function tile(g: CanvasRenderingContext2D, x: number, y: number, color: string, w = TW, h = TH): void {
  g.fillStyle = color;
  for (let r = 0; r < h; r++) {
    const half = r < h / 2 ? (r + 1) * (w / h) : (h - r) * (w / h);
    g.fillRect(x - half, y + r, half * 2, 1);
  }
}

export interface BoxColors {
  top: string;
  left: string;
  right: string;
}

/** 바닥 격자 위에 놓인 상자(가구). gx,gy 위치, w×d 타일 크기, h 픽셀 높이 */
export function box(g: CanvasRenderingContext2D, iso: Iso, gx: number, gy: number, w: number, d: number, h: number, c: BoxColors): void {
  const T = iso.at(gx, gy);
  const R = iso.at(gx + w, gy);
  const B = iso.at(gx + w, gy + d);
  const L = iso.at(gx, gy + d);
  const topEdge = (x: number) => (x <= T.x ? T.y + (T.x - x) / 2 : T.y + (x - T.x) / 2);
  const botEdge = (x: number) => (x <= B.x ? L.y + (x - L.x) / 2 : B.y - (x - B.x) / 2);
  for (let x = L.x; x < R.x; x++) {
    const yt = Math.round(topEdge(x + 0.5)) - h;
    const yb = Math.round(botEdge(x + 0.5));
    // 옆면
    g.fillStyle = x < B.x ? c.left : c.right;
    g.fillRect(x, yb - h, 1, h);
    // 윗면
    g.fillStyle = c.top;
    g.fillRect(x, yt, 1, yb - h - yt);
    // 외곽선
    g.fillStyle = INK;
    g.fillRect(x, yt - 1, 1, 1);
    g.fillRect(x, yb, 1, 1);
  }
  g.fillStyle = INK;
  g.fillRect(L.x - 1, L.y - h - 1, 1, h + 2);
  g.fillRect(R.x, R.y - h - 1, 1, h + 2);
  g.fillRect(B.x, B.y - h, 1, h);
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt))).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

export function boxOf(base: string): BoxColors {
  return { top: shade(base, 30), left: base, right: shade(base, -30) };
}
