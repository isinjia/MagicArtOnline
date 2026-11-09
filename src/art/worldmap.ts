import { isLand, MAP_H, MAP_W, SITES, TOWNS, type Town } from '../core/world';
import { INK } from './iso';

/**
 * 월드맵 도트 그림. 위에서 내려다본 지도에 지형, 길, 도시와 장소 아이콘을 그린다.
 * 이름표와 의뢰 표시는 DOM으로 얹는다.
 */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Region = 'mountain' | 'forest' | 'waste' | 'hill' | 'plain';

function region(x: number, y: number): Region {
  if (y < 64 && x < 118 && x > 14) return 'mountain';
  if (x < 50 && y > 84 && y < 172) return 'forest';
  if (y > 168) return 'waste';
  if (x > 118 && y < 100) return 'hill';
  return 'plain';
}

const GROUND: Record<Region, [string, string]> = {
  mountain: ['#8fbf6a', '#86b562'],
  forest: ['#5fae4a', '#58a344'],
  waste: ['#cdb878', '#c4ad6c'],
  hill: ['#86c766', '#7dbd5e'],
  plain: ['#7cc75a', '#74bd53'],
};

function px(g: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function mountain(g: CanvasRenderingContext2D, x: number, y: number): void {
  for (let r = 0; r < 7; r++) {
    const half = r;
    px(g, INK, x - half - 1, y + r, 1, 1);
    px(g, INK, x + half + 1, y + r, 1, 1);
    px(g, r < 2 ? '#ffffff' : r < 4 ? '#b8b8c0' : '#8a8a96', x - half, y + r, half * 2 + 1, 1);
  }
  px(g, INK, x, y - 1);
  px(g, INK, x - 7, y + 7, 15, 1);
}

function tree(g: CanvasRenderingContext2D, x: number, y: number): void {
  px(g, INK, x - 2, y - 1, 5, 1);
  px(g, INK, x - 3, y, 1, 3);
  px(g, INK, x + 3, y, 1, 3);
  px(g, '#2f7a3a', x - 2, y, 5, 3);
  px(g, '#3f9a4a', x - 1, y, 2, 1);
  px(g, INK, x - 2, y + 3, 5, 1);
  px(g, '#6b4a2e', x, y + 3, 1, 2);
}

function rock(g: CanvasRenderingContext2D, x: number, y: number): void {
  px(g, INK, x - 1, y - 1, 4, 1);
  px(g, '#9a8a6a', x - 1, y, 4, 2);
  px(g, INK, x - 1, y + 2, 4, 1);
}

function bump(g: CanvasRenderingContext2D, x: number, y: number): void {
  px(g, '#6aab4c', x - 2, y, 5, 1);
  px(g, '#6aab4c', x - 1, y - 1, 3, 1);
}

function house(g: CanvasRenderingContext2D, x: number, y: number, roof: string): void {
  px(g, INK, x - 1, y - 3, 7, 1);
  px(g, INK, x - 2, y - 2, 1, 1);
  px(g, INK, x + 6, y - 2, 1, 1);
  px(g, roof, x - 1, y - 2, 7, 2);
  px(g, INK, x - 1, y, 1, 4);
  px(g, INK, x + 5, y, 1, 4);
  px(g, '#f3dcae', x, y, 5, 4);
  px(g, '#7a4a22', x + 2, y + 2, 1, 2);
  px(g, INK, x - 1, y + 4, 7, 1);
}

function townIcon(g: CanvasRenderingContext2D, t: Town): void {
  const { x, y } = t;
  switch (t.id) {
    case 'lumina': {
      // 성
      px(g, INK, x - 8, y - 6, 17, 10);
      px(g, '#d9d4c8', x - 7, y - 5, 15, 8);
      for (const tx of [-8, 6]) {
        px(g, INK, x + tx, y - 10, 3, 5);
        px(g, '#d9d4c8', x + tx + 1, y - 9, 1, 4);
        px(g, '#c94c4c', x + tx, y - 12, 3, 2);
      }
      px(g, INK, x - 2, y - 13, 5, 8);
      px(g, '#e6e1d4', x - 1, y - 12, 3, 7);
      px(g, '#3b7dd8', x - 2, y - 15, 5, 2);
      px(g, '#ffcf3f', x, y - 18, 1, 3);
      px(g, '#7a4a22', x - 1, y, 3, 3);
      break;
    }
    case 'ironhall':
      house(g, x - 7, y - 1, '#8a5530');
      house(g, x + 2, y + 1, '#6b6f7a');
      px(g, '#555', x + 6, y - 6, 1, 3);
      break;
    case 'elmwood':
      house(g, x - 6, y, '#3f9a4a');
      house(g, x + 2, y - 2, '#8a5530');
      break;
    case 'maren':
      house(g, x - 8, y - 1, '#3b7dd8');
      house(g, x, y - 3, '#c94c4c');
      // 부두와 배
      px(g, '#7a4a22', x + 6, y + 2, 8, 2);
      px(g, INK, x + 10, y - 4, 1, 6);
      px(g, '#ffffff', x + 11, y - 4, 3, 4);
      break;
    case 'saintbell':
      // 교회
      px(g, INK, x - 5, y - 4, 11, 9);
      px(g, '#f4f1ea', x - 4, y - 3, 9, 7);
      px(g, INK, x - 1, y - 10, 3, 7);
      px(g, '#f4f1ea', x, y - 9, 1, 6);
      px(g, '#ffcf3f', x, y - 13, 1, 3);
      px(g, '#ffcf3f', x - 1, y - 12, 3, 1);
      px(g, '#3b7dd8', x - 3, y - 5, 7, 1);
      px(g, '#7a4a22', x, y + 1, 1, 3);
      break;
    case 'greywall':
      // 목책 요새
      px(g, INK, x - 8, y - 5, 17, 9);
      for (let i = 0; i < 8; i++) px(g, i % 2 ? '#9a6234' : '#b97a45', x - 7 + i * 2, y - 4, 2, 7);
      px(g, INK, x - 2, y - 11, 5, 7);
      px(g, '#8a5530', x - 1, y - 10, 3, 6);
      px(g, '#c94c4c', x + 2, y - 13, 3, 2);
      px(g, INK, x + 1, y - 13, 1, 3);
      break;
  }
}

function siteIcon(g: CanvasRenderingContext2D, x: number, y: number, type: string): void {
  switch (type) {
    case '산적 토벌':
      // 천막
      px(g, INK, x - 4, y + 2, 9, 1);
      for (let r = 0; r < 5; r++) px(g, r % 2 ? '#c94c4c' : '#f4f1ea', x - r, y - 3 + r, r * 2 + 1, 1);
      px(g, INK, x, y - 4);
      break;
    case '고블린 소탕':
    case '던전 정찰':
      // 동굴 입구
      px(g, INK, x - 4, y - 3, 9, 6);
      px(g, '#8a8a96', x - 3, y - 2, 7, 4);
      px(g, '#1a1410', x - 1, y - 1, 3, 4);
      if (type === '던전 정찰') px(g, '#7fe3ff', x, y - 4, 1, 1);
      break;
    case '폐광 조사':
      // 갱도 나무틀
      px(g, '#1a1410', x - 2, y - 2, 5, 5);
      px(g, '#7a4a22', x - 3, y - 3, 7, 1);
      px(g, '#7a4a22', x - 3, y - 2, 1, 5);
      px(g, '#7a4a22', x + 3, y - 2, 1, 5);
      break;
    case '상단 호위':
      // 이정표
      px(g, '#7a4a22', x, y - 3, 1, 6);
      px(g, INK, x - 3, y - 4, 7, 3);
      px(g, '#e0b07a', x - 2, y - 3, 5, 1);
      break;
    case '마수 사냥':
      // 해골
      px(g, INK, x - 3, y - 3, 7, 6);
      px(g, '#f4f1ea', x - 2, y - 2, 5, 4);
      px(g, INK, x - 1, y - 1, 1, 1);
      px(g, INK, x + 1, y - 1, 1, 1);
      break;
  }
}

/** 길: 두 점 사이에 점선을 깐다 */
function road(g: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }): void {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
  for (let i = 0; i <= n; i++) {
    if (i % 3 === 2) continue;
    const x = Math.round(a.x + ((b.x - a.x) * i) / n);
    const y = Math.round(a.y + ((b.y - a.y) * i) / n);
    if (isLand(x, y)) px(g, '#d9b77a', x, y, 1, 1);
  }
}

let cached: HTMLCanvasElement | null = null;

export function drawWorldMap(): HTMLCanvasElement {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = MAP_H;
  const g = c.getContext('2d')!;
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && isLand(x, y);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (land(x, y)) {
        const coast = !land(x + 1, y) || !land(x - 1, y) || !land(x, y + 1) || !land(x, y - 1);
        const [a, b] = GROUND[region(x, y)];
        px(g, coast ? '#e8d8a0' : (x >> 2) % 2 === (y >> 2) % 2 ? a : b, x, y);
      } else {
        const shallow = land(x + 1, y) || land(x - 1, y) || land(x, y + 1) || land(x, y - 1) || land(x + 2, y) || land(x, y + 2);
        const wave = hash(x >> 1, y) > 0.985;
        px(g, shallow ? '#7cc8f0' : wave ? '#a8dcf6' : '#4fa3d6', x, y);
      }
    }
  }

  const points = [...Object.values(TOWNS), ...SITES];
  const nearPoint = (x: number, y: number) => points.some((p) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12);

  // 길: 왕도에서 각 도시로, 각 장소는 가장 가까운 도시로
  const lumina = TOWNS.lumina;
  for (const t of Object.values(TOWNS)) if (t !== lumina) road(g, lumina, t);

  // 지형 장식
  for (let y = 6; y < MAP_H - 4; y += 9) {
    for (let x = 6; x < MAP_W - 4; x += 10) {
      const jx = x + Math.floor(hash(x, y) * 5) - 2;
      const jy = y + Math.floor(hash(y, x) * 5) - 2;
      if (!land(jx, jy) || !land(jx, jy + 7) || nearPoint(jx, jy)) continue;
      const r = region(jx, jy);
      const roll = hash(jx * 3, jy * 7);
      if (r === 'mountain' && roll < 0.7) mountain(g, jx, jy - 3);
      else if (r === 'forest' && roll < 0.85) tree(g, jx, jy);
      else if (r === 'waste' && roll < 0.35) rock(g, jx, jy);
      else if (r === 'hill' && roll < 0.6) bump(g, jx, jy);
      else if (r === 'plain' && roll < 0.12) tree(g, jx, jy);
    }
  }

  for (const s of SITES) siteIcon(g, s.x, s.y, s.questType);
  for (const t of Object.values(TOWNS)) townIcon(g, t);
  cached = c;
  return c;
}
