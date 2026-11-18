// render.js — drawing only: camera, city, cars, people, effects, minimap, HUD, menus.
// Top-down sun-soaked Solmar City. All art is drawn in code; no image assets.
// The canvas fills the window; the world is drawn through a camera transform and
// the HUD/menus are drawn in screen space. Menu buttons are registered in
// G.uiButtons (screen coordinates) for click handling.
import { clamp, dist, TAU, fmtMoney } from './util.js';
import { WORLD, ROAD_AT, ROAD_W } from './city.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let GG = null; // the game state of the frame currently being drawn
  const cam = { x: 600, y: 600, shake: 0 };

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function text(s, x, y, size, color, align = 'left', weight = '600') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- World ---------------------------------------------------------------
  function drawWorld(G) {
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
    cam.x += (px - cam.x) * 0.12; cam.y += (py - cam.y) * 0.12;
    if (G.shakeT > 0) { G.shakeT -= 1 / 60; cam.shake = G.shakeAmt; } else cam.shake = 0;
    const sx = (Math.random() - 0.5) * cam.shake, sy = (Math.random() - 0.5) * cam.shake;
    const vx = cam.x - W / 2 + sx, vy = cam.y - H / 2 + sy;
    G.camVX = vx; G.camVY = vy;
    ctx.save();
    ctx.translate(-vx, -vy);
    const x0 = vx - 60, y0 = vy - 60, x1 = vx + W + 60, y1 = vy + H + 60;

    // Ground: grass, then beach sand and the bay along the south edge.
    ctx.fillStyle = '#7fae5a'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(x0, Math.max(y0, 3220), x1 - x0, Math.min(y1, 3520) - Math.max(y0, 3220));
    ctx.fillStyle = '#2f8fc9'; ctx.fillRect(x0, Math.max(y0, 3520), x1 - x0, Math.min(y1, WORLD) - Math.max(y0, 3520));
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 5; i++) {
      const wy = 3540 + i * 8;
      if (wy > y0 && wy < y1) ctx.fillRect(x0 + ((i * 613) % 900), wy, 260, 3);
    }
    // Parks.
    for (const pk of G.city.parks) {
      ctx.fillStyle = '#5da244'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.fillStyle = '#6fbf52'; ctx.fillRect(pk.x + 20, pk.y + 20, pk.w - 40, pk.h - 40);
    }
    // Parking lots.
    for (const lot of G.city.lots) {
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(lot.x + 40 + i * 60, lot.y + 30); ctx.lineTo(lot.x + 40 + i * 60, lot.y + 110); ctx.stroke(); }
    }
    // Roads: asphalt + sidewalks + centre dashes.
    for (const r of ROAD_AT) {
      ctx.fillStyle = '#b9b3a4'; ctx.fillRect(x0, r - ROAD_W / 2 - 10, x1 - x0, ROAD_W + 20);
      ctx.fillRect(r - ROAD_W / 2 - 10, y0, ROAD_W + 20, y1 - y0);
      ctx.fillStyle = '#3a3f47'; ctx.fillRect(x0, r - ROAD_W / 2, x1 - x0, ROAD_W);
      ctx.fillRect(r - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    }
    ctx.fillStyle = '#f2c94c';
    for (const r of ROAD_AT) {
      for (let t = 0; t < WORLD; t += 80) {
        if (t > x0 && t < x1) ctx.fillRect(t, r - 2, 34, 4);
        if (t > y0 && t < y1) ctx.fillRect(r - 2, t, 4, 34);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of ROAD_AT) for (const ry of ROAD_AT) {
      if (rx < x0 || rx > x1 || ry < y0 || ry > y1) continue;
      for (let i = -3; i <= 3; i++) { ctx.fillRect(rx - 40 + i * 12, ry - ROAD_W / 2 + 6, 6, 14); ctx.fillRect(rx - 40 + i * 12, ry + ROAD_W / 2 - 20, 6, 14); }
    }
    // Buildings: drop shadow + roof + rooftop detail.
    for (const b of G.city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x, b.y, b.w, 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      if (b.roof === 'pool') { ctx.fillStyle = '#38bdf8'; rr(b.x + b.w * 0.25, b.y + b.h * 0.25, b.w * 0.5, b.h * 0.4, 6); ctx.fill(); }
      else if (b.roof === 'garden') { ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.22, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 1; i < 4; i++) ctx.fillRect(b.x + 8, b.y + (b.h / 4) * i, b.w - 16, 3); }
      if (b.tall) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(b.x + b.w / 2 - 2, b.y + 6, 4, 12); }
    }
    // Trees and palms.
    for (const t of G.city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      if (t.palm) {
        ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 4, t.y - 14); ctx.stroke();
        ctx.fillStyle = '#3f9e4d';
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.ellipse(t.x + 4 + Math.cos(a) * 10, t.y - 14 + Math.sin(a) * 8, 11, 4, a, 0, TAU); ctx.fill(); }
      } else {
        ctx.fillStyle = '#2f7d32'; ctx.beginPath(); ctx.arc(t.x, t.y, 11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, 7, 0, TAU); ctx.fill();
      }
    }
    // Landmark labels.
    ctx.font = `700 13px ${FONT}`;
    for (const l of G.city.landmarks) {
      if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
      ctx.fillStyle = l.color;
      ctx.beginPath(); ctx.arc(l.x, l.y, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const wdt = ctx.measureText(l.name).width;
      ctx.fillRect(l.x - wdt / 2 - 5, l.y - 30, wdt + 10, 18);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(l.name, l.x, l.y - 17);
    }
    // Cash stashes + pickups.
    for (const s of G.city.stashes) {
      if (s.taken) continue;
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(s.x, s.y, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('$', s.x, s.y + 5);
    }
    for (const pk of G.pickups) {
      if (pk.x < x0 || pk.x > x1 || pk.y < y0 || pk.y > y1) continue;
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff'; rr(pk.x - 11, pk.y - 11, 22, 22, 5); ctx.fill();
        ctx.fillStyle = '#dc2626'; ctx.fillRect(pk.x - 3, pk.y - 8, 6, 16); ctx.fillRect(pk.x - 8, pk.y - 3, 16, 6);
      } else {
        ctx.fillStyle = '#f59e0b'; rr(pk.x - 11, pk.y - 11, 22, 22, 5); ctx.fill();
        ctx.fillStyle = '#111'; ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('R', pk.x, pk.y + 5);
      }
    }
    // Mission marker: pulsing ring + beacon.
    const mk = G.missions.marker();
    if (mk) {
      const pulse = 1 + Math.sin(G.time * 4) * 0.12;
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(mk.x, mk.y, mk.r * pulse, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(250,204,21,0.15)';
      ctx.beginPath(); ctx.arc(mk.x, mk.y, mk.r * pulse, 0, TAU); ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath(); ctx.moveTo(mk.x, mk.y - 46); ctx.lineTo(mk.x - 10, mk.y - 22); ctx.lineTo(mk.x + 10, mk.y - 22); ctx.closePath(); ctx.fill();
    }
    // Cars.
    for (const c of G.cars) {
      if (c.dead) continue;
      if (c.x < x0 - 80 || c.x > x1 + 80 || c.y < y0 - 80 || c.y > y1 + 80) continue;
      drawCar(c, G.time);
    }
    // People.
    for (const pd of G.peds) {
      if (pd.dead) continue;
      if (pd.x < x0 || pd.x > x1 || pd.y < y0 || pd.y > y1) continue;
      drawPerson(pd, G.time);
    }
    // Player.
    if (p.inCar) { /* player drawn inside the car */ }
    else drawPlayer(G, p);
    // Bullets.
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3;
    for (const b of G.bullets) {
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // Particles.
    for (const pt of G.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return { vx, vy };
  }

  function drawCar(c, t) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(-c.len / 2 + 3, -c.wid / 2 + 4, c.len, c.wid, 8); ctx.fill();
    // Wheels.
    ctx.fillStyle = '#111';
    const wl = c.len * 0.32, ww = 4;
    ctx.fillRect(-wl, -c.wid / 2 - 2, 12, ww + 4); ctx.fillRect(wl - 8, -c.wid / 2 - 2, 12, ww + 4);
    ctx.fillRect(-wl, c.wid / 2 - 2, 12, ww + 4); ctx.fillRect(wl - 8, c.wid / 2 - 2, 12, ww + 4);
    // Body.
    ctx.fillStyle = c.color;
    rr(-c.len / 2, -c.wid / 2, c.len, c.wid, 8); ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    rr(-c.len * 0.18, -c.wid / 2 + 4, c.len * 0.36, c.wid - 8, 5); ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillRect(c.len * 0.18, -c.wid / 2 + 5, 5, c.wid - 10);
    // Headlights / taillights.
    ctx.fillStyle = '#fef08a'; ctx.fillRect(c.len / 2 - 2, -c.wid / 2 + 3, 3, 6); ctx.fillRect(c.len / 2 - 2, c.wid / 2 - 9, 3, 6);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(-c.len / 2 - 1, -c.wid / 2 + 3, 3, 6); ctx.fillRect(-c.len / 2 - 1, c.wid / 2 - 9, 3, 6);
    if (c.type === 'taxi') { ctx.fillStyle = '#111'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3); }
    if (c.police) {
      ctx.fillStyle = '#1e3a8a'; ctx.fillRect(-c.len * 0.1, -c.wid / 2, c.len * 0.2, c.wid);
      ctx.fillStyle = '#fff'; ctx.font = `700 8px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('PD', 0, 3);
      const flash = Math.floor(t * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
      ctx.beginPath(); ctx.arc(-4, -c.wid / 2, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
      ctx.beginPath(); ctx.arc(4, -c.wid / 2, 4, 0, TAU); ctx.fill();
    }
    if (c.smoke) {
      ctx.fillStyle = 'rgba(100,100,100,0.5)';
      ctx.beginPath(); ctx.arc(-c.len / 2, 0, 8 + Math.sin(t * 9) * 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(pd, t) {
    const bob = Math.sin(t * 10 + pd.x) * 1.5;
    ctx.save();
    ctx.translate(pd.x, pd.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 6, 9, 5, 0, 0, TAU); ctx.fill();
    // Body.
    ctx.fillStyle = pd.shirt;
    ctx.beginPath(); ctx.arc(0, bob * 0.3, pd.r, 0, TAU); ctx.fill();
    // Head.
    ctx.fillStyle = pd.color;
    ctx.beginPath(); ctx.arc(Math.cos(pd.angle) * 3, Math.sin(pd.angle) * 3 + bob * 0.3, 6, 0, TAU); ctx.fill();
    // Facing tick (gun for thugs/cops).
    if (pd.kind === 'thug' || pd.kind === 'cop') {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(Math.cos(pd.angle) * 8, Math.sin(pd.angle) * 8);
      ctx.lineTo(Math.cos(pd.angle) * 18, Math.sin(pd.angle) * 18); ctx.stroke();
    }
    ctx.restore();
    // HP bar for enemies.
    if ((pd.kind === 'thug' || pd.kind === 'cop') && pd.hp < 80) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(pd.x - 14, pd.y - 22, 28, 5);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(pd.x - 14, pd.y - 22, 28 * clamp(pd.hp / 80, 0, 1), 5);
    }
  }

  function drawPlayer(G, p) {
    const t = G.time;
    const bob = (Math.abs(p.vx) + Math.abs(p.vy)) > 10 ? Math.sin(t * 12) * 1.5 : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 7, 10, 6, 0, 0, TAU); ctx.fill();
    // Mara: teal jacket, dark hair.
    ctx.fillStyle = '#0d9488';
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(Math.cos(p.aim) * 3, Math.sin(p.aim) * 3 + bob * 0.3, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(Math.cos(p.aim) * 3 - Math.cos(p.aim) * 2, Math.sin(p.aim) * 3 - 2, 5, 0, TAU); ctx.fill();
    // Pistol.
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(Math.cos(p.aim) * 9, Math.sin(p.aim) * 9);
    ctx.lineTo(Math.cos(p.aim) * 20, Math.sin(p.aim) * 20); ctx.stroke();
    ctx.restore();
    if (p.invuln > 0 && Math.floor(t * 10) % 2 === 0) { /* blink handled by alpha */ }
  }

  // --- Minimap ---------------------------------------------------------------
  function drawMinimap(G) {
    const S = 190, mx = 16, my = H - S - 16;
    const k = S / WORLD;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,24,0.82)';
    rr(mx - 6, my - 6, S + 12, S + 12, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    rr(mx - 6, my - 6, S + 12, S + 12, 10); ctx.stroke();
    ctx.beginPath(); rr(mx, my, S, S, 6); ctx.clip();
    ctx.fillStyle = '#4a7d3a'; ctx.fillRect(mx, my, S, S);
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(mx, my + 3220 * k, S, 300 * k);
    ctx.fillStyle = '#2f8fc9'; ctx.fillRect(mx, my + 3520 * k, S, 80 * k);
    ctx.fillStyle = '#3a3f47';
    for (const r of ROAD_AT) { ctx.fillRect(mx, my + r * k - 2, S, 4); ctx.fillRect(mx + r * k - 2, my, 4, S); }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const b of G.city.buildings) ctx.fillRect(mx + b.x * k, my + b.y * k, Math.max(2, b.w * k), Math.max(2, b.h * k));
    const mk = G.missions.marker();
    if (mk) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath(); ctx.arc(mx + mk.x * k, my + mk.y * k, 5 + Math.sin(G.time * 5) * 1.5, 0, TAU); ctx.fill();
    }
    for (const c of G.cars) {
      if (c.dead) continue;
      ctx.fillStyle = c.police ? '#ef4444' : '#e5e7eb';
      ctx.fillRect(mx + c.x * k - 1.5, my + c.y * k - 1.5, 3, 3);
    }
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
    ctx.fillStyle = '#2dd4bf';
    ctx.beginPath(); ctx.arc(mx + px * k, my + py * k, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx + px * k, my + py * k, 5, 0, TAU); ctx.stroke();
    ctx.restore();
    text('SOLMAR CITY', mx, my - 10, 11, 'rgba(255,255,255,0.75)', 'left', '700');
  }

  // --- HUD -------------------------------------------------------------------
  function drawHud(G) {
    const p = G.player;
    // Top-left: health + money + score.
    ctx.fillStyle = 'rgba(8,12,24,0.88)'; rr(14, 12, 250, 74, 10); ctx.fill();
    text('MARA VOSS', 26, 34, 13, '#2dd4bf', 'left', '800');
    text(fmtMoney(p.money), 26, 58, 20, '#fff', 'left', '800');
    text(`SCORE ${p.score}`, 150, 58, 13, 'rgba(255,255,255,0.75)');
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(26, 66, 150, 10, 5); ctx.fill();
    ctx.fillStyle = p.health > 30 ? '#22c55e' : '#ef4444';
    rr(26, 66, 150 * clamp(p.health / 100, 0, 1), 10, 5); ctx.fill();
    text('HP', 182, 76, 11, '#fff', 'left', '700');
    // Wanted stars top-right.
    const stars = G.police.wanted;
    ctx.fillStyle = 'rgba(8,12,24,0.88)'; rr(W - 14 - 230, 12, 230, 44, 10); ctx.fill();
    text('WANTED', W - 232, 30, 11, 'rgba(255,255,255,0.7)', 'left', '700');
    for (let i = 0; i < 5; i++) {
      drawStar(W - 26 - i * 24, 34, i < stars);
    }
    if (stars > 0) text(stars >= 3 ? 'PD ON YOUR TAIL' : 'LAY LOW', W - 24, 50, 11, '#fca5a5', 'right', '700');
    // Mission title + objective top-centre.
    const m = G.missions;
    if (m.active || m.storyDone) {
      const title = m.storyDone ? 'STORY COMPLETE' : m.current().title;
      const wdt = Math.max(ctx.measureText(title).width, 420) + 40;
      ctx.fillStyle = 'rgba(8,12,24,0.88)'; rr(W / 2 - wdt / 2, 12, wdt, 58, 10); ctx.fill();
      ctx.font = `800 15px ${FONT}`; ctx.fillStyle = '#facc15'; ctx.textAlign = 'center';
      ctx.fillText(title, W / 2, 34);
      ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText(m.objectiveText(), W / 2, 56);
    }
    // Mission banner.
    if (m.bannerT > 0) {
      ctx.globalAlpha = clamp(m.bannerT, 0, 1);
      ctx.font = `800 26px ${FONT}`;
      const bw = ctx.measureText(m.banner).width + 48;
      ctx.fillStyle = 'rgba(8,12,24,0.85)'; rr(W / 2 - bw / 2, 96, bw, 46, 10); ctx.fill();
      ctx.fillStyle = '#facc15'; ctx.textAlign = 'center';
      ctx.fillText(m.banner, W / 2, 127);
      ctx.globalAlpha = 1;
    }
    // Toasts.
    let ty = 150;
    for (const t of G.toasts) {
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.font = `600 14px ${FONT}`;
      const tw = ctx.measureText(t.text).width + 28;
      ctx.fillStyle = 'rgba(8,12,24,0.8)'; rr(W / 2 - tw / 2, ty, tw, 30, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t.text, W / 2, ty + 20);
      ty += 38;
    }
    ctx.globalAlpha = 1;
    // Speed + car name bottom-right.
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.55);
      ctx.fillStyle = 'rgba(8,12,24,0.88)'; rr(W - 214, H - 76, 200, 62, 10); ctx.fill();
      text(p.inCar.name.toUpperCase(), W - 24, H - 52, 12, 'rgba(255,255,255,0.75)', 'right', '700');
      text(`${kmh}`, W - 24, H - 20, 26, '#fff', 'right', '800');
      text('km/h', W - 70, H - 20, 12, 'rgba(255,255,255,0.7)', 'right');
      if (p.inCar.hp < 100) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(W - 200, H - 40, 100, 7, 3); ctx.fill();
        ctx.fillStyle = p.inCar.hp > 40 ? '#f59e0b' : '#ef4444';
        rr(W - 200, H - 40, 100 * clamp(p.inCar.hp / 100, 0, 1), 7, 3); ctx.fill();
      }
    } else {
      text('WASD move · SHIFT run · E enter car · CLICK shoot · M missions · P save/pause', W - 16, H - 16, 12, 'rgba(255,255,255,0.65)', 'right');
    }
    // Dialogue box.
    if (m.dialogue.length) {
      const d = m.dialogue[0];
      const bw = Math.min(W - 80, 760);
      ctx.fillStyle = 'rgba(8,12,24,0.88)'; rr(W / 2 - bw / 2, H - 168, bw, 92, 12); ctx.fill();
      ctx.strokeStyle = '#2dd4bf'; ctx.lineWidth = 2; rr(W / 2 - bw / 2, H - 168, bw, 92, 12); ctx.stroke();
      text(d.who, W / 2 - bw / 2 + 22, H - 140, 13, '#2dd4bf', 'left', '800');
      ctx.font = `600 15px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      wrapText(d.text, W / 2 - bw / 2 + 22, H - 114, bw - 44, 20);
      text('E / CLICK to continue', W / 2 + bw / 2 - 22, H - 88, 11, 'rgba(255,255,255,0.6)', 'right');
    }
    // Crosshair on foot.
    if (!p.inCar && G.screen === 'play') {
      const mxp = G.input.mouse.x, myp = G.input.mouse.y;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mxp, myp, 9, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mxp - 13, myp); ctx.lineTo(mxp - 5, myp); ctx.moveTo(mxp + 5, myp); ctx.lineTo(mxp + 13, myp);
      ctx.moveTo(mxp, myp - 13); ctx.lineTo(mxp, myp - 5); ctx.moveTo(mxp, myp + 5); ctx.lineTo(mxp, myp + 13); ctx.stroke();
    }
    // Damage vignette.
    if (p.hurtFlash > 0) {
      ctx.fillStyle = `rgba(220,38,38,${clamp(p.hurtFlash * 0.4, 0, 0.4)})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawMinimap(G);
  }

  function drawStar(x, y, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = filled ? '#facc15' : 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const px = Math.cos(a) * 9, py = Math.sin(a) * 9;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function wrapText(s, x, y, maxW, lh) {
    const words = s.split(' ');
    let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
      else line = test;
    }
    ctx.fillText(line, x, yy);
  }

  // --- Screens ---------------------------------------------------------------
  function button(id, label, x, y, w, h, primary) {
    ctx.fillStyle = primary ? '#0d9488' : 'rgba(255,255,255,0.12)';
    rr(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = primary ? '#2dd4bf' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    rr(x, y, w, h, 10); ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 6, 17, '#fff', 'center', '700');
    GG.uiButtons.push({ id, x, y, w, h });
  }

  function drawTitle(G) {
    // Sun-soaked title backdrop: gradient sky + skyline silhouette.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ff9a5a'); g.addColorStop(0.5, '#f472b6'); g.addColorStop(1, '#312e81');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20,10,40,0.55)';
    for (let i = 0; i < 24; i++) {
      const bx = (i / 24) * W, bh = 120 + ((i * 97) % 180);
      ctx.fillRect(bx + 8, H - bh - 120, W / 24 - 16, bh);
    }
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(W * 0.78, H * 0.2, 46, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, H - 120, W, 120);
    text('SOLMAR HEAT', W / 2, H * 0.3, 84, '#fff', 'center', '900');
    text('AN OPEN-WORLD CRIME STORY  ·  SOLMAR CITY', W / 2, H * 0.3 + 44, 19, '#fde68a', 'center', '700');
    text('Steal cars. Run missions. Outrun the Solmar PD. Own the city.', W / 2, H * 0.3 + 76, 16, 'rgba(255,255,255,0.85)', 'center');
    const cx = W / 2 - 150;
    let y = H * 0.46;
    G.uiButtons = [];
    button('continue', G.saveExists ? '▶  Continue — ' + G.saveSummary : '▶  Continue (no save yet)', cx, y, 300, 48, !!G.saveExists); y += 60;
    button('new', 'NEW GAME', cx, y, 300, 48, true); y += 60;
    button('howto', 'HOW TO PLAY', cx, y, 300, 48, false); y += 60;
    button('missions', 'MISSION LIST', cx, y, 300, 48, false); y += 72;
    text('WASD move · E enter / exit car · Mouse aim · Click shoot · Shift run · P pause & save', W / 2, y, 13, 'rgba(255,255,255,0.7)', 'center');
    text('A 100% original game. Not affiliated with Rockstar Games or Grand Theft Auto.', W / 2, H - 24, 12, 'rgba(255,255,255,0.55)', 'center');
  }

  function drawPanel(title, lines, buttons) {
    ctx.fillStyle = 'rgba(5,8,18,0.72)'; ctx.fillRect(0, 0, W, H);
    const bw = 640, bh = 120 + lines.length * 26 + 90;
    const bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
    ctx.fillStyle = '#111827'; rr(bx, by, bw, bh, 14); ctx.fill();
    ctx.strokeStyle = '#2dd4bf'; ctx.lineWidth = 2; rr(bx, by, bw, bh, 14); ctx.stroke();
    text(title, W / 2, by + 52, 30, '#fff', 'center', '800');
    lines.forEach((ln, i) => text(ln, W / 2, by + 96 + i * 26, 15, 'rgba(255,255,255,0.85)', 'center'));
    GG.uiButtons = [];
    let bx2 = W / 2 - (buttons.length * 170) / 2;
    buttons.forEach(b => { button(b.id, b.label, bx2, by + bh - 66, 150, 44, b.primary); bx2 += 170; });
  }

  function drawPaused(G) {
    drawWorld(G);
    ctx.fillStyle = 'rgba(5,8,18,0.66)'; ctx.fillRect(0, 0, W, H);
    text('PAUSED', W / 2, H * 0.32, 54, '#fff', 'center', '900');
    G.uiButtons = [];
    const cx = W / 2 - 150;
    button('resume', 'RESUME', cx, H * 0.42, 300, 48, true);
    button('save', 'SAVE GAME', cx, H * 0.42 + 60, 300, 48, false);
    button('quit', 'QUIT TO TITLE', cx, H * 0.42 + 120, 300, 48, false);
    text(`Money ${fmtMoney(G.player.money)}  ·  Missions done: ${G.missions.index + (G.missions.done ? 1 : 0)} of 5`, W / 2, H * 0.42 + 200, 14, 'rgba(255,255,255,0.75)', 'center');
  }

  function drawEnd(G) {
    drawWorld(G);
    ctx.fillStyle = 'rgba(20,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    const wasted = G.endKind === 'wasted';
    text(wasted ? 'WASTED' : 'BUSTED', W / 2, H * 0.36, 72, wasted ? '#ef4444' : '#60a5fa', 'center', '900');
    text(G.endText || '', W / 2, H * 0.36 + 44, 17, '#fff', 'center');
    text(`You had ${fmtMoney(G.player.money)}  ·  Score ${G.player.score}`, W / 2, H * 0.36 + 76, 15, 'rgba(255,255,255,0.8)', 'center');
    G.uiButtons = [];
    const cx = W / 2 - 150;
    button('retry', 'TRY AGAIN', cx, H * 0.5, 300, 48, true);
    button('quit', 'QUIT TO TITLE', cx, H * 0.5 + 60, 300, 48, false);
  }

  function draw(G) {
    GG = G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    G.uiButtons = [];
    if (G.screen === 'title') { drawTitle(G); return; }
    if (G.screen === 'howto') {
      drawTitle(G);
      drawPanel('HOW TO PLAY', [
        'WASD / Arrows — move (on foot) or drive (in a car).  Shift — sprint.',
        'E — enter / exit the nearest car. Stealing a car raises your wanted level.',
        'Mouse — aim.  Click / hold — shoot.  Space — handbrake while driving.',
        'Stars — the Solmar PD chases you. Lay low and stay clean to cool off.',
        'M — mission list.  P — pause & save.  Your progress saves automatically',
        'after every mission, and anytime with P.',
        'Follow the yellow marker. Complete all 5 missions to own Solmar City.',
      ], [{ id: 'back', label: 'BACK', primary: true }]);
      return;
    }
    if (G.screen === 'missions') {
      drawTitle(G);
      const lines = ['Mara Voss returns to Solmar City. Rico has work — five jobs, one city.'];
      const { STORY } = G;
      STORY.forEach((m, i) => {
        const state = i < G.missions.index || G.missions.storyDone ? '✓ DONE' : (i === G.missions.index && G.missions.active ? '► ACTIVE' : '○ LOCKED');
        lines.push(`${m.title} — ${fmtMoney(m.pay)}   ${state}`);
      });
      drawPanel('MISSION LIST', lines, [{ id: 'back', label: 'BACK', primary: true }]);
      return;
    }
    if (G.screen === 'paused') { drawPaused(G); return; }
    if (G.screen === 'over') { drawEnd(G); return; }
    drawWorld(G);
    drawHud(G);
  }

  return { draw, resize };
}
