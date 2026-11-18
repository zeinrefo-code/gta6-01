// save.js — save/load via localStorage. Saves money, health, mission progress,
// story state, player position and owned cars. Autosaves on mission completion.
export const SAVE_KEY = 'solmar-heat.save.v1';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      money: Math.round(p.money), health: Math.round(p.health), score: p.score,
      x: Math.round(p.inCar ? p.inCar.x : p.x), y: Math.round(p.inCar ? p.inCar.y : p.y),
      missionIndex: G.missions.index, missionActive: G.missions.active,
      missionStep: G.missions.step, storyDone: G.missions.storyDone,
      wanted: G.police.wanted, savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function hasSave() { return loadSave() !== null; }

export function applySave(G, s) {
  const p = G.player;
  p.money = s.money ?? 150; p.health = s.health ?? 100; p.score = s.score ?? 0;
  p.x = s.x ?? 600; p.y = s.y ?? 600; p.inCar = null;
  G.police.setWanted(0);
  G.missions.storyDone = !!s.storyDone;
  if (s.storyDone) { G.missions.index = 4; G.missions.active = false; }
  else if (s.missionActive) { G.missions.start(s.missionIndex ?? 0); G.missions.step = s.missionStep ?? 0; }
  else { G.missions.index = s.missionIndex ?? 0; G.missions.active = false; }
}
