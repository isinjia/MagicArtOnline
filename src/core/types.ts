export type StatKey = 'might' | 'body' | 'agility' | 'insight' | 'will';
export type Stats = Record<StatKey, number>;

export type TraitId = 'brave' | 'cautious' | 'loyal' | 'greedy' | 'cold' | 'curious';

/** 직업. 계열은 jobs.ts의 JOBS에 정의한다 */
export type JobId =
  | 'warrior'
  | 'archer'
  | 'mage'
  | 'cleric'
  | 'rogue'
  | 'blacksmith'
  | 'tailor'
  | 'alchemist'
  | 'cook'
  | 'merchant'
  | 'appraiser';

/** 길드 기술 분야. 같은 분야 직업 레벨의 합계와 최고 레벨이 길드 역량이 된다 */
export type TrackId = 'combat' | 'smithing' | 'tailoring' | 'alchemy' | 'cooking' | 'commerce' | 'appraisal';

export type Slot = 'weapon' | 'armor' | 'accessory';

/** 길드 홀 시설 */
export type FacilityId = 'forge' | 'loom' | 'lab' | 'kitchen' | 'counter' | 'appraisal_desk' | 'training' | 'infirmary' | 'dorm';

/** 장인에게 맡긴 제작 주문 */
export interface Order {
  id: string;
  memberId: string;
  recipeId: string;
  doneDay: number;
}

/** 길드 역량 조건. 분야 또는 특정 직업의 레벨 합계와 최고 레벨 */
export interface Requirement {
  track?: TrackId;
  job?: JobId;
  total: number;
  max: number;
}

/** 히스토리에 남는 사건 태그. 누적 횟수가 스킬과 성장을 결정한다. */
export type Tag =
  | 'quest_clear'
  | 'quest_fail'
  | 'kill'
  | 'crit_kill'
  | 'boss_kill'
  | 'dodge'
  | 'near_death'
  | 'down'
  | 'saved_ally'
  | 'first_strike'
  | 'solo_survivor'
  | 'heal'
  | 'breakthrough';

export interface HistoryEntry {
  day: number;
  title: string;
  text: string;
  tags: Tag[];
}

export interface Member {
  id: string;
  name: string;
  age: number;
  origin: string;
  traits: TraitId[];
  /** 모험가 등급. RANKS 인덱스 (E~S) */
  grade: number;
  exp: number;
  stats: Stats;
  skills: string[];
  history: HistoryEntry[];
  tagCounts: Partial<Record<Tag, number>>;
  /** 이 날짜 전까지 부상으로 출전 불가 */
  injuredUntil: number;
  job: JobId;
  jobLevel: number;
  jobExp: number;
  /** 예전에 했던 직업의 레벨 기록. 다시 전직하면 이어진다 */
  jobRecords: Partial<Record<JobId, { level: number; exp: number }>>;
  equip: Partial<Record<Slot, string>>;
}

export interface EnemyTemplate {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  boss: boolean;
}

export interface Quest {
  id: string;
  name: string;
  desc: string;
  rank: number;
  days: number;
  rewardGold: number;
  rewardExp: number;
  enemies: EnemyTemplate[];
  /** 수주 조건 */
  reqs: Requirement[];
  /** 성공 시 얻을 수 있는 재료 */
  drops: string[];
  /** 의뢰 장소 (world.ts SITES) */
  placeId: string;
}

export interface GuildState {
  version: 4;
  /** 길드가 소속된 도시 */
  town: import('./world').TownId;
  name: string;
  day: number;
  gold: number;
  members: Member[];
  quests: Quest[];
  log: string[];
  /** 재료와 아이템 보유 수 */
  items: Record<string, number>;
  /** 다음 의뢰 한 번에 적용되는 요리 효과 */
  buff: { name: string; hpMul: number; atkMul: number } | null;
  /** 지은 시설과 레벨 */
  facilities: Partial<Record<FacilityId, number>>;
  /** 진행 중인 제작 주문 */
  orders: Order[];
  seed: number;
  nextId: number;
}
