// people.js — pedestrians, thugs and on-foot police.
// Peds stroll the sidewalks, flee gunfire and panic when a car barrels at them.
// Thugs are mission enemies: they chase and punch/shoot the player. Foot cops
// chase the player when wanted and try to arrest them.
import { clamp, dist, angTo, rand, randi, pick, circleRectResolve } from './util.js';
import { WORLD, onRoad, randomRoadPoint } from './city.js';

const PED_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#facc15', '#2dd4bf'];
const PED_SHIRTS = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];

export function makePed(x, y) {
  return {
    kind: 'ped', x, y, r: 11, angle: rand(0, Math.PI * 2), speed: rand(35, 65),
    color: pick(PED_COLORS), shirt: pick(PED_SHIRTS), state: 'walk', panic: 0,
    target: null, walkT: rand(2, 6), hp: 30, dead: false, fleeT: 0,
  };
}

export function makeThug(x, y, hp = 60) {
  return {
    kind: 'thug', x, y, r: 12, angle: 0, speed: 120, color: '#1f2937', shirt: '#991b1b',
    state: 'chase', panic: 0, target: null, walkT: 0, hp, dead: false, fleeT: 0,
    shootT: rand(1, 2), punchT: 0,
  };
}

export function makeFootCop(x, y) {
  return {
    kind: 'cop', x, y, r: 12, angle: 0, speed: 165, color: '#1e3a8a', shirt: '#1e40af',
    state: 'chase', panic: 0, target: null, walkT: 0, hp: 80, dead: false, fleeT: 0,
    punchT: 0, arrestT: 0,
  };
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint();
    G.peds.push(makePed(p.x + rand(-60, 60), p.y + rand(-60, 60)));
  }
}

// Keep the crowd near the player: recycle distant peds to nearby roads.
export function maintainPeds(G) {
  const p = G.player;
  G.peds = G.peds.filter(pd => !pd.dead || pd.deadT < 6);
  for (const pd of G.peds) if (pd.dead) pd.deadT = (pd.deadT || 0) + 1 / 60;
  while (G.peds.filter(pd => !pd.dead).length < 26) {
    const q = randomRoadPoint();
    const near = { x: p.x + (q.x - p.x) * 0.2 + rand(-300, 300), y: p.y + (q.y - p.y) * 0.2 + rand(-300, 300) };
    G.peds.push(makePed(clamp(near.x, 60, WORLD - 60), clamp(near.y, 60, WORLD - 60)));
  }
  for (const pd of G.peds) {
    if (!pd.dead && dist(pd.x, pd.y, p.x, p.y) > 1400) {
      const q = randomRoadPoint();
      pd.x = clamp(p.x + rand(-500, 500), 60, WORLD - 60);
      pd.y = clamp(p.y + rand(-500, 500), 60, WORLD - 60);
    }
  }
}

export function updatePerson(G, pd, dt) {
  if (pd.dead) return;
  const p = G.player;
  const dPlayer = dist(pd.x, pd.y, p.x, p.y);
  // Panic: gunfire nearby, or a fast car close by.
  if (G.gunfireT > 0 && dPlayer < 500) pd.panic = Math.max(pd.panic, 1.5);
  if (pd.kind === 'ped') {
    if (pd.panic > 0) {
      pd.panic -= dt;
      const a = angTo(p.x, p.y, p.x, p.y) + Math.PI;
      pd.x += Math.cos(a) * 170 * dt; pd.y += Math.sin(a) * 170 * dt;
      pd.angle = a;
    } else {
      pd.walkT -= dt;
      if (pd.walkT <= 0) {
        pd.walkT = rand(2, 6);
        pd.angle = pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rand(-0.2, 0.2);
      }
      pd.x += Math.cos(pd.angle) * pd.speed * dt;
      pd.y += Math.sin(pd.angle) * pd.speed * dt;
      if (!onRoad(pd.x, pd.y) && Math.random() < 0.02) pd.angle += Math.PI / 2;
    }
  } else if (pd.kind === 'thug') {
    const a = angTo(pd.x, pd.y, p.x, p.y);
    pd.angle = a;
    const d = dPlayer;
    // Separation: don't pile onto the same spot as other thugs/cops.
    for (const o of G.peds) {
      if (o === pd || o.dead || (o.kind !== 'thug' && o.kind !== 'cop')) continue;
      const dd = dist(pd.x, pd.y, o.x, o.y);
      if (dd < 30 && dd > 0.01) { pd.x += (pd.x - o.x) / dd * 40 * dt; pd.y += (pd.y - o.y) / dd * 40 * dt; }
    }
    if (d > 34) { pd.x += Math.cos(a) * pd.speed * dt; pd.y += Math.sin(a) * pd.speed * dt; }
    pd.shootT -= dt;
    if (d < 420 && pd.shootT <= 0 && p.inCar === null) {
      pd.shootT = rand(1.4, 2.4);
      G.enemyShoot(pd.x, pd.y, a);
    }
    if (d < 30) {
      pd.punchT -= dt;
      if (pd.punchT <= 0) { pd.punchT = 0.9; G.hurtPlayer(8, pd.x, pd.y); G.audio.punch(); }
    }
  } else if (pd.kind === 'cop') {
    const a = angTo(pd.x, pd.y, p.x, p.y);
    pd.angle = a;
    if (p.inCar) {
      // Foot cop can't catch a car: jog after it, then give up and radio a car.
      pd.x += Math.cos(a) * pd.speed * 0.7 * dt; pd.y += Math.sin(a) * pd.speed * 0.7 * dt;
      if (dPlayer > 700) pd.dead = true; // despawn, replaced by a cruiser
    } else {
      if (dPlayer > 26) { pd.x += Math.cos(a) * pd.speed * dt; pd.y += Math.sin(a) * pd.speed * dt; }
      else {
        pd.arrestT += dt;
        if (pd.arrestT > 2.5) G.busted('A Solmar PD officer cuffed you on the sidewalk.');
      }
    }
  }
  // Building collision + world clamp.
  const c = { x: pd.x, y: pd.y, r: pd.r };
  for (const b of G.city.buildings) {
    if (pd.x > b.x - 30 && pd.x < b.x + b.w + 30 && pd.y > b.y - 30 && pd.y < b.y + b.h + 30) {
      if (circleRectResolve(c, b)) { pd.x = c.x; pd.y = c.y; }
    }
  }
  pd.x = clamp(pd.x, 30, WORLD - 30); pd.y = clamp(pd.y, 30, WORLD - 30);
}
