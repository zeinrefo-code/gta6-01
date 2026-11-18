// save.js — localStorage save: money, score, mission progress, player state.
const KEY = 'solmar-heat-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.money !== 'number') return null;
    return s;
  } catch (e) { return null; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: state.money, score: state.score, missionIdx: state.missionIdx,
      wanted: state.wanted, hp: state.player ? state.player.hp : 100,
      x: state.player ? state.player.x : 600, y: state.player ? state.player.y : 600,
      ammo: state.ammo || 48, savedAt: Date.now(),
    }));
    return true;
  } catch (e) { return false; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) {} }
export function hasSave() { return !!loadSave(); }
