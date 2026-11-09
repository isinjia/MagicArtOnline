import type { GuildState } from './types';

const KEY = 'magicartonline-save-v2';

export function loadGame(): GuildState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GuildState;
    return s.version === 2 ? s : null;
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
