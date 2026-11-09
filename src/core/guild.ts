import type { Member } from './types';

export interface Perk {
  id: string;
  name: string;
  desc: string;
}

export interface GuildPower {
  partySize: number;
  maxQuestRank: number;
  recruitCost: number;
  perks: Perk[];
  has: (perkId: string) => boolean;
}

/** 보유 길드원 구성에서 길드장이 할 수 있는 일이 결정된다. */
export function guildPower(members: Member[]): GuildPower {
  const maxGrade = Math.max(0, ...members.map((m) => m.grade));
  const veterans = members.filter((m) => m.grade >= 1).length;
  const anySkill = (id: string) => members.some((m) => m.skills.includes(id));

  const perks: Perk[] = [];
  if (anySkill('guardian')) perks.push({ id: 'formation', name: '방패 진형', desc: '출전 길드원 체력 +10%' });
  if (anySkill('swift')) perks.push({ id: 'scouting', name: '정찰', desc: '퀘스트의 적 정보를 미리 본다' });
  if (anySkill('slayer')) perks.push({ id: 'renown', name: '명성', desc: '우두머리 퀘스트 금화 +30%' });
  if (members.some((m) => m.stats.insight >= 12)) perks.push({ id: 'teaching', name: '교관', desc: '퀘스트 경험치 +20%' });
  if (members.length >= 6) perks.push({ id: 'network', name: '인맥', desc: '모집 비용 -20%' });

  const has = (id: string) => perks.some((p) => p.id === id);
  return {
    partySize: Math.min(4, 2 + (veterans >= 2 ? 1 : 0) + (maxGrade >= 3 ? 1 : 0)),
    maxQuestRank: Math.min(5, maxGrade + 1),
    recruitCost: Math.round(50 * (has('network') ? 0.8 : 1)),
    perks,
    has,
  };
}
