// util.js — small shared helpers: math, random, geometry. No game logic here.
export const TAU = Math.PI * 2;
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function rand(a = 1, b) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); }
export function randi(a, b) { return Math.floor(rand(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function chance(p) { return Math.random() < p; }
// Deterministic seeded RNG (mulberry32) for city layout and staged screenshots.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
// Circle vs axis-aligned rect collision resolve: pushes the circle out, returns true on hit.
export function circleRectResolve(c, r) {
  const nx = clamp(c.x, r.x, r.x + r.w), ny = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - nx, dy = c.y - ny, d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    c.x = nx + (dx / d) * c.r; c.y = ny + (dy / d) * c.r;
  } else {
    // Centre inside the rect: push out along the smallest penetration axis.
    const l = c.x - r.x, rr = r.x + r.w - c.x, t = c.y - r.y, b = r.y + r.h - c.y;
    const m = Math.min(l, rr, t, b);
    if (m === l) c.x = r.x - c.r; else if (m === rr) c.x = r.x + r.w + c.r;
    else if (m === t) c.y = r.y - c.r; else c.y = r.y + r.h + c.r;
  }
  return true;
}
