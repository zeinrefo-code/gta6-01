// missions.js — the story of Solmar Heat: five missions with objectives and dialogue.
// Mara Voss comes home to Solmar City owing the wrong people money. Rico, an old
// friend who runs a garage, gives her work; each job pays, each job raises the heat.
// All characters, places and gangs are original.
import { dist } from './util.js';
import { landmark } from './city.js';
import { makeThug } from './people.js';
import { makeCar } from './vehicles.js';

export const STORY = [
  {
    id: 0, title: 'M1 · Homecoming', pay: 300,
    intro: [
      { who: 'MARA', text: 'Three years away. Solmar still smells like salt, petrol and bad decisions.' },
      { who: 'RICO (phone)', text: 'Mara! You picked a fine week to come home. I need a driver. Come to my garage — north side, by the safehouse.' },
    ],
    steps: [
      { type: 'goto', x: 600, y: 600, r: 90, text: 'Go to the Solmar Safehouse', say: [{ who: 'RICO', text: 'There she is. You look like trouble, kid. Good — trouble pays. First job is easy: I need a fast car. A Vortex GT is parked by the marina.' }] },
    ],
  },
  {
    id: 1, title: 'M2 · Hot Wheels', pay: 800,
    intro: [
      { who: 'RICO', text: 'The Vortex GT by the marina — bring it to my garage. Don’t ask whose it is. If the owner objects, drive faster.' },
    ],
    steps: [
      { type: 'goto', x: 2600, y: 3000, r: 110, text: 'Steal the Vortex GT at the marina', say: [{ who: 'MARA', text: 'There it is. Purple, loud, probably stolen already. Perfect.' }] },
      { type: 'deliver', x: 1000, y: 1400, r: 110, text: 'Deliver the Vortex GT to Rico’s Garage', say: [{ who: 'RICO', text: 'Beautiful. The client pays cash, no questions. You’re hired, Mara.' }] },
    ],
  },
  {
    id: 2, title: 'M3 · Debt Collection', pay: 1200,
    intro: [
      { who: 'RICO', text: 'The Neon Palms Club owes me twelve hundred. Their bouncers don’t like collectors. Go remind them — and keep the cash.' },
    ],
    steps: [
      { type: 'goto', x: 2200, y: 2200, r: 110, text: 'Go to The Neon Palms Club', say: [{ who: 'BOUNCER', text: 'Rico sent a girl? Bad move. Boys — show her the door.' }], spawnThugs: 3 },
      { type: 'fight', text: 'Deal with the club’s muscle (0/3)', say: [{ who: 'MARA', text: 'That’s the last of them. The cash is in the back office — grab it.' }] },
      { type: 'collect', x: 2200, y: 2200, r: 90, text: 'Grab the cash from the club', say: [{ who: 'MARA', text: 'Twelve hundred, plus a little extra for the trouble.' }] },
    ],
  },
  {
    id: 3, title: 'M4 · The Getaway', pay: 2000,
    intro: [
      { who: 'RICO', text: 'PD traced the Vortex to us. They’re coming for you, Mara — three stars and climbing. Lose them at the pier. Go. NOW.' },
    ],
    steps: [
      { type: 'escape', x: 1800, y: 3450, r: 130, time: 150, text: 'Escape the police — reach Bayview Pier', say: [{ who: 'MARA', text: 'Made it. Rico, the whole city is after me. What’s next?' }, { who: 'RICO', text: 'One last job. The big one. First Solmar Bank. Meet me there when you’re ready.' }] },
    ],
  },
  {
    id: 4, title: 'M5 · Bayfront Heist', pay: 5000,
    intro: [
      { who: 'RICO', text: 'First Solmar Bank, downtown. Crack the vault, grab the cash, and run for the docks. The whole PD will be on you. Make it count.' },
    ],
    steps: [
      { type: 'goto', x: 1800, y: 1800, r: 110, text: 'Go to First Solmar Bank', say: [{ who: 'MARA', text: 'Vault’s open. Alarms screaming. Grab everything and run!' }] },
      { type: 'rob', x: 1800, y: 1800, r: 110, time: 10, text: 'Crack the vault — stay inside the bank (10s)', say: [{ who: 'MARA', text: 'Bags full. Time to disappear.' }] },
      { type: 'escape', x: 3200, y: 2600, r: 130, time: 180, text: 'Escape to Port Solmar Docks', say: [{ who: 'RICO', text: 'You did it, Mara. Solmar is yours now — spend it slow, drive it fast.' }] },
    ],
  },
];

export function createMissions(G) {
  const M = {
    index: 0, step: 0, active: false, done: false, storyDone: false,
    dialogue: [], dialogueT: 0, robT: 0, missionT: 0, kills: 0, killsNeeded: 0,
    targetCar: null, banner: '', bannerT: 0,
    start(i) {
      const m = STORY[i];
      if (!m) return;
      this.index = i; this.step = 0; this.active = true; this.done = false;
      this.missionT = 0; this.kills = 0; this.robT = 0;
      this.say(m.intro);
      this.banner = m.title; this.bannerT = 3;
      this.beginStep();
      G.audio.missionJingle();
    },
    say(lines) { this.dialogue = lines.slice(); this.dialogueT = 0; },
    current() { return STORY[this.index]; },
    stepDef() { const m = this.current(); return m ? m.steps[this.step] : null; },
    beginStep() {
      const s = this.stepDef();
      if (!s) return;
      if (s.spawnThugs) {
        this.killsNeeded = s.spawnThugs;
        for (let i = 0; i < s.spawnThugs; i++) {
          const t = makeThug(s.x + (i - 1) * 90, s.y, 60);
          G.peds.push(t);
        }
      }
      if (this.index === 1 && this.step === 0 && !this.targetCar) {
        const c = makeCar(2600, 3000, 'sport', { angle: 0, parked: true });
        G.cars.push(c); this.targetCar = c;
      }
      if (this.index === 3 && this.step === 0) G.setWanted(3, 'The PD traced the stolen Vortex');
      if (this.index === 4 && this.step === 1) G.setWanted(4, 'Bank alarm tripped');
    },
    advance() {
      const s = this.stepDef();
      if (s && s.say) this.say(s.say);
      this.step++;
      if (this.step >= this.current().steps.length) this.complete();
      else this.beginStep();
    },
    complete() {
      const m = this.current();
      G.player.money += m.pay;
      G.player.score += 500 + m.pay;
      this.active = false; this.done = true;
      this.banner = `${m.title} — COMPLETE  +$${m.pay.toLocaleString('en-US')}`;
      this.bannerT = 4;
      G.audio.missionJingle();
      G.saveGame();
      if (this.index + 1 < STORY.length) {
        setTimeout(() => { if (G.screen === 'play') this.start(this.index + 1); }, 4500);
      } else {
        this.storyDone = true;
        this.banner = 'STORY COMPLETE — Solmar City is yours, Mara.';
        this.bannerT = 6;
      }
    },
    fail(reason) {
      this.active = false;
      G.audio.failJingle();
      G.banner(reason, 4);
    },
    onKill(pd) {
      const s = this.stepDef();
      if (!this.active || !s || s.type !== 'fight') return;
      if (pd.kind === 'thug') {
        this.kills++;
        if (this.kills >= this.killsNeeded) this.advance();
      }
    },
    objectiveText() {
      if (this.storyDone) return 'Story complete — free roam Solmar City. Press M for missions, P to save.';
      if (!this.active) return 'No active mission — drive to the yellow marker or press M.';
      const s = this.stepDef();
      if (!s) return '';
      let t = s.text;
      if (s.type === 'fight') t = `Deal with the club’s muscle (${this.kills}/${this.killsNeeded})`;
      if (s.type === 'rob') t = `Crack the vault — stay inside the bank (${Math.ceil(Math.max(0, s.time - this.robT))}s)`;
      if (s.type === 'escape' && s.time) t += `  (${Math.ceil(Math.max(0, s.time - this.missionT))}s left)`;
      return t;
    },
    marker() {
      const s = this.stepDef();
      if (!this.active || !s || !s.x) return null;
      return { x: s.x, y: s.y, r: s.r || 100 };
    },
    update(dt) {
      if (this.bannerT > 0) this.bannerT -= dt;
      if (this.dialogue.length) {
        this.dialogueT += dt;
        if (this.dialogueT > 6) { this.dialogue.shift(); this.dialogueT = 0; }
      }
      if (!this.active) return;
      const s = this.stepDef();
      if (!s) return;
      this.missionT += dt;
      const p = G.player;
      const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
      if (s.type === 'goto' || s.type === 'collect') {
        if (dist(px, py, s.x, s.y) < s.r) {
          if (s.type === 'collect') { G.player.money += 200; G.audio.pickup(); }
          this.advance();
        }
      } else if (s.type === 'deliver') {
        if (p.inCar === this.targetCar && dist(px, py, s.x, s.y) < s.r) {
          this.targetCar = null;
          this.advance();
        }
      } else if (s.type === 'escape') {
        if (s.time && this.missionT > s.time) { this.fail('You didn’t reach the marker in time.'); this.start(this.index); return; }
        if (dist(px, py, s.x, s.y) < s.r) this.advance();
      } else if (s.type === 'rob') {
        if (dist(px, py, s.x, s.y) < s.r) {
          this.robT += dt;
          if (this.robT >= s.time) this.advance();
        } else this.robT = Math.max(0, this.robT - dt * 2);
      }
    },
  };
  return M;
}
