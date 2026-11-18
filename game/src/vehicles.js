// vehicles.js — car definitions, traffic AI, car physics, enter/exit/steal.
// Cars are axis-free: heading in radians, arcade physics with drift and collisions
// against buildings. Traffic cars follow road lanes and turn at intersections.
import { clamp, dist, angDiff, rand, randi, pick, circleRectResolve } from './util.js';
import { WORLD, ROAD_W, ROAD_AT, onRoad, randomRoadPoint } from './city.js';

export const CAR_TYPES = {
  sedan:   { name: 'Solano Sedan',   color: '#c94f4f', len: 52, wid: 26, accel: 420, max: 430, grip: 3.2, price: 0 },
  taxi:    { name: 'Bay Taxi',      color: '#f2c94c', len: 52, wid: 26, accel: 400, max: 410, grip: 3.2, price: 0 },
  sport:   { name: 'Vortex GT',     color: '#e879f9', len: 54, wid: 26, accel: 620, max: 560, grip: 4.0, price: 0 },
  van:     { name: 'Cargo Van',     color: '#94a3b8', len: 60, wid: 28, accel: 320, max: 350, grip: 2.6, price: 0 },
  truck:   { name: 'Hauler Truck',  color: '#f59e0b', len: 72, wid: 30, accel: 280, max: 320, grip: 2.4, price: 0 },
  police:  { name: 'Solmar PD Cruiser', color: '#e5e7eb', len: 54, wid: 27, accel: 560, max: 520, grip: 3.8, price: 0 },
  classic: { name: 'Palms Classic', color: '#38bdf8', len: 56, wid: 27, accel: 380, max: 400, grip: 3.0, price: 0 },
};

export function makeCar(x, y, type, opts = {}) {
  const t = CAR_TYPES[type];
  return {
    x, y, angle: opts.angle ?? 0, speed: 0, type, name: t.name, color: t.color,
    len: t.len, wid: t.wid, accel: t.accel, max: t.max, grip: t.grip,
    r: Math.max(t.len, t.wid) * 0.55, parked: !!opts.parked, traffic: !!opts.traffic,
    police: type === 'police', driver: opts.traffic ? 'traffic' : null,
    // traffic AI
    dir: opts.dir ?? 0, lane: opts.lane ?? 0, cruise: opts.cruise ?? rand(150, 240),
    turnAt: 0, hp: 100, smoke: 0, siren: 0, id: Math.random().toString(36).slice(2, 8),
  };
}

export function spawnParkedCar(city, nearX, nearY) {
  for (let tries = 0; tries < 20; tries++) {
    const p = randomRoadPoint();
    if (nearX !== undefined && dist(p.x, p.y, nearX, nearY) < 500) continue;
    const horizontal = Math.abs(p.y - ROAD_AT[0]) < 1 || true;
    const onH = ROAD_AT.some(r => Math.abs(p.y - r) < 2);
    const angle = onH ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const type = pick(['sedan', 'sedan', 'taxi', 'sport', 'van', 'classic']);
    return makeCar(p.x, p.y, type, { angle, parked: true });
  }
  return makeCar(600, 200, 'sedan', { angle: 0, parked: true });
}

// Traffic car steering: follow its road, turn at intersections, avoid the car ahead.
export function updateTrafficCar(G, car, dt) {
  const horizontal = Math.abs(Math.sin(car.angle)) < 0.7;
  const targetSpeed = car.cruise;
  // Slow for the car ahead.
  let ahead = null, bestD = 130;
  for (const o of G.cars) {
    if (o === car) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d < bestD) {
      const a = Math.atan2(o.y - car.y, o.x - car.x);
      if (Math.abs(angDiff(car.angle, a)) < 0.6) { ahead = o; bestD = d; }
    }
  }
  const p = G.player;
  if (p.inCar !== car) {
    const dp = dist(car.x, car.y, p.x, p.y);
    if (dp < 110 && Math.abs(angDiff(car.angle, Math.atan2(p.y - car.y, p.x - car.x))) < 0.7) ahead = { x: p.x, y: p.y };
  }
  const want = ahead ? Math.max(0, targetSpeed - 220) : targetSpeed;
  car.speed += clamp(want - car.speed, -500 * dt, 320 * dt);
  // Lane keeping: steer toward the lane centre line.
  const road = horizontal ? nearestRoadY(car.y) : nearestRoadX(car.x);
  const laneOff = car.lane;
  const desired = horizontal
    ? Math.atan2((road + laneOff) - car.y, Math.cos(car.angle) >= 0 ? 1 : -1)
    : Math.atan2(Math.sin(car.angle) >= 0 ? 1 : -1, (road + laneOff) - car.x);
  // Simpler: steer heading toward the lane line.
  const lineErr = horizontal ? (road + laneOff) - car.y : (road + laneOff) - car.x;
  const steer = clamp(lineErr * 0.02, -1, 1) * (Math.cos(car.angle) >= 0 || !horizontal ? 1 : 1);
  car.angle += clamp(angDiff(car.angle, horizontal ? (Math.cos(car.angle) >= 0 ? 0 : Math.PI) : (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2)) + steer * 0.4, -2.2 * dt, 2.2 * dt);
  // Intersection turns.
  const nearCross = ROAD_AT.some(r => Math.abs(car.x - r) < 14) && ROAD_AT.some(r => Math.abs(car.y - r) < 14);
  if (nearCross && car.turnAt <= 0 && Math.random() < 0.02) {
    car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    car.turnAt = 1.5;
  }
  car.turnAt -= dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  collideBuildings(G, car);
  if (car.x < 40 || car.y < 40 || car.x > WORLD - 40 || car.y > WORLD - 40) {
    // Recycle far-away traffic to a road near the player.
    const p2 = randomRoadPoint();
    car.x = p2.x; car.y = p2.y;
  }
}

function nearestRoadX(x) { let b = ROAD_AT[0], bd = 1e9; for (const r of ROAD_AT) { const d = Math.abs(x - r); if (d < bd) { bd = d; b = r; } } return b; }
function nearestRoadY(y) { return nearestRoadX(y); }

// Player-driven car physics.
export function driveCar(G, car, dt, input) {
  const fwd = input.down('w', 'arrowup') ? 1 : input.down('s', 'arrowdown') ? -0.6 : 0;
  const steer = (input.down('a', 'arrowleft') ? -1 : 0) + (input.down('d', 'arrowright') ? 1 : 0);
  const handbrake = input.down(' ');
  if (fwd > 0) car.speed += car.accel * dt;
  else if (fwd < 0) car.speed -= car.accel * 0.7 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 700 * dt);
  car.speed = clamp(car.speed, -car.max * 0.45, car.max);
  const spd = Math.abs(car.speed) / car.max;
  car.angle += steer * car.grip * spd * (car.speed >= 0 ? 1 : -1) * dt * (handbrake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (collideBuildings(G, car)) {
    if (Math.abs(car.speed) > 260) { G.audio.crash(); damageCar(G, car, 8); G.addShake(6); }
    car.speed *= 0.45;
  }
  car.x = clamp(car.x, 30, WORLD - 30); car.y = clamp(car.y, 30, WORLD - 30);
  if (car.hp <= 40) car.smoke = 1;
  if (car.hp <= 0 && !car.dead) { car.dead = true; G.explosion(car.x, car.y); G.audio.crash(); }
}

export function collideBuildings(G, car) {
  let hit = false;
  const c = { x: car.x, y: car.y, r: car.wid * 0.42 };
  for (const b of G.city.buildings) {
    if (car.x > b.x - 40 && car.x < b.x + b.w + 40 && car.y > b.y - 40 && car.y < b.y + b.h + 40) {
      if (circleRectResolve(c, b)) { car.x = c.x; car.y = c.y; hit = true; }
    }
  }
  return hit;
}

export function damageCar(G, car, n) {
  car.hp -= n;
  if (car.hp <= 0 && !car.dead) { car.dead = true; G.explosion(car.x, car.y); }
}

// Nearest car the player could enter (within 70px).
export function nearestEnterableCar(G) {
  let best = null, bd = 75;
  for (const c of G.cars) {
    if (c.dead) continue;
    const d = dist(G.player.x, G.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
