import type { GuildState } from './types';
import { SITES } from './world';

const KEY = 'magicartonline-save-v2';

/** 예전 저장 데이터를 지금 구조로 바꾼다 */
export function migrate(raw: unknown): GuildState | null {
  const s = raw as Omit<GuildState, 'version'> & { version: number };
  if (!s || typeof s !== 'object') return null;
  if (s.version === 2) {
    // v3: 전직 기록, 시설, 제작 주문 추가
    for (const m of s.members) m.jobRecords ??= {};
    s.facilities ??= { forge: 1 };
    s.orders ??= [];
    s.version = 3;
  }
  if (s.version === 3) {
    // v4: 소속 도시와 의뢰 장소 추가
    const st = s as unknown as GuildState;
    st.town ??= 'lumina';
    for (const q of st.quests) q.placeId ??= SITES.find((x) => q.name.startsWith(x.questType))?.id ?? SITES[0].id;
    s.version = 4;
  }
  return s.version === 4 ? (s as GuildState) : null;
}

export function loadGame(): GuildState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveGame(state: GuildState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 무시하고 진행한다
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
