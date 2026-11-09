import Phaser from 'phaser';
import type { BattleEvent, BattleResult, UnitSnapshot } from '../core/battle';

const W = 720;
const H = 1280;
const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

interface UnitView {
  snap: UnitSnapshot;
  body: Phaser.GameObjects.Container;
  bar: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  x: number;
  y: number;
}

class BattleScene extends Phaser.Scene {
  private views = new Map<string, UnitView>();
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private index = 0;
  private speed = 1;
  private finished = false;

  constructor(
    private battle: { title: string; result: BattleResult },
    private onDone: () => void,
  ) {
    super('Battle');
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x14141f);
    this.add.rectangle(W / 2, H / 2, W, 4, 0x3a3550);
    this.add.text(W / 2, 60, this.battle.title, { fontFamily: FONT, fontSize: '36px', color: '#e8d9a8' }).setOrigin(0.5);

    const allies = this.battle.result.units.filter((u) => u.side === 'ally');
    const enemies = this.battle.result.units.filter((u) => u.side === 'enemy');
    this.layoutRow(enemies, 360);
    this.layoutRow(allies, 880);

    this.add.rectangle(W / 2, 1150, W - 40, 190, 0x000000, 0.45).setStrokeStyle(2, 0x3a3550);
    this.logText = this.add.text(40, 1068, '', { fontFamily: FONT, fontSize: '24px', color: '#cfcfe0', lineSpacing: 10, wordWrap: { width: W - 80 } });

    this.button(W - 110, 60, '건너뛰기', () => this.skip());
    const speedBtn = this.button(110, 60, '배속 x1', () => {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
      speedBtn.setText(`배속 x${this.speed}`);
    });

    this.time.delayedCall(500, () => this.next());
  }

  private button(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', backgroundColor: '#3a3550', padding: { x: 14, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }

  private layoutRow(units: UnitSnapshot[], y: number): void {
    const gap = W / (units.length + 1);
    units.forEach((u, i) => {
      const x = gap * (i + 1);
      const r = u.boss ? 70 : 52;
      const color = u.side === 'ally' ? 0x4a7bd1 : u.boss ? 0xb8323a : 0x8a3f4a;
      const circle = this.add.circle(0, 0, r, color).setStrokeStyle(4, u.boss ? 0xffd166 : 0xffffff, 0.6);
      const initial = this.add.text(0, 0, u.name.slice(0, 1), { fontFamily: FONT, fontSize: u.boss ? '52px' : '40px', color: '#ffffff' }).setOrigin(0.5);
      const body = this.add.container(x, y, [circle, initial]);
      const ny = y + r + 28;
      this.add.text(x, ny, u.name, { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
      this.add.rectangle(x, ny + 32, 130, 14, 0x2a2a3a).setOrigin(0.5);
      const bar = this.add.rectangle(x - 65, ny + 32, 130, 14, u.side === 'ally' ? 0x5ccf7a : 0xe0605f).setOrigin(0, 0.5);
      const hpText = this.add.text(x, ny + 58, `${u.maxHp}/${u.maxHp}`, { fontFamily: FONT, fontSize: '20px', color: '#9a9ab0' }).setOrigin(0.5);
      this.views.set(u.uid, { snap: u, body, bar, hpText, x, y });
    });
  }

  private setHp(uid: string, hp: number): void {
    const v = this.views.get(uid);
    if (!v) return;
    v.bar.width = 130 * Math.max(0, hp / v.snap.maxHp);
    v.hpText.setText(`${hp}/${v.snap.maxHp}`);
  }

  private log(line: string): void {
    this.logLines.push(line);
    this.logText.setText(this.logLines.slice(-4).join('\n'));
  }

  private float(uid: string, text: string, color: string, size = 40): void {
    const v = this.views.get(uid);
    if (!v) return;
    const t = this.add.text(v.x, v.y - 40, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: v.y - 120, alpha: 0, duration: 900 / this.speed, onComplete: () => t.destroy() });
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
        this.tweens.add({ targets: a.body, x: a.x + (t.x - a.x) * 0.35, y: a.y + (t.y - a.y) * 0.35, duration: 140 / this.speed, yoyo: true });
        this.time.delayedCall(140 / this.speed, () => {
          if (ev.dodged) {
            this.float(ev.target, '회피', '#9ad1ff', 32);
          } else {
            this.float(ev.target, ev.crit ? `치명! ${ev.dmg}` : `${ev.dmg}`, ev.crit ? '#ffd166' : '#ffffff', ev.crit ? 48 : 38);
            this.setHp(ev.target, ev.hpAfter);
            this.tweens.add({ targets: t.body, alpha: 0.4, duration: 60 / this.speed, yoyo: true });
          }
        });
        return 650;
      }
      case 'intercept':
        this.float(ev.actor, '감싸기!', '#7ef0b0', 36);
        return 700;
      case 'endure':
        this.float(ev.actor, '버텼다!', '#ffd166', 40);
        return 800;
      case 'down': {
        const v = this.views.get(ev.actor)!;
        this.tweens.add({ targets: v.body, alpha: 0.25, scale: 0.85, duration: 300 / this.speed });
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
      if (ev.kind === 'down') this.views.get(ev.actor)!.body.setAlpha(0.25).setScale(0.85);
      if (ev.kind === 'end') {
        this.log(ev.text);
        this.finish(ev.win);
      }
    }
  }

  private finish(win: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.add.rectangle(W / 2, H / 2, W, 220, 0x000000, 0.6);
    this.add.text(W / 2, H / 2, win ? '승리' : '패배', { fontFamily: FONT, fontSize: '96px', color: win ? '#ffd166' : '#e0605f', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);
    this.time.delayedCall(1300, () => this.onDone());
  }
}

/** 전투 결과를 연출로 재생한다. 사용자는 배속과 건너뛰기만 할 수 있다. */
export function playBattle(parent: HTMLElement, title: string, result: BattleResult): Promise<void> {
  return new Promise((resolve) => {
    const game: Phaser.Game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: W,
      height: H,
      backgroundColor: '#14141f',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: new BattleScene({ title, result }, () => {
        game.destroy(true);
        resolve();
      }),
    });
  });
}
