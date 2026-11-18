// police.js — the wanted system and the Solmar PD response.
// Stars 0–5. Crimes add heat (with a short cooldown so one incident is one star or
// two); heat decays when the player stays clean and out of sight. Police cruisers
// spawn at the edge of view and ram the player; foot cops chase and arrest.
// At 3+ stars the PD sets up roadblocks ahead of the player.
import { clamp, dist, angTo, angDiff, rand, circleRectResolve } from './util.js';
import { WORLD, randomRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';
import { makeFootCop } from './people.js';

export function createPolice(G) {
  const P = {
    wanted: 0, heat: 0, decayT: 0, crimeCooldown: 0, sirenT: 0,
    setWanted(n, why) {
      if (n > this.wanted) {
        this.wanted = n;
        G.audio.wantedUp();
        if (why) G.toast(why, 3);
      } else this.wanted = n;
      this.heat = n;
    },
    addWanted(n, why) {
      if (this.crimeCooldown > 0 && n <= 1) return;
      this.crimeCooldown = 1.2;
      this.setWanted(Math.min(5, this.wanted + n), why);
    },
    update(dt) {
      this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);
      // Heat decay: clean for a while and out of police sight.
      const nearestCop = this.nearestCopDist();
      if (this.wanted > 0) {
        this.decayT += dt;
        if (this.decayT > 22 && nearestCop > 600) {
          this.decayT = 0;
          this.setWanted(this.wanted - 1);
          if (this.wanted === 0) G.toast('You lost the heat. Stay clean.', 3);
        }
      } else this.decayT = 0;
      // Spawn police to match the wanted level.
      const wantCars = this.wanted === 0 ? 0 : Math.min(this.wanted, 4);
      const cops = G.cars.filter(c => c.police && !c.dead);
      if (cops.length < wantCars && Math.random() < dt * 1.5) this.spawnCruiser();
      if (cops.length > wantCars + 1) {
        const far = cops.sort((a, b) => dist(b.x, b.y, G.player.x, G.player.y) - dist(a.x, a.y, G.player.x, G.player.y))[0];
        far.dead = true;
      }
      // Foot cops at 2–3 stars near the player (at 1 star the cruisers handle it).
      const foot = G.peds.filter(p => p.kind === 'cop' && !p.dead);
      if (this.wanted >= 2 && this.wanted <= 3 && foot.length < this.wanted - 1 && Math.random() < dt * 0.8) {
        const a = rand(0, Math.PI * 2);
        G.peds.push(makeFootCop(G.player.x + Math.cos(a) * 420, G.player.y + Math.sin(a) * 420));
      }
      // Siren wail when police are near.
      this.sirenT -= dt;
      if (this.wanted > 0 && nearestCop < 700 && this.sirenT <= 0) {
        this.sirenT = 1.6;
        G.audio.sirenBurst();
      }
      for (const c of cops) this.chaseCar(c, dt);
    },
    nearestCopDist() {
      let best = 1e9;
      for (const c of G.cars) if (c.police && !c.dead) best = Math.min(best, dist(c.x, c.y, G.player.x, G.player.y));
      for (const p of G.peds) if (p.kind === 'cop' && !p.dead) best = Math.min(best, dist(p.x, p.y, G.player.x, G.player.y));
      return best;
    },
    spawnCruiser() {
      const p = G.player;
      const a = rand(0, Math.PI * 2);
      const x = clamp(p.x + Math.cos(a) * 650, 80, WORLD - 80);
      const y = clamp(p.y + Math.sin(a) * 650, 80, WORLD - 80);
      const rp = randomRoadPoint();
      const c = makeCar(rp.x, rp.y, 'police', { angle: 0 });
      c.siren = 1;
      G.cars.push(c);
    },
    chaseCar(c, dt) {
      const p = G.player;
      const tx = p.inCar ? p.inCar.x : p.x, ty = p.inCar ? p.inCar.y : p.y;
      const target = angTo(c.x, c.y, tx, ty);
      const d = dist(c.x, c.y, tx, ty);
      // Ram speed: faster when far, slower when close so they don't overshoot forever.
      const want = d > 300 ? c.max : d > 90 ? c.max * 0.75 : 260;
      c.speed += clamp(want - c.speed, -600 * dt, 480 * dt);
      const steer = clamp(angDiff(c.angle, target), -1, 1);
      c.angle += steer * 3.4 * clamp(Math.abs(c.speed) / c.max, 0.3, 1) * dt;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      // Ram the player's car.
      if (p.inCar && d < (c.len + p.inCar.len) / 2) {
        p.inCar.speed *= 0.92;
        if (Math.abs(c.speed) > 300) { G.audio.crash(); G.addShake(4); }
        c.speed *= 0.7;
      }
      // Bust the player on foot if a cruiser stops right on them (2+ stars only:
      // at 1 star the PD chases but does not move in for the arrest).
      if (!p.inCar && this.wanted >= 2 && d < 34 && Math.abs(c.speed) < 120) {
        G.bustT += dt;
        if (G.bustT > 2.5) G.busted('A PD cruiser boxed you in and the officers moved in.');
      }
      // Building collision (simple push-out).
      const cc = { x: c.x, y: c.y, r: c.wid * 0.42 };
      for (const b of G.city.buildings) {
        if (c.x > b.x - 40 && c.x < b.x + b.w + 40 && c.y > b.y - 40 && c.y < b.y + b.h + 40) {
          if (circleRectResolve(cc, b)) { c.x = cc.x; c.y = cc.y; c.speed *= 0.6; }
        }
      }
      c.x = clamp(c.x, 30, WORLD - 30); c.y = clamp(c.y, 30, WORLD - 30);
    },
  };
  return P;
}
