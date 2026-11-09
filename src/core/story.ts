import type { MemberRecord } from './battle';
import { josa } from './josa';
import type { Rng } from './rng';
import type { Member, Quest } from './types';

export interface StoryContext {
  member: Member;
  quest: Quest;
  record: MemberRecord;
  win: boolean;
  party: Member[];
}

/**
 * 길드원의 히스토리 문장을 만든다.
 * 지금은 문장 조합 방식이고, 나중에 AI 생성기로 같은 인터페이스를 구현해 교체한다.
 */
export interface StoryGenerator {
  generate(ctx: StoryContext): Promise<string>;
}

export class TemplateStoryGenerator implements StoryGenerator {
  constructor(private rng: Rng) {}

  async generate({ member: m, quest, record: r, win }: StoryContext): Promise<string> {
    const pick = <T,>(xs: T[]) => this.rng.pick(xs);
    const lines: string[] = [];
    const n = m.name;

    if (r.firstStrike) lines.push(pick([`${josa(n, '은', '는')} 누구보다 먼저 적진에 뛰어들었다.`, `선두에 선 것은 ${josa(n, "이었다", "였다")}.`]));
    if (r.bossKills.length) lines.push(`마지막 일격으로 ${josa(r.bossKills[0], '을', '를')} 쓰러뜨렸다.`);
    else if (r.kills >= 2) lines.push(pick([`${n}의 손에 ${r.kills}명의 적이 쓰러졌다.`, `${josa(n, '은', '는')} ${r.kills}번 적의 숨을 끊었다.`]));
    else if (r.kills === 1) lines.push(`${josa(n, '은', '는')} 적 하나를 베어 넘겼다.`);
    if (r.critKills >= 1) lines.push(pick(['급소를 꿰뚫는 일격이 빛났다.', '단 한 수로 승부를 갈랐다.']));
    if (r.savedNames.length) lines.push(`위기에 처한 ${josa(r.savedNames[0], '을', '를')} 몸으로 막아섰다.`);
    if (r.dodges >= 3) lines.push(pick(['적의 공격을 바람처럼 흘려냈다.', '칼날 사이를 춤추듯 빠져나갔다.']));
    if (r.endured) lines.push('쓰러지기 직전, 이를 악물고 버텨냈다.');
    else if (r.nearDeath && !r.down) lines.push('피투성이가 되어서도 물러서지 않았다.');
    if (r.down) lines.push(pick(['결국 쓰러져 동료의 등에 업혀 돌아왔다.', '의식을 잃고 쓰러졌다.']));
    if (r.soloSurvivor) lines.push('끝까지 홀로 서 있었다. 그날의 고독을 잊지 못했다.');

    if (lines.length === 0) {
      lines.push(m.traits.includes('cautious') ? '신중하게 뒤를 받치며 제 몫을 해냈다.' : '묵묵히 제 몫을 해냈다.');
    }
    const ending = win ? pick(['', '의뢰는 무사히 끝났다.']) : pick(['의뢰는 실패로 끝났다.', '분한 마음을 안고 돌아섰다.']);
    return [`${quest.name}에 나섰다.`, ...lines.slice(0, 3), ending].filter(Boolean).join(' ');
  }
}
