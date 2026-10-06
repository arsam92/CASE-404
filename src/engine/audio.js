/* CASE 404 — procedural audio engine (Web Audio API).
   Every sound is generated at runtime: no external audio files, no copyright risk.
   Modes of use: short SFX (click, notify, gavel...) and ambient music loops
   (menu / investigate / court / danger) built from detuned drones, sparse plucks
   and filtered noise. Audio starts after the first user gesture (autoplay policy). */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.mode = null;
    this._timer = null;
    this._drone = null;
    this.enabled = true;
    this.volMusic = 0.6;
    this.volSfx = 0.8;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16 * this.volMusic;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5 * this.volSfx;
    this.sfxGain.connect(this.master);
  }

  setVolumes(music, sfx) {
    this.volMusic = music; this.volSfx = sfx;
    if (this.musicGain) this.musicGain.gain.value = 0.16 * music;
    if (this.sfxGain) this.sfxGain.gain.value = 0.5 * sfx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 1 : 0;
  }

  /* ---------------- SFX ---------------- */

  _env(node, t0, a, d, peak) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g);
    return g;
  }

  _osc(type, freq, t0, dur, peak, dest) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    const g = this._env(o, t0, 0.005, dur, peak);
    g.connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }

  _noise(t0, dur, peak, filterFreq, dest) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    src.connect(f);
    const g = this._env(f, t0, 0.005, dur, peak);
    g.connect(dest || this.sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  sfx(name) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'click': this._osc('triangle', 1400, t, 0.05, 0.12); break;
      case 'select': this._osc('triangle', 900, t, 0.06, 0.14); this._osc('triangle', 1200, t + 0.05, 0.06, 0.1); break;
      case 'type': this._osc('square', 2400, t, 0.012, 0.012); break;
      case 'notify': this._osc('sine', 880, t, 0.12, 0.16); this._osc('sine', 1174, t + 0.1, 0.18, 0.14); break;
      case 'threat': {
        this._osc('sawtooth', 110, t, 0.5, 0.2);
        this._osc('sawtooth', 116, t, 0.5, 0.2);
        this._noise(t, 0.35, 0.1, 500);
        break;
      }
      case 'door': this._noise(t, 0.3, 0.16, 260); this._osc('sine', 70, t, 0.3, 0.2); break;
      case 'knock': this._noise(t, 0.08, 0.3, 700); this._noise(t + 0.18, 0.08, 0.3, 700); break;
      case 'camera': this._noise(t, 0.05, 0.25, 4000); this._osc('square', 1800, t + 0.02, 0.04, 0.08); break;
      case 'stamp': this._noise(t, 0.12, 0.5, 900); this._osc('sine', 90, t, 0.15, 0.4); break;
      case 'gavel': this._noise(t, 0.1, 0.6, 1400); this._osc('sine', 120, t, 0.22, 0.5); this._noise(t + 0.25, 0.1, 0.5, 1400); break;
      case 'whoosh': this._noise(t, 0.4, 0.14, 1200); break;
      case 'glitch': { this._noise(t, 0.12, 0.2, 3000); this._osc('square', 220, t, 0.1, 0.1); this._osc('square', 66, t + 0.08, 0.14, 0.12); break; }
      case 'success': [523, 659, 784].forEach((f, i) => this._osc('sine', f, t + i * 0.09, 0.25, 0.12)); break;
      case 'fail': this._osc('sawtooth', 180, t, 0.4, 0.16); this._osc('sawtooth', 90, t + 0.12, 0.45, 0.18); break;
      case 'reveal': this._osc('sine', 660, t, 0.3, 0.14); this._osc('sine', 990, t + 0.12, 0.35, 0.1); break;
    }
  }

  /* ---------------- Ambient music ---------------- */

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (!this.ctx) return;
    this._stopLoop();
    if (!mode || mode === 'none') return;
    this._startLoop(mode);
  }

  _stopLoop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._drone) { try { this._drone.stop(); } catch { } this._drone = null; }
  }

  _startLoop(mode) {
    const t = this.ctx.currentTime;
    // drone
    const roots = { menu: 55, investigate: 49, court: 58.3, danger: 43.7, calm: 65.4 };
    const root = roots[mode] || 49;
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = root;
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = root * 1.007;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = mode === 'danger' ? 320 : 220;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.18, t + 2);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
    o1.start(); o2.start();
    this._drone = { stop: () => { try { g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1); o1.stop(this.ctx.currentTime + 1.2); o2.stop(this.ctx.currentTime + 1.2); } catch { } } };

    // sparse notes on a minor scale
    const scales = {
      menu: [0, 3, 7, 10, 12], investigate: [0, 2, 3, 7, 8],
      court: [0, 5, 7, 12], danger: [0, 1, 5, 6, 10], calm: [0, 4, 7, 11, 12]
    };
    const scale = scales[mode] || scales.investigate;
    const base = root * 4;
    const tempo = { menu: 3200, investigate: 2400, court: 2800, danger: 1400, calm: 3600 }[mode] || 2400;

    const tick = () => {
      if (!this.ctx || this.mode !== mode) return;
      if (Math.random() < (mode === 'danger' ? 0.85 : 0.55)) {
        const t0 = this.ctx.currentTime + 0.05;
        const semi = scale[Math.floor(Math.random() * scale.length)] + (Math.random() < 0.3 ? 12 : 0);
        const freq = base * Math.pow(2, semi / 12);
        const o = this.ctx.createOscillator();
        o.type = mode === 'danger' ? 'square' : 'sine';
        o.frequency.setValueAtTime(freq, t0);
        const eg = this._env(o, t0, 0.02, mode === 'danger' ? 0.5 : 1.6, 0.055);
        eg.connect(this.musicGain);
        o.start(t0); o.stop(t0 + 2);
        if (mode === 'danger' && Math.random() < 0.4) this._noise(t0 + 0.5, 0.2, 0.03, 900, this.musicGain);
      }
    };
    tick();
    this._timer = setInterval(tick, tempo);
  }
}

export const Audio = new AudioEngine();

/* Wire global effect events to sounds. */
import { bus } from './bus.js';
bus.on('fx:sfx', e => Audio.sfx(e.name));
bus.on('fx:music', e => Audio.setMode(e.mode));
bus.on('audio:unlock', () => Audio.init());
