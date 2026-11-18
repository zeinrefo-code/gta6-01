// main.js — Solmar Heat entry: game loop, state machine, wiring for every system.
import { clamp, dist, angleTo, rand } from './util.js';
import { WORLD, LANDMARKS, collidesBuilding, nearestRoadPoint } from './city.js';
import { makeCar, spawnTraffic, spawnParked, drivePlayer, updateTraffic, nearestCar, carHit } from './vehicles.js';
import { spawnPeds, updatePeople, makeThug } from './people.js';
import { addWanted, updatePolice } from './police.js';
import { startMission, updateMissions, completeMission, MISSIONS } from './missions.js';
import { shoot, updateBullets, updateParticles, updatePickups, explodeCar, spawnPickupNear } from './combat.js';
import { drawWorld, drawMinimap, drawHUD, drawTitle, drawPause, drawEndScreen, drawHowTo, drawMissionList } from './render.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const audio = new AudioEngine();

// ---- Game state ----
const G = {
  state: 'title', // title | howto | missionlist | playing | paused | busted | wasted
  time: 0, shake: 0,
  player: { x: 600, y: 750, angle: 0, aimAngle: -Math.PI / 2, hp: 100, speed: 0 },
  money: 0, score: 0, ammo: 120,
  wanted: 0, cleanTimer: 0, recentCrime: 0, spawnCd: 0,
  cars: [], people: [], cops: [], policeCars: [], thugs: [],
  bullets: [], particles: [], pickups: [],
  inCar: false, car: null,
  missionIdx: 0, mission: null, missionTimer: 0, missionStage: 0,
  storyDone: false, cashCollected: false, vaultCracked: false,
  dialogue: null, dialogueIdx: 0,
  bannerText: null, bannerSub: null, bannerLife: 0,
  toasts: [], camera: { x: 0, y: 0 },
  menuSel: 0, menuRects: [], titleItems: [],
  saveExists: false, gunfireAt: null, pendingNext: null,
  missionCompleteAt: 0, sirenCd: 0, pedCd: 0, trafficCd: 0,
};

G.toast = (text) => { G.toasts.push({ text, life: 3 }); if (G.toasts.length > 4) G.toasts.shift(); };
G.banner = (text, sub) => { G.bannerText = text; G.bannerSub = sub || ''; G.bannerLife = 3; };
G.addShake = (n) => { G.shake = Math.min(14, G.shake + n); };
G.addScore = (n, label) => { G.score += n; if (label) G.toast(label); };
G.addWanted = (n, reason) => addWanted(G, n, reason);
G.spawnParticles = (x, y, color, n) => {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(30, 160);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.8), max: 0.8, color, size: rand(3, 7) });
  }
};
G.dropPickup = (x, y) => {
  const r = Math.random();
  if (r < 0.4) spawnPickupNear(G, x, y, 'health');
  else if (r < 0.75) spawnPickupNear(G, x, y, 'cash', 150);
  else spawnPickupNear(G, x, y, 'ammo');
};
G.spawnCashStash = (x, y) => { G.pickups.push({ x, y, kind: 'cash', value: 400, bob: 0, taken: false }); };
G.audioShot = () => audio.shot();
G.audioExplosion = () => audio.explosion();
G.audioPickup = () => audio.pickup();
G.audioMission = () => audio.mission();
G.saveGame = () => { writeSave(G); G.saveExists = true; };
G.wasted = () => { if (G.state !== 'playing') return; G.state = 'wasted'; G.money = Math.max(0, G.money - 100); };
G.busted = () => { if (G.state !== 'playing') return; G.state = 'busted'; G.money = Math.max(0, G.money - 200); G.wanted = 0; };
G.respawn = () => {
  const h = LANDMARKS.hospital;
  G.player.x = h.x + 120; G.player.y = h.y + 120; G.player.hp = 100;
  G.inCar = false; G.car = null; G.wanted = 0; G.policeCars = []; G.cops = [];
  G.state = 'playing'; G.saveGame();
};

function newGame() {
  clearSave();
  G.money = 100; G.score = 0; G.ammo = 120; G.wanted = 0;
  G.player.x = 600; G.player.y = 750; G.player.hp = 100; G.player.angle = -Math.PI / 2;
  G.inCar = false; G.car = null; G.storyDone = false; G.cashCollected = false; G.vaultCracked = false;
  G.bullets = []; G.particles = []; G.pickups = []; G.cops = []; G.policeCars = []; G.thugs = [];
  G.cars = [...spawnTraffic(16, 600, 750), ...spawnParked(14, 600, 750)];
  // Guarantee a Vortex GT parked near the start for M2.
  const v = makeCar('vortex', 750, 795, 0, { parked: true });
  G.cars.push(v);
  G.people = spawnPeds(26, 600, 750);
  // A few health pickups around the city.
  spawnPickupNear(G, 900, 750, 'health'); spawnPickupNear(G, 1500, 1350, 'health'); spawnPickupNear(G, 2100, 2100, 'cash', 250);
  G.state = 'playing';
  startMission(G, 0);
  G.saveGame();
}

function continueGame() {
  const s = loadSave();
  if (!s) { newGame(); return; }
  G.money = s.money; G.score = s.score; G.ammo = s.ammo || 120;
  G.player.x = s.x; G.player.y = s.y; G.player.hp = s.hp || 100;
  G.wanted = 0; G.inCar = false; G.car = null; G.storyDone = false;
  G.cashCollected = false; G.vaultCracked = false;
  G.bullets = []; G.particles = []; G.pickups = []; G.cops = []; G.policeCars = []; G.thugs = [];
  G.cars = [...spawnTraffic(16, s.x, s.y), ...spawnParked(14, s.x, s.y)];
  G.cars.push(makeCar('vortex', s.x + 150, s.y + 45, 0, { parked: true }));
  G.people = spawnPeds(26, s.x, s.y);
  G.state = 'playing';
  startMission(G, Math.min(s.missionIdx || 0, MISSIONS.length - 1));
}

function enterExitCar() {
  if (G.inCar) {
    const c = G.car;
    G.inCar = false; G.car = null;
    G.player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 34;
    G.player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 34;
    G.player.hp = Math.max(G.player.hp, 1);
    return;
  }
  const car = nearestCar(G.cars, G.player.x, G.player.y, 72);
  if (!car || car.dead) return;
  if (car.traffic || car.parked) {
    car.traffic = false; car.parked = false; car.speed = 0;
    G.addWanted(1, 'Car stolen'); G.recentCrime = 6;
    G.toast('You took the ' + car.type.name);
  }
  if (car.police) { G.addWanted(1, 'Stole a PD cruiser'); }
  G.inCar = true; G.car = car;
  G.player.x = car.x; G.player.y = car.y;
  audio.ensure();
}

// ---- Shooting ----
let shootCd = 0;
function tryShoot() {
  if (shootCd > 0 || G.ammo <= 0) return;
  shootCd = 0.22;
  const px = G.inCar && G.car ? G.car.x : G.player.x;
  const py = G.inCar && G.car ? G.car.y : G.player.y;
  const ang = G.player.aimAngle;
  shoot(G, px, py, ang, true);
}

// ---- Update ----
function update(dt) {
  G.time += dt;
  if (G.bannerLife > 0) G.bannerLife -= dt * 0.8;
  if (G.bannerLife <= 0) G.bannerText = null;
  for (const t of G.toasts) t.life -= dt;
  G.toasts = G.toasts.filter(t => t.life > 0);
  G.shake = Math.max(0, G.shake - dt * 30);
  shootCd = Math.max(0, shootCd - dt);

  // Mission-complete handoff: start next mission after the banner breathes.
  if (G.pendingNext !== null && G.time * 1000 - G.missionCompleteAt > 2200) {
    const next = G.pendingNext; G.pendingNext = null;
    startMission(G, next);
  }

  const mv = input.moveVec();
  const running = input.down('ShiftLeft') || input.down('ShiftRight');
  if (G.inCar && G.car) {
    const car = G.car;
    drivePlayer(car, {
      up: input.down('KeyW') || input.down('ArrowUp') || G.shotAutoDrive,
      down: input.down('KeyS') || input.down('ArrowDown'),
      left: input.down('KeyA') || input.down('ArrowLeft'),
      right: input.down('KeyD') || input.down('ArrowRight'),
      hand: input.down('Space'),
    }, dt);
    G.player.x = car.x; G.player.y = car.y;
    // Ramming peds in a car is a crime.
    for (const p of G.people) {
      if (!p.dead && p.kind === 'ped' && dist(p.x, p.y, car.x, car.y) < 26 && Math.abs(car.speed) > 12) {
        p.dead = true; G.addWanted(1, 'Pedestrian hit'); G.recentCrime = 6; G.addScore(-25, '');
        G.spawnParticles(p.x, p.y, '#ff5a5a', 8);
      }
    }
    if (car.hp <= 0 && !car.exploded) explodeCar(G, car);
    if (input.mouseDown) tryShoot();
  } else {
    const sp = (running ? 210 : 130);
    const nx = G.player.x + mv.x * sp * dt;
    const ny = G.player.y + mv.y * sp * dt;
    if (mv.active) G.player.angle = Math.atan2(mv.y, mv.x);
    if (!collidesBuilding(nx, G.player.y, 12)) G.player.x = nx;
    if (!collidesBuilding(G.player.x, ny, 12)) G.player.y = ny;
    G.player.x = clamp(G.player.x, 30, WORLD - 30);
    G.player.y = clamp(G.player.y, 30, WORLD - 30);
    if (input.mouseDown) tryShoot();
  }
  // Aim at mouse (world coords).
  const wx = G.camera.x + input.mouseX, wy = G.camera.y + input.mouseY;
  G.player.aimAngle = angleTo(G.player.x, G.player.y, wx, wy);

  // Thugs shoot back.
  for (const t of G.thugs) {
    if (t.dead) continue;
    t.shootCd -= dt;
    const d = dist(t.x, t.y, G.player.x, G.player.y);
    if (t.shootCd <= 0 && d < 420) {
      t.shootCd = rand(0.9, 1.8);
      shoot(G, t.x, t.y, angleTo(t.x, t.y, G.player.x, G.player.y) + rand(-0.12, 0.12), false);
    }
  }
  // Cash stash pickup completes the M3 grab.
  for (const pk of G.pickups) {
    if (pk.kind === 'cash' && pk.value === 400 && dist(pk.x, pk.y, G.player.x, G.player.y) < 40) G.cashCollected = true;
  }

  updateTraffic(G.cars, dt, G.player);
  updatePeople(G.people, dt, G.player, G.gunfireAt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateParticles(G, dt);
  updatePickups(G, dt);
  updateMissions(G, dt);

  // Keep traffic and peds topped up near the player.
  G.trafficCd -= dt;
  if (G.trafficCd <= 0) {
    G.trafficCd = 4;
    const near = G.cars.filter(c => dist(c.x, c.y, G.player.x, G.player.y) < 800).length;
    if (near < 14) G.cars.push(...spawnTraffic(4, G.player.x, G.player.y));
    const nearPeds = G.people.filter(p => !p.dead && dist(p.x, p.y, G.player.x, G.player.y) < 700).length;
    if (nearPeds < 18) G.people.push(...spawnPeds(6, G.player.x, G.player.y));
  }
  // Siren blips while wanted.
  G.sirenCd -= dt;
  if (G.wanted > 0 && G.sirenCd <= 0) { G.sirenCd = 1.6; audio.siren(); }

  // Camera follows player / car.
  const tx = clamp(G.player.x - 640, 0, WORLD - 1280);
  const ty = clamp(G.player.y - 360, 0, WORLD - 720);
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);

  audio.update(dt, G.inCar, G.inCar && G.car ? G.car.speed : 0);
  if (G.player.hp <= 0 && G.state === 'playing') G.wasted();
}

// ---- Menu handling ----
function menuActivate() {
  audio.ensure(); audio.click();
  if (G.state === 'title') {
    const item = G.titleItems[G.menuSel];
    if (item === 'CONTINUE') continueGame();
    else if (item === 'NEW GAME') newGame();
    else if (item === 'HOW TO PLAY') G.state = 'howto';
    else if (item === 'MISSION LIST') G.state = 'missionlist';
  } else if (G.state === 'paused') {
    if (G.menuSel === 0) { G.state = 'playing'; }
    else { G.saveGame(); G.state = 'title'; G.saveExists = true; }
  }
}

function handleKeys() {
  if (input.wasPressed('KeyM')) { audio.setMuted(!audio.muted); G.toast(audio.muted ? 'Sound muted' : 'Sound on'); }
  if (G.state === 'title') {
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) G.menuSel = (G.menuSel + G.titleItems.length - 1) % G.titleItems.length;
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) G.menuSel = (G.menuSel + 1) % G.titleItems.length;
    if (input.wasPressed('Enter') || input.wasPressed('Space')) menuActivate();
  } else if (G.state === 'howto' || G.state === 'missionlist') {
    if (input.wasPressed('Escape') || input.wasPressed('Enter') || input.clicked) G.state = 'title';
  } else if (G.state === 'playing') {
    if (input.wasPressed('KeyP')) { G.state = 'paused'; G.menuSel = 0; G.saveGame(); G.toast('Autosaved'); }
    if (input.wasPressed('KeyE')) enterExitCar();
    if (G.dialogue && G.dialogueIdx < G.dialogue.length) {
      if (input.wasPressed('Space') || input.clicked) { G.dialogueIdx++; audio.click(); }
    }
  } else if (G.state === 'paused') {
    if (input.wasPressed('KeyP')) G.state = 'playing';
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) G.menuSel = (G.menuSel + 1) % 2;
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) G.menuSel = (G.menuSel + 1) % 2;
    if (input.wasPressed('Enter')) menuActivate();
  } else if (G.state === 'busted' || G.state === 'wasted') {
    if (input.wasPressed('Enter')) G.respawn();
  }
  // Mouse clicks on menu rows.
  if (input.clicked) {
    for (let i = 0; i < G.menuRects.length; i++) {
      const r = G.menuRects[i];
      if (input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h) {
        G.menuSel = i; menuActivate(); break;
      }
    }
  }
}

// ---- Screenshot staging (?shot=1..4) ----
function stageShot(n) {
  newGame();
  G.dialogueIdx = 99; // skip intro dialogue so the HUD is visible
  const c = (x, y) => { G.player.x = x; G.player.y = y; G.camera.x = clamp(x - 640, 0, WORLD - 1280); G.camera.y = clamp(y - 360, 0, WORLD - 720); };
  if (n === 1) {
    // Cover: high-speed chase, police, wanted stars, mission objective, minimap.
    const car = makeCar('vortex', 1350, 1500, -Math.PI / 2, {});
    car.speed = 55; G.cars.push(car);
    G.inCar = true; G.car = car; G.shotAutoDrive = true;
    c(1350, 1500);
    startMission(G, 3); G.dialogueIdx = 99; G.wanted = 3;
    G.policeCars = [];
    for (let i = 0; i < 3; i++) {
      const pc = makeCar('cruiser', 1350 + (i - 1) * 40, 1500 + 170 + i * 90, -Math.PI / 2, { police: true });
      pc.siren = true; G.policeCars.push(pc); G.cars.push(pc);
    }
    G.cars.push(...spawnTraffic(6, 1350, 1500));
    G.people = spawnPeds(20, 1350, 1500);
  } else if (n === 2) {
    // On foot downtown with traffic + peds.
    c(1350, 1500);
    G.mission = MISSIONS[0]; G.missionIdx = 0; G.missionTimer = 0;
    G.cars.push(...spawnTraffic(8, 1350, 1500));
    G.people = spawnPeds(26, 1350, 1500);
  } else if (n === 3) {
    // 5-star chase.
    const car = makeCar('vortex', 2250, 2100, -Math.PI / 2, {});
    car.speed = 62; G.cars.push(car);
    G.inCar = true; G.car = car; G.shotAutoDrive = true;
    c(2250, 2100);
    G.wanted = 5;
    startMission(G, 4); G.dialogueIdx = 99;
    for (let i = 0; i < 4; i++) {
      const pc = makeCar('cruiser', 2250 + (i - 2) * 40, 2100 + 180 + i * 80, -Math.PI / 2, { police: true });
      pc.siren = true; G.policeCars.push(pc); G.cars.push(pc);
    }
    G.cars.push(...spawnTraffic(5, 2250, 2100));
  } else if (n === 4) {
    // Mission fight: armed thugs at the Neon Palms Club.
    const club = LANDMARKS.club;
    c(club.x, club.y + 180);
    startMission(G, 2); G.dialogueIdx = 99;
    G.player.aimAngle = angleTo(G.player.x, G.player.y, club.x, club.y);
    G.cars.push(...spawnTraffic(4, club.x, club.y));
    G.people = spawnPeds(14, club.x, club.y);
    G.spawnParticles(club.x, club.y, '#ffd23f', 10);
  }
  G.banner('SOLMAR HEAT', G.mission ? G.mission.title + ' — ' + G.mission.objective : '');
  G.bannerLife = 2.5;
}

// ---- Boot ----
G.saveExists = !!loadSave();
const params = new URLSearchParams(location.search);
const shot = parseInt(params.get('shot') || '0', 10);
if (shot >= 1 && shot <= 4) {
  stageShot(shot);
} else {
  // Title screen backdrop: a parked camera over downtown.
  G.player.x = 1200; G.player.y = 1200;
  G.camera.x = 560; G.camera.y = 840;
  G.cars = [...spawnTraffic(10, 1200, 1200), ...spawnParked(8, 1200, 1200)];
  G.people = spawnPeds(20, 1200, 1200);
}

window.__game = G;
window.__solmar = { state: () => G.state, mission: () => G.missionIdx, money: () => G.money, wanted: () => G.wanted, speed: () => (G.car ? Math.abs(G.car.speed) * 3.6 : 0), pos: () => ({ x: G.player.x, y: G.player.y }), inCar: () => G.inCar };

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  handleKeys();
  if (G.state === 'playing') update(dt);
  else if (G.state === 'title') { updateTraffic(G.cars, dt, G.player); updatePeople(G.people, dt, G.player, null); G.time += dt; }
  ctx.clearRect(0, 0, 1280, 720);
  if (G.state === 'title') { drawWorld(ctx, G, G.time); drawTitle(ctx, G); }
  else if (G.state === 'howto') { drawWorld(ctx, G, G.time); drawHowTo(ctx); }
  else if (G.state === 'missionlist') { drawWorld(ctx, G, G.time); drawMissionList(ctx, G); }
  else if (G.state === 'paused') { drawWorld(ctx, G, G.time); drawHUD(ctx, G); drawMinimap(ctx, G); drawPause(ctx, G); }
  else if (G.state === 'busted' || G.state === 'wasted') { drawWorld(ctx, G, G.time); drawHUD(ctx, G); drawEndScreen(ctx, G, G.state); }
  else { drawWorld(ctx, G, G.time); drawMinimap(ctx, G); drawHUD(ctx, G); }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
