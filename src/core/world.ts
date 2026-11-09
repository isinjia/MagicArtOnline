import type { FacilityId, JobId } from './types';

export type TownId = 'lumina' | 'ironhall' | 'elmwood' | 'maren' | 'saintbell' | 'greywall';

export interface Town {
  id: TownId;
  name: string;
  kind: string;
  /** 지도 좌표 (지도 도트 단위) */
  x: number;
  y: number;
  desc: string;
  /** 특혜 설명 */
  perks: string[];
  /** 모집할 때 자주 오는 직업 */
  jobBias: JobId[];
  /** 자주 들어오는 의뢰 종류 (QUEST_TYPES 이름) */
  questBias: string[];
  start: { gold: number; items: Record<string, number>; facilities: Partial<Record<FacilityId, number>> };
  /** 상점 구입가 배율, 판매가 배율 */
  buyMul: number;
  sellMul: number;
  /** 의뢰 금화 배율 */
  goldMul: number;
  /** 의뢰 경험치 배율 */
  expMul: number;
}

export interface Site {
  id: string;
  name: string;
  x: number;
  y: number;
  questType: string;
}

export const MAP_W = 180;
export const MAP_H = 210;

export const TOWNS: Record<TownId, Town> = {
  lumina: {
    id: 'lumina',
    name: '왕도 루미나',
    kind: '왕도',
    x: 92,
    y: 110,
    desc: '왕국의 한가운데. 사람과 의뢰가 모두 모인다.',
    perks: ['시작 금화 200', '모든 직업이 고르게 모집된다', '의뢰 경험치 +10%'],
    jobBias: [],
    questBias: [],
    start: { gold: 200, items: { iron: 2, herb: 2 }, facilities: { forge: 1 } },
    buyMul: 1,
    sellMul: 1,
    goldMul: 1,
    expMul: 1.1,
  },
  ironhall: {
    id: 'ironhall',
    name: '광산 마을 아이언홀',
    kind: '광산 마을',
    x: 50,
    y: 44,
    desc: '북쪽 산맥 아래 광부들의 마을. 망치 소리가 그치지 않는다.',
    perks: ['대장장이·전사가 자주 온다', '철광석 8개로 시작', '폐광·고블린 의뢰가 많다'],
    jobBias: ['blacksmith', 'warrior'],
    questBias: ['폐광 조사', '고블린 소탕'],
    start: { gold: 100, items: { iron: 8, herb: 1 }, facilities: { forge: 1 } },
    buyMul: 1,
    sellMul: 1,
    goldMul: 1,
    expMul: 1,
  },
  elmwood: {
    id: 'elmwood',
    name: '숲 마을 엘름우드',
    kind: '숲 마을',
    x: 32,
    y: 122,
    desc: '서쪽 깊은 숲 속 사냥꾼과 약초꾼의 마을.',
    perks: ['궁수·연금술사·요리사가 자주 온다', '약초·가죽·고기로 시작', '실험대 Lv1 보유'],
    jobBias: ['archer', 'alchemist', 'cook'],
    questBias: ['마수 사냥', '고블린 소탕'],
    start: { gold: 100, items: { herb: 5, leather: 3, meat: 3 }, facilities: { lab: 1 } },
    buyMul: 1,
    sellMul: 1,
    goldMul: 1,
    expMul: 1,
  },
  maren: {
    id: 'maren',
    name: '항구 도시 마렌',
    kind: '항구 도시',
    x: 150,
    y: 140,
    desc: '동쪽 만의 무역항. 돈이 도는 곳이다.',
    perks: ['상인·감정사·재봉사가 자주 온다', '상점 카운터 Lv1 보유', '구입가 -10%, 판매가 +10%'],
    jobBias: ['merchant', 'appraiser', 'tailor'],
    questBias: ['상단 호위', '산적 토벌'],
    start: { gold: 150, items: { leather: 2 }, facilities: { counter: 1 } },
    buyMul: 0.9,
    sellMul: 1.1,
    goldMul: 1,
    expMul: 1,
  },
  saintbell: {
    id: 'saintbell',
    name: '수도원 도시 세인트벨',
    kind: '수도원 도시',
    x: 138,
    y: 60,
    desc: '종소리가 울리는 언덕 위 수도원. 언데드 소문이 끊이지 않는다.',
    perks: ['성직자·마법사가 자주 온다', '의무실 Lv1 보유', '폐광·던전 의뢰가 많다'],
    jobBias: ['cleric', 'mage'],
    questBias: ['폐광 조사', '던전 정찰'],
    start: { gold: 100, items: { herb: 4 }, facilities: { infirmary: 1 } },
    buyMul: 1,
    sellMul: 1,
    goldMul: 1,
    expMul: 1,
  },
  greywall: {
    id: 'greywall',
    name: '변경 요새 그레이월',
    kind: '변경 요새',
    x: 86,
    y: 186,
    desc: '남쪽 황야를 지키는 요새. 위험하지만 보수가 좋다.',
    perks: ['전사·도적이 자주 온다', '의뢰 금화 +20%', '산적·마수 의뢰가 많다'],
    jobBias: ['warrior', 'rogue'],
    questBias: ['산적 토벌', '마수 사냥'],
    start: { gold: 80, items: { iron: 2 }, facilities: { forge: 1 } },
    buyMul: 1,
    sellMul: 1,
    goldMul: 1.2,
    expMul: 1,
  },
};
export const TOWN_IDS = Object.keys(TOWNS) as TownId[];

/** 의뢰가 생기는 장소 */
export const SITES: Site[] = [
  { id: 'black_pass', name: '검은 고개', x: 70, y: 78, questType: '산적 토벌' },
  { id: 'south_camp', name: '남부 산적 야영지', x: 122, y: 178, questType: '산적 토벌' },
  { id: 'goblin_den', name: '고블린 굴', x: 34, y: 76, questType: '고블린 소탕' },
  { id: 'thorn_cave', name: '덤불 동굴', x: 58, y: 148, questType: '고블린 소탕' },
  { id: 'old_mine', name: '버려진 광산', x: 78, y: 28, questType: '폐광 조사' },
  { id: 'catacomb', name: '수도원 지하묘지', x: 158, y: 86, questType: '폐광 조사' },
  { id: 'east_road', name: '동부 교역로', x: 124, y: 124, questType: '상단 호위' },
  { id: 'south_road', name: '남부 교역로', x: 94, y: 156, questType: '상단 호위' },
  { id: 'old_dungeon', name: '고대 던전', x: 112, y: 34, questType: '던전 정찰' },
  { id: 'sunken_ruin', name: '가라앉은 유적', x: 30, y: 178, questType: '던전 정찰' },
  { id: 'wolf_woods', name: '늑대 숲', x: 16, y: 102, questType: '마수 사냥' },
  { id: 'orc_waste', name: '오크 황야', x: 56, y: 196, questType: '마수 사냥' },
];

export function siteById(id: string): Site | undefined {
  return SITES.find((s) => s.id === id);
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 길드에서 장소까지 걸리는 날 (왕복과 의뢰 수행 포함) */
export function travelDays(town: Town, site: Site): number {
  return 1 + Math.floor(distance(town, site) / 40);
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 지도 육지 모양: 타원 몇 개를 합치고 해안선을 조금 흔든다 */
export function isLand(x: number, y: number): boolean {
  const blobs = [
    { cx: 88, cy: 118, rx: 80, ry: 92 },
    { cx: 70, cy: 46, rx: 62, ry: 40 },
    { cx: 140, cy: 66, rx: 36, ry: 36 },
  ];
  const wobble = (hash(x >> 2, y >> 2) - 0.5) * 0.18;
  let land = blobs.some((b) => ((x - b.cx) / b.rx) ** 2 + ((y - b.cy) / b.ry) ** 2 < 1 + wobble);
  // 동쪽 만 (항구)
  if (((x - 176) / 22) ** 2 + ((y - 146) / 18) ** 2 < 1 + wobble) land = false;
  // 작은 섬
  if (((x - 166) / 9) ** 2 + ((y - 196) / 7) ** 2 < 1 + wobble) land = true;
  return land;
}
