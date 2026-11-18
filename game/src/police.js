// police.js — wanted system 0-5 stars, PD cruiser chases, arrests, heat decay.
import { clamp, dist, angleTo, angleDiff, rand } from './util.js';
import { makeCar } from './vehicles.js';
import { makeCop } from './people.js';
import { nearestRoadPoint } from './city.js';

export function addWanted(G, n, reason) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  if (n > 0) { G.heatTimer = 0; G.cleanTimer = 0; if (reason) G.toast(reason + '  +' + n + ' star' + (n > 1 ? 's' : '')); }
}

export function updatePolice(G, dt) {
  const p = G.player;
  // Heat decays when clean and out of sight of cops.
  const anyCopNear = G.cops.some(c => !c.dead && dist(c.x, c.y, p.x, p.y) < 500) ||
    G.policeCars.some(c => !c.dead && dist(c.x, c.y, p.x, p.y) < 500);
  if (G.wanted > 0 && !anyCopNear && !G.recentCrime) {
    G.cleanTimer += dt;
    if (G.cleanTimer > 14) { G.wanted = Math.max(0, G.wanted - 1); G.cleanTimer = 0; if (G.wanted === 0) G.toast('You lost the heat.'); }
  } else G.cleanTimer = 0;
  if (G.recentCrime > 0) G.recentCrime -= dt;

  // Spawn cruisers up to wanted level (1 per star, max 4 active).
  const wantCruisers = G.wanted >= 1 ? Math.min(4, G.wanted + (G.wanted >= 4 ? 1 : 0)) : 0;
  G.spawnCd -= dt;
  if (G.policeCars.length < wantCruisers && G.spawnCd <= 0) {
    G.spawnCd = 2.5;
    const rp = nearestRoadPoint(p.x + rand(-700, 700), p.y + rand(-700, 700));
    const car = makeCar('cruiser', rp.x, rp.y, angleTo(rp.x, rp.y, p.x, p.y), { police: true });
    car.siren = true;
    G.policeCars.push(car);
    G.cars.push(car);
  }
  // Spawn foot cops at 2+ stars.
  if (G.wanted >= 2 && G.cops.length < G.wanted - 1 && G.spawnCd <= 0) {
    G.spawnCd = 3;
    const a = rand(0, Math.PI * 2);
    G.cops.push(makeCop(p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320));
    G.people.push(G.cops[G.cops.length - 1]);
  }
  // Cruiser chase + ram.
  for (const c of G.policeCars) {
    if (c.dead) continue;
    const d = dist(c.x, c.y, p.x, p.y);
    const targetAngle = angleTo(c.x, c.y, p.x, p.y);
    c.angle += angleDiff(c.angle, targetAngle) * Math.min(1, dt * 2.2);
    const sp = clamp(d * 0.9, 30, 62);
    const nx = c.x + Math.cos(c.angle) * sp * dt;
    const ny = c.y + Math.sin(c.angle) * sp * dt;
    c.x = nx; c.y = ny; c.speed = sp;
    if (d < 46) {
      // Ram: damage player or their car.
      if (G.inCar && G.car) { G.car.hp -= 14 * dt; G.addShake(3); }
      else { p.hp -= 10 * dt; G.addShake(4); }
      if (p.hp <= 0) G.wasted();
    }
    if (d > 1100) { c.dead = true; }
  }
  G.policeCars = G.policeCars.filter(c => !c.dead);
  G.cars = G.cars.filter(c => !c.dead || c === G.car);
  // Arrest: a foot cop standing on the player for 2s at 2+ stars.
  for (const cop of G.cops) {
    if (!cop.dead && cop.arrestT > 2 && G.wanted >= 2) { G.busted(); return; }
  }
  // Despawn far cops.
  G.cops = G.cops.filter(c => !c.dead && dist(c.x, c.y, p.x, p.y) < 1200);
}
