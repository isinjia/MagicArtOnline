import { describe, expect, it } from 'vitest';
import { combatStats, simulateBattle } from '../src/core/battle';
import { createMember, createQuest, newGame, questReach } from '../src/core/gen';
import { build, canBuild, memberCap } from '../src/core/facilities';
import { artisansFor, buy, canCraft, effectiveStats, equip, passDays, RECIPES, startOrder } from '../src/core/items';
import { isAvailable } from '../src/core/progress';
import { migrate } from '../src/core/save';
import { addJobExp, canChangeJob, changeJob, meets, trackLevels } from '../src/core/jobs';
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
  it('제작은 장인 한 명에게 맡기고, 날이 지나면 완성되어 그 장인만 경험치를 얻는다', () => {
    const s = guildWith([['blacksmith', 1], ['blacksmith', 1], ['warrior', 1]]);
    s.items = { iron: 2 };
    s.gold = 100;
    const rc = RECIPES.find((r) => r.id === 'iron_sword')!;
    expect(canCraft(s, rc).ok).toBe(true);
    const [a, b] = s.members;
    expect(startOrder(s, rc, a)).toBe(true);
    expect(s.items.iron ?? 0).toBe(0);
    expect(s.items.iron_sword ?? 0).toBe(0);
    expect(isAvailable(s, a)).toBe(false);
    passDays(s, rc.days);
    expect(s.items.iron_sword).toBe(1);
    expect(a.jobExp).toBeGreaterThan(0);
    expect(b.jobExp).toBe(0);
    expect(isAvailable(s, a)).toBe(true);
  });

  it('최고 레벨 조건은 맡은 장인 본인이 채워야 한다', () => {
    const s = guildWith([['blacksmith', 3], ['blacksmith', 2], ['blacksmith', 2]]);
    s.items = { iron: 10, manastone: 5 };
    s.gold = 1000;
    s.facilities.forge = 2;
    const rc = RECIPES.find((r) => r.id === 'steel_sword')!; // 합계 6, 장인 Lv2
    expect(artisansFor(s, rc).length).toBe(3);
    const knight = RECIPES.find((r) => r.id === 'knight_armor')!; // 합계 10 필요
    expect(canCraft(s, knight).ok).toBe(false);
    s.members[1].jobLevel = 5;
    s.items.leather = 2;
    expect(canCraft(s, knight).ok).toBe(true);
    // Lv3 이상만 맡을 수 있다
    expect(artisansFor(s, knight).map((m) => m.jobLevel)).toEqual([3, 5]);
  });

  it('시설 레벨이 모자라면 만들 수 없다', () => {
    const s = guildWith([['blacksmith', 5], ['blacksmith', 5]]);
    s.items = { iron: 10, manastone: 5 };
    s.gold = 1000;
    const rc = RECIPES.find((r) => r.id === 'steel_sword')!;
    expect(canCraft(s, rc).ok).toBe(false);
    s.facilities.forge = 2;
    expect(canCraft(s, rc).ok).toBe(true);
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

  it('상점 카운터와 상인이 있어야 재료를 살 수 있다', () => {
    const s = guildWith([['warrior', 1]]);
    s.gold = 500;
    expect(buy(s, 'herb')).toBe(false);
    s.members.push(createMember(s, new Rng(9), 'merchant'));
    expect(buy(s, 'herb')).toBe(false);
    s.facilities.counter = 1;
    expect(buy(s, 'herb')).toBe(true);
    expect(buy(s, 'manastone')).toBe(false);
  });

  it('시설을 지으면 금화와 재료가 들고 레벨이 오른다', () => {
    const s = guildWith([['warrior', 1]]);
    s.gold = 200;
    s.items = { herb: 4 };
    expect(canBuild(s, 'infirmary').ok).toBe(true);
    expect(build(s, 'infirmary')).toBe(true);
    expect(s.facilities.infirmary).toBe(1);
    expect(s.gold).toBe(80);
  });

  it('숙소 레벨이 정원을 정한다', () => {
    const s = guildWith([['warrior', 1]]);
    expect(memberCap(s)).toBe(5);
    s.facilities.dorm = 2;
    expect(memberCap(s)).toBe(9);
  });
});

describe('전직', () => {
  it('능력치 조건을 채우면 전직하고, 예전 직업으로 돌아가면 레벨이 이어진다', () => {
    const s = guildWith([['warrior', 4]]);
    const m = s.members[0];
    s.gold = 200;
    m.stats.insight = 3;
    expect(canChangeJob(s, m, 'mage').ok).toBe(false);
    m.stats.insight = 8;
    expect(changeJob(s, m, 'mage')).toBe(true);
    expect(m.job).toBe('mage');
    expect(m.jobLevel).toBe(1);
    expect(changeJob(s, m, 'warrior')).toBe(true);
    expect(m.jobLevel).toBe(4);
    expect(s.gold).toBe(100);
  });
});

describe('저장 데이터', () => {
  it('v2 저장을 최신 구조로 옮긴다', () => {
    const s = newGame(1) as unknown as Record<string, unknown>;
    s.version = 2;
    delete s.facilities;
    delete s.orders;
    delete s.town;
    for (const q of s.quests as Record<string, unknown>[]) delete q.placeId;
    for (const m of s.members as Record<string, unknown>[]) delete m.jobRecords;
    const out = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(out.version).toBe(4);
    expect(out.town).toBe('lumina');
    expect(out.quests.every((q) => !!q.placeId)).toBe(true);
    expect(out.facilities.forge).toBe(1);
    expect(out.orders).toEqual([]);
    expect(out.members[0].jobRecords).toEqual({});
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
