// vehicles.js — 7 car types, arcade driving physics, traffic AI, parked cars.
import { clamp, rand, pick, angleDiff, dist } from './util.js';
import { isRoad, collidesBuilding, randomRoadPoint, WORLD } from './city.js';

export const CAR_TYPES = [
  { key: 'vortex', name: 'Vortex GT', color: '#ff2e63', top: 240, accel: 46, brake: 80, steer: 2.9, hp: 120 },
  { key: 'sedan', name: 'Solmar Sedan', color: '#4aa8ff', top: 165, accel: 30, brake: 65, steer: 2.4, hp: 100 },
  { key: 'taxi', name: 'Sunset Taxi', color: '#ffd23f', top: 170, accel: 32, brake: 65, steer: 2.4, hp: 100 },
  { key: 'hatch', name: 'Palm Hatchback', color: '#2ee6a8', top: 150, accel: 28, brake: 60, steer: 2.6, hp: 90 },
  { key: 'van', name: 'Cargo Van', color: '#e8e8e8', top: 135, accel: 22, brake: 55, steer: 2.0, hp: 130 },
  { key: 'truck', name: 'Haul Truck', color: '#ff8c42', top: 120, accel: 18, brake: 50, steer: 1.8, hp: 160 },
  { key: 'cruiser', name: 'PD Cruiser', color: '#1a1a2e', top: 210, accel: 40, brake: 75, steer: 2.7, hp: 140 },
];

export function makeCar(typeKey, x, y, angle, opts = {}) {
  const t = CAR_TYPES.find(c => c.key === typeKey) || CAR_TYPES[1];
  return {
    type: t, x, y, angle: angle || 0, speed: 0, hp: t.hp, maxHp: t.hp,
    parked: !!opts.parked, traffic: !!opts.traffic, police: !!opts.police,
    aiAngle: angle || 0, aiSpeed: opts.aiSpeed || rand(28, 48),
    dead: false, exploded: false, driver: opts.driver !== false,
    w: t.key === 'truck' ? 62 : 46, h: t.key === 'truck' ? 24 : 22,
  };
}

export function spawnTraffic(count, playerX, playerY) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint();
    if (dist(p.x, p.y, playerX, playerY) < 260) continue;
    const horizontal = Math.random() < 0.5;
    const angle = horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const type = pick(CAR_TYPES.filter(t => t.key !== 'cruiser' && t.key !== 'vortex'));
    cars.push(makeCar(type.key, p.x, p.y, angle, { traffic: true }));
  }
  return cars;
}

export function spawnParked(count, playerX, playerY) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint();
    if (dist(p.x, p.y, playerX, playerY) < 200) continue;
    const horizontal = Math.random() < 0.5;
    const off = (Math.random() < 0.5 ? -1 : 1) * 34;
    const angle = horizontal ? 0 : Math.PI / 2;
    const x = horizontal ? p.x + rand(-120, 120) : p.x + off;
    const y = horizontal ? p.y + off : p.y + rand(-120, 120);
    if (collidesBuilding(x, y, 26)) continue;
    const type = pick(CAR_TYPES.filter(t => t.key !== 'cruiser'));
    cars.push(makeCar(type.key, x, y, angle + (Math.random() < 0.5 ? 0 : Math.PI), { parked: true }));
  }
  return cars;
}

// Player driving: arcade physics. dt seconds, input {up,down,left,right,hand}.
export function drivePlayer(car, input, dt) {
  const t = car.type;
  const accel = input.up ? t.accel : 0;
  const braking = input.down ? t.brake : 0;
  car.speed += accel * dt;
  if (braking) car.speed -= Math.sign(car.speed) * braking * dt;
  car.speed -= car.speed * (input.hand ? 2.2 : 0.55) * dt;
  car.speed = clamp(car.speed, -t.top * 0.35, t.top / 3.6);
  const steerAmt = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const grip = input.hand ? 1.6 : 1;
  car.angle += steerAmt * t.steer * grip * dt * clamp(Math.abs(car.speed) / 14, 0, 1) * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!collidesBuilding(nx, car.y, 20)) car.x = nx; else car.speed *= 0.4;
  if (!collidesBuilding(car.x, ny, 20)) car.y = ny; else car.speed *= 0.4;
  car.x = clamp(car.x, 30, WORLD - 30);
  car.y = clamp(car.y, 30, WORLD - 30);
}

export function updateTraffic(cars, dt, player) {
  for (const c of cars) {
    if (!c.traffic || c.dead) continue;
    // Drive along current axis; at intersections sometimes turn.
    const onH = Math.abs(Math.sin(c.angle)) < 0.5;
    const target = c.aiAngle;
    c.angle += angleDiff(c.angle, target) * Math.min(1, dt * 3);
    const sp = c.aiSpeed;
    const nx = c.x + Math.cos(c.angle) * sp * dt;
    const ny = c.y + Math.sin(c.angle) * sp * dt;
    const nearInter = isRoad(nx, ny) && Math.abs(nx % 300) < 60 || Math.abs(ny % 300) < 60;
    if (isRoad(nx, ny) && !collidesBuilding(nx, ny, 20)) { c.x = nx; c.y = ny; }
    else { c.aiAngle += Math.PI / 2; }
    if (nearInter && Math.random() < dt * 0.25) {
      c.aiAngle += (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2;
    }
    // Avoid piling into the player: slow when close ahead
    if (player && dist(c.x, c.y, player.x, player.y) < 70) c.aiSpeed = 12; else c.aiSpeed = clamp(c.aiSpeed + dt * 10, 12, 48);
    // Keep inside world, wrap around edges by turning
    if (c.x < 120 || c.x > WORLD - 120 || c.y < 120 || c.y > WORLD - 120) c.aiAngle += Math.PI;
  }
}

// Simple circle-vs-car collision for bullets / ramming.
export function carHit(car, x, y, r) {
  const dx = x - car.x, dy = y - car.y;
  const ca = Math.cos(-car.angle), sa = Math.sin(-car.angle);
  const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
  return Math.abs(lx) < car.w / 2 + r && Math.abs(ly) < car.h / 2 + r;
}
export function nearestCar(cars, x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of cars) { const d = dist(c.x, c.y, x, y); if (d < bd) { bd = d; best = c; } }
  return best;
}
