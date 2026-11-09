import Phaser from 'phaser';
import { makeIso, tile } from '../art/iso';
import { drawEnemy, drawMember } from '../art/sprites';
import type { BattleEvent, BattleResult, UnitSnapshot } from '../core/battle';
import type { Member } from '../core/types';

const W = 720;
const H = 1280;
const FONT = 'Galmuri11, sans-serif';
const INK = 0x2a1d17;
const CREAM = 0xfff6dc;

interface UnitView {
  snap: UnitSnapshot;
  body: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  x: number;
  y: number;
}

const PX = 5; // 배경 도트 1칸의 화면 크기

/** 쿼터뷰 들판: 마름모 잔디 타일과 대각선 흙길 */
function fieldTexture(): HTMLCanvasElement {
  const w = W / PX;
  const h = H / PX;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6cc04a';
  g.fillRect(0, 0, w, h);
  const iso = makeIso(w / 2, -40);
  for (let gy = -24; gy < 64; gy++) {
    for (let gx = -24; gx < 64; gx++) {
      const p = iso.at(gx, gy);
      if (p.y < -12 || p.y > h + 2 || p.x < -12 || p.x > w + 12) continue;
      // 왼쪽 아래에서 오른쪽 위로 가로지르는 흙길
      const path = Math.abs(gx - 18) <= 1;
      const color = path ? ((gx + gy) % 2 ? '#d9b77a' : '#cfa96b') : (gx + gy) % 2 ? '#6cc04a' : '#62b542';
      tile(g, p.x, p.y, color);
      if (!path && (gx * 7 + gy * 13) % 9 === 0) {
        g.fillStyle = '#4e9a34';
        g.fillRect(p.x - 2, p.y + 3, 1, 2);
        g.fillRect(p.x - 1, p.y + 4, 1, 1);
        g.fillRect(p.x + 2, p.y + 4, 1, 2);
      }
      if (!path && (gx * 5 + gy * 3) % 23 === 0) {
        g.fillStyle = '#ffffff';
        g.fillRect(p.x, p.y + 4, 1, 1);
        g.fillStyle = '#ffcf3f';
        g.fillRect(p.x + 1, p.y + 4, 1, 1);
      }
    }
  }
  return c;
}

class BattleScene extends Phaser.Scene {
  private views = new Map<string, UnitView>();
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private index = 0;
  private speed = 1;
  private finished = false;

  constructor(
    private battle: { title: string; result: BattleResult; party: Member[] },
    private onDone: () => void,
  ) {
    super('Battle');
  }

  create(): void {
    this.textures.addCanvas('field', fieldTexture());
    this.add.image(0, 0, 'field').setOrigin(0).setScale(PX);

    this.panel(W / 2, 64, 420, 70);
    this.add.text(W / 2, 64, this.battle.title, { fontFamily: FONT, fontSize: '30px', color: '#7a4a22', fontStyle: 'bold' }).setOrigin(0.5);

    const allies = this.battle.result.units.filter((u) => u.side === 'ally');
    const enemies = this.battle.result.units.filter((u) => u.side === 'enemy');
    // 쿼터뷰: 적은 오른쪽 위, 아군은 왼쪽 아래에서 대각선으로 마주본다
    this.layoutRow(enemies, 470, 440, false);
    this.layoutRow(allies, 250, 840, true);

    this.panel(W / 2, 1150, W - 40, 200);
    this.logText = this.add.text(48, 1068, '', { fontFamily: FONT, fontSize: '24px', color: '#2a1d17', lineSpacing: 12, wordWrap: { width: W - 96 } });

    this.button(W - 100, 150, '스킵', () => this.skip());
    const speedBtn = this.button(100, 150, 'x1', () => {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
      speedBtn.setText(`x${this.speed}`);
    });

    this.time.delayedCall(500, () => this.next());
  }

  private panel(x: number, y: number, w: number, h: number): void {
    this.add.rectangle(x, y, w, h, CREAM).setStrokeStyle(6, INK);
    this.add.rectangle(x, y + h / 2 - 8, w - 12, 6, 0xf6e3b4);
  }

  private button(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    this.add.rectangle(x, y, 130, 64, 0x5cbf4a).setStrokeStyle(6, INK);
    return this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold', stroke: '#2a1d17', strokeThickness: 6 })
      .setOrigin(0.5)
      .setPadding(40, 16, 40, 16)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }

  private layoutRow(units: UnitSnapshot[], cx: number, cy: number, ally: boolean): void {
    // 진형은 오른쪽 아래로 비스듬히 늘어선다
    const sx = 120;
    const sy = 60;
    units.forEach((u, i) => {
      const k = i - (units.length - 1) / 2;
      const x = cx + k * sx;
      const y = cy + k * sy;
      const key = `u:${u.uid}`;
      const member = u.memberId ? this.battle.party.find((m) => m.id === u.memberId) : undefined;
      this.textures.addCanvas(key, member ? drawMember(member) : drawEnemy(u.name, u.boss));
      const scale = u.boss ? 9 : 7;
      this.add.rectangle(x, y + 70, 90, 10, 0x2a1d17, 0.25);
      this.add.rectangle(x, y + 70, 60, 20, 0x2a1d17, 0.25);
      const body = this.add.image(x, y, key).setScale(scale).setOrigin(0.5, 0.6);
      // 아군은 오른쪽 위(적)를, 적은 왼쪽 아래(아군)를 본다
      if (!ally && !u.name.includes('울프')) body.setFlipX(true);
      body.setDepth(y);
      const ny = y + 100;
      this.add.text(x, ny, ally ? u.name.split(' ')[0] : u.name, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#2a1d17', strokeThickness: 6 }).setOrigin(0.5).setDepth(3000);
      this.add.rectangle(x, ny + 34, 108, 20, INK).setOrigin(0.5).setDepth(3000);
      const bar = this.add.rectangle(x - 50, ny + 34, 100, 12, u.side === 'ally' ? 0x5cbf4a : 0xe0524a).setOrigin(0, 0.5).setDepth(3001);
      const hpText = this.add.text(x, ny + 62, `${u.maxHp}/${u.maxHp}`, { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#2a1d17', strokeThickness: 4 }).setOrigin(0.5).setDepth(3001);
      this.views.set(u.uid, { snap: u, body, bar, hpText, x, y });
      // 대기 중 숨쉬기 (공격 이동과 겹치지 않게 세로 크기만 바꾼다)
      this.tweens.add({ targets: body, scaleY: scale * 0.92, duration: 300, yoyo: true, repeat: -1, delay: i * 120, ease: 'Stepped', easeParams: [2] });
    });
  }

  private setHp(uid: string, hp: number): void {
    const v = this.views.get(uid);
    if (!v) return;
    v.bar.width = 100 * Math.max(0, hp / v.snap.maxHp);
    v.hpText.setText(`${hp}/${v.snap.maxHp}`);
  }

  private log(line: string): void {
    this.logLines.push(line);
    this.logText.setText(this.logLines.slice(-4).join('\n'));
  }

  private float(uid: string, text: string, color: string, size = 40): void {
    const v = this.views.get(uid);
    if (!v) return;
    const t = this.add.text(v.x, v.y - 60, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#2a1d17', strokeThickness: 8 }).setOrigin(0.5).setDepth(4000);
    this.tweens.add({ targets: t, y: v.y - 140, duration: 700 / this.speed, ease: 'Stepped', easeParams: [6], onComplete: () => t.destroy() });
  }

  private next(): void {
    if (this.finished) return;
    const ev = this.battle.result.events[this.index++];
    if (!ev) return;
    const wait = this.play(ev);
    if (ev.kind !== 'end') this.time.delayedCall(wait / this.speed, () => this.next());
  }

  private play(ev: BattleEvent): number {
    this.log(ev.text);
    switch (ev.kind) {
      case 'attack': {
        const a = this.views.get(ev.actor)!;
        const t = this.views.get(ev.target)!;
        this.tweens.add({ targets: a.body, x: a.x + (t.x - a.x) * 0.4, y: a.y + (t.y - a.y) * 0.4, duration: 150 / this.speed, yoyo: true, ease: 'Stepped', easeParams: [3] });
        this.time.delayedCall(150 / this.speed, () => {
          if (ev.dodged) {
            this.float(ev.target, 'MISS', '#7fe3ff', 34);
          } else {
            this.float(ev.target, ev.crit ? `${ev.dmg}!!` : `${ev.dmg}`, ev.crit ? '#ffcf3f' : '#ffffff', ev.crit ? 54 : 40);
            this.setHp(ev.target, ev.hpAfter);
            t.body.setTintFill(0xffffff);
            this.time.delayedCall(80, () => t.body.clearTint());
            if (ev.crit) this.cameras.main.shake(120, 0.008);
          }
        });
        return 650;
      }
      case 'intercept':
        this.float(ev.actor, '감싸기!', '#5cbf4a', 36);
        return 700;
      case 'endure':
        this.float(ev.actor, '버텼다!', '#ffcf3f', 40);
        return 800;
      case 'down': {
        const v = this.views.get(ev.actor)!;
        this.tweens.killTweensOf(v.body);
        this.tweens.add({ targets: v.body, angle: v.snap.side === 'ally' ? -90 : 90, alpha: 0.5, duration: 250 / this.speed, ease: 'Stepped', easeParams: [3] });
        return 600;
      }
      case 'end':
        this.finish(ev.win);
        return 0;
    }
  }

  private skip(): void {
    if (this.finished) return;
    const events = this.battle.result.events;
    for (; this.index < events.length; this.index++) {
      const ev = events[this.index];
      if (ev.kind === 'attack' && !ev.dodged) this.setHp(ev.target, ev.hpAfter);
      if (ev.kind === 'down') {
        const v = this.views.get(ev.actor)!;
        this.tweens.killTweensOf(v.body);
        v.body.setAngle(v.snap.side === 'ally' ? -90 : 90).setAlpha(0.5);
      }
      if (ev.kind === 'end') {
        this.log(ev.text);
        this.finish(ev.win);
      }
    }
  }

  private finish(win: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.add.rectangle(W / 2, H / 2 - 40, 460, 150, win ? 0xffcf3f : 0xe0524a).setStrokeStyle(8, INK).setDepth(6000);
    this.add
      .text(W / 2, H / 2 - 40, win ? '승리!' : '패배…', { fontFamily: FONT, fontSize: '80px', fontStyle: 'bold', color: '#ffffff', stroke: '#2a1d17', strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(6001);
    this.time.delayedCall(1300, () => this.onDone());
  }
}

/** 전투 결과를 도트 연출로 재생한다. 사용자는 배속과 스킵만 할 수 있다. */
export function playBattle(parent: HTMLElement, title: string, result: BattleResult, party: Member[]): Promise<void> {
  return new Promise((resolve) => {
    const game: Phaser.Game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: W,
      height: H,
      backgroundColor: '#6cc04a',
      pixelArt: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: new BattleScene({ title, result, party }, () => {
        game.destroy(true);
        resolve();
      }),
    });
  });
}
