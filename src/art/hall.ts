import { RECIPES } from '../core/items';
import type { FacilityId, GuildState, Member } from '../core/types';
import { box, boxOf, INK, makeIso, shade, tile, TW } from './iso';
import { drawMember, type Frame, SPRITE_H, SPRITE_W, type View } from './sprites';

const W = 176;
const H = 126;
const N = 8; // 방 크기 (타일)
const WALL = 34;
const iso = makeIso(W / 2, 40);

interface Furniture {
  gx: number;
  gy: number;
  w: number;
  d: number;
  draw: (g: CanvasRenderingContext2D) => void;
}

interface Walker {
  id: string;
  gx: number;
  gy: number;
  tx: number;
  ty: number;
  wait: number;
  flip: boolean;
  view: View;
  bubble: string;
  bubbleT: number;
  /** 방향·프레임별 스프라이트 캐시 */
  sprites: Map<string, HTMLCanvasElement>;
  member: Member;
  key: string;
  dir?: [number, number];
}

const BUBBLES = ['!', '♪', '…', '?', '★'];

const WOODC = '#b97a45';

/** 늘 있는 장식 가구 */
function decor(): Furniture[] {
  return [
    {
      gx: 0, gy: 2, w: 1, d: 2,
      draw: (g) => {
        box(g, iso, 0, 2, 1, 2, 26, boxOf('#8a5530'));
        const colors = ['#c94c4c', '#3b7dd8', '#3fa36b', '#e0962f'];
        for (let r = 0; r < 3; r++) {
          for (let x = 0; x < 10; x++) {
            const a = iso.at(1, 2);
            const py = a.y + x / 2 - 22 + r * 8;
            g.fillStyle = colors[(x + r) % 4];
            if (x % 3 !== 2) g.fillRect(a.x - x - 1, Math.round(py), 1, 5);
          }
        }
      },
    },
    { gx: 3, gy: 4, w: 2, d: 1, draw: (g) => box(g, iso, 3, 4, 2, 1, 8, { top: '#d39a62', left: WOODC, right: shade(WOODC, -35) }) },
    { gx: 2, gy: 4, w: 1, d: 1, draw: (g) => box(g, iso, 2.25, 4.25, 0.5, 0.5, 5, boxOf('#8a5530')) },
    { gx: 5, gy: 4, w: 1, d: 1, draw: (g) => box(g, iso, 5.25, 4.25, 0.5, 0.5, 5, boxOf('#8a5530')) },
    {
      gx: 7, gy: 0, w: 1, d: 1,
      draw: (g) => {
        box(g, iso, 7.1, 0.1, 0.8, 0.8, 12, boxOf('#9a6234'));
        const p = iso.at(7.5, 0.9);
        g.fillStyle = '#5a3a1e';
        g.fillRect(p.x - 8, p.y - 9, 16, 1);
        g.fillRect(p.x - 8, p.y - 4, 16, 1);
      },
    },
    {
      gx: 0, gy: 7, w: 1, d: 1,
      draw: (g) => {
        box(g, iso, 0.25, 7.25, 0.5, 0.5, 5, boxOf('#c9643a'));
        const p = iso.at(0.5, 7.5);
        g.fillStyle = INK;
        g.fillRect(p.x - 5, p.y - 16, 10, 10);
        g.fillStyle = '#3fa36b';
        g.fillRect(p.x - 4, p.y - 15, 8, 8);
        g.fillStyle = '#5cbf4a';
        g.fillRect(p.x - 3, p.y - 15, 4, 4);
      },
    },
  ];
}

interface FacilitySpot extends Furniture {
  id: FacilityId;
  /** 장인이 일할 때 서는 칸 */
  work: [number, number];
}

/** 시설은 지었을 때만 나타난다 */
function facilitySpots(): FacilitySpot[] {
  const dot = (g: CanvasRenderingContext2D, gx: number, gy: number, dx: number, dy: number, w: number, h: number, c: string) => {
    const p = iso.at(gx, gy);
    g.fillStyle = c;
    g.fillRect(p.x + dx, p.y + dy, w, h);
  };
  return [
    {
      id: 'forge', gx: 0, gy: 5, w: 1, d: 2, work: [1, 5],
      draw: (g) => {
        box(g, iso, 0, 5, 1, 2, 18, boxOf('#7d7f8c'));
        dot(g, 1, 6, -9, -12, 6, 6, INK);
        dot(g, 1, 6, -8, -11, 4, 4, '#ff8a2a');
        dot(g, 1, 6, -7, -10, 2, 2, '#ffd23f');
        dot(g, 0.5, 5.2, -1, -24, 2, 4, '#9a9a9a');
      },
    },
    {
      id: 'lab', gx: 1, gy: 0, w: 2, d: 1, work: [2, 1],
      draw: (g) => {
        box(g, iso, 1, 0, 2, 1, 8, { top: '#e0b07a', left: WOODC, right: shade(WOODC, -35) });
        dot(g, 1.6, 0.5, -1, -15, 3, 5, INK);
        dot(g, 1.6, 0.5, 0, -13, 1, 2, '#5cdf6a');
        dot(g, 2.3, 0.5, -1, -14, 3, 4, INK);
        dot(g, 2.3, 0.5, 0, -13, 1, 2, '#d45a9a');
      },
    },
    {
      id: 'counter', gx: 4, gy: 1, w: 3, d: 1, work: [5, 0],
      draw: (g) => {
        box(g, iso, 4, 1, 3, 1, 9, { top: '#e0b07a', left: WOODC, right: shade(WOODC, -35) });
        dot(g, 5.5, 1.5, -2, -13, 4, 2, '#ffcf3f');
        dot(g, 5.5, 1.5, -1, -14, 2, 1, '#ffcf3f');
      },
    },
    {
      id: 'kitchen', gx: 7, gy: 3, w: 1, d: 2, work: [6, 3],
      draw: (g) => {
        box(g, iso, 7, 3, 1, 2, 10, boxOf('#5a5d6a'));
        dot(g, 7.5, 3.6, -3, -15, 7, 4, INK);
        dot(g, 7.5, 3.6, -2, -14, 5, 2, '#8a8f99');
        dot(g, 7.5, 3.6, 0, -19, 1, 3, '#ffffff');
      },
    },
    {
      id: 'loom', gx: 5, gy: 6, w: 1, d: 1, work: [4, 6],
      draw: (g) => {
        box(g, iso, 5.1, 6.1, 0.8, 0.8, 14, boxOf('#9a6234'));
        for (let i = 0; i < 4; i++) dot(g, 5.9, 6.5, -6 + i * 2, -12, 1, 8, ['#c94c4c', '#3b7dd8', '#ffcf3f', '#3fa36b'][i]);
      },
    },
    {
      id: 'appraisal_desk', gx: 7, gy: 6, w: 1, d: 1, work: [6, 6],
      draw: (g) => {
        box(g, iso, 7.1, 6.1, 0.8, 0.8, 8, boxOf('#5a3a1e'));
        dot(g, 7.5, 6.5, -1, -12, 3, 3, '#7fe3ff');
      },
    },
    {
      id: 'training', gx: 3, gy: 7, w: 1, d: 1, work: [3, 6],
      draw: (g) => {
        box(g, iso, 3.45, 7.45, 0.1, 0.1, 18, boxOf('#7a4a22'));
        box(g, iso, 3.3, 7.3, 0.4, 0.4, 8, boxOf('#e8c25a'));
        dot(g, 3.5, 7.5, -3, -26, 6, 5, '#e8c25a');
        dot(g, 3.5, 7.5, -3, -27, 6, 1, INK);
      },
    },
    {
      id: 'infirmary', gx: 7, gy: 5, w: 1, d: 1, work: [6, 5],
      draw: (g) => {
        box(g, iso, 7.05, 5.05, 0.9, 0.9, 5, { top: '#ffffff', left: '#d0d0d0', right: '#b0b0b0' });
        dot(g, 7.5, 5.5, -5, -7, 5, 2, '#c94c4c');
        dot(g, 7.5, 5.5, 1, -7, 4, 2, '#f4f1ea');
      },
    },
  ];
}

/** 왼쪽 벽(gx=0 쪽) 또는 오른쪽 벽(gy=0 쪽)에 사각형 장식을 그린다. u는 벽 위 가로 위치(픽셀), v는 바닥에서 높이 */
function wallRect(g: CanvasRenderingContext2D, side: 'left' | 'right', u0: number, u1: number, v0: number, v1: number, color: string): void {
  const top = iso.at(0, 0);
  g.fillStyle = color;
  for (let u = u0; u < u1; u++) {
    const x = side === 'left' ? top.x - u - 1 : top.x + u;
    const edgeY = top.y + Math.floor(u / 2);
    g.fillRect(x, edgeY - v1, 1, v1 - v0);
  }
}

/** 쿼터뷰 길드 홀: 길드원이 돌아다니는 방. 화면이 다시 그려져도 같은 캔버스를 다시 붙여 움직임이 이어진다. */
export class GuildHall {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private walkers = new Map<string, Walker>();
  private bg: HTMLCanvasElement;
  private furn: Furniture[] = [];
  private spots = facilitySpots();
  private furnKey = '';
  private blocked = new Set<string>();
  private tick = 0;
  private running = false;

  constructor(private getState: () => GuildState) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.className = 'hall';
    this.ctx = this.canvas.getContext('2d')!;
    this.layout();
    this.bg = this.drawRoom();
  }

  /** 지은 시설에 맞춰 가구 배치와 막힌 칸을 다시 계산한다 */
  private layout(): void {
    const fac = this.getState().facilities;
    const key = JSON.stringify(fac);
    if (key === this.furnKey) return;
    this.furnKey = key;
    this.furn = [...decor(), ...this.spots.filter((sp) => (fac[sp.id] ?? 0) > 0)];
    this.blocked.clear();
    for (const f of this.furn) for (let x = f.gx; x < f.gx + f.w; x++) for (let y = f.gy; y < f.gy + f.d; y++) this.blocked.add(`${x},${y}`);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.step();
    this.draw();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let last = 0;
    const loop = (t: number) => {
      if (!this.running) return;
      if (t - last > (reduce ? 1000 : 110)) {
        last = t;
        this.step();
        this.draw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  private drawRoom(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    // 바깥 잔디
    g.fillStyle = '#6cc04a';
    g.fillRect(0, 0, W, H);
    for (let gy = -6; gy < 14; gy++) for (let gx = -6; gx < 14; gx++) {
      const p = iso.at(gx, gy);
      if ((gx + gy) % 2 === 0) tile(g, p.x, p.y, '#62b542');
    }

    const top = iso.at(0, 0);
    const span = (N * TW) / 2;
    // 벽 (왼쪽은 조금 어둡게)
    for (let u = 0; u < span; u++) {
      const edgeY = top.y + Math.floor(u / 2);
      for (const side of ['left', 'right'] as const) {
        const x = side === 'left' ? top.x - u - 1 : top.x + u;
        const base = side === 'left' ? '#ead0a0' : '#f3dcae';
        g.fillStyle = Math.floor(u / 5) % 2 ? base : shade(base, -12);
        g.fillRect(x, edgeY - WALL, 1, WALL);
        g.fillStyle = '#b97a45';
        g.fillRect(x, edgeY - 4, 1, 4);
        g.fillStyle = INK;
        g.fillRect(x, edgeY - WALL - 2, 1, 2);
      }
    }
    g.fillStyle = INK;
    g.fillRect(top.x - 1, top.y - WALL - 2, 2, WALL + 2);

    // 창문(왼쪽 벽), 깃발과 게시판(오른쪽 벽)
    for (const u of [14, 52]) {
      wallRect(g, 'left', u, u + 18, 12, 28, '#5a3a1e');
      wallRect(g, 'left', u + 2, u + 8, 14, 26, '#8fd3ff');
      wallRect(g, 'left', u + 10, u + 16, 14, 26, '#8fd3ff');
      wallRect(g, 'left', u + 3, u + 5, 21, 25, '#d6f1ff');
    }
    wallRect(g, 'right', 10, 26, 8, 30, '#c94c4c');
    wallRect(g, 'right', 15, 21, 16, 23, '#ffcf3f');
    wallRect(g, 'right', 36, 62, 10, 28, '#7a4a22');
    wallRect(g, 'right', 38, 44, 18, 26, '#fffdf4');
    wallRect(g, 'right', 46, 54, 20, 26, '#fffdf4');
    wallRect(g, 'right', 40, 50, 12, 17, '#fffdf4');
    wallRect(g, 'right', 55, 60, 13, 20, '#fffdf4');

    // 마룻바닥
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      const p = iso.at(gx, gy);
      tile(g, p.x, p.y, (gx + gy) % 2 ? '#d39a62' : '#c98d55');
    }
    // 깔개
    for (let gy = 5; gy < 7; gy++) for (let gx = 2; gx < 6; gx++) {
      const p = iso.at(gx, gy);
      tile(g, p.x, p.y, (gx + gy) % 2 ? '#c94c4c' : '#b8403f');
    }
    // 바닥 외곽선
    const L = iso.at(0, N);
    const B = iso.at(N, N);
    const R = iso.at(N, 0);
    g.fillStyle = INK;
    for (let x = L.x; x <= B.x; x++) g.fillRect(x, Math.round(L.y + (x - L.x) / 2) + 0, 1, 1);
    for (let x = B.x; x <= R.x; x++) g.fillRect(x, Math.round(B.y - (x - B.x) / 2), 1, 1);
    return c;
  }

  private free(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < N && y < N && !this.blocked.has(`${x},${y}`);
  }

  private randomFree(): [number, number] {
    for (;;) {
      const x = Math.floor(Math.random() * N);
      const y = Math.floor(Math.random() * N);
      if (this.free(x, y)) return [x, y];
    }
  }

  private sync(members: Member[]): void {
    const ids = new Set(members.map((m) => m.id));
    for (const id of this.walkers.keys()) if (!ids.has(id)) this.walkers.delete(id);
    for (const m of members) {
      const key = `${m.name}:${m.job}`;
      const w = this.walkers.get(m.id);
      if (!w) {
        const [gx, gy] = this.randomFree();
        const [tx, ty] = this.randomFree();
        // 처음부터 바로 돌아다니게 목적지를 정해 둔다
        this.walkers.set(m.id, { id: m.id, gx, gy, tx, ty, wait: Math.random() * 6, flip: Math.random() < 0.5, view: 'quarter', bubble: '', bubbleT: 0, sprites: new Map(), member: m, key });
      } else {
        w.member = m;
        if (w.key !== key) {
          w.sprites.clear();
          w.key = key;
        }
      }
    }
  }

  private step(): void {
    const state = this.getState();
    this.layout();
    this.sync(state.members);
    this.tick++;
    const SPEED = 0.125;
    for (const w of this.walkers.values()) {
      const m = state.members.find((x) => x.id === w.id)!;
      if (m.injuredUntil > state.day) continue;
      // 제작 중이면 자기 시설 앞으로 가서 일한다
      const order = state.orders.find((o) => o.memberId === m.id);
      const spot = order ? this.spots.find((sp) => sp.id === RECIPES.find((r) => r.id === order.recipeId)?.facility) : undefined;
      if (spot && (w.tx !== spot.work[0] || w.ty !== spot.work[1])) {
        const atSpot = Math.round(w.gx) === spot.work[0] && Math.round(w.gy) === spot.work[1];
        if (!atSpot) {
          [w.tx, w.ty] = spot.work;
          w.wait = 0;
        }
      }
      if (spot && Math.abs(w.gx - spot.work[0]) < 1e-6 && Math.abs(w.gy - spot.work[1]) < 1e-6) {
        w.dir = undefined;
        // 시설 쪽을 바라본다
        const dx = spot.gx + (spot.w - 1) / 2 - spot.work[0];
        const dy = spot.gy + (spot.d - 1) / 2 - spot.work[1];
        const dir: [number, number] = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
        w.view = dir[0] > 0 || dir[1] > 0 ? 'quarter' : 'back';
        w.flip = dir[1] > 0 || dir[0] < 0;
        if (this.tick % 12 === 0) {
          w.bubble = '♪';
          w.bubbleT = 6;
        } else if (w.bubbleT > 0) w.bubbleT--;
        continue;
      }
      if (w.bubbleT > 0) w.bubbleT--;
      else if (Math.random() < 0.01) {
        w.bubble = BUBBLES[Math.floor(Math.random() * BUBBLES.length)];
        w.bubbleT = 16;
      }
      if (w.wait > 0) {
        w.wait--;
        continue;
      }
      // 칸 중앙에 있을 때 다음 칸을 정한다 (격자를 따라 걷는다)
      const onGrid = Math.abs(w.gx - Math.round(w.gx)) < 1e-6 && Math.abs(w.gy - Math.round(w.gy)) < 1e-6;
      if (onGrid) {
        w.gx = Math.round(w.gx);
        w.gy = Math.round(w.gy);
        if (w.gx === w.tx && w.gy === w.ty) {
          [w.tx, w.ty] = this.randomFree();
          w.wait = 10 + Math.random() * 40;
          continue;
        }
        const opts: [number, number][] = [];
        if (w.tx !== w.gx) opts.push([Math.sign(w.tx - w.gx), 0]);
        if (w.ty !== w.gy) opts.push([0, Math.sign(w.ty - w.gy)]);
        const ok = opts.filter(([dx, dy]) => this.free(w.gx + dx, w.gy + dy));
        const dir = ok[Math.floor(Math.random() * ok.length)];
        if (!dir) {
          [w.tx, w.ty] = this.randomFree();
          continue;
        }
        w.dir = dir;
      }
      const dir = w.dir;
      if (!dir) continue;
      w.gx += dir[0] * SPEED;
      w.gy += dir[1] * SPEED;
      // 쿼터뷰 4방향: +gx 오른쪽 아래, +gy 왼쪽 아래, -gy 오른쪽 위, -gx 왼쪽 위
      w.view = dir[0] > 0 || dir[1] > 0 ? 'quarter' : 'back';
      w.flip = dir[1] > 0 || dir[0] < 0;
    }
  }

  private draw(): void {
    const g = this.ctx;
    const state = this.getState();
    g.imageSmoothingEnabled = false;
    g.drawImage(this.bg, 0, 0);

    // 가구와 길드원을 깊이 순서대로 그린다
    type Item = { depth: number; draw: () => void };
    const items: Item[] = this.furn.map((f) => ({ depth: f.gx + f.w - 1 + f.gy + f.d - 1, draw: () => f.draw(g) }));
    for (const w of this.walkers.values()) {
      const m = state.members.find((x) => x.id === w.id);
      if (!m) continue;
      items.push({ depth: w.gx + w.gy + 0.01, draw: () => this.drawWalker(w, m.injuredUntil > state.day) });
    }
    items.sort((a, b) => a.depth - b.depth).forEach((i) => i.draw());
  }

  private drawWalker(w: Walker, injured: boolean): void {
    const g = this.ctx;
    const c = iso.at(w.gx + 0.5, w.gy + 0.5); // 칸 중앙
    const x = c.x - SPRITE_W / 2;
    const y = c.y - SPRITE_H + 2;
    const moving = !injured && w.wait <= 0 && !!w.dir;
    // 걷기 순서: 내딛기, 서기, 반대 발, 서기
    const frame: Frame = moving ? ([1, 0, 2, 0] as const)[this.tick % 4] : 0;
    const bob = moving && frame === 0 ? -1 : 0;
    const sprite = this.sprite(w, injured ? 'front' : w.view, frame);
    g.fillStyle = 'rgba(60,30,10,0.3)';
    g.fillRect(c.x - 5, c.y, 10, 2);
    g.fillRect(c.x - 4, c.y - 1, 8, 1);
    if (injured) {
      g.save();
      g.translate(c.x, c.y - 4);
      g.rotate(-Math.PI / 2);
      g.drawImage(sprite, -SPRITE_H / 2, -SPRITE_W / 2);
      g.restore();
      this.bubbleAt(c.x + 4, c.y - 20, 'Z', '#7b5fc7');
      return;
    }
    if (w.flip) {
      g.save();
      g.translate(x + SPRITE_W, y + bob);
      g.scale(-1, 1);
      g.drawImage(sprite, 0, 0);
      g.restore();
    } else {
      g.drawImage(sprite, x, y + bob);
    }
    if (w.bubbleT > 0) this.bubbleAt(c.x + 3, y - 4 + bob, w.bubble, '#c94c4c');
  }

  private sprite(w: Walker, view: View, frame: Frame): HTMLCanvasElement {
    const k = `${view}${frame}`;
    let c = w.sprites.get(k);
    if (!c) {
      c = drawMember(w.member, view, frame);
      w.sprites.set(k, c);
    }
    return c;
  }

  private bubbleAt(x: number, y: number, text: string, color: string): void {
    const g = this.ctx;
    g.fillStyle = INK;
    g.fillRect(x - 1, y - 1, 12, 13);
    g.fillRect(x + 1, y + 12, 3, 2);
    g.fillStyle = '#ffffff';
    g.fillRect(x, y, 10, 11);
    g.fillRect(x + 2, y + 11, 1, 1);
    g.fillStyle = color;
    g.font = '10px Galmuri9, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(text, x + 5, y + 1);
  }
}

