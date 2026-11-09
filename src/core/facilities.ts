import { meetsAll } from './jobs';
import { josa } from './josa';
import type { FacilityId, GuildState, Member, Requirement, TrackId } from './types';

export interface FacilityLevel {
  gold: number;
  mats: Record<string, number>;
  req: Requirement[];
  /** 이 레벨의 효과 설명 */
  effect: string;
}

export interface FacilityDef {
  name: string;
  desc: string;
  /** 이 시설이 있어야 제작할 수 있는 분야 */
  track?: TrackId;
  levels: FacilityLevel[];
}

const L = (gold: number, mats: Record<string, number>, req: Requirement[], effect: string): FacilityLevel => ({ gold, mats, req, effect });

export const FACILITIES: Record<FacilityId, FacilityDef> = {
  forge: {
    name: '대장간',
    desc: '무기와 갑옷을 만든다.',
    track: 'smithing',
    levels: [
      L(100, { iron: 3 }, [], '기본 무기·갑옷 제작'),
      L(250, { iron: 6, manastone: 1 }, [{ track: 'smithing', total: 4, max: 2 }], '강철 장비 제작'),
      L(600, { iron: 10, manastone: 3 }, [{ track: 'smithing', total: 10, max: 4 }], '미스릴 장비 제작'),
    ],
  },
  loom: {
    name: '재봉대',
    desc: '장갑, 망토, 로브를 짓는다.',
    track: 'tailoring',
    levels: [
      L(80, { leather: 2 }, [], '가죽 장신구 제작'),
      L(200, { silk: 3 }, [{ track: 'tailoring', total: 3, max: 2 }], '로브 제작'),
      L(500, { silk: 6, manastone: 2 }, [{ track: 'tailoring', total: 8, max: 4 }], '은사 로브 제작'),
    ],
  },
  lab: {
    name: '실험대',
    desc: '물약을 조합한다.',
    track: 'alchemy',
    levels: [
      L(80, { herb: 3 }, [], '회복약 제작'),
      L(220, { herb: 5, manastone: 1 }, [{ track: 'alchemy', total: 3, max: 2 }], '각성 물약 제작'),
      L(520, { manastone: 3 }, [{ track: 'alchemy', total: 8, max: 4 }], '엘릭서 제작'),
    ],
  },
  kitchen: {
    name: '주방',
    desc: '출전 전 요리를 만든다.',
    track: 'cooking',
    levels: [
      L(60, { meat: 2 }, [], '도시락 요리'),
      L(180, { meat: 4, herb: 2 }, [{ track: 'cooking', total: 3, max: 2 }], '만찬 요리'),
    ],
  },
  counter: {
    name: '상점 카운터',
    desc: '상점에서 재료를 들여온다. 레벨이 오르면 품목이 는다.',
    track: 'commerce',
    levels: [
      L(100, {}, [], '약초·고기·철광석·가죽 구입'),
      L(300, { leather: 2 }, [{ track: 'commerce', total: 4, max: 2 }], '거미줄 구입'),
      L(700, { manastone: 1 }, [{ track: 'commerce', total: 10, max: 4 }], '마석 구입'),
    ],
  },
  appraisal_desk: {
    name: '감정대',
    desc: '미감정 유물을 감정한다.',
    track: 'appraisal',
    levels: [
      L(120, {}, [], '유물 감정'),
      L(350, { manastone: 1 }, [{ track: 'appraisal', total: 3, max: 2 }], '희귀품 확률 +10%'),
    ],
  },
  training: {
    name: '훈련장',
    desc: '전투계 길드원을 단련한다.',
    levels: [
      L(150, { iron: 2 }, [{ track: 'combat', total: 4, max: 2 }], '의뢰 경험치·직업 경험치 +10%'),
      L(400, { iron: 4, leather: 2 }, [{ track: 'combat', total: 10, max: 4 }], '+20%'),
      L(900, { manastone: 3 }, [{ track: 'combat', total: 20, max: 6 }], '+30%, 출전 인원 +1'),
    ],
  },
  infirmary: {
    name: '의무실',
    desc: '다친 길드원이 빨리 낫는다.',
    levels: [
      L(120, { herb: 4 }, [], '부상 기간 -1일'),
      L(300, { herb: 6, manastone: 1 }, [{ track: 'alchemy', total: 3, max: 2 }], '부상 기간 -2일'),
    ],
  },
  dorm: {
    name: '숙소',
    desc: '길드원을 더 받는다.',
    levels: [
      L(150, { leather: 2 }, [], '정원 7명'),
      L(400, { leather: 4, iron: 4 }, [], '정원 9명'),
      L(900, { manastone: 2 }, [], '정원 12명'),
    ],
  },
};

export const FACILITY_IDS = Object.keys(FACILITIES) as FacilityId[];

export function facilityLevel(state: GuildState, id: FacilityId): number {
  return state.facilities[id] ?? 0;
}

export function memberCap(state: GuildState): number {
  return [5, 7, 9, 12][facilityLevel(state, 'dorm')];
}

export function trainingBonus(state: GuildState): number {
  return facilityLevel(state, 'training') * 0.1;
}

export function nextLevel(state: GuildState, id: FacilityId): FacilityLevel | undefined {
  return FACILITIES[id].levels[facilityLevel(state, id)];
}

export function canBuild(state: GuildState, id: FacilityId): { ok: boolean; why?: string } {
  const next = nextLevel(state, id);
  if (!next) return { ok: false, why: '최고 레벨' };
  if (!meetsAll(state.members, next.req)) return { ok: false, why: '기술 부족' };
  if (state.gold < next.gold) return { ok: false, why: '금화 부족' };
  for (const [k, n] of Object.entries(next.mats)) if ((state.items[k] ?? 0) < n) return { ok: false, why: '재료 부족' };
  return { ok: true };
}

export function build(state: GuildState, id: FacilityId): boolean {
  if (!canBuild(state, id).ok) return false;
  const next = nextLevel(state, id)!;
  state.gold -= next.gold;
  for (const [k, n] of Object.entries(next.mats)) {
    state.items[k] -= n;
    if (state.items[k] <= 0) delete state.items[k];
  }
  state.facilities[id] = facilityLevel(state, id) + 1;
  const lv = state.facilities[id]!;
  state.log.unshift(`${state.day}일차. ${lv === 1 ? `${josa(FACILITIES[id].name, '을', '를')} 지었다` : `${FACILITIES[id].name} Lv${lv}로 넓혔다`}.`);
  return true;
}

/** 제작 중인 장인은 다른 일을 할 수 없다 */
export function orderOf(state: GuildState, m: Member) {
  return state.orders.find((o) => o.memberId === m.id);
}

