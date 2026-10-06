/* CASE 404 — HUD: toasts, stamps, top bar, typewriter, speaker cards. */

import { G } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function elx(tag, cls, html) { return el(tag, cls, html); }

function charIndex() {
  if (!G._charIndex) {
    G._charIndex = {};
    for (const [id, c] of Object.entries(G.chars || {})) {
      G._charIndex[id.toLowerCase()] = { id, ...c };
      G._charIndex[(c.name || id).toUpperCase()] = { id, ...c };
      G._charIndex[c.name?.toUpperCase().replace(/\s+/g, '_')] = { id, ...c };
    }
  }
  return G._charIndex;
}

export function lookupChar(sp) {
  if (!sp) return null;
  const idx = charIndex();
  return idx[String(sp).toUpperCase()] || idx[String(sp).toLowerCase()] || null;
}

export function avatarEl(sp, size = '') {
  const c = lookupChar(sp);
  const a = el('div', 'avatar ' + size);
  const name = c ? c.name : (sp || '?');
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  a.textContent = sp === 'NARRATOR' || !sp ? '?' : initials;
  a.style.setProperty('--av-c', c?.color || '#31405f');
  if (sp === 'NARRATOR' || !sp) a.classList.add('avatar-narr');
  return a;
}

export const HUD = {
  root: document.getElementById('hud'),

  /* ---------- toasts ---------- */
  toast(msg, cls = '') {
    const t = el('div', 'toast ' + cls, msg);
    this.root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
  },

  /* ---------- top bar ---------- */
  topbar(show, data = {}) {
    let bar = document.getElementById('topbar');
    if (!show) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = el('div', '');
      bar.id = 'topbar';
      this.root.prepend(bar);
      bar.innerHTML = `
        <button class="tb-btn" id="tbMenu" title="Pause"><span>II</span></button>
        <div class="tb-case"><span class="tb-code"></span><span class="tb-title"></span></div>
        <div class="tb-actions">
          <button class="tb-btn" id="tbEvidence" title="Evidence"><span>EV</span></button>
          <button class="tb-btn" id="tbBoard" title="Board"><span>BD</span></button>
          <button class="tb-btn tb-phone" id="tbPhone" title="Phone"><span>P</span></button>
        </div>`;
      bar.querySelector('#tbMenu').onclick = () => { Audio.sfx('click'); bus.emit('nav', 'pause'); };
      bar.querySelector('#tbEvidence').onclick = () => { Audio.sfx('click'); bus.emit('open', 'evidence'); };
      bar.querySelector('#tbBoard').onclick = () => { Audio.sfx('click'); bus.emit('open', 'board'); };
      bar.querySelector('#tbPhone').onclick = () => { Audio.sfx('click'); bus.emit('open', 'phone'); };
    }
    bar.querySelector('.tb-code').textContent = data.code || '';
    bar.querySelector('.tb-title').textContent = data.title || '';
  },

  /* ---------- big center stamp ---------- */
  stamp(text, sub = '', color = 'var(--red)') {
    return new Promise(res => {
      const s = el('div', 'stamp-wrap');
      s.innerHTML = `<div class="stamp" style="--stamp-c:${color}"><span>${text}</span>${sub ? `<em>${sub}</em>` : ''}</div>`;
      this.root.appendChild(s);
      Audio.sfx('stamp');
      setTimeout(() => s.classList.add('out'), 1500);
      setTimeout(() => { s.remove(); res(); }, 2000);
    });
  },

  redFlash() {
    const f = el('div', 'redflash');
    this.root.appendChild(f);
    setTimeout(() => f.remove(), 650);
  },

  /* ---------- typewriter ---------- */
  typewriter(elText, text, speed, onChar) {
    const cpsMap = { slow: 18, normal: 34, fast: 60, instant: Infinity };
    const cps = cpsMap[speed] ?? 34;
    let i = 0, done = false, timer = null;
    elText.textContent = '';
    const step = () => {
      if (done) return;
      // reveal next chunk (multiple chars per tick for slow devices)
      const chunk = cps === Infinity ? text.length : 1;
      i = Math.min(text.length, i + chunk);
      elText.textContent = text.slice(0, i);
      if (onChar && i < text.length && i % 3 === 0) onChar();
      if (i >= text.length) { done = true; clearInterval(timer); }
    };
    if (cps === Infinity) { step(); done = true; }
    else timer = setInterval(step, 1000 / cps);
    return {
      finish() { done = true; clearInterval(timer); elText.textContent = text; },
      get done() { return done; }
    };
  }
};
