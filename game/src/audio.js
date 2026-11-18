// audio.js — synthesised SFX and a synthwave music loop (WebAudio, no assets).
export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false; this.musicOn = false;
    this.musicTimer = 0; this.beat = 0; this.engineOsc = null; this.engineGain = null;
  }
  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.35; }
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, lowpass) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  shot() { this.noise(0.12, 0.35, 2500); this.blip(180, 0.08, 'square', 0.15, 60); }
  explosion() { this.noise(0.7, 0.5, 500); this.blip(90, 0.5, 'sawtooth', 0.25, 30); }
  pickup() { this.blip(660, 0.09, 'sine', 0.25); setTimeout(() => this.blip(990, 0.12, 'sine', 0.25), 90); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.25), i * 110)); }
  siren() { this.blip(750, 0.35, 'sine', 0.06, 1100); }
  click() { this.blip(440, 0.05, 'sine', 0.15); }
  // Synthwave loop: bassline + pad arpeggio, scheduled per beat.
  update(dt, driving, speed) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 0.24;
      this.beat = (this.beat + 1) % 32;
      const bassNotes = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
      const n = bassNotes[Math.floor(this.beat / 4) % bassNotes.length];
      this.blip(n, 0.22, 'sawtooth', 0.05);
      if (this.beat % 4 === 0) this.blip(n * 4, 0.3, 'triangle', 0.03);
      if (this.beat % 8 === 6) this.blip(880, 0.1, 'sine', 0.03);
    }
    // Engine hum while driving.
    if (driving) {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0.02;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 50 + Math.abs(speed) * 1.4;
      this.engineGain.gain.value = 0.015 + Math.abs(speed) * 0.0004;
    } else if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch (e) {}
      this.engineOsc = null; this.engineGain = null;
    }
  }
}
