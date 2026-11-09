import { describe, expect, it } from 'vitest';
import { createMember, createQuest, newGame } from '../src/core/gen';
import { buyPrice } from '../src/core/items';
import { Rng } from '../src/core/rng';
import { isLand, siteById, SITES, TOWN_IDS, TOWNS, travelDays } from '../src/core/world';

describe('월드맵', () => {
  it('모든 도시와 장소는 육지 위에 있다', () => {
    for (const t of Object.values(TOWNS)) expect(isLand(t.x, t.y)).toBe(true);
    for (const s of SITES) expect(isLand(s.x, s.y)).toBe(true);
  });

  it('도시마다 시작 자원과 시설이 다르다', () => {
    const maren = newGame(1, 'maren', '바다의 별');
    expect(maren.name).toBe('바다의 별');
    expect(maren.facilities.counter).toBe(1);
    const iron = newGame(1, 'ironhall');
    expect(iron.items.iron).toBe(8);
    expect(newGame(1, 'lumina').gold).toBe(200);
  });

  it('의뢰는 지도 위 장소에서 생기고, 멀수록 오래 걸린다', () => {
    for (const id of TOWN_IDS) {
      const s = newGame(7, id);
      for (const q of s.quests) {
        const site = siteById(q.placeId)!;
        expect(site).toBeTruthy();
        expect(q.days).toBe(travelDays(TOWNS[id], site));
      }
    }
    const far = travelDays(TOWNS.greywall, siteById('old_mine')!);
    const near = travelDays(TOWNS.greywall, siteById('orc_waste')!);
    expect(far).toBeGreaterThan(near);
  });

  it('소속 도시에 따라 모집되는 직업이 치우친다', () => {
    const s = newGame(3, 'saintbell');
    const rng = new Rng(5);
    let holy = 0;
    for (let i = 0; i < 200; i++) if (['cleric', 'mage'].includes(createMember(s, rng).job)) holy++;
    // 기본 확률은 약 20%, 수도원 도시는 그보다 훨씬 높다
    expect(holy).toBeGreaterThan(80);
  });

  it('소속 도시가 자주 들어오는 의뢰를 정한다', () => {
    const s = newGame(9, 'ironhall');
    const rng = new Rng(2);
    let bias = 0;
    for (let i = 0; i < 200; i++) if (['폐광 조사', '고블린 소탕'].some((n) => createQuest(s, rng, 0).name.startsWith(n))) bias++;
    expect(bias).toBeGreaterThan(110);
  });

  it('항구 도시는 상점 구입가가 싸다', () => {
    const a = newGame(1, 'maren');
    const b = newGame(1, 'lumina');
    expect(buyPrice(a, 'manastone')).toBeLessThan(buyPrice(b, 'manastone'));
  });
});
