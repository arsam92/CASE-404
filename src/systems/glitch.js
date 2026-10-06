/* CASE 404 — atmosphere glitch system.
   Visual + audio "ERROR 404" corruption that escalates with threat level.
   Purely cosmetic / immersive; never blocks input or changes game state. */

import { G } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';

const GLITCH_CHARS = '█▓▒░╬╪╫╔╗╚╝║═┌┐└┘│─◆◇◈▣▤▥▦▧▨▩▲▼◄►◆◇○●◎⊙';
const ERROR_LINES = [
  'ARCHIVE SYNC ERROR 404',
  'RECORD NOT FOUND',
  'CHAIN OF CUSTODY BROKEN',
  'FILE DELETED — TRACE REMAINS',
  'ACCESS DENIED BY 404',
  'SIGNATURE: 404',
  'THIS RECORD WAS NEVER HERE',
  'REDACTED BY AUTHORITY',
];

let layer = null;
let timer = null;
let active = false;

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'glitchLayer';
  layer.setAttribute('aria-hidden', 'true');
  document.getElementById('app')?.appendChild(layer) || document.body.appendChild(layer);
  return layer;
}

function threatIntensity() {
  const t = G.s?.threat?.level ?? 0;
  // 0 → almost never; 7 → frequent micro-glitches
  return Math.min(1, t / 7);
}

function randomError() {
  return ERROR_LINES[Math.floor(Math.random() * ERROR_LINES.length)];
}

function flashOverlay(text, ms = 420) {
  const root = ensureLayer();
  const el = document.createElement('div');
  el.className = 'glitch-overlay';
  el.innerHTML = `<div class="glitch-line">${text}</div>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 280);
  }, ms);
}

function tear() {
  const root = ensureLayer();
  const el = document.createElement('div');
  el.className = 'glitch-tear';
  const y = 8 + Math.random() * 84;
  const h = 2 + Math.random() * 18;
  el.style.top = y + '%';
  el.style.height = h + 'px';
  el.style.setProperty('--shift', (Math.random() * 24 - 12) + 'px');
  root.appendChild(el);
  setTimeout(() => el.remove(), 180 + Math.random() * 220);
}

function scanlineBurst() {
  const root = ensureLayer();
  const el = document.createElement('div');
  el.className = 'glitch-scan';
  root.appendChild(el);
  setTimeout(() => el.remove(), 500);
}

/** Corrupt a string with 404-style glyphs (for typewriter at high threat). */
export function corruptText(text, intensity = threatIntensity()) {
  if (intensity < 0.35 || !text) return text;
  const rate = intensity * 0.08; // max ~8% of chars
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' || text[i] === '\n') { out += text[i]; continue; }
    if (Math.random() < rate) out += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    else out += text[i];
  }
  return out;
}

/** One-shot big glitch (threat raise, contradiction, meta moments). */
export function burst(kind = 'soft') {
  const intense = kind === 'hard' || (G.s?.threat?.level ?? 0) >= 5;
  Audio.sfx('glitch');
  flashOverlay(randomError(), intense ? 700 : 380);
  tear();
  if (intense) {
    tear();
    scanlineBurst();
    document.body.classList.add('glitch-shake');
    setTimeout(() => document.body.classList.remove('glitch-shake'), 420);
  }
}

function scheduleNext() {
  if (!active) return;
  const intensity = threatIntensity();
  // base interval 18–45s, shrinks with threat
  const min = 14000 - intensity * 9000;
  const max = 42000 - intensity * 22000;
  const wait = min + Math.random() * Math.max(2000, max - min);
  timer = setTimeout(() => {
    if (!active) return;
    if (Math.random() < 0.25 + intensity * 0.55) {
      const hard = intensity > 0.6 && Math.random() < 0.35;
      if (hard) burst('hard');
      else {
        tear();
        if (Math.random() < 0.4) flashOverlay(randomError(), 280);
        if (Math.random() < 0.5) Audio.sfx('glitch');
      }
    }
    scheduleNext();
  }, wait);
}

export const Glitch = {
  start() {
    if (active) return;
    active = true;
    ensureLayer();
    scheduleNext();
  },
  stop() {
    active = false;
    if (timer) { clearTimeout(timer); timer = null; }
  },
  burst,
  corruptText,
  /** Call when threat level changes so next interval adapts immediately. */
  onThreatChanged() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (active) scheduleNext();
  }
};

// Auto-start ambient glitches once the game boots past the splash
bus.on('audio:unlock', () => Glitch.start());
bus.on('fx:threat', () => {
  Glitch.burst('hard');
  Glitch.onThreatChanged();
});
