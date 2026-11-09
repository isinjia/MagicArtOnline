import { simulateBattle } from '../core/battle';
import { RANK_EXP, STAT_KEYS, STAT_LABEL, TRAITS } from '../core/data';
import { newGame, rankName } from '../core/gen';
import { guildPower } from '../core/guild';
import { applyQuest, describeUps, isAvailable, recruit, type QuestOutcome } from '../core/progress';
import { Rng } from '../core/rng';
import { clearSave, saveGame } from '../core/save';
import { SKILL_BY_ID } from '../core/skills';
import { TemplateStoryGenerator } from '../core/story';
import type { GuildState, Member, Quest } from '../core/types';

type Tab = 'members' | 'quests' | 'log';
type Screen =
  | { kind: 'guild'; tab: Tab }
  | { kind: 'member'; id: string; back: Tab }
  | { kind: 'assign'; questId: string; picked: string[] }
  | { kind: 'battle' }
  | { kind: 'result'; outcome: QuestOutcome };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class App {
  private screen: Screen = { kind: 'guild', tab: 'members' };
  private resetArmed = false;

  constructor(
    private root: HTMLElement,
    private state: GuildState,
  ) {
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (el) this.act(el.dataset.act!, el.dataset.arg ?? '');
    });
    this.render();
  }

  private get power() {
    return guildPower(this.state.members);
  }

  private act(action: string, arg: string): void {
    const s = this.screen;
    if (action !== 'reset') this.resetArmed = false;
    switch (action) {
      case 'tab':
        this.screen = { kind: 'guild', tab: arg as Tab };
        break;
      case 'member':
        this.screen = { kind: 'member', id: arg, back: s.kind === 'guild' ? s.tab : 'members' };
        break;
      case 'back':
        this.screen = { kind: 'guild', tab: s.kind === 'member' ? s.back : s.kind === 'assign' ? 'quests' : 'members' };
        break;
      case 'quest':
        this.screen = { kind: 'assign', questId: arg, picked: [] };
        break;
      case 'pick':
        if (s.kind === 'assign') {
          if (s.picked.includes(arg)) s.picked = s.picked.filter((id) => id !== arg);
          else if (s.picked.length < this.power.partySize) s.picked.push(arg);
        }
        break;
      case 'depart':
        if (s.kind === 'assign') void this.depart(s.questId, s.picked);
        return;
      case 'recruit': {
        const rng = new Rng(this.state.seed);
        recruit(this.state, rng);
        saveGame(this.state);
        break;
      }
      case 'rest':
        this.state.day++;
        this.state.log.unshift(`${this.state.day - 1}일차. 하루를 쉬며 몸을 추슬렀다.`);
        saveGame(this.state);
        break;
      case 'reset':
        // 브라우저 확인창이 막힌 환경이 있어 두 번 눌러 확인한다
        if (!this.resetArmed) {
          this.resetArmed = true;
          break;
        }
        this.resetArmed = false;
        clearSave();
        this.state = newGame();
        saveGame(this.state);
        this.screen = { kind: 'guild', tab: 'members' };
        break;
    }
    this.render();
  }

  private async depart(questId: string, picked: string[]): Promise<void> {
    const quest = this.state.quests.find((q) => q.id === questId);
    const party = picked.map((id) => this.state.members.find((m) => m.id === id)!).filter(Boolean);
    if (!quest || party.length === 0) return;

    const rng = new Rng(this.state.seed);
    const result = simulateBattle(party, quest, rng, { hpMul: this.power.has('formation') ? 1.1 : 1 });
    const outcome = await applyQuest(this.state, quest, party, result, new TemplateStoryGenerator(rng), rng);
    saveGame(this.state);

    this.screen = { kind: 'battle' };
    this.render();
    const { playBattle } = await import('../battle/playBattle');
    await playBattle(this.root.querySelector<HTMLElement>('#battle')!, quest.name, result);
    this.screen = { kind: 'result', outcome };
    this.render();
  }

  private render(): void {
    const s = this.screen;
    let body = '';
    if (s.kind === 'guild') body = this.header() + this.tabs(s.tab) + `<main>${s.tab === 'members' ? this.members() : s.tab === 'quests' ? this.quests() : this.logView()}</main>`;
    else if (s.kind === 'member') body = this.memberDetail(s.id);
    else if (s.kind === 'assign') body = this.assign(s.questId, s.picked);
    else if (s.kind === 'battle') body = '<div id="battle"></div>';
    else body = this.result(s.outcome);
    this.root.innerHTML = body;
    this.root.querySelector('main, .scroll')?.scrollTo(0, 0);
  }

  private header(): string {
    const p = this.power;
    const perks = p.perks.length
      ? p.perks.map((k) => `<span class="chip" title="${esc(k.desc)}">${esc(k.name)}</span>`).join('')
      : '<span class="muted">길드원이 성장하면 길드 능력이 생긴다</span>';
    return `<header>
      <div class="row"><h1>${esc(this.state.name)}</h1><span class="day">${this.state.day}일차</span></div>
      <div class="row stats"><span>금화 <b>${this.state.gold}</b></span><span>출전 <b>${p.partySize}명</b></span><span>수주 <b>${rankName(p.maxQuestRank)}등급까지</b></span></div>
      <div class="perks">${perks}</div>
    </header>`;
  }

  private tabs(tab: Tab): string {
    const t = (id: Tab, label: string) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${label}</button>`;
    return `<nav>${t('members', '길드원')}${t('quests', '퀘스트')}${t('log', '기록')}</nav>`;
  }

  private status(m: Member): string {
    return isAvailable(this.state, m) ? '<span class="ok">대기</span>' : `<span class="bad">부상 ${m.injuredUntil - this.state.day}일</span>`;
  }

  private memberCard(m: Member, extra = ''): string {
    const traits = m.traits.map((t) => TRAITS[t].name).join(' · ');
    const skills = m.skills.map((id) => `<span class="chip">${SKILL_BY_ID[id].name}</span>`).join('');
    return `<div class="card-head"><b>${esc(m.name)}</b><span class="realm">${rankName(m.grade)}등급</span>${this.status(m)}${extra}</div>
      <div class="muted">${traits} · ${m.age}세</div>
      <div class="statline">${STAT_KEYS.map((k) => `${STAT_LABEL[k]} ${m.stats[k]}`).join(' ')}</div>
      ${skills ? `<div class="perks">${skills}</div>` : ''}`;
  }

  private members(): string {
    const p = this.power;
    const cards = this.state.members.map((m) => `<div class="card tap" data-act="member" data-arg="${m.id}">${this.memberCard(m)}</div>`).join('');
    const canRecruit = this.state.gold >= p.recruitCost && this.state.members.length < 8;
    return `${cards}
      <div class="actions">
        <button data-act="recruit" ${canRecruit ? '' : 'disabled'}>길드원 모집 (금화 ${p.recruitCost})</button>
        <button class="ghost" data-act="rest">하루 쉬기</button>
      </div>`;
  }

  private questCard(q: Quest): string {
    const p = this.power;
    const locked = q.rank > p.maxQuestRank;
    const foes = p.has('scouting') ? `<div class="muted">적: ${q.enemies.map((e) => esc(e.name) + (e.boss ? '(우두머리)' : '')).join(', ')}</div>` : `<div class="muted">적 ${q.enemies.length}명${q.enemies.some((e) => e.boss) ? ', 우두머리 있음' : ''}</div>`;
    return `<div class="card ${locked ? 'locked' : 'tap'}" ${locked ? '' : `data-act="quest" data-arg="${q.id}"`}>
      <div class="card-head"><b>${esc(q.name)}</b><span class="realm">${rankName(q.rank)}등급</span></div>
      <div>${esc(q.desc)}</div>${foes}
      <div class="statline">${q.days}일 소요 · 금화 ${q.rewardGold} · 경험 ${q.rewardExp}${locked ? ' · <span class="bad">길드 역량 부족</span>' : ''}</div>
    </div>`;
  }

  private quests(): string {
    return this.state.quests.map((q) => this.questCard(q)).join('');
  }

  private logView(): string {
    return `${this.state.log.map((l) => `<p class="log">${esc(l)}</p>`).join('')}
      <div class="actions"><button class="ghost danger" data-act="reset">${this.resetArmed ? '한 번 더 누르면 모든 진행이 지워진다' : '처음부터 다시'}</button></div>`;
  }

  private memberDetail(id: string): string {
    const m = this.state.members.find((x) => x.id === id);
    if (!m) return '';
    const next = RANK_EXP[m.grade + 1];
    const expPct = next ? Math.round(((m.exp - RANK_EXP[m.grade]) / (next - RANK_EXP[m.grade])) * 100) : 100;
    const skills = m.skills.length
      ? m.skills.map((sid) => `<div class="skill"><b>${SKILL_BY_ID[sid].name}</b> ${SKILL_BY_ID[sid].desc}</div>`).join('')
      : '<div class="muted">아직 익힌 스킬이 없다. 겪은 일이 쌓이면 스킬이 생긴다.</div>';
    const history = [...m.history]
      .reverse()
      .map((h) => `<div class="hist"><div class="hist-title">${h.day}일차 · ${esc(h.title)}</div><div>${esc(h.text)}</div></div>`)
      .join('');
    return `<div class="topbar"><button class="ghost" data-act="back">← 뒤로</button></div>
      <div class="scroll">
        <div class="card">${this.memberCard(m)}
          <div class="muted">${esc(m.origin)}</div>
          <div class="exp"><div style="width:${expPct}%"></div></div>
          <div class="muted">경험 ${m.exp}${next ? ` / ${next} (다음 등급 ${rankName(m.grade + 1)})` : ' (최고 등급)'}</div>
        </div>
        <h2>기질</h2>${m.traits.map((t) => `<div class="skill"><b>${TRAITS[t].name}</b> ${TRAITS[t].desc}</div>`).join('')}
        <h2>스킬</h2>${skills}
        <h2>히스토리</h2>${history}
      </div>`;
  }

  private assign(questId: string, picked: string[]): string {
    const q = this.state.quests.find((x) => x.id === questId);
    if (!q) return '';
    const size = this.power.partySize;
    const cards = this.state.members
      .map((m) => {
        const avail = isAvailable(this.state, m);
        const on = picked.includes(m.id);
        return `<div class="card ${avail ? 'tap' : 'locked'} ${on ? 'picked' : ''}" ${avail ? `data-act="pick" data-arg="${m.id}"` : ''}>${this.memberCard(m, on ? '<span class="chip on">출전</span>' : '')}</div>`;
      })
      .join('');
    return `<div class="topbar"><button class="ghost" data-act="back">← 뒤로</button><span>${picked.length}/${size}명 배치</span></div>
      <div class="scroll">${this.questCard(q).replace(/data-act="quest" data-arg="[^"]*"/, '').replace('tap', '')}
        <h2>길드원 배치</h2>${cards}</div>
      <div class="bottom"><button data-act="depart" ${picked.length ? '' : 'disabled'}>출발</button></div>`;
  }

  private result(o: QuestOutcome): string {
    const rows = o.members
      .map((r) => {
        const changes = [
          `경험 +${r.expGained}`,
          describeUps(r.statUps),
          ...r.newSkills.map((s) => `<span class="chip on">새 스킬: ${s}</span>`),
          r.breakthrough ? `<span class="chip gold">승급: ${r.breakthrough}등급</span>` : '',
          r.injuredDays ? `<span class="bad">부상</span>` : '',
        ].filter(Boolean);
        return `<div class="card"><div class="card-head"><b>${esc(r.name)}</b></div><div class="story">${esc(r.story)}</div><div class="statline">${changes.join(' · ')}</div></div>`;
      })
      .join('');
    return `<div class="scroll">
        <h1 class="result ${o.win ? 'win' : 'lose'}">${o.win ? '의뢰 성공' : '의뢰 실패'}</h1>
        <p class="center">${esc(o.questName)}${o.win ? ` · 금화 +${o.gold}` : ''}</p>
        ${rows}
      </div>
      <div class="bottom"><button data-act="back">길드로 돌아가기</button></div>`;
  }
}
