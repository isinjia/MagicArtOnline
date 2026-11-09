import { josa } from './josa';
import { GIVEN_NAMES, ORIGINS, QUEST_TYPES, RANKS, STAT_KEYS, SURNAMES, TRAIT_IDS } from './data';
import { JOB_IDS, JOBS, meets } from './jobs';
import { Rng } from './rng';
import { distance, SITES, TOWNS, travelDays, type TownId } from './world';
import type { EnemyTemplate, GuildState, JobId, Member, Quest, Requirement, Stats, TraitId } from './types';

function newId(state: GuildState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

function randomJob(rng: Rng, state?: GuildState): JobId {
  // 소속 도시에서 자주 오는 직업
  const bias = state ? TOWNS[state.town].jobBias : [];
  if (bias.length && rng.chance(0.45)) return rng.pick(bias);
  const roll = rng.next();
  const family = roll < 0.5 ? '전투계' : roll < 0.8 ? '생산계' : '상인계';
  return rng.pick(JOB_IDS.filter((j) => JOBS[j].family === family));
}

export function createMember(state: GuildState, rng: Rng, job: JobId = randomJob(rng, state)): Member {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, rng.int(3, 7)])) as Stats;
  for (const [k, v] of Object.entries(JOBS[job].bias)) stats[k as keyof Stats] += v ?? 0;
  const traits: TraitId[] = [rng.pick(TRAIT_IDS)];
  if (rng.chance(0.5)) {
    const second = rng.pick(TRAIT_IDS);
    if (second !== traits[0]) traits.push(second);
  }
  const origin = rng.pick(ORIGINS);
  return {
    id: newId(state, 'm'),
    name: `${rng.pick(GIVEN_NAMES)} ${rng.pick(SURNAMES)}`,
    age: rng.int(16, 34),
    origin,
    traits,
    grade: 0,
    exp: 0,
    stats,
    skills: [],
    history: [{ day: state.day, title: '입단', text: `${origin}. 길드의 문을 두드렸다.`, tags: [] }],
    tagCounts: {},
    injuredUntil: 0,
    job,
    jobLevel: 1,
    jobExp: 0,
    jobRecords: {},
    equip: {},
  };
}

export function createQuest(state: GuildState, rng: Rng, rank: number): Quest {
  const town = TOWNS[state.town];
  // 소속 도시에서 자주 들어오는 의뢰를 먼저 고른다
  const biased = QUEST_TYPES.filter((t) => town.questBias.includes(t.name));
  const type = biased.length && rng.chance(0.55) ? rng.pick(biased) : rng.pick(QUEST_TYPES);
  // 같은 종류의 장소 중 가까운 곳이 더 자주 나온다
  const sites = SITES.filter((s) => s.questType === type.name).sort((a, b) => distance(town, a) - distance(town, b));
  const site = sites.length > 1 && rng.chance(0.35) ? sites[1] : sites[0];
  const days = travelDays(town, site);
  const far = 1 + (days - 1) * 0.15;
  const count = rng.int(2, 3) + (rank >= 2 ? 1 : 0);
  const hasBoss = rank >= 1 && rng.chance(0.4);
  const enemies: EnemyTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const boss = hasBoss && i === 0;
    const mul = boss ? 2.2 : 1;
    enemies.push({
      name: boss ? type.boss : rng.pick(type.foes),
      hp: Math.round((35 + rank * 45) * mul * (0.9 + rng.next() * 0.2)),
      atk: Math.round((7 + rank * 7) * (boss ? 1.3 : 1)),
      def: Math.round(1 + rank * 2.5),
      spd: rng.int(3, 7) + rank * 2,
      boss,
    });
  }
  return {
    id: newId(state, 'q'),
    name: hasBoss ? `${type.name}: ${type.boss}` : type.name,
    desc: type.desc,
    rank,
    days,
    rewardGold: Math.round((30 + rank * 40) * (hasBoss ? 1.5 : 1) * far * town.goldMul),
    rewardExp: Math.round((20 + rank * 25) * (hasBoss ? 1.4 : 1) * far),
    enemies,
    reqs: questReqs(rank, type.special),
    drops: type.drops,
    placeId: site.id,
  };
}

/** 의뢰 수주 조건: 등급이 오를수록 전투 레벨 합계와 최고 레벨이 더 필요하다. 일부 의뢰는 특정 직업이 필요하다 */
export function questReqs(rank: number, special?: JobId): Requirement[] {
  if (rank <= 0) return [];
  const reqs: Requirement[] = [{ track: 'combat', total: 3 * rank + 1, max: rank + 1 }];
  if (special && rank >= 2) reqs.push({ job: special, total: rank - 1, max: rank - 1 });
  return reqs;
}

/** 지금 전투 역량으로 받을 수 있는 가장 높은 의뢰 등급 */
export function questReach(state: GuildState): number {
  let r = 0;
  while (r < RANKS.length - 1 && meets(state.members, questReqs(r + 1)[0])) r++;
  return r;
}

/** 받을 수 있는 등급 근처로 채우고, 목표가 되도록 한 단계 위 의뢰도 섞는다 */
export function refillQuests(state: GuildState, rng: Rng): void {
  const reach = questReach(state);
  while (state.quests.length < 4) {
    const rank = Math.max(0, Math.min(RANKS.length - 1, rng.int(reach - 1, reach + 1)));
    state.quests.push(createQuest(state, rng, rank));
  }
}

export function newGame(seed = Date.now(), townId: TownId = 'lumina', name = '이름 없는 길드'): GuildState {
  const town = TOWNS[townId];
  const state: GuildState = {
    version: 4,
    town: townId,
    name,
    day: 1,
    gold: town.start.gold,
    members: [],
    quests: [],
    log: [],
    items: { ...town.start.items },
    buff: null,
    facilities: { ...town.start.facilities },
    orders: [],
    seed,
    nextId: 1,
  };
  const rng = new Rng(seed);
  for (const job of ['warrior', 'archer', 'blacksmith'] as JobId[]) state.members.push(createMember(state, rng, job));
  refillQuests(state, rng);
  state.log.unshift(`1일차. ${town.name}에 ${josa(name, '을', '를')} 세웠다. ${josa(state.members.map((m) => m.name).join(', '), '이', '가')} 함께한다.`);
  state.seed = rng.seed;
  return state;
}

export function rankName(grade: number): string {
  return RANKS[Math.min(grade, RANKS.length - 1)];
}
