import { GuildHall } from '../art/hall';
import { enemySpriteUrl, memberSpriteUrl } from '../art/sprites';
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
const rankBadge = (grade: number) => `<span class="rank r${grade}">${rankName(grade)}</span>`;

export class App {
  private screen: Screen = { kind: 'guild', tab: 'members' };
  private resetArmed = false;
  private hall: GuildHall;

  constructor(
    private root: HTMLElement,
    private state: GuildState,
  ) {
    this.hall = new GuildHall(() => this.state);
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (el && !(el as HTMLButtonElement).disabled) this.act(el.dataset.act!, el.dataset.arg ?? '');
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
      case 'recruit':
        recruit(this.state, new Rng(this.state.seed));
        saveGame(this.state);
        break;
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
    await playBattle(this.root.querySelector<HTMLElement>('#battle')!, quest.name, result, party);
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

    const slot = this.root.querySelector('#hall-slot');
    if (slot) {
      slot.appendChild(this.hall.canvas);
      this.hall.start();
    } else {
      this.hall.stop();
    }
  }

  private header(): string {
    const p = this.power;
    const perks = p.perks.map((k) => `<span class="perk" title="${esc(k.desc)}">${esc(k.name)}</span>`).join('');
    return `<header>
      <div class="hud">
        <div class="win name">${esc(this.state.name)}</div>
        <div class="win"><span class="coin"></span><b>${this.state.gold}</b></div>
        <div class="win"><b>${this.state.day}</b>일차</div>
      </div>
      <div class="hall-wrap" id="hall-slot"></div>
      <div class="power"><span>출전 <b>${p.partySize}명</b></span><span>수주 <b>${rankName(p.maxQuestRank)}등급</b>까지</span><span>길드원 <b>${this.state.members.length}/8</b></span>${perks}</div>
    </header>`;
  }

  private tabs(tab: Tab): string {
    const t = (id: Tab, label: string) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${label}</button>`;
    return `<nav>${t('members', '길드원')}${t('quests', '의뢰')}${t('log', '기록')}</nav>`;
  }

  private status(m: Member): string {
    return isAvailable(this.state, m) ? '<span class="ok">대기</span>' : `<span class="bad">부상 ${m.injuredUntil - this.state.day}일</span>`;
  }

  private portrait(m: Member): string {
    return `<div class="portrait"><img class="sprite" src="${memberSpriteUrl(m)}" alt=""></div>`;
  }

  private memberCard(m: Member, extra = ''): string {
    const traits = m.traits.map((t) => TRAITS[t].name).join(' · ');
    const skills = m.skills.map((id) => `<span class="chip">${SKILL_BY_ID[id].name}</span>`).join('');
    return `<div class="mrow">${this.portrait(m)}<div class="mbody">
      <div class="card-head"><span class="nm">${esc(m.name)}</span>${rankBadge(m.grade)}${this.status(m)}${extra}</div>
      <div class="muted">${traits} · ${m.age}세</div>
      <div class="stats">${STAT_KEYS.map((k) => `<div>${STAT_LABEL[k]}<b>${m.stats[k]}</b></div>`).join('')}</div>
      ${skills ? `<div class="chips">${skills}</div>` : ''}
    </div></div>`;
  }

  private members(): string {
    const p = this.power;
    const cards = this.state.members.map((m) => `<div class="card win tap" data-act="member" data-arg="${m.id}">${this.memberCard(m)}</div>`).join('');
    const canRecruit = this.state.gold >= p.recruitCost && this.state.members.length < 8;
    return `${cards}
      <div class="actions">
        <button class="btn" data-act="recruit" ${canRecruit ? '' : 'disabled'}>모집 ${p.recruitCost}G</button>
        <button class="btn sub" data-act="rest">하루 쉬기</button>
      </div>`;
  }

  private questCard(q: Quest, tappable = true): string {
    const p = this.power;
    const locked = q.rank > p.maxQuestRank;
    const scout = p.has('scouting');
    const foes = q.enemies.map((e) => `<img class="sprite ${scout ? '' : 'hidden'}" src="${enemySpriteUrl(e.name, e.boss)}" alt="${scout ? esc(e.name) : '?'}" title="${scout ? esc(e.name) : '정찰하면 보인다'}">`).join('');
    const act = tappable && !locked ? `data-act="quest" data-arg="${q.id}"` : '';
    return `<div class="card win ${locked ? 'locked' : tappable ? 'tap' : ''}" ${act}>
      <div class="card-head"><span class="nm">${esc(q.name)}</span>${rankBadge(q.rank)}</div>
      <div>${esc(q.desc)}</div>
      <div class="foes">${foes}</div>
      <div class="reward"><span>${q.days}일</span><span><span class="coin"></span> ${q.rewardGold}G</span><span>EXP ${q.rewardExp}</span>${locked ? '<span class="bad">길드 역량 부족</span>' : ''}</div>
    </div>`;
  }

  private quests(): string {
    return this.state.quests.map((q) => this.questCard(q)).join('');
  }

  private logView(): string {
    return `${this.state.log.map((l) => `<p class="log">${esc(l)}</p>`).join('')}
      <div class="actions"><button class="btn danger wide" data-act="reset">${this.resetArmed ? '한 번 더 누르면 모든 진행이 지워진다' : '처음부터 다시'}</button></div>`;
  }

  private memberDetail(id: string): string {
    const m = this.state.members.find((x) => x.id === id);
    if (!m) return '';
    const next = RANK_EXP[m.grade + 1];
    const expPct = next ? Math.round(((m.exp - RANK_EXP[m.grade]) / (next - RANK_EXP[m.grade])) * 100) : 100;
    const skills = m.skills.length
      ? m.skills.map((sid) => `<div class="skill win"><b>${SKILL_BY_ID[sid].name}</b>${SKILL_BY_ID[sid].desc}</div>`).join('')
      : '<div class="muted">아직 익힌 스킬이 없다. 겪은 일이 쌓이면 스킬이 생긴다.</div>';
    const history = [...m.history]
      .reverse()
      .map((h) => `<div class="hist"><div class="hist-title">${h.day}일차 · ${esc(h.title)}</div><div>${esc(h.text)}</div></div>`)
      .join('');
    return `<div class="topbar"><button class="btn sub" data-act="back">◀ 뒤로</button></div>
      <div class="scroll">
        <div class="card win">${this.memberCard(m)}
          <div class="muted">${esc(m.origin)}</div>
          <div class="exp"><div style="width:${expPct}%"></div></div>
          <div class="muted">EXP ${m.exp}${next ? ` / ${next} (다음 ${rankName(m.grade + 1)}등급)` : ' (최고 등급)'}</div>
        </div>
        <div class="section">기질</div>${m.traits.map((t) => `<div class="skill win"><b>${TRAITS[t].name}</b>${TRAITS[t].desc}</div>`).join('')}
        <div class="section">스킬</div>${skills}
        <div class="section">히스토리</div>${history}
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
        return `<div class="card win ${avail ? 'tap' : 'locked'} ${on ? 'picked' : ''}" ${avail ? `data-act="pick" data-arg="${m.id}"` : ''}>${this.memberCard(m, on ? '<span class="chip on">출전</span>' : '')}</div>`;
      })
      .join('');
    return `<div class="topbar"><button class="btn sub" data-act="back">◀ 뒤로</button><span class="win">${picked.length} / ${size}명 배치</span></div>
      <div class="scroll">${this.questCard(q, false)}
        <div class="section">누구를 보낼까?</div>${cards}</div>
      <div class="bottom"><button class="btn" data-act="depart" ${picked.length ? '' : 'disabled'}>출발!</button></div>`;
  }

  private result(o: QuestOutcome): string {
    const rows = o.members
      .map((r) => {
        const m = this.state.members.find((x) => x.id === r.memberId);
        const changes = [
          `<span class="chip">EXP +${r.expGained}</span>`,
          describeUps(r.statUps) ? `<span class="chip">${describeUps(r.statUps)}</span>` : '',
          ...r.newSkills.map((s) => `<span class="chip on">새 스킬 ${s}</span>`),
          r.breakthrough ? `<span class="chip gold">${r.breakthrough}등급 승급!</span>` : '',
          r.injuredDays ? `<span class="chip" style="color:var(--red)">부상</span>` : '',
        ].filter(Boolean);
        return `<div class="card win"><div class="mrow">${m ? this.portrait(m) : '<div></div>'}<div class="mbody">
          <div class="card-head"><span class="nm">${esc(r.name)}</span></div>
          <div class="story">${esc(r.story)}</div>
          <div class="chips">${changes.join('')}</div></div></div></div>`;
      })
      .join('');
    return `<div class="topbar"><div class="banner ${o.win ? 'win-c' : 'lose-c'}" style="flex:1">${o.win ? '의뢰 성공!' : '의뢰 실패…'}</div></div>
      <div class="scroll">
        <p class="center">${esc(o.questName)}${o.win ? ` · ${o.gold}G 획득` : ''}</p>
        ${rows}
      </div>
      <div class="bottom"><button class="btn" data-act="back">길드로 돌아가기</button></div>`;
  }
}
