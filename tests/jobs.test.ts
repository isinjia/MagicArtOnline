import { describe, expect, it } from 'vitest';
import { combatStats, simulateBattle } from '../src/core/battle';
import { createMember, createQuest, newGame, questReach } from '../src/core/gen';
import { buy, canCraft, craft, effectiveStats, equip, RECIPES } from '../src/core/items';
import { addJobExp, meets, trackLevels } from '../src/core/jobs';
import { Rng } from '../src/core/rng';
import type { GuildState, JobId } from '../src/core/types';

function guildWith(jobs: [JobId, number][]): GuildState {
  const s = newGame(11);
  const rng = new Rng(3);
  s.members = jobs.map(([job, lv]) => {
    const m = createMember(s, rng, job);
    m.jobLevel = lv;
    return m;
  });
  return s;
}

describe('직업 레벨 합산', () => {
  it('대장장이 5명이 각각 Lv2면 대장 기술 합계는 10, 최고는 Lv2', () => {
    const s = guildWith([['blacksmith', 2], ['blacksmith', 2], ['blacksmith', 2], ['blacksmith', 2], ['blacksmith', 2]]);
    const t = trackLevels(s.members).smithing;
    expect(t.total).toBe(10);
    expect(t.max).toBe(2);
  });

  it('합계가 넘어도 최고 레벨이 모자라면 만들 수 없다', () => {
    const s = guildWith([['blacksmith', 2], ['blacksmith', 2], ['blacksmith', 2], ['blacksmith', 2], ['blacksmith', 2]]);
    // 기사의 갑옷: 대장 합계 10, 최고 Lv3 필요
    expect(meets(s.members, { track: 'smithing', total: 10, max: 3 })).toBe(false);
    s.members[0].jobLevel = 3;
    expect(meets(s.members, { track: 'smithing', total: 10, max: 3 })).toBe(true);
  });

  it('전투 기술은 전투계 직업 전체를 합산한다', () => {
    const s = guildWith([['warrior', 2], ['archer', 3], ['mage', 1], ['blacksmith', 5]]);
    const c = trackLevels(s.members).combat;
    expect(c.total).toBe(6);
    expect(c.max).toBe(3);
  });

  it('직업 경험치가 차면 레벨이 오른다', () => {
    const s = guildWith([['cook', 1]]);
    expect(addJobExp(s.members[0], 60)).toBe(2);
    expect(s.members[0].jobLevel).toBe(3);
  });
});

describe('의뢰 조건', () => {
  it('높은 등급 의뢰는 전투 합계와 최고 레벨이 필요하다', () => {
    const s = guildWith([['warrior', 1], ['archer', 1]]);
    expect(questReach(s)).toBe(0);
    s.members[0].jobLevel = 2;
    s.members[1].jobLevel = 2;
    expect(questReach(s)).toBe(1);
    const q = createQuest(s, new Rng(1), 1);
    expect(q.reqs[0]).toMatchObject({ track: 'combat', total: 4, max: 2 });
  });
});

describe('제작과 상점', () => {
  it('제작하면 재료가 줄고, 그 분야 장인 모두가 직업 경험치를 얻는다', () => {
    const s = guildWith([['blacksmith', 1], ['blacksmith', 1], ['warrior', 1]]);
    s.items = { iron: 2 };
    s.gold = 100;
    const rc = RECIPES.find((r) => r.id === 'iron_sword')!;
    expect(canCraft(s, rc).ok).toBe(true);
    craft(s, rc);
    expect(s.items.iron ?? 0).toBe(0);
    expect(s.items.iron_sword).toBe(1);
    expect(s.members[0].jobExp).toBeGreaterThan(0);
    expect(s.members[1].jobExp).toBeGreaterThan(0);
    expect(s.members[2].jobExp).toBe(0);
  });

  it('장비를 차면 실제 능력치가 오른다', () => {
    const s = guildWith([['warrior', 1]]);
    s.items = { iron_sword: 1 };
    const m = s.members[0];
    const before = effectiveStats(m).might;
    equip(s, m, 'iron_sword');
    expect(effectiveStats(m).might).toBe(before + 2);
    expect(s.items.iron_sword ?? 0).toBe(0);
  });

  it('상인이 없으면 재료를 살 수 없고, 상업 레벨로 품목이 열린다', () => {
    const s = guildWith([['warrior', 1]]);
    s.gold = 500;
    expect(buy(s, 'herb')).toBe(false);
    const m = createMember(s, new Rng(9), 'merchant');
    s.members.push(m);
    expect(buy(s, 'herb')).toBe(true);
    expect(buy(s, 'manastone')).toBe(false);
  });
});

describe('직업별 전투', () => {
  it('성직자는 다친 동료를 치유한다', () => {
    let heals = 0;
    for (let i = 0; i < 30; i++) {
      const s = guildWith([['warrior', 1], ['cleric', 3]]);
      const rng = new Rng(100 + i);
      const res = simulateBattle(s.members, createQuest(s, rng, 1), rng);
      heals += res.events.filter((e) => e.kind === 'heal').length;
    }
    expect(heals).toBeGreaterThan(0);
  });

  it('생산계는 같은 능력치의 전투계보다 공격이 약하다', () => {
    const s = guildWith([['warrior', 1], ['blacksmith', 1]]);
    s.members[1].stats = { ...s.members[0].stats };
    expect(combatStats(s.members[1]).atk).toBeLessThan(combatStats(s.members[0]).atk);
  });
});
