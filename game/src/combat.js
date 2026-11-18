// combat.js — mouse-aimed shooting, bullets, explosions, particles, pickups.
import { dist, rand, pick } from './util.js';
import { carHit } from './vehicles.js';

export function shoot(G, fromX, fromY, angle, friendly) {
  const b = { x: fromX + Math.cos(angle) * 26, y: fromY + Math.sin(angle) * 26, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620, life: 0.9, friendly: !!friendly, dmg: friendly ? 34 : 12 };
  G.bullets.push(b);
  G.audioShot();
  G.particles.push({ x: b.x, y: b.y, vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, life: 0.12, max: 0.12, color: '#ffd23f', size: 5 });
  G.gunfireAt = { x: fromX, y: fromY };
  if (friendly) G.ammo = Math.max(0, (G.ammo || 0) - 1);
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    if (b.friendly) {
      // Hit thugs / cops
      for (const person of G.people) {
        if (person.dead || person.kind === 'ped') continue;
        if (dist(b.x, b.y, person.x, person.y) < 16) {
          person.hp -= b.dmg; b.life = 0;
          G.spawnParticles(b.x, b.y, '#ff5a5a', 6);
          if (person.hp <= 0) {
            person.dead = true;
            G.addScore(50, 'Enemy down +50');
            if (person.kind === 'cop') G.addWanted(2, 'Cop down');
            G.dropPickup(person.x, person.y);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit cars (not the player's own)
      for (const car of G.cars) {
        if (car === G.car || car.dead) continue;
        if (carHit(car, b.x, b.y, 4)) {
          car.hp -= b.dmg; b.life = 0;
          G.spawnParticles(b.x, b.y, '#ffb347', 6);
          if (car.hp <= 0 && !car.exploded) explodeCar(G, car);
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit peds (crime!)
      for (const person of G.people) {
        if (person.dead || person.kind !== 'ped') continue;
        if (dist(b.x, b.y, person.x, person.y) < 14) {
          person.hp -= b.dmg; b.life = 0;
          if (person.hp <= 0) { person.dead = true; G.addWanted(1, 'Pedestrian hit'); G.addScore(-25, ''); }
          break;
        }
      }
    } else {
      // Enemy bullet vs player / player car
      const px = G.player.x, py = G.player.y;
      if (dist(b.x, b.y, px, py) < 16) {
        b.life = 0;
        if (G.inCar && G.car) { G.car.hp -= b.dmg; if (G.car.hp <= 0 && !G.car.exploded) explodeCar(G, G.car); }
        else { G.player.hp -= b.dmg; G.addShake(4); if (G.player.hp <= 0) G.wasted(); }
      }
    }
  }
  G.bullets = G.bullets.filter(b => b.life > 0);
}

export function explodeCar(G, car) {
  car.exploded = true; car.dead = true;
  G.spawnParticles(car.x, car.y, '#ff6b35', 26);
  G.spawnParticles(car.x, car.y, '#ffd23f', 18);
  G.spawnParticles(car.x, car.y, '#888888', 14);
  G.addShake(10);
  G.audioExplosion();
  if (car === G.car) { G.inCar = false; G.car = null; G.player.hp -= 25; if (G.player.hp <= 0) G.wasted(); }
  if (dist(car.x, car.y, G.player.x, G.player.y) < 90) { G.player.hp -= 20; if (G.player.hp <= 0) G.wasted(); }
}

export function updateParticles(G, dt) {
  for (const pt of G.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy *= 0.94; pt.life -= dt; }
  G.particles = G.particles.filter(p => p.life > 0);
}

export function updatePickups(G, dt) {
  for (const pk of G.pickups) {
    pk.bob += dt;
    if (dist(pk.x, pk.y, G.player.x, G.player.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'health') { G.player.hp = Math.min(100, G.player.hp + 40); G.toast('Health +40'); }
      if (pk.kind === 'cash') { G.money += pk.value; G.addScore(100, 'Cash stash +$' + pk.value); G.toast('Cash +$' + pk.value); }
      if (pk.kind === 'ammo') { G.ammo += 24; G.toast('Ammo +24'); }
      G.audioPickup();
    }
  }
  G.pickups = G.pickups.filter(p => !p.taken);
}

export function spawnPickupNear(G, x, y, kind, value) {
  G.pickups.push({ x: x + rand(-30, 30), y: y + rand(-30, 30), kind, value: value || 0, bob: rand(0, 3), taken: false });
}
