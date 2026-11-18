// render.js — camera, city drawing, minimap, HUD, menus.
import { clamp, dist, fmtMoney, fmtTime } from './util.js';
import { WORLD, getBuildings, getTrees, getRoads, LANDMARKS, districtColorAt, districtNameAt } from './city.js';
import { missionMarker, MISSIONS } from './missions.js';

const W = 1280, H = 720;

function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w, h = car.h;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = car.type.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.fillStyle = 'rgba(20,20,40,0.85)';
  ctx.fillRect(-w * 0.18, -h / 2 + 3, w * 0.3, h - 6);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5);
  ctx.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-w / 2, -h / 2 + 3, 3, 5);
  ctx.fillRect(-w / 2, h / 2 - 8, 3, 5);
  if (car.type.key === 'taxi') { ctx.fillStyle = '#111'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('TAXI', -12, 3); }
  if (car.police) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('PD', -6, 3);
    const blink = Math.floor(t * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2222' : '#2266ff';
    ctx.beginPath(); ctx.arc(0, -h / 2 - 2, 4, 0, 7); ctx.fill();
    ctx.fillStyle = blink ? '#2266ff' : '#ff2222';
    ctx.beginPath(); ctx.arc(6, -h / 2 - 2, 4, 0, 7); ctx.fill();
  }
  if (car.hp < car.maxHp * 0.5) {
    ctx.fillStyle = 'rgba(255,100,0,0.7)';
    ctx.beginPath(); ctx.arc(-w / 4, 0, 5 + Math.random() * 3, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.closePath();
}

function drawPerson(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 3, 9, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(4, 0, 4.5, 0, 7); ctx.fill();
  if (p.kind === 'thug') {
    ctx.fillStyle = '#111'; ctx.fillRect(8, -2, 12, 3);
    ctx.fillStyle = '#ff2222'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('!', -14, -12);
  }
  if (p.kind === 'cop') {
    ctx.fillStyle = '#0a1a4a'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('PD', -14, -11);
  }
  if (p.hp < 100 && p.kind !== 'ped') {
    ctx.fillStyle = '#222'; ctx.fillRect(-10, -16, 20, 3);
    ctx.fillStyle = '#ff4444'; ctx.fillRect(-10, -16, 20 * Math.max(0, p.hp / 100), 3);
  }
  ctx.restore();
}

export function drawWorld(ctx, G, t) {
  const cam = G.camera;
  ctx.save();
  ctx.translate(-cam.x + (Math.random() - 0.5) * G.shake, -cam.y + (Math.random() - 0.5) * G.shake);
  const vx0 = cam.x - 40, vy0 = cam.y - 40, vx1 = cam.x + W + 40, vy1 = cam.y + H + 40;
  // Sunset sky gradient ground base
  ctx.fillStyle = '#241a3d';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // District ground tiles
  for (let gx = Math.floor(vx0 / 300) * 300; gx < vx1; gx += 300)
    for (let gy = Math.floor(vy0 / 300) * 300; gy < vy1; gy += 300) {
      ctx.fillStyle = districtColorAt(gx + 150, gy + 150);
      ctx.fillRect(gx + 46, gy + 46, 208, 208);
    }
  // Bay / beach on the east edge
  ctx.fillStyle = '#1b4a6b';
  ctx.fillRect(3300, vy0, 300, vy1 - vy0);
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(3220, vy0, 80, vy1 - vy0);
  // Roads
  for (const r of getRoads()) {
    ctx.fillStyle = '#232030';
    ctx.fillRect(r - 46, vy0, 92, vy1 - vy0);
    ctx.fillRect(vx0, r - 46, vx1 - vx0, 92);
  }
  // Lane markings
  ctx.strokeStyle = 'rgba(255,210,90,0.75)'; ctx.lineWidth = 2; ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const r of getRoads()) { ctx.moveTo(r, vy0); ctx.lineTo(r, vy1); ctx.moveTo(vx0, r); ctx.lineTo(vx1, r); }
  ctx.stroke(); ctx.setLineDash([]);
  // Crosswalks at intersections
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const rx of getRoads()) for (const ry of getRoads()) {
    if (rx < vx0 - 60 || rx > vx1 + 60 || ry < vy0 - 60 || ry > vy1 + 60) continue;
    for (let k = -2; k <= 2; k++) { ctx.fillRect(rx - 40 + k * 16, ry - 46, 8, 12); ctx.fillRect(rx - 40 + k * 16, ry + 34, 8, 12); }
  }
  // Park trees
  for (const tr of getTrees()) {
    if (tr.x < vx0 || tr.x > vx1 || tr.y < vy0 || tr.y > vy1) continue;
    ctx.fillStyle = '#1d5c2e'; ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#2e8b47'; ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.6, 0, 7); ctx.fill();
  }
  // Buildings
  for (const b of getBuildings()) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    if (b.tall) { ctx.fillStyle = 'rgba(255,220,120,0.5)'; for (let i = 0; i < 5; i++) ctx.fillRect(b.x + 12 + i * 16, b.y + 12, 8, 8); }
    if (b.landmark) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(LANDMARKS[b.landmark].name, b.x + b.w / 2, b.y - 8);
      ctx.textAlign = 'left';
    }
  }
  // Mission marker (pulsing yellow diamond + beam)
  const mk = missionMarker(G);
  if (mk && G.state === 'playing') {
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    ctx.fillStyle = 'rgba(255,210,63,0.18)';
    ctx.fillRect(mk.x - 60, mk.y - 60, 120, 120);
    ctx.save(); ctx.translate(mk.x, mk.y); ctx.rotate(Math.PI / 4); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#7a5c00'; ctx.lineWidth = 3;
    ctx.fillRect(-16, -16, 32, 32); ctx.strokeRect(-16, -16, 32, 32); ctx.restore();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼', mk.x, mk.y - 34); ctx.textAlign = 'left';
  }
  // Pickups
  for (const pk of G.pickups) {
    const bob = Math.sin(pk.bob * 3) * 3;
    ctx.save(); ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') { ctx.fillStyle = '#fff'; ctx.fillRect(-11, -11, 22, 22); ctx.fillStyle = '#e63946'; ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6); }
    if (pk.kind === 'cash') { ctx.fillStyle = '#2ee6a8'; ctx.fillRect(-12, -8, 24, 16); ctx.fillStyle = '#064'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('$', -3, 4); }
    if (pk.kind === 'ammo') { ctx.fillStyle = '#ffd23f'; ctx.fillRect(-10, -6, 20, 12); ctx.fillStyle = '#111'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('AMMO', -13, 3); }
    ctx.restore();
  }
  // Cars (parked + traffic + police)
  for (const car of G.cars) { if (!car.dead && car.x > vx0 - 80 && car.x < vx1 + 80 && car.y > vy0 - 80 && car.y < vy1 + 80) drawCar(ctx, car, t); }
  // People
  for (const p of G.people) { if (!p.dead && p.x > vx0 - 40 && p.x < vx1 + 40 && p.y > vy0 - 40 && p.y < vy1 + 40) drawPerson(ctx, p, t); }
  // Player
  const pl = G.player;
  ctx.save(); ctx.translate(pl.x, pl.y); ctx.rotate(pl.aimAngle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 11, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff2e63'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(5, 0, 5.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(8, -2, 16, 4);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('MARA', -14, -15);
  ctx.restore();
  // Bullets
  for (const b of G.bullets) { ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, 7); ctx.fill(); }
  // Particles
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (pt.life / pt.max), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawMinimap(ctx, G) {
  const S = 168, ox = 14, oy = H - S - 30;
  const scale = S / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,24,0.85)';
  roundRect(ctx, ox - 4, oy - 4, S + 8, S + 26, 8); ctx.fill();
  ctx.strokeStyle = '#ff5fa2'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#2b2140'; ctx.fillRect(ox, oy, S, S);
  ctx.fillStyle = '#1b4a6b'; ctx.fillRect(ox + 3300 * scale, oy, S - 3300 * scale, S);
  ctx.strokeStyle = '#4a4460'; ctx.lineWidth = 1;
  for (const r of getRoads()) {
    ctx.beginPath(); ctx.moveTo(ox + r * scale, oy); ctx.lineTo(ox + r * scale, oy + S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, oy + r * scale); ctx.lineTo(ox + S, oy + r * scale); ctx.stroke();
  }
  for (const [k, l] of Object.entries(LANDMARKS)) {
    ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(ox + l.x * scale, oy + l.y * scale, 3.5, 0, 7); ctx.fill();
  }
  const mk = missionMarker(G);
  if (mk) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(ox + mk.x * scale, oy + mk.y * scale, 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke(); }
  ctx.fillStyle = '#ff2e63';
  const px = ox + clamp(G.player.x, 0, WORLD) * scale, py = oy + clamp(G.player.y, 0, WORLD) * scale;
  ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('SOLMAR CITY · ' + districtNameAt(G.player.x, G.player.y).toUpperCase(), ox, oy + S + 14);
  ctx.restore();
}

export function drawHUD(ctx, G) {
  const pl = G.player;
  ctx.save();
  // Top-left: identity, money, HP, score
  ctx.fillStyle = 'rgba(10,8,24,0.78)'; roundRect(ctx, 12, 12, 250, 92, 10); ctx.fill();
  ctx.fillStyle = '#ff5fa2'; ctx.font = 'bold 17px sans-serif'; ctx.fillText('MARA VOSS', 24, 36);
  ctx.fillStyle = '#2ee6a8'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(fmtMoney(G.money), 24, 60);
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText('SCORE ' + G.score + '   AMMO ' + G.ammo, 24, 80);
  ctx.fillStyle = '#333'; ctx.fillRect(24, 88, 120, 8);
  ctx.fillStyle = pl.hp > 40 ? '#2ee6a8' : '#ff4444'; ctx.fillRect(24, 88, 120 * clamp(pl.hp / 100, 0, 1), 8);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText('HP ' + Math.max(0, Math.ceil(pl.hp)), 150, 96);
  // Top-center: mission
  if (G.mission) {
    ctx.fillStyle = 'rgba(10,8,24,0.78)';
    const mw = 430; roundRect(ctx, W / 2 - mw / 2, 12, mw, 58, 10); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(G.mission.title, W / 2, 34);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
    ctx.fillText(G.mission.objective, W / 2, 56);
    ctx.textAlign = 'left';
    if (G.missionTimer > 0) {
      ctx.fillStyle = G.missionTimer < 30 ? '#ff4444' : '#fff';
      ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⏱ ' + fmtTime(G.missionTimer), W / 2, 92);
      ctx.textAlign = 'left';
    }
  } else if (G.storyDone) {
    ctx.fillStyle = 'rgba(10,8,24,0.78)'; roundRect(ctx, W / 2 - 150, 12, 300, 34, 10); ctx.fill();
    ctx.fillStyle = '#2ee6a8'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('FREE ROAM · STORY COMPLETE', W / 2, 34); ctx.textAlign = 'left';
  }
  // Top-right: wanted
  ctx.fillStyle = 'rgba(10,8,24,0.78)'; roundRect(ctx, W - 232, 12, 220, G.wanted > 0 ? 76 : 54, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('WANTED', W - 220, 34);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd23f' : '#444';
    ctx.font = '20px sans-serif'; ctx.fillText('★', W - 220 + i * 24, 56);
  }
  if (G.wanted > 0) {
    ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText('PD ON YOUR TAIL', W - 220, 72);
  }
  // Bottom-right: car / speedometer
  if (G.inCar && G.car) {
    ctx.fillStyle = 'rgba(10,8,24,0.78)'; roundRect(ctx, W - 262, H - 92, 250, 80, 10); ctx.fill();
    ctx.fillStyle = '#7fe7ff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(G.car.type.name.toUpperCase(), W - 250, H - 64);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif';
    ctx.fillText(Math.round(Math.abs(G.car.speed) * 3.6) + ' km/h', W - 250, H - 34);
    ctx.fillStyle = '#333'; ctx.fillRect(W - 250, H - 26, 150, 7);
    ctx.fillStyle = G.car.hp > 40 ? '#2ee6a8' : '#ff4444';
    ctx.fillRect(W - 250, H - 26, 150 * clamp(G.car.hp / G.car.maxHp, 0, 1), 7);
    ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText('CAR HP', W - 92, H - 19);
  } else {
    ctx.fillStyle = 'rgba(10,8,24,0.6)'; roundRect(ctx, W - 262, H - 52, 250, 40, 10); ctx.fill();
    ctx.fillStyle = '#ccc'; ctx.font = '12px sans-serif';
    ctx.fillText('On foot · E to enter a car · Click to shoot', W - 250, H - 27);
  }
  // Toasts
  let ty = 120;
  for (const toast of G.toasts) {
    ctx.globalAlpha = Math.min(1, toast.life);
    ctx.fillStyle = 'rgba(10,8,24,0.85)'; roundRect(ctx, 12, ty, 300, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.font = '13px sans-serif'; ctx.fillText(toast.text, 24, ty + 20);
    ctx.globalAlpha = 1; ty += 36;
  }
  // Banner
  if (G.bannerText) {
    ctx.globalAlpha = Math.min(1, G.bannerLife);
    ctx.fillStyle = 'rgba(10,8,24,0.82)';
    ctx.fillRect(0, H / 2 - 150, W, 86);
    ctx.fillStyle = '#ff5fa2'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(G.bannerText, W / 2, H / 2 - 112);
    ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
    ctx.fillText(G.bannerSub || '', W / 2, H / 2 - 82);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  // Dialogue box
  if (G.dialogue && G.dialogueIdx < G.dialogue.length) {
    ctx.fillStyle = 'rgba(10,8,24,0.9)'; roundRect(ctx, W / 2 - 330, H - 150, 660, 74, 10); ctx.fill();
    ctx.strokeStyle = '#ff5fa2'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
    ctx.fillText(G.dialogue[G.dialogueIdx], W / 2 - 310, H - 118);
    ctx.fillStyle = '#ffd23f'; ctx.font = '12px sans-serif';
    ctx.fillText('Click or press SPACE to continue…', W / 2 - 310, H - 92);
  }
  // Controls hint
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px sans-serif';
  ctx.fillText('WASD move · E car · Click shoot · Shift run · P pause · M mute', 14, H - 196 > 120 ? H - 196 : 120);
  ctx.restore();
}

export function drawTitle(ctx, G) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#ff7e5f'); grad.addColorStop(0.45, '#feb47b'); grad.addColorStop(0.7, '#7b2f8e'); grad.addColorStop(1, '#1a0b2e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff2e63'; ctx.beginPath(); ctx.arc(W / 2, 300, 150, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(W / 2, 300, 120, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a0b2e';
  for (let i = 0; i < 14; i++) { const bx = 180 + i * 70; ctx.fillRect(bx, 430 + (i % 3) * 40, 46, 200); }
  ctx.fillStyle = '#ff5fa2'; ctx.font = 'bold 84px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', W / 2, 150);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story · Solmar City', W / 2, 190);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 16px sans-serif';
  ctx.fillText('MARA VOSS is back — and Solmar City is about to remember her name.', W / 2, 540);
  const items = [];
  if (G.saveExists) items.push('CONTINUE');
  items.push('NEW GAME');
  items.push('HOW TO PLAY');
  items.push('MISSION LIST');
  G.titleItems = items;
  ctx.restore();
  // Draw menu as buttons via DOM-free canvas rows
  drawMenuRows(ctx, G, items, 585);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('A 100% original game. Not affiliated with Rockstar Games or Grand Theft Auto.', W / 2, H - 18);
  ctx.fillText('WASD move · E enter/exit car · Mouse aim · Click shoot · Shift run · P pause · M mute', W / 2, H - 38);
  ctx.restore();
}

function drawMenuRows(ctx, G, items, startY) {
  // Store clickable rects for mouse handling.
  G.menuRects = [];
  items.forEach((it, i) => {
    const y = startY + i * 44 - 200 + 200; // rows start at startY
    const ry = 560 + i * 46;
    const sel = G.menuSel === i;
    ctx.fillStyle = sel ? '#ff2e63' : 'rgba(10,8,24,0.75)';
    roundRect(ctx, W / 2 - 180, ry, 360, 38, 8); ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText((sel ? '▶ ' : '') + it, W / 2, ry + 24);
    ctx.textAlign = 'left';
    G.menuRects.push({ x: W / 2 - 180, y: ry, w: 360, h: 38, label: it });
  });
}

export function drawPause(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,24,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, 240);
  ctx.font = '16px sans-serif';
  ctx.fillText('Game autosaved. Press P or click Resume to keep playing.', W / 2, 280);
  ctx.fillStyle = '#2ee6a8'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Money ' + fmtMoney(G.money) + '   ·   Score ' + G.score + '   ·   Mission ' + (G.mission ? G.mission.title : 'Free roam'), W / 2, 320);
  ctx.restore();
  drawMenuRows(ctx, G, ['RESUME', 'SAVE & TITLE'], 0);
}

export function drawEndScreen(ctx, G, kind) {
  ctx.save();
  ctx.fillStyle = kind === 'busted' ? 'rgba(10,20,60,0.85)' : 'rgba(60,10,20,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', W / 2, 300);
  ctx.font = '18px sans-serif';
  ctx.fillText(kind === 'busted' ? 'The Solmar PD took you in. You paid a $200 fine.' : 'Mara went down. The city keeps moving.', W / 2, 350);
  ctx.fillStyle = '#ffd23f'; ctx.font = '15px sans-serif';
  ctx.fillText('Press ENTER to wake up at Solmar General Hospital', W / 2, 400);
  ctx.restore();
}

export function drawHowTo(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,24,0.92)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff5fa2'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('HOW TO PLAY', W / 2, 120);
  ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
  const lines = [
    'WASD / Arrow keys — move Mara on foot, drive when in a car',
    'E — enter / exit the nearest car (stealing one raises your wanted level)',
    'Mouse — aim · Left click — shoot (pistol on foot, drive-by from a car)',
    'Shift — run · P — pause & autosave · M — mute sound',
    'Wanted stars — crimes raise them; lay low and out of sight to cool off',
    'At 2+ stars foot cops will try to arrest you. At 0 HP you are WASTED.',
    'Follow the yellow marker to complete 5 story missions with Rico.',
    'Earn cash, buy nothing — just survive Solmar City.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 190 + i * 44));
  ctx.fillStyle = '#ffd23f'; ctx.font = '15px sans-serif';
  ctx.fillText('Press ESC / click to go back', W / 2, 580);
  ctx.restore();
}

export function drawMissionList(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,24,0.92)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff5fa2'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('MISSION LIST', W / 2, 120);
  ctx.font = '17px sans-serif';
  MISSIONS.forEach((m, i) => {
    const done = G.missionIdx > i || G.storyDone;
    const cur = G.missionIdx === i && !G.storyDone;
    ctx.fillStyle = done ? '#2ee6a8' : cur ? '#ffd23f' : '#fff';
    ctx.fillText((done ? '✓ ' : cur ? '▶ ' : '· ') + m.title + ' — ' + m.objective + '  (+$' + m.reward + ')', W / 2, 190 + i * 52);
  });
  ctx.fillStyle = '#ffd23f'; ctx.font = '15px sans-serif';
  ctx.fillText('Press ESC / click to go back', W / 2, 580);
  ctx.restore();
}
