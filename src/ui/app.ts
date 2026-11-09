import { GuildHall } from '../art/hall';
import { enemySpriteUrl, memberSpriteUrl } from '../art/sprites';
import { simulateBattle } from '../core/battle';
import { RANK_EXP, STAT_KEYS, STAT_LABEL, TRAITS } from '../core/data';
import { newGame, rankName } from '../core/gen';
import { guildPower } from '../core/guild';
import {
  APPRAISE_REQ,
  appraise,
  buy,
  buyPrice,
  canCraft,
  count,
  craft,
  effectiveStats,
  equip,
  ITEMS,
  RECIPES,
  sell,
  sellPrice,
  SHOP,
  unequip,
  useItem,
} from '../core/items';
import { JOB_EXP, JOB_IDS, JOB_MAX, JOBS, levelOf, meets, meetsAll, reqName, TRACK_IDS, TRACKS } from '../core/jobs';
import { applyQuest, describeUps, isAvailable, recruit, type QuestOutcome } from '../core/progress';
import { josa } from '../core/josa';
import { Rng } from '../core/rng';
import { clearSave, saveGame } from '../core/save';
import { SKILL_BY_ID } from '../core/skills';
import { TemplateStoryGenerator } from '../core/story';
import type { GuildState, Member, Quest, Requirement, Slot, TrackId } from '../core/types';

type Tab = 'members' | 'quests' | 'craft' | 'shop' | 'log';
type Screen =
  | { kind: 'guild'; tab: Tab }
  | { kind: 'member'; id: string; back: Tab }
  | { kind: 'assign'; questId: string; picked: string[] }
  | { kind: 'battle' }
  | { kind: 'result'; outcome: QuestOutcome };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rankBadge = (grade: number) => `<span class="rank r${grade}">${rankName(grade)}</span>`;
const SLOT_LABEL: Record<Slot, string> = { weapon: '무기', armor: '갑옷', accessory: '장신구' };

export class App {
  private screen: Screen = { kind: 'guild', tab: 'members' };
  private resetArmed = false;
  private notice = '';
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

  private rng(): Rng {
    return new Rng(this.state.seed);
  }

  private act(action: string, arg: string): void {
    const s = this.screen;
    const st = this.state;
    if (action !== 'reset') this.resetArmed = false;
    if (action !== 'noop') this.notice = '';
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
        const m = recruit(st, this.rng());
        if (m) this.notice = `${JOBS[m.job].name} ${josa(m.name, '이', '가')} 들어왔다.`;
        break;
      }
      case 'rest':
        st.day++;
        st.log.unshift(`${st.day - 1}일차. 하루를 쉬며 몸을 추슬렀다.`);
        break;
      case 'craft': {
        const rc = RECIPES.find((r) => r.id === arg);
        if (rc && craft(st, rc).length) this.notice = `${ITEMS[rc.item].name} 완성!`;
        break;
      }
      case 'buy':
        if (buy(st, arg)) this.notice = `${ITEMS[arg].name} 구입 (-${buyPrice(st, arg)}G)`;
        break;
      case 'sell': {
        const price = sellPrice(st, arg);
        if (sell(st, arg)) this.notice = `${ITEMS[arg].name} 판매 (+${price}G)`;
        break;
      }
      case 'appraise': {
        const r = appraise(st, this.rng());
        if (r) this.notice = r;
        break;
      }
      case 'use': {
        // arg: item 또는 item:memberId
        const [item, mid] = arg.split(':');
        const m = mid ? st.members.find((x) => x.id === mid) : undefined;
        const r = useItem(st, item, this.rng(), m);
        if (r) this.notice = r;
        break;
      }
      case 'equip': {
        const [item, mid] = arg.split(':');
        const m = st.members.find((x) => x.id === mid);
        if (m) equip(st, m, item);
        break;
      }
      case 'unequip': {
        const [slot, mid] = arg.split(':');
        const m = st.members.find((x) => x.id === mid);
        if (m) unequip(st, m, slot as Slot);
        break;
      }
      case 'reset':
        // 브라우저 확인창이 막힌 환경이 있어 두 번 눌러 확인한다
        if (!this.resetArmed) {
          this.resetArmed = true;
          break;
        }
        this.resetArmed = false;
        clearSave();
        this.state = newGame();
        this.screen = { kind: 'guild', tab: 'members' };
        break;
    }
    saveGame(this.state);
    this.render();
  }

  private async depart(questId: string, picked: string[]): Promise<void> {
    const quest = this.state.quests.find((q) => q.id === questId);
    const party = picked.map((id) => this.state.members.find((m) => m.id === id)!).filter(Boolean);
    if (!quest || party.length === 0 || !meetsAll(this.state.members, quest.reqs)) return;

    const p = this.power;
    const buff = this.state.buff;
    const hpMul = (p.has('formation') ? 1.1 : 1) * (p.has('supply') ? 1.05 : 1) * (buff?.hpMul ?? 1);
    const atkMul = (p.has('maintenance') ? 1.05 : 1) * (buff?.atkMul ?? 1);
    this.state.buff = null;

    const rng = new Rng(this.state.seed);
    const result = simulateBattle(party, quest, rng, { hpMul, atkMul });
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
    if (s.kind === 'guild') {
      const views: Record<Tab, () => string> = {
        members: () => this.members(),
        quests: () => this.quests(),
        craft: () => this.workshop(),
        shop: () => this.shop(),
        log: () => this.logView(),
      };
      const notice = this.notice ? `<div class="notice">${esc(this.notice)}</div>` : '';
      body = this.header() + this.tabs(s.tab) + `<main>${notice}${views[s.tab]()}</main>`;
    } else if (s.kind === 'member') body = this.memberDetail(s.id);
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

  // ---------- 공통 조각 ----------

  private trackChip(t: TrackId): string {
    const l = this.power.tracks[t];
    return `<span class="track"><b>${TRACKS[t].name}</b> ${l.total}<small>최고 Lv${l.max}</small></span>`;
  }

  private reqChip(r: Requirement): string {
    const l = levelOf(this.state.members, r);
    const ok = meets(this.state.members, r);
    return `<span class="req ${ok ? 'ok' : 'no'}">${reqName(r)} 합계 ${l.total}/${r.total} · 최고 Lv${l.max}/${r.max}</span>`;
  }

  private header(): string {
    const p = this.power;
    const tracks = TRACK_IDS.filter((t) => t === 'combat' || p.tracks[t].count > 0).map((t) => this.trackChip(t)).join('');
    const perks = p.perks.map((k) => `<span class="perk" title="${esc(k.desc)}">${esc(k.name)}</span>`).join('');
    const buff = this.state.buff ? `<span class="perk">${esc(this.state.buff.name)}</span>` : '';
    return `<header>
      <div class="hud">
        <div class="win name">${esc(this.state.name)}</div>
        <div class="win"><span class="coin"></span><b>${this.state.gold}</b></div>
        <div class="win"><b>${this.state.day}</b>일차</div>
      </div>
      <div class="hall-wrap" id="hall-slot"></div>
      <div class="power">${tracks}</div>
      <div class="power"><span>출전 <b>${p.partySize}명</b></span><span>길드원 <b>${this.state.members.length}/8</b></span>${perks}${buff}</div>
    </header>`;
  }

  private tabs(tab: Tab): string {
    const t = (id: Tab, label: string) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${label}</button>`;
    return `<nav>${t('members', '길드원')}${t('quests', '의뢰')}${t('craft', '공방')}${t('shop', '상점')}${t('log', '기록')}</nav>`;
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
    const st = effectiveStats(m);
    return `<div class="mrow">${this.portrait(m)}<div class="mbody">
      <div class="card-head"><span class="nm">${esc(m.name)}</span>${rankBadge(m.grade)}${this.status(m)}${extra}</div>
      <div class="jobline"><span class="job">${JOBS[m.job].name} Lv${m.jobLevel}</span><span class="muted">${traits}</span></div>
      <div class="stats">${STAT_KEYS.map((k) => `<div>${STAT_LABEL[k]}<b class="${st[k] > m.stats[k] ? 'up' : ''}">${st[k]}</b></div>`).join('')}</div>
      ${skills ? `<div class="chips">${skills}</div>` : ''}
    </div></div>`;
  }

  // ---------- 길드원 ----------

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

  private memberDetail(id: string): string {
    const m = this.state.members.find((x) => x.id === id);
    if (!m) return '';
    const next = RANK_EXP[m.grade + 1];
    const expPct = next ? Math.round(((m.exp - RANK_EXP[m.grade]) / (next - RANK_EXP[m.grade])) * 100) : 100;
    const jNext = JOB_EXP[m.jobLevel + 1];
    const jPct = m.jobLevel >= JOB_MAX ? 100 : Math.round(((m.jobExp - JOB_EXP[m.jobLevel]) / (jNext - JOB_EXP[m.jobLevel])) * 100);
    const job = JOBS[m.job];
    const howToGrow =
      job.family === '전투계' ? '의뢰에 나가면 오른다.' : job.family === '생산계' ? `공방에서 ${TRACKS[job.track].name} 제작을 하면 오른다.` : m.job === 'merchant' ? '상점에서 사고팔면 오른다.' : '유물을 감정하면 오른다.';

    const slots = (['weapon', 'armor', 'accessory'] as Slot[])
      .map((slot) => {
        const cur = m.equip[slot];
        const owned = Object.keys(this.state.items).filter((k) => ITEMS[k]?.slot === slot && count(this.state, k) > 0);
        const options = owned.map((k) => `<button class="btn mini" data-act="equip" data-arg="${k}:${m.id}">${ITEMS[k].name} 장착</button>`).join('');
        return `<div class="slot win"><div class="card-head"><span class="nm">${SLOT_LABEL[slot]}</span>${cur ? `<button class="btn mini sub" data-act="unequip" data-arg="${slot}:${m.id}">해제</button>` : ''}</div>
          <div>${cur ? `<b>${ITEMS[cur].name}</b> <span class="muted">${ITEMS[cur].desc}</span>` : '<span class="muted">없음</span>'}</div>
          ${options ? `<div class="chips">${options}</div>` : ''}</div>`;
      })
      .join('');

    const potions = ['potion', 'awaken', 'elixir']
      .filter((k) => count(this.state, k) > 0 && (k !== 'potion' || !isAvailable(this.state, m)))
      .map((k) => `<button class="btn mini" data-act="use" data-arg="${k}:${m.id}">${ITEMS[k].name} 사용 (${count(this.state, k)})</button>`)
      .join('');

    const skills = m.skills.length
      ? m.skills.map((sid) => `<div class="skill win"><b>${SKILL_BY_ID[sid].name}</b>${SKILL_BY_ID[sid].desc}</div>`).join('')
      : '<div class="muted">아직 익힌 스킬이 없다. 겪은 일이 쌓이면 스킬이 생긴다.</div>';
    const history = [...m.history]
      .reverse()
      .map((h) => `<div class="hist"><div class="hist-title">${h.day}일차 · ${esc(h.title)}</div><div>${esc(h.text)}</div></div>`)
      .join('');
    const notice = this.notice ? `<div class="notice">${esc(this.notice)}</div>` : '';
    return `<div class="topbar"><button class="btn sub" data-act="back">◀ 뒤로</button></div>
      <div class="scroll">${notice}
        <div class="card win">${this.memberCard(m)}
          <div class="muted">${esc(m.origin)}</div>
          <div class="exp"><div style="width:${expPct}%"></div></div>
          <div class="muted">등급 EXP ${m.exp}${next ? ` / ${next} (다음 ${rankName(m.grade + 1)}등급)` : ' (최고 등급)'}</div>
        </div>
        <div class="section">직업</div>
        <div class="card win">
          <div class="card-head"><span class="nm">${job.name} Lv${m.jobLevel}</span><span class="chip">${job.family} · ${TRACKS[job.track].name}</span></div>
          <div>${job.desc}</div>
          <div class="exp job"><div style="width:${jPct}%"></div></div>
          <div class="muted">직업 EXP ${m.jobExp}${m.jobLevel < JOB_MAX ? ` / ${jNext}` : ' (최고 레벨)'} · ${howToGrow}</div>
        </div>
        <div class="section">장비</div>${slots}
        ${potions ? `<div class="section">물약</div><div class="chips">${potions}</div>` : ''}
        <div class="section">기질</div>${m.traits.map((t) => `<div class="skill win"><b>${TRAITS[t].name}</b>${TRAITS[t].desc}</div>`).join('')}
        <div class="section">스킬</div>${skills}
        <div class="section">히스토리</div>${history}
      </div>`;
  }

  // ---------- 의뢰 ----------

  private questCard(q: Quest, tappable = true): string {
    const p = this.power;
    const ok = meetsAll(this.state.members, q.reqs);
    const scout = p.has('scouting');
    const foes = q.enemies.map((e) => `<img class="sprite ${scout ? '' : 'hidden'}" src="${enemySpriteUrl(e.name, e.boss)}" alt="${scout ? esc(e.name) : '?'}">`).join('');
    const act = tappable && ok ? `data-act="quest" data-arg="${q.id}"` : '';
    const reqs = q.reqs.length ? `<div class="chips">${q.reqs.map((r) => this.reqChip(r)).join('')}</div>` : '';
    return `<div class="card win ${ok ? (tappable ? 'tap' : '') : 'locked'}" ${act}>
      <div class="card-head"><span class="nm">${esc(q.name)}</span>${rankBadge(q.rank)}</div>
      <div>${esc(q.desc)}</div>
      <div class="foes">${foes}</div>
      ${reqs}
      <div class="reward"><span>${q.days}일</span><span><span class="coin"></span> ${q.rewardGold}G</span><span>EXP ${q.rewardExp}</span><span>전리품 ${q.drops.map((d) => ITEMS[d].name).join('·')}</span></div>
    </div>`;
  }

  private quests(): string {
    const buff = this.state.buff ? `<div class="notice">${esc(this.state.buff.name)} 준비됨: 다음 의뢰에 효과가 난다.</div>` : '';
    return buff + this.state.quests.map((q) => this.questCard(q)).join('');
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
        <div class="section">누구를 보낼까?</div>
        <div class="muted">전투계 직업만 의뢰로 직업 레벨이 오른다. 생산계와 상인계는 약하지만 등급 경험치는 얻는다.</div>
        ${cards}</div>
      <div class="bottom"><button class="btn" data-act="depart" ${picked.length ? '' : 'disabled'}>출발!</button></div>`;
  }

  // ---------- 공방 ----------

  private inventory(filter: (k: string) => boolean, action?: (k: string) => string): string {
    const keys = Object.keys(this.state.items).filter((k) => ITEMS[k] && count(this.state, k) > 0 && filter(k));
    if (!keys.length) return '<div class="muted">없음</div>';
    return `<div class="inv">${keys.map((k) => `<div class="inv-item win"><b>${ITEMS[k].name}</b><span>×${count(this.state, k)}</span>${action ? action(k) : ''}</div>`).join('')}</div>`;
  }

  private workshop(): string {
    const p = this.power;
    const crafts: TrackId[] = ['smithing', 'tailoring', 'alchemy', 'cooking'];
    const sections = crafts
      .map((t) => {
        const l = p.tracks[t];
        const workers = this.state.members.filter((m) => JOBS[m.job].track === t).map((m) => `${m.name.split(' ')[0]} Lv${m.jobLevel}`).join(', ');
        const recipes = RECIPES.filter((r) => r.track === t)
          .map((r) => {
            const c = canCraft(this.state, r);
            const locked = !meetsAll(this.state.members, r.req);
            const mats = Object.entries(r.mats)
              .map(([k, n]) => `<span class="${count(this.state, k) >= n ? '' : 'bad'}">${ITEMS[k].name} ${count(this.state, k)}/${n}</span>`)
              .join(' · ');
            return `<div class="card win ${locked ? 'locked' : ''}">
              <div class="card-head"><span class="nm">${ITEMS[r.item].name}</span><span class="muted">${ITEMS[r.item].desc}</span></div>
              <div class="chips">${r.req.map((q) => this.reqChip(q)).join('')}</div>
              <div class="reward">${mats}<span>${r.gold}G</span><span>${r.days}일</span></div>
              <button class="btn mini" data-act="craft" data-arg="${r.id}" ${c.ok ? '' : 'disabled'}>${c.ok ? '제작' : c.why}</button>
            </div>`;
          })
          .join('');
        return `<div class="section">${TRACKS[t].name} 기술 · 합계 ${l.total} · 최고 Lv${l.max}</div>
          <div class="muted">${workers ? `장인: ${esc(workers)}` : `장인이 없다. ${josa(JOBS[JOB_IDS.find((j) => JOBS[j].track === t)!].name, '을', '를')} 모집하자.`}</div>
          ${recipes}`;
      })
      .join('');
    const food = this.inventory(
      (k) => ITEMS[k].kind === 'food',
      (k) => `<button class="btn mini" data-act="use" data-arg="${k}">준비</button>`,
    );
    return `<div class="muted">같은 분야 장인들의 직업 레벨 합계와 최고 레벨이 조건을 넘으면 만들 수 있다. 만들 때마다 그 분야 장인 모두가 직업 경험치를 얻는다.</div>
      <div class="section">보관함</div>${this.inventory(() => true)}
      <div class="section">요리 준비</div>${food}
      ${sections}`;
  }

  // ---------- 상점 ----------

  private shop(): string {
    const st = this.state;
    const c = this.power.tracks.commerce;
    const a = this.power.tracks.appraisal;
    const buyList = SHOP.map((e) => {
      const ok = meetsAll(st.members, e.req);
      const price = buyPrice(st, e.item);
      return `<div class="card win ${ok ? '' : 'locked'}">
        <div class="card-head"><span class="nm">${ITEMS[e.item].name}</span><span><span class="coin"></span> ${price}G</span></div>
        <div class="chips">${e.req.map((r) => this.reqChip(r)).join('')}</div>
        <button class="btn mini" data-act="buy" data-arg="${e.item}" ${ok && st.gold >= price ? '' : 'disabled'}>구입</button>
      </div>`;
    }).join('');
    const sellList = this.inventory(
      () => true,
      (k) => `<button class="btn mini sub" data-act="sell" data-arg="${k}">${sellPrice(st, k)}G 판매</button>`,
    );
    const relics = count(st, 'relic');
    const canAppraise = relics > 0 && meetsAll(st.members, APPRAISE_REQ);
    return `<div class="muted">상인의 직업 레벨 합계가 높을수록 싸게 사고 비싸게 판다. 상업 합계 ${c.total} · 최고 Lv${c.max}</div>
      <div class="section">판매</div>${sellList}
      <div class="section">구입</div>${buyList}
      <div class="section">감정</div>
      <div class="card win">
        <div>미감정 유물 ×${relics}. 감정 최고 레벨이 높을수록 희귀 장비가 나올 확률이 오른다. (감정 합계 ${a.total} · 최고 Lv${a.max})</div>
        <div class="chips">${APPRAISE_REQ.map((r) => this.reqChip(r)).join('')}</div>
        <button class="btn mini" data-act="appraise" ${canAppraise ? '' : 'disabled'}>감정하기</button>
      </div>`;
  }

  // ---------- 기록, 결과 ----------

  private logView(): string {
    return `${this.state.log.map((l) => `<p class="log">${esc(l)}</p>`).join('')}
      <div class="actions"><button class="btn danger wide" data-act="reset">${this.resetArmed ? '한 번 더 누르면 모든 진행이 지워진다' : '처음부터 다시'}</button></div>`;
  }

  private result(o: QuestOutcome): string {
    const rows = o.members
      .map((r) => {
        const m = this.state.members.find((x) => x.id === r.memberId);
        const changes = [
          `<span class="chip">EXP +${r.expGained}</span>`,
          describeUps(r.statUps) ? `<span class="chip">${describeUps(r.statUps)}</span>` : '',
          r.jobUp && m ? `<span class="chip on">${JOBS[m.job].name} Lv${r.jobUp}!</span>` : '',
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
    const drops = Object.entries(o.drops)
      .map(([k, n]) => `<span class="chip">${ITEMS[k].name} ×${n}</span>`)
      .join('');
    return `<div class="topbar"><div class="banner ${o.win ? 'win-c' : 'lose-c'}" style="flex:1">${o.win ? '의뢰 성공!' : '의뢰 실패…'}</div></div>
      <div class="scroll">
        <p class="center">${esc(o.questName)}${o.win ? ` · ${o.gold}G 획득` : ''}</p>
        ${drops ? `<div class="chips">${drops}</div>` : ''}
        ${rows}
      </div>
      <div class="bottom"><button class="btn" data-act="back">길드로 돌아가기</button></div>`;
  }
}
