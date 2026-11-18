// people.js — pedestrians, armed thugs, foot cops.
import { rand, pick, dist, angleTo, clamp } from './util.js';
import { isRoad, collidesBuilding, WORLD, randomRoadPoint } from './city.js';

const PED_COLORS = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b', '#c77dff', '#90be6d', '#f9c74f'];
const NAMES = ['Ana', 'Ben', 'Cleo', 'Dario', 'Elsa', 'Felix', 'Gia', 'Hugo', 'Ivy', 'Jonas', 'Kira', 'Leo'];

export function makePed(x, y) {
  return {
    kind: 'ped', name: pick(NAMES), x, y, angle: rand(0, Math.PI * 2),
    speed: rand(14, 26), color: pick(PED_COLORS), hp: 50, dead: false,
    flee: 0, walkT: rand(0, 4), target: null,
  };
}
export function makeThug(x, y) {
  return {
    kind: 'thug', name: 'Thug', x, y, angle: rand(0, Math.PI * 2),
    speed: 30, color: '#2b2b3a', hp: 90, dead: false, flee: 0,
    shootCd: rand(0.5, 1.5), walkT: 0, target: null,
  };
}
export function makeCop(x, y) {
  return {
    kind: 'cop', name: 'Officer', x, y, angle: rand(0, Math.PI * 2),
    speed: 52, color: '#1a2a6b', hp: 100, dead: false, flee: 0,
    arrestT: 0, walkT: 0, target: null,
  };
}

export function spawnPeds(count, px, py) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint();
    if (dist(p.x, p.y, px, py) > 700) continue;
    out.push(makePed(p.x + rand(-40, 40), p.y + rand(-40, 40)));
  }
  // Top up with peds near the player on roads.
  while (out.length < count) {
    const a = rand(0, Math.PI * 2), d = rand(120, 600);
    const x = clamp(px + Math.cos(a) * d, 80, WORLD - 80);
    const y = clamp(py + Math.sin(a) * d, 80, WORLD - 80);
    out.push(makePed(x, y));
  }
  return out.slice(0, count);
}

export function updatePeople(people, dt, player, gunfireAt) {
  for (const p of people) {
    if (p.dead) continue;
    if (p.kind === 'thug') {
      // Thugs hold ground and shoot at the player when close.
      const d = dist(p.x, p.y, player.x, player.y);
      if (d < 420) p.angle = angleTo(p.x, p.y, player.x, player.y);
      continue;
    }
    if (p.kind === 'cop') {
      // Foot cops chase the player when wanted >= 2.
      const d = dist(p.x, p.y, player.x, player.y);
      if (d < 700) {
        p.angle = angleTo(p.x, p.y, player.x, player.y);
        const nx = p.x + Math.cos(p.angle) * p.speed * dt;
        const ny = p.y + Math.sin(p.angle) * p.speed * dt;
        if (!collidesBuilding(nx, ny, 12)) { p.x = nx; p.y = ny; }
        if (d < 34) p.arrestT += dt; else p.arrestT = 0;
      }
      continue;
    }
    // Pedestrians: stroll along sidewalks, flee gunfire.
    if (gunfireAt && dist(p.x, p.y, gunfireAt.x, gunfireAt.y) < 320) p.flee = 2.5;
    if (p.flee > 0) {
      p.flee -= dt;
      p.angle = angleTo(gunfireAt ? gunfireAt.x : p.x, gunfireAt ? gunfireAt.y : p.y, p.x, p.y);
      const sp = 68;
      const nx = p.x + Math.cos(p.angle) * sp * dt;
      const ny = p.y + Math.sin(p.angle) * sp * dt;
      if (!collidesBuilding(nx, ny, 10)) { p.x = nx; p.y = ny; }
    } else {
      p.walkT -= dt;
      if (p.walkT <= 0) { p.walkT = rand(2, 5); p.angle = rand(0, Math.PI * 2); }
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!collidesBuilding(nx, ny, 10) && nx > 60 && nx < WORLD - 60 && ny > 60 && ny < WORLD - 60) { p.x = nx; p.y = ny; }
      else p.walkT = 0;
    }
  }
}
