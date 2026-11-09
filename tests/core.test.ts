import { describe, expect, it } from 'vitest';
import { simulateBattle } from '../src/core/battle';
import { createQuest, newGame } from '../src/core/gen';
import { guildPower } from '../src/core/guild';
import { josa } from '../src/core/josa';
import { applyQuest } from '../src/core/progress';
import { Rng } from '../src/core/rng';
import { TemplateStoryGenerator } from '../src/core/story';

describe('josa', () => {
  it('받침에 맞는 조사를 고른다', () => {
    expect(josa('검', '을', '를')).toBe('검을');
    expect(josa('알렌', '이', '가')).toBe('알렌이');
    expect(josa('세라', '이', '가')).toBe('세라가');
  });
});

describe('battle', () => {
  it('같은 시드면 같은 결과가 나온다', () => {
    const s = newGame(42);
    const q = s.quests[0];
    const a = simulateBattle(s.members, q, new Rng(7));
    const b = simulateBattle(s.members, q, new Rng(7));
    expect(a).toEqual(b);
    expect(a.events.at(-1)?.kind).toBe('end');
  });
});

describe('progress', () => {
  it('퀘스트 결과가 히스토리, 경험, 날짜에 반영된다', async () => {
    const s = newGame(1);
    const q = s.quests[0];
    const party = s.members.slice(0, 2);
    const rng = new Rng(s.seed);
    const res = simulateBattle(party, q, rng);
    const out = await applyQuest(s, q, party, res, new TemplateStoryGenerator(rng), rng);
    expect(out.members).toHaveLength(2);
    expect(party[0].history.length).toBe(2);
    expect(party[0].exp).toBeGreaterThan(0);
    expect(s.day).toBe(1 + q.days);
    expect(s.quests).toHaveLength(4);
  });

  it('겪은 일이 쌓이면 스킬을 깨닫는다', async () => {
    const s = newGame(3);
    const m = s.members[0];
    m.tagCounts.near_death = 1;
    const q = s.quests[0];
    const rng = new Rng(9);
    const res = simulateBattle([m], q, rng);
    res.records[m.id].nearDeath = true;
    await applyQuest(s, q, [m], res, new TemplateStoryGenerator(rng), rng);
    expect(m.skills).toContain('unyielding');
  });

  it('전투 직업 레벨 합계에 따라 출전 인원이 늘어난다', () => {
    const s = newGame(5);
    expect(guildPower(s.members).partySize).toBe(2);
    for (const m of s.members.filter((x) => x.job === 'warrior' || x.job === 'archer')) m.jobLevel = 3;
    expect(guildPower(s.members).partySize).toBe(3);
  });
});

describe('balance', () => {
  it('E등급 3명은 E등급 퀘스트를 대체로 이기고 D등급은 접전이다', () => {
    let win0 = 0;
    let win1 = 0;
    for (let i = 0; i < 200; i++) {
      const s = newGame(1000 + i);
      const rng = new Rng(i + 1);
      if (simulateBattle(s.members, createQuest(s, rng, 0), rng).win) win0++;
      if (simulateBattle(s.members, createQuest(s, rng, 1), rng).win) win1++;
    }
    console.log(`E등급 승률 ${win0 / 2}%, D등급 승률 ${win1 / 2}%`);
    expect(win0).toBeGreaterThan(150);
    expect(win1).toBeLessThan(win0);
  });
});
