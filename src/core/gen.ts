import { josa } from './josa';
import { GIVEN_NAMES, ORIGINS, QUEST_TYPES, RANKS, STAT_KEYS, SURNAMES, TRAIT_IDS } from './data';
import { Rng } from './rng';
import type { EnemyTemplate, GuildState, Member, Quest, Stats, TraitId } from './types';

function newId(state: GuildState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

export function createMember(state: GuildState, rng: Rng): Member {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, rng.int(3, 8)])) as Stats;
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
  };
}

export function createQuest(state: GuildState, rng: Rng, rank: number): Quest {
  const type = rng.pick(QUEST_TYPES);
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
    days: rng.int(1, 3),
    rewardGold: Math.round((30 + rank * 40) * (hasBoss ? 1.5 : 1)),
    rewardExp: Math.round((20 + rank * 25) * (hasBoss ? 1.4 : 1)),
    enemies,
  };
}

export function refillQuests(state: GuildState, rng: Rng, maxRank: number): void {
  while (state.quests.length < 4) {
    const rank = Math.max(0, Math.min(maxRank, rng.int(maxRank - 1, maxRank)));
    state.quests.push(createQuest(state, rng, rank));
  }
}

export function newGame(seed = Date.now()): GuildState {
  const state: GuildState = {
    version: 1,
    name: '이름 없는 길드',
    day: 1,
    gold: 100,
    members: [],
    quests: [],
    log: [],
    seed,
    nextId: 1,
  };
  const rng = new Rng(seed);
  for (let i = 0; i < 3; i++) state.members.push(createMember(state, rng));
  refillQuests(state, rng, 1);
  state.log.unshift(`1일차. 길드를 세웠다. ${josa(state.members.map((m) => m.name).join(', '), '이', '가')} 함께한다.`);
  state.seed = rng.seed;
  return state;
}

export function rankName(grade: number): string {
  return RANKS[Math.min(grade, RANKS.length - 1)];
}
