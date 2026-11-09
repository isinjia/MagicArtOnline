import { effectiveStats } from './items';
import { josa } from './josa';
import type { Rng } from './rng';
import type { JobId, Member, Quest, TraitId } from './types';

export interface UnitSnapshot {
  uid: string;
  name: string;
  side: 'ally' | 'enemy';
  maxHp: number;
  boss: boolean;
  memberId?: string;
}

export type BattleEvent =
  | { kind: 'attack'; actor: string; target: string; dmg: number; crit: boolean; dodged: boolean; hpAfter: number; text: string }
  | { kind: 'intercept'; actor: string; target: string; text: string }
  | { kind: 'heal'; actor: string; target: string; amount: number; hpAfter: number; text: string }
  | { kind: 'endure'; actor: string; text: string }
  | { kind: 'down'; actor: string; text: string }
  | { kind: 'end'; win: boolean; text: string };

/** 전투 중 길드원 한 명이 겪은 일. 히스토리와 성장의 재료 */
export interface MemberRecord {
  kills: number;
  critKills: number;
  bossKills: string[];
  dodges: number;
  nearDeath: boolean;
  endured: boolean;
  down: boolean;
  savedNames: string[];
  firstStrike: boolean;
  soloSurvivor: boolean;
  damageDealt: number;
  heals: number;
}

export interface BattleResult {
  win: boolean;
  units: UnitSnapshot[];
  events: BattleEvent[];
  records: Record<string, MemberRecord>;
}

interface Unit extends UnitSnapshot {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  dodge: number;
  traits: TraitId[];
  skills: string[];
  endured: boolean;
  job?: JobId;
  heal: number;
  pierce: number;
}

/** 길드원의 전투 능력. 능력치(장비 포함), 등급, 직업과 직업 레벨, 기질, 스킬이 모두 반영된다 */
export function combatStats(m: Member, hpMul = 1, atkMul = 1) {
  const has = (id: string) => m.skills.includes(id);
  const t = (id: TraitId) => m.traits.includes(id);
  const st = effectiveStats(m);
  const lv = m.jobLevel;
  const job = m.job;
  const combatJob = ['warrior', 'archer', 'mage', 'cleric', 'rogue'].includes(job);
  const baseAtk = job === 'mage' ? 4 + st.insight * 1.6 : 4 + st.might * 1.5;
  return {
    maxHp: Math.round((30 + st.body * 6 + m.grade * 25 + lv * 4) * (job === 'warrior' ? 1.15 : 1) * hpMul),
    atk: (baseAtk + m.grade * 5 + (combatJob ? lv * 1.5 : 0)) * (combatJob ? 1 : 0.85) * (t('brave') ? 1.1 : 1) * (has('hunter') ? 1.15 : 1) * atkMul,
    def: st.body * 0.5 + m.grade * 2.5 + (has('scar') ? 2 : 0) + (job === 'warrior' ? lv * 0.5 : 0),
    spd: st.agility + (has('swift') ? 4 : 0) + (job === 'archer' ? 2 + lv * 0.3 : 0),
    crit: 0.05 + st.insight * 0.006 + (t('cold') ? 0.05 : 0) + (has('executioner') ? 0.12 : 0) + (job === 'archer' ? 0.05 + lv * 0.01 : 0),
    dodge: st.agility * 0.007 + (t('cautious') ? 0.06 : 0) + (has('shadowstep') ? 0.08 : 0) + (job === 'rogue' ? 0.06 + lv * 0.01 : 0),
    heal: job === 'cleric' ? (6 + st.will + lv * 2) * (has('healer') ? 1.3 : 1) : 0,
    pierce: job === 'mage' ? 0.5 : 0,
  };
}

function emptyRecord(): MemberRecord {
  return { kills: 0, critKills: 0, bossKills: [], dodges: 0, nearDeath: false, endured: false, down: false, savedNames: [], firstStrike: false, soloSurvivor: false, damageDealt: 0, heals: 0 };
}

export function simulateBattle(party: Member[], quest: Quest, rng: Rng, opts: { hpMul?: number; atkMul?: number } = {}): BattleResult {
  const allies: Unit[] = party.map((m) => {
    const c = combatStats(m, opts.hpMul, opts.atkMul);
    return { uid: `a:${m.id}`, memberId: m.id, name: m.name, side: 'ally', boss: false, hp: c.maxHp, ...c, traits: m.traits, skills: m.skills, endured: false, job: m.job };
  });
  const enemies: Unit[] = quest.enemies.map((e, i) => ({
    uid: `e:${i}`,
    name: e.name,
    side: 'enemy',
    boss: e.boss,
    maxHp: e.hp,
    hp: e.hp,
    atk: e.atk,
    def: e.def,
    spd: e.spd,
    crit: 0.05,
    dodge: 0.03,
    traits: [],
    skills: [],
    endured: false,
    heal: 0,
    pierce: 0,
  }));
  const all = [...allies, ...enemies];
  const units: UnitSnapshot[] = all.map(({ uid, name, side, maxHp, boss, memberId }) => ({ uid, name, side, maxHp, boss, memberId }));
  const records: Record<string, MemberRecord> = Object.fromEntries(party.map((m) => [m.id, emptyRecord()]));
  const events: BattleEvent[] = [];
  const alive = (u: Unit) => u.hp > 0;
  const rec = (u: Unit) => (u.memberId ? records[u.memberId] : undefined);

  for (let round = 1; round <= 30; round++) {
    const order = all.filter(alive).sort((a, b) => b.spd + rng.next() * 3 - (a.spd + rng.next() * 3));
    if (round === 1 && order[0]?.side === 'ally') rec(order[0])!.firstStrike = true;

    for (const actor of order) {
      if (!alive(actor)) continue;
      const foes = (actor.side === 'ally' ? enemies : allies).filter(alive);
      if (foes.length === 0) break;

      // 성직자: 체력이 절반 아래인 동료가 있으면 공격 대신 치유
      if (actor.heal > 0) {
        const hurt = allies.filter((u) => alive(u) && u.hp < u.maxHp * 0.5).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (hurt && rng.chance(0.75)) {
          const amount = Math.min(hurt.maxHp - hurt.hp, Math.round(actor.heal * (0.9 + rng.next() * 0.2)));
          hurt.hp += amount;
          rec(actor)!.heals++;
          events.push({ kind: 'heal', actor: actor.uid, target: hurt.uid, amount, hpAfter: hurt.hp, text: `${josa(actor.name, '이', '가')} ${hurt.name}의 상처를 ${amount} 치유했다.` });
          continue;
        }
      }

      let target = actor.traits.includes('cold') ? foes.reduce((a, b) => (a.hp <= b.hp ? a : b)) : rng.pick(foes);

      // 동료 감싸기: 의리, 용맹, 수호가 계기
      if (actor.side === 'enemy' && target.hp < target.maxHp * 0.4) {
        for (const p of allies.filter((u) => alive(u) && u !== target)) {
          const chance = (p.skills.includes('guardian') ? 0.5 : 0) + (p.traits.includes('loyal') ? 0.3 : 0) + (p.traits.includes('brave') ? 0.12 : 0);
          if (chance > 0 && rng.chance(chance)) {
            events.push({ kind: 'intercept', actor: p.uid, target: target.uid, text: `${josa(p.name, '이', '가')} ${josa(target.name, '을', '를')} 감싸며 앞을 막아섰다!` });
            rec(p)!.savedNames.push(target.name);
            target = p;
            break;
          }
        }
      }

      if (rng.chance(target.dodge)) {
        events.push({ kind: 'attack', actor: actor.uid, target: target.uid, dmg: 0, crit: false, dodged: true, hpAfter: target.hp, text: `${josa(target.name, '이', '가')} ${actor.name}의 공격을 흘려냈다.` });
        if (rec(target)) rec(target)!.dodges++;
        continue;
      }

      const crit = rng.chance(actor.crit);
      let atk = actor.atk;
      if (actor.side === 'ally') {
        if (target.boss && actor.skills.includes('slayer')) atk *= 1.2;
        if (actor.skills.includes('lone_wolf') && allies.filter(alive).length === 1) atk *= 1.4;
      }
      let dmg = Math.max(1, Math.round(atk * (0.85 + rng.next() * 0.3) - target.def * (1 - actor.pierce)));
      if (crit) dmg = Math.round(dmg * 1.8);
      target.hp -= dmg;
      if (rec(actor)) rec(actor)!.damageDealt += dmg;

      let endured = false;
      if (target.hp <= 0 && target.skills.includes('unyielding') && !target.endured) {
        target.hp = 1;
        target.endured = true;
        endured = true;
      }
      const hpAfter = Math.max(0, target.hp);
      events.push({
        kind: 'attack',
        actor: actor.uid,
        target: target.uid,
        dmg,
        crit,
        dodged: false,
        hpAfter,
        text: `${actor.name}의 ${crit ? '치명적인 ' : ''}일격, ${target.name}에게 ${dmg} 피해.`,
      });

      const tr = rec(target);
      if (endured) {
        events.push({ kind: 'endure', actor: target.uid, text: `${josa(target.name, '이', '가')} 쓰러지기 직전 이를 악물고 버텼다!` });
        tr!.endured = true;
        tr!.nearDeath = true;
      } else if (target.hp <= 0) {
        events.push({ kind: 'down', actor: target.uid, text: `${josa(target.name, '이', '가')} 쓰러졌다.` });
        if (tr) tr.down = true;
        const ar = rec(actor);
        if (ar && target.side === 'enemy') {
          ar.kills++;
          if (crit) ar.critKills++;
          if (target.boss) ar.bossKills.push(target.name);
        }
      } else if (tr && target.hp < target.maxHp * 0.2) {
        tr.nearDeath = true;
      }
    }

    if (enemies.every((u) => !alive(u)) || allies.every((u) => !alive(u))) break;
  }

  const win = enemies.every((u) => !alive(u));
  const standing = allies.filter(alive);
  if (win && allies.length >= 2 && standing.length === 1) rec(standing[0])!.soloSurvivor = true;
  events.push({ kind: 'end', win, text: win ? '승리했다.' : '패퇴했다.' });
  return { win, units, events, records };
}
