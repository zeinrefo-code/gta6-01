// main.js — Solmar Heat: boot, game state, the loop, player controls, crime,
// pickups, save/load wiring and screenshot staging (?shot=...).
// I wrote this file fresh for Solmar Heat; it replaces the starter's main.js.
import { clamp, dist, angTo, rand, pick, circleRectResolve } from './util.js';
import { buildCity, WORLD, landmark, randomRoadPoint } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { makeCar, spawnParkedCar, updateTrafficCar, driveCar, nearestEnterableCar, damageCar } from './vehicles.js';
import { makePed, spawnPeds, maintainPeds, updatePerson } from './people.js';
import { createCombat } from './combat.js';
import { createMissions, STORY } from './missions.js';
import { createPolice } from './police.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
input.init();
const audio = createAudio();
const city = buildCity(7);

const G = {
  city, input, audio, STORY, screen: 'title', time: 0,
  player: {
    x: 1800, y: 3300, vx: 0, vy: 0, r: 12, aim: 0, health: 100, money: 150, score: 0,
    inCar: null, invuln: 0, hurtFlash: 0, fireT: 0, runT: 0,
  },
  cars: [], peds: [], bullets: [], particles: [], pickups: [], toasts: [],
  gunfireT: 0, bustT: 0, shakeT: 0, shakeAmt: 0, camVX: 0, camVY: 0,
  endKind: 'wasted', endText: '', saveExists: false, saveSummary: '', uiButtons: [],
  missions: null, police: null, combat: null,
};
G.missions = createMissions(G);
G.police = createPolice(G);
G.combat = createCombat(G);
const renderer = createRenderer(canvas);
window.__G = G;

G.toast = (text, secs = 3) => { G.toasts.push({ text, life: secs, max: secs }); };
G.banner = (text, secs = 3) => { G.missions.banner = text; G.missions.bannerT = secs; };
G.addShake = (n) => { G.shakeT = 0.3; G.shakeAmt = n; };
G.setWanted = (n, why) => G.police.setWanted(n, why);
G.addWanted = (n, why) => G.police.addWanted(n, why);
G.saveGame = () => { if (saveGame(G)) G.toast('Game saved.', 2); refreshSaveInfo(); };
G.spark = (x, y) => { for (let i = 0; i < 4; i++) G.particles.push({ x, y, vx: rand(-90, 90), vy: rand(-90, 90), life: 0.25, max: 0.25, color: '#fde68a', size: 2 }); };
G.blood = (x, y) => { for (let i = 0; i < 8; i++) G.particles.push({ x, y, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.4, max: 0.4, color: '#dc2626', size: 3 }); };
G.explosion = (x, y) => {
  for (let i = 0; i < 26; i++) G.particles.push({ x, y, vx: rand(-260, 260), vy: rand(-260, 260), life: rand(0.3, 0.8), max: 0.8, color: pick(['#f97316', '#facc15', '#78716c']), size: rand(4, 9) });
  G.addShake(10);
};
G.addCashDrop = (x, y, amount) => {
  G.pickups.push({ kind: 'cash', x: x + rand(-14, 14), y: y + rand(-14, 14), amount, t: 0 });
};
G.enemyShoot = (x, y, angle) => { G.combat.fireBullet(x, y, angle, false, 520); };
G.hurtPlayer = (n, sx, sy) => {
  const p = G.player;
  if (p.invuln > 0 || G.screen !== 'play') return;
  p.health -= n; p.hurtFlash = 1; p.invuln = 0.35;
  if (p.health <= 0) { p.health = 0; wasted(); }
};
G.busted = (reason) => {
  if (G.screen !== 'play') return;
  G.endKind = 'busted'; G.endText = reason;
  const p = G.player;
  p.money = Math.round(p.money * 0.8);
  G.police.setWanted(0);
  if (p.inCar) { p.x = p.inCar.x; p.y = p.inCar.y; p.inCar = null; }
  G.screen = 'over';
  status.textContent = 'Busted. ' + reason;
  audio.failJingle();
};

function wasted() {
  const p = G.player;
  G.endKind = 'wasted'; G.endText = 'Mara was taken down in the streets of Solmar.';
  p.money = Math.round(p.money * 0.8);
  G.police.setWanted(0);
  if (p.inCar) { p.x = p.inCar.x; p.y = p.inCar.y; p.inCar = null; }
  G.explosion(p.x, p.y);
  G.screen = 'over';
  status.textContent = 'Wasted.';
  audio.failJingle();
}

function refreshSaveInfo() {
  const s = loadSave();
  G.saveExists = !!s;
  G.saveSummary = s ? `${new Date(s.savedAt).toLocaleDateString()} · $${(s.money ?? 0).toLocaleString('en-US')} · mission ${(s.missionIndex ?? 0) + 1}/5` : '';
}
refreshSaveInfo();

function seedWorld() {
  G.cars = []; G.peds = []; G.bullets = []; G.particles = []; G.pickups = []; G.toasts = [];
  // Parked cars around the city.
  for (let i = 0; i < 9; i++) G.cars.push(spawnParkedCar(city));
  // Traffic cars on the roads.
  for (let i = 0; i < 14; i++) {
    const p = randomRoadPoint();
    const horizontal = Math.random() < 0.5;
    const type = pick(['sedan', 'sedan', 'taxi', 'taxi', 'van', 'sport', 'classic', 'truck']);
    const c = makeCar(p.x, p.y, type, { angle: horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2), traffic: true, lane: pick([-22, 22]), cruise: rand(150, 240) });
    G.cars.push(c);
  }
  spawnPeds(G, 26);
  // Health + repair pickups at fixed spots.
  G.pickups.push({ kind: 'health', x: 1000, y: 600, t: 0 }, { kind: 'health', x: 2600, y: 1800, t: 0 }, { kind: 'health', x: 1400, y: 3000, t: 0 });
  G.pickups.push({ kind: 'repair', x: 1000, y: 1400, t: 0 }, { kind: 'repair', x: 2200, y: 600, t: 0 });
  G.city.stashes.forEach(s => { s.taken = false; });
}

function newGame() {
  seedWorld();
  const p = G.player;
  // Mara arrives by boat at Bayview Pier, then walks up to the safehouse.
  p.x = 1800; p.y = 3300; p.health = 100; p.money = 150; p.score = 0; p.inCar = null; p.invuln = 0;
  G.police.setWanted(0);
  G.missions.index = 0; G.missions.step = 0; G.missions.active = false; G.missions.done = false;
  G.missions.storyDone = false; G.missions.dialogue = [];
  G.screen = 'play';
  G.missions.start(0);
  status.textContent = 'Playing Solmar Heat. Mission 1: Homecoming.';
}

function continueGame() {
  const s = loadSave();
  if (!s) { newGame(); return; }
  seedWorld();
  applySave(G, s);
  G.screen = 'play';
  if (!G.missions.active && !G.missions.storyDone) G.missions.start(G.missions.index);
  status.textContent = 'Continued your saved game.';
}

function respawnAfterEnd() {
  const p = G.player;
  const h = landmark(city, 'hospital');
  p.x = h.x; p.y = h.y + 120; p.health = 100; p.inCar = null; p.invuln = 1;
  G.police.setWanted(0);
  G.bustT = 0;
  G.screen = 'play';
  G.toast('You woke up at Solmar General. The city is still yours to take.', 4);
  if (G.missions.active) G.missions.start(G.missions.index);
}

// --- Player update ----------------------------------------------------------
function updatePlayer(dt) {
  const p = G.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2);
  p.fireT -= dt;
  p.runT = Math.max(0, p.runT - dt);
  const mx = input.mouse.x + G.camVX, my = input.mouse.y + G.camVY;

  if (p.inCar) {
    const car = p.inCar;
    p.x = car.x; p.y = car.y;
    p.aim = angTo(car.x, car.y, mx, my);
    driveCar(G, car, dt, input);
    // Drive-by shooting.
    if (input.mouse.down && p.fireT <= 0) {
      p.fireT = 0.28;
      G.combat.fireBullet(car.x + Math.cos(p.aim) * 26, car.y + Math.sin(p.aim) * 26, p.aim, true);
      audio.gunshot();
    }
    // Run over pedestrians at speed.
    if (Math.abs(car.speed) > 200) {
      for (const pd of G.peds) {
        if (pd.dead) continue;
        if (dist(car.x, car.y, pd.x, pd.y) < 34) {
          G.combat.hitPerson(pd, 100, true);
          car.speed *= 0.85;
          audio.crash();
          G.addShake(3);
        }
      }
    }
    // Car destroyed while driving.
    if (car.dead) {
      p.x = car.x + 40; p.y = car.y; p.inCar = null; p.health -= 20;
      if (p.health <= 0) wasted();
    }
    if (input.hit('e')) {
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      car.parked = true; car.traffic = false;
      p.inCar = null;
      audio.click();
    }
    audio.setEngine(Math.abs(car.speed) / car.max, true);
  } else {
    const sprint = input.down('shift') ? 1.5 : 1;
    let dx = (input.down('d', 'arrowright') ? 1 : 0) - (input.down('a', 'arrowleft') ? 1 : 0);
    let dy = (input.down('s', 'arrowdown') ? 1 : 0) - (input.down('w', 'arrowup') ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    const spd = 175 * sprint;
    p.vx = (dx / len) * spd * (dx || dy ? 1 : 0);
    p.vy = (dy / len) * spd * (dx || dy ? 1 : 0);
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.aim = angTo(p.x, p.y, mx, my);
    const c = { x: p.x, y: p.y, r: p.r };
    for (const b of city.buildings) {
      if (p.x > b.x - 30 && p.x < b.x + b.w + 30 && p.y > b.y - 30 && p.y < b.y + b.h + 30) {
        if (circleRectResolve(c, b)) { p.x = c.x; p.y = c.y; }
      }
    }
    p.x = clamp(p.x, 24, WORLD - 24); p.y = clamp(p.y, 24, WORLD - 24);
    // Shooting.
    if (input.mouse.down && p.fireT <= 0) {
      p.fireT = 0.22;
      G.combat.fireBullet(p.x + Math.cos(p.aim) * 20, p.y + Math.sin(p.aim) * 20, p.aim, true);
      audio.gunshot();
    }
    // Enter a car.
    if (input.hit('e')) {
      const car = nearestEnterableCar(G);
      if (car) {
        if (car.police) G.addWanted(2, 'You stole a police cruiser!');
        else if (car.traffic || car.parked) G.addWanted(1, 'You stole a car!');
        car.parked = false; car.traffic = false;
        p.inCar = car;
        audio.click();
        G.toast(`Driving: ${car.name}`, 2);
      } else if (G.missions.dialogue.length) {
        G.missions.dialogue.shift(); G.missions.dialogueT = 0;
      }
    }
    // Advance dialogue with click too.
    if (input.mouse.clicked && G.missions.dialogue.length) {
      G.missions.dialogue.shift(); G.missions.dialogueT = 0;
    }
    audio.setEngine(0, false);
  }
  // Cash stashes + pickups.
  for (const s of city.stashes) {
    if (!s.taken && dist(p.x, p.y, s.x, s.y) < 30) {
      s.taken = true; p.money += 150; p.score += 25;
      audio.pickup(); G.toast('Found a stash: +$150', 2);
    }
  }
  for (const pk of G.pickups) {
    pk.t += dt;
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      if (pk.kind === 'cash') { p.money += pk.amount; p.score += 10; audio.pickup(); }
      else if (pk.kind === 'health' && p.health < 100) { p.health = Math.min(100, p.health + 50); audio.pickup(); G.toast('Health +50', 2); pk.x = -9999; continue; }
      else if (pk.kind === 'repair' && p.inCar) { p.inCar.hp = 100; p.inCar.smoke = 0; audio.pickup(); G.toast('Car repaired', 2); pk.x = -9999; continue; }
      else continue;
      pk.x = -9999;
    }
  }
  G.pickups = G.pickups.filter(pk => pk.x > -100);
}

function maintainTraffic(dt) {
  const p = G.player;
  // Remove far traffic, keep the streets busy near the player.
  G.cars = G.cars.filter(c => {
    if (c.dead) return false;
    if (c.traffic && dist(c.x, c.y, p.x, p.y) > 1600) return false;
    if (c.parked && dist(c.x, c.y, p.x, p.y) > 2200) return false;
    return true;
  });
  const traffic = G.cars.filter(c => c.traffic).length;
  if (traffic < 12 && Math.random() < dt * 2) {
    const a = rand(0, Math.PI * 2);
    const rp = { x: clamp(p.x + Math.cos(a) * rand(500, 900), 100, WORLD - 100), y: clamp(p.y + Math.sin(a) * rand(500, 900), 100, WORLD - 100) };
    const road = randomRoadPoint();
    const horizontal = Math.random() < 0.5;
    const c = makeCar(road.x, road.y, pick(['sedan', 'taxi', 'van', 'sport', 'classic']), {
      angle: horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      traffic: true, lane: pick([-22, 22]), cruise: rand(150, 240),
    });
    G.cars.push(c);
  }
  const parked = G.cars.filter(c => c.parked).length;
  if (parked < 6 && Math.random() < dt * 0.5) G.cars.push(spawnParkedCar(city, p.x, p.y));
}

function step(dt) {
  G.time += dt;
  G.gunfireT = Math.max(0, G.gunfireT - dt);
  if (G.screen !== 'play') return;
  updatePlayer(dt);
  if (G.screen !== 'play') return; // wasted/busted during update
  for (const c of G.cars) {
    if (c.dead || c === G.player.inCar) continue;
    if (c.traffic) updateTrafficCar(G, c, dt);
    else if (c.police) { /* police cars are driven by police.js */ }
  }
  G.police.update(dt);
  maintainPeds(G);
  for (const pd of G.peds) updatePerson(G, pd, dt);
  G.combat.updateBullets(dt);
  G.combat.updateParticles(dt);
  maintainTraffic(dt);
  G.missions.update(dt);
  for (const t of G.toasts) t.life -= dt;
  G.toasts = G.toasts.filter(t => t.life > 0);
  G.bustT = G.police.nearestCopDist() > 60 ? 0 : G.bustT;
  audio.musicTick();
}

// --- Menus / clicks -----------------------------------------------------------
function handleClick() {
  if (!input.mouse.clicked) return;
  const mx = input.mouse.x, my = input.mouse.y;
  for (const b of G.uiButtons) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      audio.init(); audio.resume(); audio.click();
      if (b.id === 'new') newGame();
      else if (b.id === 'continue') continueGame();
      else if (b.id === 'howto') G.screen = 'howto';
      else if (b.id === 'missions') G.screen = 'missions';
      else if (b.id === 'back') G.screen = 'title';
      else if (b.id === 'resume') G.screen = 'play';
      else if (b.id === 'save') { G.saveGame(); }
      else if (b.id === 'retry') respawnAfterEnd();
      else if (b.id === 'quit') { G.screen = 'title'; refreshSaveInfo(); }
      return;
    }
  }
}

// --- Screenshot staging -------------------------------------------------------
function stageShot(name) {
  seedWorld();
  const p = G.player;
  p.health = 100; p.money = 2450; p.score = 1850; p.inCar = null;
  G.police.setWanted(0);
  G.missions.index = 0; G.missions.active = false; G.missions.dialogue = [];
  G.screen = 'play';
  if (name === 'menu') { G.screen = 'title'; refreshSaveInfo(); return; }
  if (name === 'cover') {
    // Downtown chase: Mara in a Vortex GT, 3 stars, cruisers on her tail, mission live.
    const car = makeCar(1800, 1800, 'sport', { angle: Math.PI / 2 });
    car.speed = 380;
    G.cars.push(car); p.inCar = car; p.x = car.x; p.y = car.y;
    G.missions.start(3); // The Getaway
    G.missions.dialogue = [];
    G.police.setWanted(3, '');
    for (let i = 0; i < 3; i++) {
      const c = makeCar(1800 + (i % 2 ? 46 : -46), 1800 - 330 - i * 90, 'police', { angle: Math.PI / 2 });
      c.speed = 470; G.cars.push(c);
    }
  } else if (name === 'street') {
    p.x = 1800; p.y = 1400;
    G.missions.start(1);
    G.missions.dialogue = [];
    for (let i = 0; i < 6; i++) spawnPeds(G, 1);
  } else if (name === 'chase') {
    const car = makeCar(2200, 2200, 'sport', { angle: 0 });
    car.speed = 460;
    G.cars.push(car); p.inCar = car; p.x = car.x; p.y = car.y;
    G.missions.start(4);
    G.missions.dialogue = [];
    G.police.setWanted(4, '');
    for (let i = 0; i < 3; i++) {
      const c = makeCar(2200 - 330 - i * 90, 2200 + (i % 2 ? 46 : -46), 'police', { angle: 0 });
      c.speed = 500; G.cars.push(c);
    }
  } else if (name === 'mission') {
    // Mara on the road outside the club, thugs closing in along the same road.
    p.x = 1900; p.y = 2200;
    G.missions.start(2);
    G.missions.dialogue = [];
    G.missions.step = 1; // fight step
    G.missions.kills = 0; G.missions.killsNeeded = 3;
    G.peds.push(...[0, 1, 2].map(i => {
      const t = { kind: 'thug', x: 2120 + i * 120, y: 2200, r: 12, angle: 0, speed: 120, color: '#1f2937', shirt: '#991b1b', state: 'chase', panic: 0, target: null, walkT: 0, hp: 60, dead: false, fleeT: 0, shootT: 1 + i * 0.5, punchT: 0 };
      return t;
    }));
    G.police.setWanted(1, '');
  }
  // Run the world forward so traffic, peds and police are mid-action.
  // Fewer steps for the chase/fight shots so the police and thugs are closing
  // in, not already piled on top of the player.
  const steps = (name === 'chase' || name === 'mission') ? 40 : 90;
  for (let i = 0; i < steps; i++) step(STEP);
  // Clean staged frame: no damage flash, full health, and the getaway car moving.
  p.hurtFlash = 0; p.invuln = 0; p.health = 100;
  if (p.inCar) { p.inCar.speed = 430; p.inCar.hp = 100; p.inCar.smoke = 0; }
  G.missions.banner = G.missions.active ? G.missions.current().title + ' — IN PROGRESS' : '';
  G.missions.bannerT = 0;
}

// --- Loop ---------------------------------------------------------------------
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
  audio.init();
  // Global keys.
  if (input.hit('p', 'escape')) {
    if (G.screen === 'play') { G.screen = 'paused'; G.saveGame(); }
    else if (G.screen === 'paused') G.screen = 'play';
    else if (G.screen === 'howto' || G.screen === 'missions') G.screen = 'title';
  }
  if (input.hit('m') && G.screen === 'play') { G.screen = 'missions'; }
  if (input.hit('enter') && G.screen === 'title') newGame();
  if (G.screen === 'title' && input.hit(' ')) newGame();
  handleClick();
  while (acc >= STEP) { step(STEP); acc -= STEP; }
  if (G.screen === 'title') G.time += STEP;
  renderer.draw(G);
  input.endFrame();
}

if (shotName) {
  stageShot(shotName);
  let painted = 0;
  (function paint() {
    renderer.draw(G);
    painted++;
    // The camera eases toward the player, so paint many frames before the shot.
    if (painted < 40) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
} else {
  seedWorld();
  status.textContent = 'Solmar Heat. Press Enter or click New Game to start.';
  requestAnimationFrame(frame);
}
