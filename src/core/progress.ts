import { josa } from './josa';
import type { BattleResult, MemberRecord } from './battle';
import { RANK_EXP, STAT_KEYS, STAT_LABEL } from './data';
import { createMember, rankName, refillQuests } from './gen';
import { guildPower } from './guild';
import { addDrops, ITEMS } from './items';
import { addJobExp, isCombatJob, JOBS } from './jobs';
import type { Rng } from './rng';
import { meetsSkill, SKILLS } from './skills';
import type { StoryGenerator } from './story';
import type { GuildState, Member, Quest, StatKey, Tag } from './types';

export interface MemberOutcome {
  memberId: string;
  name: string;
  story: string;
  expGained: number;
  statUps: Partial<Record<StatKey, number>>;
  newSkills: string[];
  breakthrough?: string;
  injuredDays: number;
  /** 직업 레벨이 올랐다면 새 레벨 */
  jobUp?: number;
}

export interface QuestOutcome {
  questName: string;
  win: boolean;
  gold: number;
  drops: Record<string, number>;
  members: MemberOutcome[];
}

function tagsOf(r: MemberRecord, win: boolean): Tag[] {
  const tags: Tag[] = [win ? 'quest_clear' : 'quest_fail'];
  for (let i = 0; i < r.kills; i++) tags.push('kill');
  for (let i = 0; i < r.critKills; i++) tags.push('crit_kill');
  for (let i = 0; i < r.bossKills.length; i++) tags.push('boss_kill');
  for (let i = 0; i < r.dodges; i++) tags.push('dodge');
  for (let i = 0; i < r.savedNames.length; i++) tags.push('saved_ally');
  if (r.nearDeath) tags.push('near_death');
  if (r.down) tags.push('down');
  if (r.firstStrike) tags.push('first_strike');
  if (r.soloSurvivor) tags.push('solo_survivor');
  for (let i = 0; i < r.heals; i++) tags.push('heal');
  return tags;
}

/** 어떤 경험이 어떤 능력치를 키우는가 */
const TAG_STAT: Partial<Record<Tag, StatKey>> = {
  kill: 'might',
  crit_kill: 'insight',
  dodge: 'agility',
  near_death: 'will',
  down: 'body',
  saved_ally: 'body',
  first_strike: 'agility',
  boss_kill: 'will',
  heal: 'will',
};

function grow(m: Member, tags: Tag[], rng: Rng): Partial<Record<StatKey, number>> {
  const ups: Partial<Record<StatKey, number>> = {};
  const add = (k: StatKey, v: number) => {
    m.stats[k] += v;
    ups[k] = (ups[k] ?? 0) + v;
  };
  for (const t of tags) {
    const k = TAG_STAT[t];
    if (k && rng.chance(0.35)) add(k, 1);
  }
  if (tags.includes('quest_clear') && rng.chance(0.5)) add(rng.pick(STAT_KEYS), 1);
  return ups;
}

export function describeUps(ups: Partial<Record<StatKey, number>>): string {
  return Object.entries(ups)
    .map(([k, v]) => `${STAT_LABEL[k as StatKey]} +${v}`)
    .join(', ');
}

/** 전투 결과를 길드 상태에 반영한다. 히스토리, 성장, 스킬, 돌파, 보상, 날짜 */
export async function applyQuest(
  state: GuildState,
  quest: Quest,
  party: Member[],
  result: BattleResult,
  storyGen: StoryGenerator,
  rng: Rng,
): Promise<QuestOutcome> {
  const power = guildPower(state.members);
  const day = state.day;
  const outcomes: MemberOutcome[] = [];

  for (const m of party) {
    const r = result.records[m.id];
    const tags = tagsOf(r, result.win);
    for (const t of tags) m.tagCounts[t] = (m.tagCounts[t] ?? 0) + 1;

    const story = await storyGen.generate({ member: m, quest, record: r, win: result.win, party });
    m.history.push({ day, title: quest.name, text: story, tags });

    const statUps = grow(m, tags, rng);

    const newSkills: string[] = [];
    for (const s of SKILLS) {
      if (!m.skills.includes(s.id) && meetsSkill(m, s)) {
        m.skills.push(s.id);
        for (const [k, v] of Object.entries(s.bonus)) m.stats[k as StatKey] += v ?? 0;
        newSkills.push(s.name);
        m.history.push({ day, title: `스킬 습득: ${s.name}`, text: `지난 경험이 쌓여 ${josa(s.name, '을', '를')} 익혔다. ${s.desc}`, tags: [] });
      }
    }

    let exp = quest.rewardExp * (result.win ? 1 : 0.4);
    exp *= 1 + m.stats.insight * 0.02;
    if (m.traits.includes('curious')) exp *= 1.15;
    if (power.has('teaching')) exp *= 1.2;
    const expGained = Math.round(exp);
    m.exp += expGained;

    let breakthrough: string | undefined;
    while (m.grade + 1 < RANK_EXP.length && m.exp >= RANK_EXP[m.grade + 1]) {
      m.grade++;
      breakthrough = rankName(m.grade);
      m.tagCounts.breakthrough = (m.tagCounts.breakthrough ?? 0) + 1;
      m.history.push({ day, title: `승급: ${breakthrough}등급`, text: `길드 심사를 통과해 ${breakthrough}등급 모험가가 되었다.`, tags: ['breakthrough'] });
    }

    // 전투계 직업은 의뢰로 직업 경험치를 얻는다
    let jobUp: number | undefined;
    if (isCombatJob(m.job) && addJobExp(m, quest.rewardExp * (result.win ? 0.6 : 0.25))) jobUp = m.jobLevel;

    const injuredDays = r.down ? Math.max(1, 2 + quest.rank - (power.has('firstaid') ? 1 : 0)) : 0;
    if (injuredDays) m.injuredUntil = day + quest.days + injuredDays;

    outcomes.push({ memberId: m.id, name: m.name, story, expGained, statUps, newSkills, breakthrough, injuredDays, jobUp });
  }

  let gold = 0;
  if (result.win) {
    gold = quest.rewardGold;
    if (power.has('renown') && quest.enemies.some((e) => e.boss)) gold *= 1.3;
    gold *= 1 + 0.1 * party.filter((m) => m.traits.includes('greedy')).length;
    gold = Math.round(gold);
  }
  state.gold += gold;

  // 전리품: 도적과 보물 감각이 있으면 더 많이, 우두머리는 미감정 유물을 남긴다
  const drops: Record<string, number> = {};
  if (result.win) {
    let rolls = 1 + quest.rank + party.filter((m) => m.job === 'rogue').length + (power.has('treasure') ? 1 : 0);
    while (rolls-- > 0) {
      const item = rng.pick(quest.drops);
      drops[item] = (drops[item] ?? 0) + rng.int(1, 2);
    }
    if (quest.enemies.some((e) => e.boss)) drops.relic = 1;
    addDrops(state, drops);
    for (const m of state.members.filter((x) => x.job === 'appraiser')) addJobExp(m, 4);
  }

  state.day += quest.days;
  state.quests = state.quests.filter((q) => q.id !== quest.id);
  refillQuests(state, rng);

  const names = party.map((m) => m.name).join(', ');
  state.log.unshift(`${day}일차. ${names} → ${quest.name}: ${result.win ? `성공, 금화 ${gold}` : '실패'}.`);
  for (const o of outcomes) {
    if (o.jobUp) state.log.unshift(`${day}일차. ${o.name}, ${JOBS[party.find((m) => m.id === o.memberId)!.job].name} Lv${o.jobUp} 달성.`);
    if (o.breakthrough) state.log.unshift(`${day}일차. ${o.name}, ${o.breakthrough}등급 승급.`);
    for (const s of o.newSkills) state.log.unshift(`${day}일차. ${o.name}, ${s} 습득.`);
  }
  state.seed = rng.seed;
  const dropText = Object.entries(drops).map(([k, n]) => `${ITEMS[k].name} ${n}`).join(', ');
  if (dropText) state.log.unshift(`${day}일차. 전리품: ${dropText}.`);
  return { questName: quest.name, win: result.win, gold, drops, members: outcomes };
}

export function recruit(state: GuildState, rng: Rng): Member | null {
  const cost = guildPower(state.members).recruitCost;
  if (state.gold < cost || state.members.length >= 8) return null;
  state.gold -= cost;
  const m = createMember(state, rng);
  state.members.push(m);
  state.log.unshift(`${state.day}일차. ${JOBS[m.job].name} ${josa(m.name, '을', '를')} 길드원으로 맞이했다.`);
  state.seed = rng.seed;
  return m;
}

export function isAvailable(state: GuildState, m: Member): boolean {
  return m.injuredUntil <= state.day;
}
