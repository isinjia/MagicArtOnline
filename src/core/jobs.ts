import type { JobId, Member, Requirement, StatKey, TrackId } from './types';

export type JobFamily = '전투계' | '생산계' | '상인계';

export interface JobDef {
  name: string;
  family: JobFamily;
  track: TrackId;
  desc: string;
  /** 처음 만들 때 더해지는 능력치 */
  bias: Partial<Record<StatKey, number>>;
}

export const JOBS: Record<JobId, JobDef> = {
  warrior: { name: '전사', family: '전투계', track: 'combat', desc: '체력과 공격이 높다. 레벨마다 더 단단해진다.', bias: { might: 2, body: 2 } },
  archer: { name: '궁수', family: '전투계', track: 'combat', desc: '먼저 움직이고 급소를 잘 노린다.', bias: { agility: 2, insight: 1 } },
  mage: { name: '마법사', family: '전투계', track: 'combat', desc: '지능으로 공격하고 방어를 일부 꿰뚫는다.', bias: { insight: 3 } },
  cleric: { name: '성직자', family: '전투계', track: 'combat', desc: '다친 동료를 치유한다.', bias: { will: 3 } },
  rogue: { name: '도적', family: '전투계', track: 'combat', desc: '잘 피하고 전리품을 더 챙긴다.', bias: { agility: 3 } },
  blacksmith: { name: '대장장이', family: '생산계', track: 'smithing', desc: '무기와 갑옷을 만든다.', bias: { might: 2, body: 1 } },
  tailor: { name: '재봉사', family: '생산계', track: 'tailoring', desc: '로브와 장신구를 만든다.', bias: { agility: 1, insight: 1 } },
  alchemist: { name: '연금술사', family: '생산계', track: 'alchemy', desc: '회복약과 물약을 만든다.', bias: { insight: 2 } },
  cook: { name: '요리사', family: '생산계', track: 'cooking', desc: '출전 전에 힘이 나는 요리를 만든다.', bias: { body: 1, will: 1 } },
  merchant: { name: '상인', family: '상인계', track: 'commerce', desc: '상점을 열고 사고파는 값을 유리하게 만든다.', bias: { will: 1, insight: 1 } },
  appraiser: { name: '감정사', family: '상인계', track: 'appraisal', desc: '유물을 감정하고 전리품을 더 찾아낸다.', bias: { insight: 3 } },
};

export const JOB_IDS = Object.keys(JOBS) as JobId[];

export const TRACKS: Record<TrackId, { name: string; family: JobFamily }> = {
  combat: { name: '전투', family: '전투계' },
  smithing: { name: '대장', family: '생산계' },
  tailoring: { name: '재봉', family: '생산계' },
  alchemy: { name: '연금', family: '생산계' },
  cooking: { name: '요리', family: '생산계' },
  commerce: { name: '상업', family: '상인계' },
  appraisal: { name: '감정', family: '상인계' },
};
export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];

/** 직업 레벨 n에 필요한 누적 직업 경험치 (인덱스 = 레벨) */
export const JOB_EXP = [0, 0, 20, 60, 120, 200, 300, 420, 560, 720, 900];
export const JOB_MAX = 10;

export interface LevelStat {
  total: number;
  max: number;
  count: number;
}

/** 분야별 합계와 최고 레벨. 부상자도 포함한다 (기술은 사라지지 않는다) */
export function trackLevels(members: Member[]): Record<TrackId, LevelStat> {
  const out = Object.fromEntries(TRACK_IDS.map((t) => [t, { total: 0, max: 0, count: 0 }])) as Record<TrackId, LevelStat>;
  for (const m of members) {
    const t = out[JOBS[m.job].track];
    t.total += m.jobLevel;
    t.max = Math.max(t.max, m.jobLevel);
    t.count++;
  }
  return out;
}

export function jobLevels(members: Member[], job: JobId): LevelStat {
  const ms = members.filter((m) => m.job === job);
  return { total: ms.reduce((a, m) => a + m.jobLevel, 0), max: Math.max(0, ...ms.map((m) => m.jobLevel)), count: ms.length };
}

export function reqName(r: Requirement): string {
  return r.track ? TRACKS[r.track].name : JOBS[r.job!].name;
}

export function levelOf(members: Member[], r: Requirement): LevelStat {
  return r.track ? trackLevels(members)[r.track] : jobLevels(members, r.job!);
}

export function meets(members: Member[], r: Requirement): boolean {
  const l = levelOf(members, r);
  return l.total >= r.total && l.max >= r.max;
}

export function meetsAll(members: Member[], reqs: Requirement[]): boolean {
  return reqs.every((r) => meets(members, r));
}

/** 직업 경험치를 더하고 오른 레벨 수를 돌려준다 */
export function addJobExp(m: Member, amount: number): number {
  m.jobExp += Math.round(amount);
  let ups = 0;
  while (m.jobLevel < JOB_MAX && m.jobExp >= JOB_EXP[m.jobLevel + 1]) {
    m.jobLevel++;
    ups++;
  }
  return ups;
}

export function isCombatJob(job: JobId): boolean {
  return JOBS[job].family === '전투계';
}
