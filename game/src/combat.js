// combat.js — bullets, explosions, particles, pickups, player health.
// Shooting is mouse-aimed on foot; drive-by shots come from the car window.
// Bullets hit peds, thugs, cops, cars and buildings; kills pay out cash and raise heat.
import { clamp, dist, angTo } from './util.js';

export function createCombat(G) {
  return {
    fireBullet(x, y, angle, fromPlayer, speed = 780) {
      G.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.9, fromPlayer });
      G.particles.push({ x, y, vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, life: 0.12, max: 0.12, color: '#fde68a', size: 5 });
      G.gunfireT = 1.2;
    },
    updateBullets(dt) {
      for (const b of G.bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        // Buildings stop bullets.
        for (const bd of G.city.buildings) {
          if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { b.life = 0; G.spark(b.x, b.y); break; }
        }
        if (b.life <= 0) continue;
        if (b.fromPlayer) {
          for (const pd of G.peds) {
            if (pd.dead) continue;
            if (dist(b.x, b.y, pd.x, pd.y) < pd.r + 4) {
              b.life = 0; this.hitPerson(pd, 34, true); break;
            }
          }
          if (b.life <= 0) continue;
          for (const c of G.cars) {
            if (c.dead || c === G.player.inCar) continue;
            if (Math.abs(b.x - c.x) < c.len / 2 + 4 && Math.abs(b.y - c.y) < c.wid / 2 + 4) {
              b.life = 0; damageCarTarget(G, c, 20); G.spark(b.x, b.y); break;
            }
          }
        } else {
          const p = G.player;
          if (p.inCar) {
            const c = p.inCar;
            if (Math.abs(b.x - c.x) < c.len / 2 + 4 && Math.abs(b.y - c.y) < c.wid / 2 + 4) {
              b.life = 0; damageCarTarget(G, c, 8); break;
            }
          } else if (dist(b.x, b.y, p.x, p.y) < 14) {
            b.life = 0; G.hurtPlayer(9, b.x, b.y);
          }
        }
      }
      G.bullets = G.bullets.filter(b => b.life > 0);
    },
    hitPerson(pd, dmg, byPlayer) {
      pd.hp -= dmg;
      G.blood(pd.x, pd.y);
      if (pd.hp > 0) {
        if (pd.kind === 'ped') { pd.panic = 2; if (byPlayer) G.addWanted(1, 'You shot a pedestrian'); }
        return;
      }
      pd.dead = true; pd.deadT = 0;
      G.addCashDrop(pd.x, pd.y, pd.kind === 'ped' ? 25 : 120);
      if (byPlayer) {
        if (pd.kind === 'cop') G.addWanted(2, 'You shot a police officer');
        else if (pd.kind === 'thug') { G.player.score += 50; }
        else G.addWanted(1, 'You killed a pedestrian');
      }
      G.missions.onKill(pd);
    },
    updateParticles(dt) {
      for (const pt of G.particles) {
        pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.96; pt.vy *= 0.96; pt.life -= dt;
      }
      G.particles = G.particles.filter(pt => pt.life > 0);
    },
  };
}

function damageCarTarget(G, c, n) {
  c.hp -= n;
  if (c.hp <= 0 && !c.dead) { c.dead = true; G.explosion(c.x, c.y); G.audio.crash(); }
}
