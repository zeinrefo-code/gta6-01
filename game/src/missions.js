// missions.js — 5-mission story chain for Mara Voss and Rico's garage.
import { dist } from './util.js';
import { LANDMARKS } from './city.js';
import { makeThug } from './people.js';
import { makeCar } from './vehicles.js';

export const MISSIONS = [
  { id: 1, title: 'M1 · Homecoming', name: 'Homecoming', reward: 300,
    intro: ["RICO: Mara! You're back in Solmar at last.", "RICO: Come to my garage — we have work to do.", "MARA: On my way, Rico. Don't start without me."],
    objective: "Reach Rico's Garage", marker: () => ({ x: LANDMARKS.garage.x, y: LANDMARKS.garage.y }) },
  { id: 2, title: 'M2 · Hot Wheels', name: 'Hot Wheels', reward: 500,
    intro: ["RICO: A client wants a Vortex GT. No questions.", "RICO: Steal one off the street and bring it here.", "MARA: Easy. The city owes me a ride anyway."],
    objective: 'Steal a Vortex GT and deliver it to the garage', marker: () => ({ x: LANDMARKS.garage.x, y: LANDMARKS.garage.y }) },
  { id: 3, title: 'M3 · Debt Collection', name: 'Debt Collection', reward: 800,
    intro: ["RICO: The Neon Palms crew owes me big. Three thugs, one cash box.", "RICO: Take them down and bring me the money.", "MARA: Consider it collected."],
    objective: 'Take out 3 thugs at The Neon Palms Club, grab the cash', marker: () => ({ x: LANDMARKS.club.x, y: LANDMARKS.club.y }) },
  { id: 4, title: 'M4 · The Getaway', name: 'The Getaway', reward: 1200,
    intro: ["RICO: The PD is onto us! Three stars and climbing!", "RICO: Lose them and reach Bayview Pier. Fast!", "MARA: Hold on tight, Solmar. I'm gone."],
    objective: 'Escape the police — reach Bayview Pier', marker: () => ({ x: LANDMARKS.pier.x, y: LANDMARKS.pier.y }), timed: 150 },
  { id: 5, title: 'M5 · Bayfront Heist', name: 'Bayfront Heist', reward: 2500,
    intro: ["RICO: One last job. The Bayfront Bank vault.", "RICO: Crack it at four stars, then vanish to the docks.", "MARA: The whole city is about to know my name."],
    objective: 'Crack the Bayfront Bank vault, escape to the docks', marker: () => ({ x: LANDMARKS.bank.x, y: LANDMARKS.bank.y }), timed: 240 },
];

export function startMission(G, idx) {
  const m = MISSIONS[idx];
  if (!m) { G.missionIdx = MISSIONS.length; G.storyDone = true; G.banner('STORY COMPLETE', 'Solmar is yours now, Mara. Free roam!'); G.toast('Free roam — explore Solmar City'); return; }
  G.missionIdx = idx;
  G.mission = m;
  G.missionTimer = m.timed || 0;
  G.missionStage = 0;
  G.dialogue = [...m.intro];
  G.dialogueIdx = 0;
  G.banner(m.title, m.objective);
  if (idx === 2) {
    // Spawn the three thugs at the club.
    G.thugs = [];
    const c = LANDMARKS.club;
    for (let i = 0; i < 3; i++) {
      const t = makeThug(c.x + (i - 1) * 70, c.y + 60 + (i % 2) * 40);
      G.thugs.push(t); G.people.push(t);
    }
    G.missionStage = 0;
  }
  if (idx === 3) { G.addWanted(3, 'The PD is onto you'); }
  if (idx === 4) { G.addWanted(4, 'Bank alarm tripped'); G.vaultCracked = false; }
  G.saveGame();
}

export function missionMarker(G) {
  if (!G.mission) return null;
  if (G.missionIdx === 4 && G.vaultCracked) return { x: LANDMARKS.docks.x, y: LANDMARKS.docks.y };
  if (G.missionIdx === 2 && G.thugs.every(t => t.dead)) return { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y };
  return G.mission.marker();
}

export function updateMissions(G, dt) {
  if (!G.mission || G.storyDone) return;
  const p = G.player;
  if (G.missionTimer > 0) {
    G.missionTimer -= dt;
    if (G.missionTimer <= 0) { G.missionTimer = 0; G.banner('TOO SLOW', 'The moment passed — try the mission again'); G.failMission(); return; }
  }
  const m = G.mission;
  const mk = missionMarker(G);
  if (!mk) return;
  const d = dist(p.x, p.y, mk.x, mk.y);
  if (G.missionIdx === 0) {
    if (d < 110) completeMission(G);
  } else if (G.missionIdx === 1) {
    // Deliver a Vortex GT to the garage while driving it.
    if (G.inCar && G.car && G.car.type.key === 'vortex' && d < 130) completeMission(G);
  } else if (G.missionIdx === 2) {
    if (G.thugs.every(t => t.dead)) {
      if (G.missionStage === 0) {
        G.missionStage = 1;
        G.spawnCashStash(LANDMARKS.club.x, LANDMARKS.club.y);
        G.banner('CASH SECURED', 'Grab the cash box, then get back to the garage');
        G.toast('Cash box dropped at the club');
      }
      if (d < 130 && G.cashCollected) completeMission(G);
    }
  } else if (G.missionIdx === 3) {
    if (d < 130) completeMission(G);
  } else if (G.missionIdx === 4) {
    if (!G.vaultCracked) {
      if (dist(p.x, p.y, LANDMARKS.bank.x, LANDMARKS.bank.y) < 130) {
        G.vaultCracked = true;
        G.money += 1500; G.addScore(500, 'Vault cracked +$1,500');
        G.banner('VAULT CRACKED', 'Now run — escape to the docks!');
        G.audioPickup();
      }
    } else if (d < 130) completeMission(G);
  }
}

export function completeMission(G) {
  const m = G.mission;
  G.money += m.reward;
  G.addScore(200, 'Mission complete +' + m.reward);
  G.banner('MISSION COMPLETE', m.name + '  ·  +$' + m.reward);
  G.audioMission();
  G.cashCollected = false;
  G.vaultCracked = false;
  G.saveGame();
  G.mission = null;
  G.missionCompleteAt = performance.now();
  G.pendingNext = G.missionIdx + 1;
}

export function failMission(G) {
  const idx = G.missionIdx;
  G.wanted = Math.max(0, G.wanted - 1);
  setTimeout(() => { if (G.state === 'playing') startMission(G, idx); }, 1200);
}
