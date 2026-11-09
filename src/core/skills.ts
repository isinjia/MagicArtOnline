import type { Member, StatKey, Tag } from './types';

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  /** 습득 조건: 누적 태그 횟수 */
  need: Partial<Record<Tag, number>>;
  /** 습득 시 얻는 능력치 */
  bonus: Partial<Record<StatKey, number>>;
}

/** 히스토리에서 생겨나는 스킬. 조건을 채우면 익힌다. */
export const SKILLS: SkillDef[] = [
  { id: 'unyielding', name: '불굴', desc: '전투마다 한 번, 쓰러질 일격을 버텨낸다.', need: { near_death: 2 }, bonus: { will: 2 } },
  { id: 'guardian', name: '수호', desc: '위기의 동료를 감쌀 확률이 크게 오른다.', need: { saved_ally: 2 }, bonus: { body: 2 } },
  { id: 'executioner', name: '급소 찌르기', desc: '치명타 확률이 오른다.', need: { crit_kill: 3 }, bonus: { insight: 1 } },
  { id: 'swift', name: '선봉', desc: '누구보다 빠르게 움직인다.', need: { first_strike: 3 }, bonus: { agility: 2 } },
  { id: 'hunter', name: '사냥꾼', desc: '공격력이 15% 오른다.', need: { kill: 8 }, bonus: { might: 2 } },
  { id: 'shadowstep', name: '회피 본능', desc: '회피율이 오른다.', need: { dodge: 5 }, bonus: { agility: 1 } },
  { id: 'lone_wolf', name: '고독한 늑대', desc: '홀로 남았을 때 공격력이 크게 오른다.', need: { solo_survivor: 1 }, bonus: { will: 1 } },
  { id: 'slayer', name: '거인 사냥꾼', desc: '우두머리에게 주는 피해가 20% 오른다.', need: { boss_kill: 1 }, bonus: { might: 1 } },
  { id: 'healer', name: '치유의 손', desc: '치유량이 30% 오른다.', need: { heal: 5 }, bonus: { will: 2 } },
  { id: 'scar', name: '흉터', desc: '쓰러져 본 몸은 더 단단해진다. 방어가 오른다.', need: { down: 3 }, bonus: { body: 2 } },
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function meetsSkill(m: Member, s: SkillDef): boolean {
  return Object.entries(s.need).every(([tag, n]) => (m.tagCounts[tag as Tag] ?? 0) >= (n ?? 0));
}
