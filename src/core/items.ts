import { addJobExp, JOBS, levelOf, meetsAll, trackLevels } from './jobs';
import { josa } from './josa';
import type { Rng } from './rng';
import type { GuildState, Member, Requirement, Slot, StatKey, Stats, TrackId } from './types';

export type ItemKind = 'material' | 'gear' | 'potion' | 'food' | 'relic';

export interface ItemDef {
  name: string;
  kind: ItemKind;
  desc: string;
  /** 상점 기준가 */
  value: number;
  slot?: Slot;
  bonus?: Partial<Record<StatKey, number>>;
}

export const ITEMS: Record<string, ItemDef> = {
  // 재료
  iron: { name: '철광석', kind: 'material', desc: '대장 기술의 기본 재료.', value: 15 },
  leather: { name: '가죽', kind: 'material', desc: '갑옷과 장신구에 쓴다.', value: 15 },
  herb: { name: '약초', kind: 'material', desc: '물약과 요리에 쓴다.', value: 10 },
  silk: { name: '거미줄', kind: 'material', desc: '질긴 실. 로브를 짠다.', value: 25 },
  meat: { name: '고기', kind: 'material', desc: '요리 재료.', value: 12 },
  manastone: { name: '마석', kind: 'material', desc: '마력이 깃든 돌. 상급 제작에 쓴다.', value: 60 },
  relic: { name: '미감정 유물', kind: 'relic', desc: '감정사가 감정하면 정체가 드러난다.', value: 40 },
  // 대장
  iron_sword: { name: '철검', kind: 'gear', slot: 'weapon', bonus: { might: 2 }, desc: '힘 +2', value: 60 },
  iron_armor: { name: '철 갑옷', kind: 'gear', slot: 'armor', bonus: { body: 2 }, desc: '체력 +2', value: 80 },
  steel_sword: { name: '강철 검', kind: 'gear', slot: 'weapon', bonus: { might: 4 }, desc: '힘 +4', value: 160 },
  knight_armor: { name: '기사의 갑옷', kind: 'gear', slot: 'armor', bonus: { body: 4, will: 1 }, desc: '체력 +4, 의지 +1', value: 260 },
  mithril_sword: { name: '미스릴 검', kind: 'gear', slot: 'weapon', bonus: { might: 7, agility: 2 }, desc: '힘 +7, 민첩 +2', value: 600 },
  // 재봉
  leather_gloves: { name: '가죽 장갑', kind: 'gear', slot: 'accessory', bonus: { agility: 2 }, desc: '민첩 +2', value: 50 },
  travel_cloak: { name: '여행자 망토', kind: 'gear', slot: 'accessory', bonus: { agility: 1, will: 1, body: 1 }, desc: '민첩·의지·체력 +1', value: 110 },
  mage_robe: { name: '마법사 로브', kind: 'gear', slot: 'armor', bonus: { insight: 3, will: 1 }, desc: '지능 +3, 의지 +1', value: 170 },
  silver_robe: { name: '은사 로브', kind: 'gear', slot: 'armor', bonus: { insight: 5, will: 2 }, desc: '지능 +5, 의지 +2', value: 420 },
  // 연금
  potion: { name: '회복약', kind: 'potion', desc: '부상을 바로 낫게 한다.', value: 40 },
  awaken: { name: '각성 물약', kind: 'potion', desc: '경험치 +40.', value: 120 },
  elixir: { name: '엘릭서', kind: 'potion', desc: '무작위 능력치가 영구히 +1.', value: 400 },
  // 요리
  lunch: { name: '든든한 도시락', kind: 'food', desc: '다음 의뢰 출전자 체력 +15%.', value: 40 },
  feast: { name: '용사의 만찬', kind: 'food', desc: '다음 의뢰 출전자 체력·공격 +15%.', value: 150 },
  // 감정 결과 희귀품
  ancient_ring: { name: '고대의 반지', kind: 'gear', slot: 'accessory', bonus: { might: 1, body: 1, agility: 1, insight: 1, will: 1 }, desc: '모든 능력치 +1', value: 500 },
  hero_sword: { name: '영웅의 검', kind: 'gear', slot: 'weapon', bonus: { might: 6, will: 2 }, desc: '힘 +6, 의지 +2', value: 550 },
  guardian_armor: { name: '수호의 갑옷', kind: 'gear', slot: 'armor', bonus: { body: 6, will: 1 }, desc: '체력 +6, 의지 +1', value: 550 },
};

const FOOD_EFFECT: Record<string, { hpMul: number; atkMul: number }> = {
  lunch: { hpMul: 1.15, atkMul: 1 },
  feast: { hpMul: 1.15, atkMul: 1.15 },
};

export interface Recipe {
  id: string;
  item: string;
  track: TrackId;
  req: Requirement[];
  mats: Record<string, number>;
  gold: number;
  days: number;
}

const r = (id: string, track: TrackId, total: number, max: number, mats: Record<string, number>, gold: number, days: number): Recipe => ({
  id,
  item: id,
  track,
  req: [{ track, total, max }],
  mats,
  gold,
  days,
});

/** 제작법. 분야 레벨 합계와 최고 레벨이 모두 맞아야 만들 수 있다 */
export const RECIPES: Recipe[] = [
  r('iron_sword', 'smithing', 1, 1, { iron: 2 }, 20, 1),
  r('iron_armor', 'smithing', 2, 1, { iron: 3, leather: 1 }, 30, 1),
  r('steel_sword', 'smithing', 6, 2, { iron: 4, manastone: 1 }, 60, 2),
  r('knight_armor', 'smithing', 10, 3, { iron: 6, leather: 2, manastone: 1 }, 100, 2),
  r('mithril_sword', 'smithing', 18, 5, { iron: 8, manastone: 4 }, 250, 3),
  r('leather_gloves', 'tailoring', 1, 1, { leather: 2 }, 15, 1),
  r('travel_cloak', 'tailoring', 4, 2, { leather: 3, silk: 1 }, 30, 1),
  r('mage_robe', 'tailoring', 6, 2, { silk: 3, manastone: 1 }, 50, 2),
  r('silver_robe', 'tailoring', 12, 4, { silk: 6, manastone: 3 }, 150, 3),
  r('potion', 'alchemy', 1, 1, { herb: 2 }, 5, 1),
  r('awaken', 'alchemy', 4, 2, { herb: 3, manastone: 1 }, 30, 1),
  r('elixir', 'alchemy', 10, 4, { herb: 5, manastone: 3 }, 120, 2),
  r('lunch', 'cooking', 1, 1, { meat: 2, herb: 1 }, 5, 1),
  r('feast', 'cooking', 6, 3, { meat: 4, herb: 2, manastone: 1 }, 40, 1),
];

/** 상점에서 살 수 있는 재료. 상업 레벨로 품목이 열린다 */
export const SHOP: { item: string; req: Requirement[] }[] = [
  { item: 'herb', req: [{ track: 'commerce', total: 1, max: 1 }] },
  { item: 'meat', req: [{ track: 'commerce', total: 2, max: 1 }] },
  { item: 'iron', req: [{ track: 'commerce', total: 3, max: 1 }] },
  { item: 'leather', req: [{ track: 'commerce', total: 3, max: 1 }] },
  { item: 'silk', req: [{ track: 'commerce', total: 6, max: 2 }] },
  { item: 'manastone', req: [{ track: 'commerce', total: 10, max: 3 }] },
];

export const APPRAISE_REQ: Requirement[] = [{ track: 'appraisal', total: 1, max: 1 }];

export function count(state: GuildState, item: string): number {
  return state.items[item] ?? 0;
}

function addItem(state: GuildState, item: string, n: number): void {
  state.items[item] = count(state, item) + n;
  if (state.items[item] <= 0) delete state.items[item];
}

/** 장비를 포함한 실제 능력치 */
export function effectiveStats(m: Member): Stats {
  const s = { ...m.stats };
  for (const id of Object.values(m.equip)) {
    if (!id) continue;
    for (const [k, v] of Object.entries(ITEMS[id].bonus ?? {})) s[k as StatKey] += v ?? 0;
  }
  return s;
}

export function canCraft(state: GuildState, rc: Recipe): { ok: boolean; why?: string } {
  if (!meetsAll(state.members, rc.req)) return { ok: false, why: '기술 부족' };
  if (state.gold < rc.gold) return { ok: false, why: '금화 부족' };
  for (const [k, n] of Object.entries(rc.mats)) if (count(state, k) < n) return { ok: false, why: '재료 부족' };
  return { ok: true };
}

/** 해당 분야 장인 모두가 함께 만들고 직업 경험치를 나눠 받는다 */
export function craft(state: GuildState, rc: Recipe): string[] {
  if (!canCraft(state, rc).ok) return [];
  state.gold -= rc.gold;
  for (const [k, n] of Object.entries(rc.mats)) addItem(state, k, -n);
  addItem(state, rc.item, 1);
  state.day += rc.days;
  const tier = rc.req[0].max;
  const lines = [`${state.day - rc.days}일차. ${josa(ITEMS[rc.item].name, '을', '를')} 만들었다.`];
  for (const m of state.members.filter((x) => JOBS[x.job].track === rc.track)) {
    const ups = addJobExp(m, 12 + tier * 8);
    m.exp += 3 + tier * 2;
    if (ups) lines.push(`${state.day - rc.days}일차. ${m.name}, ${JOBS[m.job].name} Lv${m.jobLevel} 달성.`);
  }
  state.log.unshift(...lines.reverse());
  return lines;
}

function commerce(state: GuildState) {
  return trackLevels(state.members).commerce;
}

export function buyPrice(state: GuildState, item: string): number {
  const c = commerce(state);
  return Math.round(ITEMS[item].value * (1 - Math.min(0.3, c.total * 0.02)));
}

export function sellPrice(state: GuildState, item: string): number {
  const c = commerce(state);
  return Math.round(ITEMS[item].value * (0.5 + Math.min(0.4, c.total * 0.03)));
}

function merchantExp(state: GuildState, gold: number): void {
  for (const m of state.members.filter((x) => x.job === 'merchant')) {
    const ups = addJobExp(m, Math.max(2, gold / 6));
    if (ups) state.log.unshift(`${state.day}일차. ${m.name}, 상인 Lv${m.jobLevel} 달성.`);
  }
}

export function buy(state: GuildState, item: string): boolean {
  const entry = SHOP.find((s) => s.item === item);
  const price = buyPrice(state, item);
  if (!entry || !meetsAll(state.members, entry.req) || state.gold < price) return false;
  state.gold -= price;
  addItem(state, item, 1);
  merchantExp(state, price);
  return true;
}

export function sell(state: GuildState, item: string): boolean {
  if (count(state, item) <= 0) return false;
  const price = sellPrice(state, item);
  addItem(state, item, -1);
  state.gold += price;
  merchantExp(state, price);
  return true;
}

/** 유물 감정: 감정 최고 레벨이 높을수록 희귀 장비가 나올 확률이 오른다 */
export function appraise(state: GuildState, rng: Rng): string | null {
  if (count(state, 'relic') <= 0 || !meetsAll(state.members, APPRAISE_REQ)) return null;
  const lv = levelOf(state.members, APPRAISE_REQ[0]);
  addItem(state, 'relic', -1);
  let result: string;
  if (rng.chance(0.2 + lv.max * 0.1)) {
    const item = rng.pick(['ancient_ring', 'hero_sword', 'guardian_armor']);
    addItem(state, item, 1);
    result = `미감정 유물의 정체는 ${josa(ITEMS[item].name, '이었다', '였다')}!`;
  } else {
    const gold = Math.round(rng.int(50, 150) * (1 + lv.max * 0.2));
    state.gold += gold;
    result = `오래된 골동품이었다. ${gold}G에 팔았다.`;
  }
  for (const m of state.members.filter((x) => x.job === 'appraiser')) {
    const ups = addJobExp(m, 25);
    if (ups) state.log.unshift(`${state.day}일차. ${m.name}, 감정사 Lv${m.jobLevel} 달성.`);
  }
  state.log.unshift(`${state.day}일차. ${result}`);
  state.seed = rng.seed;
  return result;
}

export function equip(state: GuildState, m: Member, item: string): boolean {
  const def = ITEMS[item];
  if (!def?.slot || count(state, item) <= 0) return false;
  const prev = m.equip[def.slot];
  if (prev) addItem(state, prev, 1);
  addItem(state, item, -1);
  m.equip[def.slot] = item;
  return true;
}

export function unequip(state: GuildState, m: Member, slot: Slot): void {
  const prev = m.equip[slot];
  if (!prev) return;
  addItem(state, prev, 1);
  delete m.equip[slot];
}

/** 물약은 길드원에게, 요리는 다음 의뢰에 쓴다 */
export function useItem(state: GuildState, item: string, rng: Rng, m?: Member): string | null {
  const def = ITEMS[item];
  if (!def || count(state, item) <= 0) return null;
  let text: string | null = null;
  if (def.kind === 'food') {
    state.buff = { name: def.name, ...FOOD_EFFECT[item] };
    text = `${josa(def.name, '을', '를')} 준비했다. 다음 의뢰에 효과가 난다.`;
  } else if (def.kind === 'potion' && m) {
    if (item === 'potion') {
      if (m.injuredUntil <= state.day) return null;
      m.injuredUntil = state.day;
      text = `${m.name}의 부상이 나았다.`;
    } else if (item === 'awaken') {
      m.exp += 40;
      text = `${m.name}, 경험치 +40.`;
    } else if (item === 'elixir') {
      const k = rng.pick(['might', 'body', 'agility', 'insight', 'will'] as StatKey[]);
      m.stats[k]++;
      text = `${m.name}의 능력치가 영구히 올랐다.`;
      state.seed = rng.seed;
    }
  }
  if (!text) return null;
  addItem(state, item, -1);
  state.log.unshift(`${state.day}일차. ${text}`);
  return text;
}

export function addDrops(state: GuildState, items: Record<string, number>): void {
  for (const [k, n] of Object.entries(items)) addItem(state, k, n);
}
