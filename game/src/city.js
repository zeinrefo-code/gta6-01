// city.js — Solmar City: 3600x3600 open world, road grid, districts, landmarks.
import { mulberry32, dist } from './util.js';

export const WORLD = 3600;
export const ROAD_STEP = 300;
export const ROAD_HALF = 46;

const ROADS = [];
for (let i = 0; i < 12; i++) ROADS.push(150 + i * ROAD_STEP);

export const LANDMARKS = {
  garage: { name: "Rico's Garage", x: 600, y: 600, color: '#ffb347' },
  club: { name: 'The Neon Palms Club', x: 1800, y: 900, color: '#ff5fa2' },
  hospital: { name: 'Solmar General Hospital', x: 2700, y: 2700, color: '#7fe7ff' },
  pier: { name: 'Bayview Pier', x: 3450, y: 1800, color: '#ffd166' },
  docks: { name: 'Solmar Docks', x: 3000, y: 3450, color: '#9dff6e' },
  bank: { name: 'Bayfront Bank', x: 1500, y: 2100, color: '#e8b4ff' },
  plaza: { name: 'Sunset Plaza', x: 1200, y: 1500, color: '#ff8c69' },
  beach: { name: 'Solmar Beach', x: 3450, y: 600, color: '#7fe7ff' },
};

function districtAt(x, y) {
  if (x > 3150) return 'beach';
  if (x > 2400 && y > 2700) return 'docks';
  if (x < 1200 && y < 1200) return 'downtown';
  if (x > 2100 && y < 1200) return 'marina';
  if (x < 1200 && y > 2400) return 'suburbs';
  if (x > 1800 && y > 1800 && x < 2700 && y < 2700) return 'park';
  return 'downtown';
}

const DISTRICT_COLORS = {
  downtown: '#3a2b52', marina: '#2b3a52', suburbs: '#33482e',
  docks: '#4a3a28', park: '#2e4a2e', beach: '#4a3a52',
};

// Buildings: one or two per block, never on roads, never on landmarks.
const buildings = [];
{
  const rng = mulberry32(20261118);
  for (let bx = 0; bx < 11; bx++) for (let by = 0; by < 11; by++) {
    const x0 = ROADS[bx] + ROAD_HALF + 14, x1 = ROADS[bx + 1] - ROAD_HALF - 14;
    const y0 = ROADS[by] + ROAD_HALF + 14, y1 = ROADS[by + 1] - ROAD_HALF - 14;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const nearLandmark = Object.values(LANDMARKS).some(l => dist(l.x, l.y, cx, cy) < 260);
    if (nearLandmark) continue;
    const n = rng() < 0.45 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const w = 90 + rng() * 90, h = 90 + rng() * 90;
      const ox = n === 1 ? 0 : (k === 0 ? -55 : 55);
      const oy = n === 1 ? 0 : (k === 0 ? -40 : 40);
      const d = districtAt(cx, cy);
      buildings.push({
        x: cx + ox - w / 2, y: cy + oy - h / 2, w, h,
        color: ['#5b4a7a', '#6a4a6e', '#4a5a7a', '#7a5a4a', '#4a6a5a'][Math.floor(rng() * 5)],
        roof: ['#2e2140', '#3a2a3a', '#24303e'][Math.floor(rng() * 3)],
        tall: d === 'downtown' && rng() < 0.5,
        district: d,
      });
    }
  }
  // Landmark buildings (big, drawn distinctly)
  for (const [key, l] of Object.entries(LANDMARKS)) {
    buildings.push({ x: l.x - 70, y: l.y - 55, w: 140, h: 110, color: l.color, roof: '#241a33', tall: key === 'bank', district: 'landmark', landmark: key });
  }
}

// Trees in the park district and along the beach.
const trees = [];
{
  const rng = mulberry32(777);
  for (let i = 0; i < 90; i++) {
    const x = 1850 + rng() * 800, y = 1850 + rng() * 800;
    if (!isRoad(x, y)) trees.push({ x, y, r: 12 + rng() * 10 });
  }
  for (let i = 0; i < 30; i++) trees.push({ x: 3250 + rng() * 250, y: 250 + rng() * 700, r: 12 + rng() * 8 });
}

export function isRoad(x, y) {
  for (const r of ROADS) if (Math.abs(x - r) < ROAD_HALF || Math.abs(y - r) < ROAD_HALF) return true;
  return false;
}
export function isOnRoadAxis(x, y) { return ROADS.some(r => Math.abs(x - r) < 8) || ROADS.some(r => Math.abs(y - r) < 8); }
export function collidesBuilding(x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function nearestRoadPoint(x, y) {
  let best = null, bd = 1e9;
  for (const rx of ROADS) for (const ry of ROADS) {
    const d = dist(x, y, rx, ry);
    if (d < bd) { bd = d; best = { x: rx, y: ry }; }
  }
  // Also snap to nearest road line
  let lx = x, ly = y;
  let bx = ROADS[0]; for (const r of ROADS) if (Math.abs(r - x) < Math.abs(bx - x)) bx = r;
  let by = ROADS[0]; for (const r of ROADS) if (Math.abs(r - y) < Math.abs(by - y)) by = r;
  if (Math.abs(bx - x) < Math.abs(by - y)) lx = bx; else ly = by;
  if (dist(x, y, lx, ly) < bd) return { x: lx, y: ly };
  return best;
}
export function randomRoadPoint(rngFn) {
  const r = rngFn || Math.random;
  const a = ROADS[Math.floor(r() * ROADS.length)];
  const b = ROADS[Math.floor(r() * ROADS.length)];
  return Math.random() < 0.5 ? { x: a, y: 150 + r() * 3300 } : { x: 150 + r() * 3300, y: b };
}
export function getBuildings() { return buildings; }
export function getTrees() { return trees; }
export function getRoads() { return ROADS; }
export function districtColorAt(x, y) { return DISTRICT_COLORS[districtAt(x, y)] || '#3a2b52'; }
export function districtNameAt(x, y) {
  const d = districtAt(x, y);
  return { downtown: 'Downtown', marina: 'Marina', suburbs: 'Suburbs', docks: 'The Docks', park: 'Palm Park', beach: 'Solmar Beach' }[d];
}
