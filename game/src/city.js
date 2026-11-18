// city.js — Solmar City: layout, districts, buildings, roads, landmarks, pickups.
// The city is a 3600x3600 grid. Roads run every 400px; blocks between them hold
// buildings, parks, parking lots and plazas. The south edge is Solmar Beach and the bay.
import { makeRng, randi, pick } from './util.js';

export const WORLD = 3600;
export const ROAD_AT = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
export const ROAD_W = 96;

export function buildCity(seed = 7) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const lots = [];
  // District per block column/row: 0 downtown, 1 marina, 2 suburbs, 3 industrial.
  function district(bx, by) {
    const cx = bx * 400 + 200, cy = by * 400 + 200;
    const dDown = Math.hypot(cx - 1800, cy - 1600);
    if (cy > 3200) return 'beach';
    if (dDown < 750) return 'downtown';
    if (cx > 2900) return 'industrial';
    if (cy < 700 || cx < 500) return 'suburbs';
    return 'midtown';
  }
  const palette = {
    downtown: ['#7a6a8f', '#5d6f8a', '#8a7a5d', '#6f7f6a', '#93706a'],
    midtown: ['#b08d6a', '#8a7a6e', '#a08a7a', '#7d8a96', '#c0a080'],
    suburbs: ['#d8b48f', '#e0c8a0', '#c8a888', '#b8c0a0'],
    industrial: ['#8a8a86', '#707a72', '#9a8a7a'],
    beach: ['#e8d8a8'],
  };
  for (let bx = 0; bx < 9; bx++) {
    for (let by = 0; by < 9; by++) {
      const x0 = bx * 400 + 248, y0 = by * 400 + 248, w = 304, h = 304;
      const d = district(bx, by);
      if (d === 'beach') { // sand, palms, no buildings
        for (let i = 0; i < 5; i++) trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, palm: true });
        continue;
      }
      if (rng() < 0.16 && d !== 'downtown') { // park block
        parks.push({ x: x0, y: y0, w, h });
        for (let i = 0; i < 8; i++) trees.push({ x: x0 + 20 + rng() * (w - 40), y: y0 + 20 + rng() * (h - 40), palm: false });
        continue;
      }
      if (rng() < 0.12) { // parking lot block
        lots.push({ x: x0, y: y0, w, h });
        continue;
      }
      const n = d === 'downtown' ? 1 : (rng() < 0.5 ? 2 : 4);
      if (n === 1) {
        buildings.push(makeBuilding(x0 + 30, y0 + 30, w - 60, h - 60, d, palette, rng, true));
      } else if (n === 2) {
        buildings.push(makeBuilding(x0 + 14, y0 + 40, w / 2 - 30, h - 80, d, palette, rng, false));
        buildings.push(makeBuilding(x0 + w / 2 + 16, y0 + 40, w / 2 - 30, h - 80, d, palette, rng, false));
      } else {
        const hw = w / 2, hh = h / 2;
        for (const [ox, oy] of [[0, 0], [hw, 0], [0, hh], [hw, hh]]) {
          buildings.push(makeBuilding(x0 + ox + 12, y0 + oy + 12, hw - 24, hh - 24, d, palette, rng, false));
        }
      }
      if (rng() < 0.7) trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, palm: d === 'beach' });
    }
  }
  // Street lamps along roads.
  for (const r of ROAD_AT) for (let t = 300; t < WORLD; t += 400) {
    lamps.push({ x: r + 62, y: t }); lamps.push({ x: t, y: r - 62 });
  }
  return {
    buildings, trees, lamps, parks, lots,
    // Landmarks (name, x, y, colour) — all original.
    landmarks: [
      { name: 'Solmar Safehouse', kind: 'safehouse', x: 600, y: 600, color: '#4ade80' },
      { name: 'Rico’s Garage', kind: 'garage', x: 1000, y: 1400, color: '#f59e0b' },
      { name: 'First Solmar Bank', kind: 'bank', x: 1800, y: 1800, color: '#facc15' },
      { name: 'Solmar General Hospital', kind: 'hospital', x: 2600, y: 1000, color: '#f87171' },
      { name: 'Bayview Pier', kind: 'pier', x: 1800, y: 3450, color: '#38bdf8' },
      { name: 'The Neon Palms Club', kind: 'club', x: 2200, y: 2200, color: '#e879f9' },
      { name: 'Port Solmar Docks', kind: 'docks', x: 3200, y: 2600, color: '#94a3b8' },
      { name: 'Solmar PD HQ', kind: 'pd', x: 1400, y: 2600, color: '#60a5fa' },
    ],
    // Cash stashes at intersections, so they are always reachable.
    stashes: [
      { x: 600, y: 1000 }, { x: 2400, y: 600 }, { x: 3200, y: 1800 }, { x: 800, y: 3000 },
      { x: 2600, y: 2600 }, { x: 1400, y: 600 }, { x: 3400, y: 600 }, { x: 600, y: 2200 },
    ],
  };
}

function makeBuilding(x, y, w, h, d, palette, rng, tower) {
  return {
    x, y, w, h, district: d, tall: tower,
    color: pick.call ? palette[d][Math.floor(rng() * palette[d].length)] : palette[d][0],
    roof: rng() < 0.4 ? 'pool' : (rng() < 0.5 ? 'garden' : 'plain'),
    hgt: tower ? 26 + rng() * 30 : 6 + rng() * 10,
  };
}

// --- Road helpers ---------------------------------------------------------
export function nearestRoadCoord(v) {
  let best = ROAD_AT[0], bd = 1e9;
  for (const r of ROAD_AT) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}
export function onRoad(x, y) {
  return ROAD_AT.some(r => Math.abs(x - r) < ROAD_W / 2) || ROAD_AT.some(r => Math.abs(y - r) < ROAD_W / 2);
}
export function roadPointNear(x, y) {
  // Snap a point onto the nearest road centre line.
  const rx = nearestRoadCoord(x), ry = nearestRoadCoord(y);
  return Math.abs(x - rx) < Math.abs(y - ry) ? { x: rx, y } : { x, y: ry };
}
export function landmark(city, kind) {
  return city.landmarks.find(l => l.kind === kind);
}
export function randomRoadPoint() {
  const horizontal = Math.random() < 0.5;
  const r = ROAD_AT[randi(0, ROAD_AT.length - 1)];
  const t = randi(200, 3400);
  return horizontal ? { x: t, y: r } : { x: r, y: t };
}
