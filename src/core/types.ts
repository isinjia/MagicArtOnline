export type StatKey = 'might' | 'body' | 'agility' | 'insight' | 'will';
export type Stats = Record<StatKey, number>;

export type TraitId = 'brave' | 'cautious' | 'loyal' | 'greedy' | 'cold' | 'curious';

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
}

export interface GuildState {
  version: 1;
  name: string;
  day: number;
  gold: number;
  members: Member[];
  quests: Quest[];
  log: string[];
  seed: number;
  nextId: number;
}
