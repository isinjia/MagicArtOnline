import type { Member, StatKey } from '../core/types';

/**
 * 카이로소프트풍 도트 스프라이트를 코드로 그린다.
 * 템플릿 문자 하나가 픽셀 하나이고, 팔레트로 색을 입힌다.
 */
type Palette = Record<string, string>;
type Template = readonly string[];

const OUTLINE = '#2a1d17';

// 14x18 꼬마 인간형. h 머리, s 피부, e 눈, m 입, c 옷, d 옷 어두운색, p 바지, b 신발
export const HUMANOID: Template = [
  '....oooooo....',
  '...ohhhhhho...',
  '..ohhhhhhhho..',
  '.ohhhhhhhhhho.',
  '.ohssssssssho.',
  '.ohsessssesho.',
  '.ohsessssesho.',
  '..osssmmssso..',
  '...oooooooo...',
  '.occcccccccco.',
  '.occcccccccco.',
  'osccccccccccso',
  '.oddddddddddo.',
  '..oppppppppo..',
  '..oppppppppo..',
  '..opppoopppo..',
  '..obbo..obbo..',
  '..oooo..oooo..',
];

/** 정면(초상화), 쿼터뷰 앞(오른쪽 아래를 본다), 쿼터뷰 뒤(오른쪽 위를 본다). 왼쪽 방향은 좌우 반전으로 만든다 */
export type View = 'front' | 'quarter' | 'back';
/** 0 서기, 1 내딛기, 2 다리 모으기 */
export type Frame = 0 | 1 | 2;

const HEAD_QUARTER: Template = [
  '....oooooo....',
  '...ohhhhhho...',
  '..ohhhhhhhho..',
  '.ohhhhhhhhhho.',
  '.ohhhssssssho.',
  '.ohhssessseso.',
  '.ohhssessseso.',
  '..ohssssmsso..',
  '...oooooooo...',
];

const HEAD_BACK: Template = [
  '....oooooo....',
  '...ohhhhhho...',
  '..ohhhhhhhho..',
  '.ohhhhhhhhhho.',
  '.ohhhhhhhhhho.',
  '.ohhhhhhhhhso.',
  '.ohhhhhhhhhso.',
  '..ohhhhhhhso..',
  '...oooooooo...',
];

const LEGS: Record<Frame, Template> = {
  0: HUMANOID.slice(13),
  1: ['..oppppppppo..', '..opppoopppo..', '..oppo..oppo..', '.obbo....obbo.', '.oooo....oooo.'],
  2: ['..oppppppppo..', '..oppppppppo..', '...oppppppo...', '...obbbbbbo...', '...oooooooo...'],
};

/** 방향과 걷기 프레임을 조합한 인간형 템플릿 */
export function humanoid(view: View, frame: Frame): Template {
  const head = view === 'front' ? HUMANOID.slice(0, 9) : view === 'quarter' ? HEAD_QUARTER : HEAD_BACK;
  return [...head, ...HUMANOID.slice(9, 13), ...LEGS[frame]];
}

// 16x10 거미. c 몸, d 배, e 눈
export const SPIDER: Template = [
  '......oooo......',
  '.....occcco.....',
  'o...occcccco...o',
  '.o.occeccecco.o.',
  '..ooccccccccoo..',
  'o..occcccccco..o',
  '.o..oddddddo..o.',
  '..o..oddddo..o..',
  '.o....oooo....o.',
  'o..............o',
];

// 16x15 골렘
export const GOLEM: Template = [
  '....oooooooo....',
  '...occcccccco...',
  '...ocdccccdco...',
  '...occeccecco...',
  '...occcccccco...',
  '.oooooooooooooo.',
  'occcccccccccccco',
  'occdccccccccdcco',
  'occcccccccccccco',
  'ooooccccccccoooo',
  '...occcccccco...',
  '...occcooccco...',
  '..occco..occco..',
  '..occco..occco..',
  '..ooooo..ooooo..',
];

// 18x10 늑대
export const WOLF: Template = [
  '..oo.oo...........',
  '.occocco..........',
  'occcccccoooooooo..',
  'oceccccccccccccco.',
  'occcccccccccccccco',
  'oocccccccccccccco.',
  '..occdcccccccdcco.',
  '..occo....occo....',
  '..occo....occo....',
  '..oooo....oooo....',
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickBy<T>(arr: readonly T[], h: number, salt: number): T {
  return arr[(h >>> salt) % arr.length];
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt))).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

function paint(ctx: CanvasRenderingContext2D, t: Template, pal: Palette, ox: number, oy: number): void {
  t.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = ch === 'o' ? OUTLINE : pal[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

function px(ctx: CanvasRenderingContext2D, color: string, pts: [number, number][]): void {
  ctx.fillStyle = color;
  for (const [x, y] of pts) ctx.fillRect(x, y, 1, 1);
}

/** 외곽선을 두른 도형 */
function outlined(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string): void {
  ctx.fillStyle = OUTLINE;
  for (const [x, y] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect(x + dx, y + dy, 1, 1);
  px(ctx, fill, pts);
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

const SKINS = ['#f7d7b5', '#efc49c', '#d9a378', '#a8714a'];
const HAIRS = ['#3b2a20', '#8a4b2a', '#e8c25a', '#c0392b', '#2d3e70', '#e6e6e6', '#6b4fa0', '#d4733a'];
const CLOTHES = ['#3b7dd8', '#c94c4c', '#3fa36b', '#e0962f', '#7b5fc7', '#2e9c9c', '#d45a9a'];
const PANTS = ['#5a4636', '#34495e', '#4b3b2a', '#3d5a3a'];

/** 가장 높은 능력치가 겉모습(장비)을 정한다 */
export function memberClass(m: Member): StatKey {
  return (Object.entries(m.stats) as [StatKey, number][]).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export const SPRITE_W = 18;
export const SPRITE_H = 24;

/** 길드원 스프라이트 18x21. 같은 길드원은 항상 같은 모습 */
export function drawMember(m: Member, view: View = 'front', frame: Frame = 0): HTMLCanvasElement {
  const h = hash(m.id + m.name);
  const cls = memberClass(m);
  const clothes = pickBy(CLOTHES, h, 3);
  const pal: Palette = {
    h: pickBy(HAIRS, h, 7),
    s: pickBy(SKINS, h, 1),
    e: OUTLINE,
    m: '#c0605a',
    c: clothes,
    d: shade(clothes, -50),
    p: pickBy(PANTS, h, 11),
    b: '#3a2a1e',
  };
  if (cls === 'agility') pal.h = shade(clothes, -30); // 후드
  const [c, ctx] = canvas(SPRITE_W, SPRITE_H);
  const ox = 2;
  const oy = 6;

  if (cls === 'will') {
    // 망토
    ctx.fillStyle = shade(clothes, -70);
    ctx.fillRect(ox + 1, oy + 9, 12, 8);
  }
  paint(ctx, humanoid(view, frame), pal, ox, oy);

  const metal = '#cfd8e3';
  if (cls === 'might') {
    // 검
    px(ctx, OUTLINE, [[16, 7], [17, 8], [15, 8]]);
    px(ctx, metal, [[16, 8], [16, 9], [16, 10], [16, 11], [16, 12], [16, 13], [16, 14]]);
    px(ctx, '#e8c25a', [[15, 15], [16, 15], [17, 15]]);
    px(ctx, '#7a4a22', [[16, 16], [16, 17]]);
  } else if (cls === 'insight') {
    // 뾰족한 마법사 모자 (끝이 옆으로 꺾인다)와 지팡이
    const hat = shade(clothes, -40);
    const cone: [number, number][] = [
      [12, 0], [13, 0],
      [10, 1], [11, 1],
      [9, 2], [10, 2], [11, 2],
      [8, 3], [9, 3], [10, 3], [11, 3],
      [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],
      [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5],
    ];
    const brim: [number, number][] = [];
    for (let x = 3; x <= 14; x++) brim.push([x, 6]);
    outlined(ctx, [...cone, ...brim], hat);
    px(ctx, '#ffcf3f', [[7, 5], [8, 5], [9, 5], [10, 5], [11, 5]]);
    px(ctx, '#7a4a22', [[16, 9], [16, 10], [16, 11], [16, 12], [16, 13], [16, 14], [16, 15], [16, 16], [16, 17], [16, 18]]);
    px(ctx, OUTLINE, [[16, 6], [15, 7], [17, 7], [16, 8]]);
    px(ctx, '#7fe3ff', [[16, 7]]);
  } else if (cls === 'body') {
    // 방패
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(0, 14, 5, 7);
    ctx.fillStyle = metal;
    ctx.fillRect(1, 15, 3, 5);
    px(ctx, '#c94c4c', [[2, 16], [2, 17], [2, 18]]);
  } else if (cls === 'agility') {
    // 단검
    px(ctx, metal, [[16, 14], [16, 15], [16, 16]]);
    px(ctx, OUTLINE, [[16, 13], [16, 17]]);
  }
  return c;
}

interface EnemyLook {
  /** 'human'이면 방향과 프레임에 맞는 인간형 템플릿을 쓴다 */
  t: Template | 'human';
  pal: Palette;
}

function enemyLook(name: string): EnemyLook {
  const human = (s: string, hair: string, cloth: string, pants = '#4b3b2a'): EnemyLook => ({
    t: 'human',
    pal: { s, h: hair, e: OUTLINE, m: shade(s, -60), c: cloth, d: shade(cloth, -50), p: pants, b: '#3a2a1e' },
  });
  if (name.includes('거미')) return { t: SPIDER, pal: { c: '#5b4a6e', d: '#8e3b46', e: '#ff5a5a' } };
  if (name.includes('골렘')) return { t: GOLEM, pal: { c: '#9a9488', d: '#6f6a60', e: '#7fe3ff' } };
  if (name.includes('울프')) return { t: WOLF, pal: { c: '#7d7f8c', d: '#55576a', e: '#ffd23f' } };
  if (name.includes('고블린')) return human('#7bbf4a', '#5a3a1e', '#8a6a3a');
  if (name.includes('오크')) return human('#5c8a3a', '#2a1d17', '#7a4a22', '#3b3b3b');
  if (name.includes('스켈레톤')) return human('#eeeeee', '#eeeeee', '#bdbdbd', '#9e9e9e');
  if (name.includes('구울')) return human('#9cb38f', '#4d5a46', '#5d5d4a');
  if (name.includes('망령')) return human('#b9c7e0', '#6d7b8d', '#6d7b8d', '#4c5664');
  if (name.includes('복면') || name.includes('도적')) return human('#2f2f3a', '#1e1e26', '#3a3a48');
  if (name.includes('궁수')) return human('#efc49c', '#3fa36b', '#4d7a3a');
  return human('#efc49c', '#c0392b', '#8a5a3a'); // 산적
}

/** 적 스프라이트. 우두머리는 왕관을 쓴다 */
export function drawEnemy(name: string, boss: boolean, view: View = 'front', frame: Frame = 0): HTMLCanvasElement {
  const look = enemyLook(name);
  const t = look.t === 'human' ? humanoid(view, frame) : look.t;
  const w = Math.max(...t.map((r) => r.length)) + 4;
  const h = t.length + 4;
  const [c, ctx] = canvas(w, h);
  const ox = 2;
  const oy = 4;
  paint(ctx, t, look.pal, ox, oy - 1);
  if (boss) {
    const cx = Math.floor(w / 2);
    px(ctx, OUTLINE, [[cx - 3, 3], [cx + 2, 3], [cx - 3, 2], [cx + 2, 2], [cx - 1, 2], [cx, 2]]);
    px(ctx, '#ffd23f', [[cx - 3, 1], [cx - 1, 1], [cx, 1], [cx + 2, 1], [cx - 2, 2], [cx + 1, 2], [cx - 2, 3], [cx - 1, 3], [cx, 3], [cx + 1, 3]]);
  }
  return c;
}

const urlCache = new Map<string, string>();

/** DOM에서 쓸 스프라이트 이미지 주소. 같은 모습이면 캐시를 쓴다 */
export function memberSpriteUrl(m: Member): string {
  const key = `${m.id}:${m.name}:${memberClass(m)}`;
  let url = urlCache.get(key);
  if (!url) {
    url = drawMember(m).toDataURL();
    urlCache.set(key, url);
  }
  return url;
}

export function enemySpriteUrl(name: string, boss: boolean): string {
  const key = `e:${name}:${boss}`;
  let url = urlCache.get(key);
  if (!url) {
    url = drawEnemy(name, boss).toDataURL();
    urlCache.set(key, url);
  }
  return url;
}
