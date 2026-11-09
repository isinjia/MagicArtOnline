import { type LevelStat, trackLevels } from './jobs';
import type { FacilityId, Member, TrackId } from './types';

export interface Perk {
  id: string;
  name: string;
  desc: string;
}

export interface GuildPower {
  partySize: number;
  recruitCost: number;
  tracks: Record<TrackId, LevelStat>;
  perks: Perk[];
  has: (perkId: string) => boolean;
}

/** 보유 길드원 구성에서 길드장이 할 수 있는 일이 결정된다. */
export function guildPower(members: Member[], facilities: Partial<Record<FacilityId, number>> = {}): GuildPower {
  const tracks = trackLevels(members);
  const anySkill = (id: string) => members.some((m) => m.skills.includes(id));

  const perks: Perk[] = [];
  // 스킬에서 생기는 능력
  if (anySkill('guardian')) perks.push({ id: 'formation', name: '방패 진형', desc: '출전 길드원 체력 +10%' });
  if (anySkill('swift')) perks.push({ id: 'scouting', name: '정찰', desc: '의뢰의 적 정보를 미리 본다' });
  if (anySkill('slayer')) perks.push({ id: 'renown', name: '명성', desc: '우두머리 의뢰 금화 +30%' });
  if (members.some((m) => m.stats.insight >= 12)) perks.push({ id: 'teaching', name: '교관', desc: '의뢰 경험치 +20%' });
  // 직업 레벨 합계에서 생기는 능력
  if (tracks.smithing.total >= 5) perks.push({ id: 'maintenance', name: '장비 정비', desc: '대장 5 이상: 출전 공격 +5%' });
  if (tracks.alchemy.total >= 3) perks.push({ id: 'firstaid', name: '응급 처치', desc: '연금 3 이상: 부상 기간 -1일' });
  if (tracks.cooking.total >= 3) perks.push({ id: 'supply', name: '보급', desc: '요리 3 이상: 출전 체력 +5%' });
  if (tracks.commerce.total >= 5) perks.push({ id: 'network', name: '인맥', desc: '상업 5 이상: 모집 비용 -20%' });
  if (tracks.appraisal.total >= 3) perks.push({ id: 'treasure', name: '보물 감각', desc: '감정 3 이상: 전리품 +1' });

  const has = (id: string) => perks.some((p) => p.id === id);
  return {
    // 전투 레벨 합계 6 이상이면 +1, 전투 최고 Lv5 이상이면 +1
    partySize: Math.min(5, 2 + (tracks.combat.total >= 6 ? 1 : 0) + (tracks.combat.max >= 5 ? 1 : 0) + ((facilities.training ?? 0) >= 3 ? 1 : 0)),
    recruitCost: Math.round(50 * (has('network') ? 0.8 : 1)),
    tracks,
    perks,
    has,
  };
}
