/* CASE 404 — screens: boot, main menu, case brief, case select, archives,
   pause, settings, save/load, case complete. */

import { G, freshProfile, reqOk, rel } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';
import { Store } from '../engine/save.js';
import { HUD, elx, avatarEl, lookupChar } from './hud.js';
import { EvidenceUI } from '../systems/evidence.js';
import { BoardUI } from '../systems/board.js';
import { ENDINGS, Endings } from '../systems/endings.js';
import { THREAT_LABELS } from '../engine/state.js';

const overlay = () => document.getElementById('overlay');

function clearOverlay() { overlay().innerHTML = ''; }

/* ============ BOOT ============ */

export function renderBoot(stage, onDone) {
  stage.innerHTML = `
    <div class="screen boot-screen" id="bootScreen">
      <div class="boot-logo">
        <div class="boot-case">CASE</div>
        <div class="boot-404 glitch" data-text="404">404</div>
      </div>
      <div class="boot-sub">23 CASES. ONE TRUTH.</div>
      <div class="boot-tap">TAP TO BEGIN</div>
      <div class="boot-foot">an original investigation · v0.1.0</div>
    </div>`;
  const s = document.getElementById('bootScreen');
  s.addEventListener('pointerup', () => {
    Audio.init();
    Audio.sfx('select');
    Audio.setMode('menu');
    onDone();
  }, { once: true });
}

/* ============ MAIN MENU ============ */

export function renderMenu(stage) {
  stage.innerHTML = `
    <div class="screen menu-screen">
      <div class="menu-logo">
        <div class="menu-case">CASE</div>
        <div class="menu-404 glitch" data-text="404">404</div>
        <div class="menu-tag">23 CASES. ONE TRUTH.</div>
      </div>
      <div class="menu-btns">
        <button class="menu-btn" data-nav="new"><b>NEW GAME</b><span>The deeper you dig, the more it digs back.</span></button>
        <button class="menu-btn" data-nav="resume"><b>CONTINUE</b><span id="menuContinueInfo"></span></button>
        <button class="menu-btn" data-nav="caseSelect"><b>CASE SELECT</b><span>Review the record. 23 files. 1 sealed.</span></button>
        <button class="menu-btn" data-nav="archive"><b>CHARACTERS</b><span>People you have met. People you have hurt.</span></button>
        <button class="menu-btn" data-nav="story"><b>DOSSIER</b><span>Threats, decisions and connections so far.</span></button>
        <button class="menu-btn" data-nav="settings"><b>SETTINGS</b><span></span></button>
      </div>
      <div class="menu-foot">CASE 404 · original story · all assets generated at runtime</div>
    </div>`;
  const latest = Store.latest();
  const info = stage.querySelector('#menuContinueInfo');
  if (latest) {
    const cm = G.manifest?.cases.find(c => c.id === latest.state?.progress?.currentCase);
    info.textContent = cm ? `${cm.code} — ${cm.title}` : 'Resume investigation';
  } else info.textContent = 'No record found';

  stage.querySelectorAll('.menu-btn').forEach(b => {
    b.onclick = () => { Audio.sfx('select'); bus.emit('nav', b.dataset.nav); };
  });
  Audio.setMode('menu');
}

/* ============ CASE BRIEF (before a case starts) ============ */

export function renderCaseBrief(stage, data, onStart) {
  stage.innerHTML = `
    <div class="screen brief-screen">
      <div class="brief-code">${data.code}</div>
      <div class="brief-title">${data.title}</div>
      <div class="brief-file panel">
        <div class="brief-file-head">CASE FILE</div>
        <p>${data.brief}</p>
        ${data.objectives ? `<div class="brief-obj"><b>PRIMARY OBJECTIVES</b>${data.objectives.map(o => `<div>☐ ${o}</div>`).join('')}</div>` : ''}
      </div>
      <button class="btn btn-primary brief-start">OPEN THE FILE ▸</button>
    </div>`;
  stage.querySelector('.brief-start').onclick = () => { Audio.sfx('stamp'); onStart(); };
}

/* ============ CASE SELECT ============ */

export function renderCaseSelect(stage) {
  stage.innerHTML = `<div class="screen select-screen">
    <div class="ov-head"><button class="ov-close back">‹</button><h3>CASE SELECT</h3><span></span></div>
    <div class="case-grid"></div></div>`;
  stage.querySelector('.back').onclick = () => bus.emit('nav', 'menu');
  const grid = stage.querySelector('.case-grid');
  const unlocked = G.s.progress.unlocked;

  for (const c of G.manifest.cases) {
    const completed = G.s.progress.completed[c.id];
    const playable = c.status === 'playable';
    const isOpen = c.id <= unlocked;
    const card = elx('div', 'case-card panel ' +
      (completed ? 'done' : c.id === unlocked && playable ? 'next' : playable ? 'open' : 'dev'));
    if (!playable) {
      card.innerHTML = `
        <div class="cc-code">${c.code}</div>
        <div class="cc-title">${c.title}</div>
        <div class="cc-brief">${c.brief || ''}</div>
        <div class="cc-status dev">IN DEVELOPMENT — FRAMEWORK READY</div>`;
      card.onclick = () => {
        Audio.sfx('fail');
        HUD.toast('This file is sealed. New cases are added as data — see docs/ADDING_CASES.md', 'warn');
      };
    } else if (!isOpen && !completed) {
      card.innerHTML = `
        <div class="cc-code">${c.code}</div>
        <div class="cc-title">████████ ██</div>
        <div class="cc-brief">CLASSIFIED — complete the previous case.</div>
        <div class="cc-status locked">LOCKED</div>`;
    } else {
      card.innerHTML = `
        <div class="cc-code">${c.code}</div>
        <div class="cc-title">${c.title}</div>
        <div class="cc-brief">${c.brief || ''}</div>
        <div class="cc-status ${completed ? 'done' : 'open'}">${completed ? 'CLOSED — ' + String(completed).toUpperCase() : (c.id === unlocked ? 'CURRENT' : 'REPLAY')}</div>`;
      card.onclick = () => { Audio.sfx('select'); bus.emit('nav', 'startCase:' + c.id); };
    }
    grid.appendChild(card);
  }
}

/* ============ CHARACTER ARCHIVE ============ */

export function renderArchive(stage) {
  stage.innerHTML = `<div class="screen archive-screen">
    <div class="ov-head"><button class="ov-close back">‹</button><h3>CHARACTER ARCHIVE</h3><span></span></div>
    <div class="archive-grid"></div></div>`;
  stage.querySelector('.back').onclick = () => bus.emit('nav', 'menu');
  const grid = stage.querySelector('.archive-grid');

  for (const [id, c] of Object.entries(G.chars || {})) {
    const r = G.s.npc[id];
    const met = r?.met;
    const card = elx('div', 'arch-card panel' + (met ? '' : ' unknown'));
    card.innerHTML = `
      <div class="arch-top">${avatarEl(met ? c.name : '?????', 'big')}<div>
        <b>${met ? c.name : 'UNIDENTIFIED'}</b>
        <span>${met ? (c.role || '') : 'no record'}</span>
      </div></div>
      <p>${met ? (c.bio || '') : 'You have not met this person.'}</p>
      ${met ? `<div class="arch-rel">
        ${['trust', 'fear', 'loyalty', 'suspicion'].map(s => `<div class="arch-relrow"><span>${s}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, r[s] ?? 0))}%"></i></div></div>`).join('')}
      </div>` : ''}
      ${met && r.memory?.length ? `<div class="arch-memory"><b>REMEMBERS</b>${r.memory.map(m => `<div>· ${m}</div>`).join('')}</div>` : ''}
    `;
    grid.appendChild(card);
  }
}

/* ============ DOSSIER (story archive) ============ */

export function renderStoryArchive(stage) {
  stage.innerHTML = `<div class="screen dossier-screen">
    <div class="ov-head"><button class="ov-close back">‹</button><h3>DOSSIER</h3><span></span></div>
    <div class="dossier-body"></div></div>`;
  stage.querySelector('.back').onclick = () => bus.emit('nav', 'menu');
  const body = stage.querySelector('.dossier-body');

  // threat log
  const t = elx('div', 'panel pad dossier-sec');
  t.innerHTML = `<h4>THREAT LEVEL</h4>
    <div class="tl-big">${G.s.threat.level} / 7 — ${THREAT_LABELS[G.s.threat.level] || ''}</div>`;
  for (const ev of G.s.threat.events) t.appendChild(elx('div', 'dossier-row', `LEVEL ${ev.level} — ${ev.label}`));
  body.appendChild(t);

  // decisions
  const d = elx('div', 'panel pad dossier-sec');
  d.innerHTML = `<h4>DECISION RECORD</h4>`;
  if (!G.s.progress.choices.length) d.appendChild(elx('div', 'dossier-row', 'No major decisions on record.'));
  for (const c of G.s.progress.choices) d.appendChild(elx('div', 'dossier-row', `${c.summary || c.name}`));
  body.appendChild(d);

  // connections
  const b = elx('div', 'panel pad dossier-sec');
  b.innerHTML = `<h4>CONNECTIONS</h4><p>${G.s.board.links.length} links mapped on the investigation board.</p>`;
  const openB = elx('button', 'btn btn-ghost', 'OPEN BOARD');
  openB.onclick = () => bus.emit('open', 'board');
  b.appendChild(openB);
  body.appendChild(b);

  // endings seen
  const e = elx('div', 'panel pad dossier-sec');
  e.innerHTML = `<h4>ENDINGS DISCOVERED</h4>`;
  const seen = G.s.progress.seenEndings;
  for (const [id, def] of Object.entries(ENDINGS)) {
    e.appendChild(elx('div', 'dossier-row', `${seen.includes(id) ? def.title : 'ENDING ' + id + ' — ████████'}`));
  }
  body.appendChild(e);
}

/* ============ PAUSE ============ */

export function renderPause() {
  Audio.sfx('click');
  const root = overlay();
  root.innerHTML = '';
  const wrap = elx('div', 'overlay-panel center pause-panel');
  wrap.innerHTML = `
    <h3>PAUSED</h3>
    <button class="btn btn-primary" data-a="resume">RESUME</button>
    <button class="btn" data-a="save">SAVE GAME</button>
    <button class="btn" data-a="load">LOAD GAME</button>
    <button class="btn" data-a="settings">SETTINGS</button>
    <button class="btn" data-a="select">CASE SELECT</button>
    <button class="btn btn-ghost" data-a="menu">MAIN MENU</button>`;
  wrap.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      Audio.sfx('click');
      const a = b.dataset.a;
      if (a === 'resume') { clearOverlay(); return; }
      if (a === 'menu' || a === 'select') clearOverlay();
      bus.emit('nav', a);
    };
  });
  root.appendChild(wrap);
}

/* ============ SETTINGS ============ */

export function renderSettings() {
  const root = overlay();
  root.innerHTML = '';
  const wrap = elx('div', 'overlay-panel center settings-panel');
  const s = G.s.settings;
  wrap.innerHTML = `
    <h3>SETTINGS</h3>
    <div class="set-row"><span>MUSIC</span><input type="range" id="setMusic" min="0" max="1" step="0.05" value="${s.music}"></div>
    <div class="set-row"><span>SOUND FX</span><input type="range" id="setSfx" min="0" max="1" step="0.05" value="${s.sfx}"></div>
    <div class="set-row"><span>TEXT SPEED</span>
      <div class="seg" id="setSpeed">
        ${['slow', 'normal', 'fast', 'instant'].map(v => `<button data-v="${v}" class="${s.textSpeed === v ? 'on' : ''}">${v.toUpperCase()}</button>`).join('')}
      </div></div>
    <button class="btn btn-ghost" id="setClose">CLOSE</button>
    <button class="btn btn-danger" id="setWipe">ERASE ALL PROGRESS</button>`;
  root.appendChild(wrap);
  const persist = () => { Store.metaSet({ booted: true, settings: G.s.settings }); Store.auto(); };
  wrap.querySelector('#setMusic').oninput = e => { G.s.settings.music = +e.target.value; Audio.setVolumes(s.music, s.sfx); persist(); };
  wrap.querySelector('#setSfx').oninput = e => { G.s.settings.sfx = +e.target.value; Audio.setVolumes(s.music, s.sfx); Audio.sfx('click'); persist(); };
  wrap.querySelector('#setSpeed').querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      G.s.settings.textSpeed = b.dataset.v;
      wrap.querySelectorAll('#setSpeed button').forEach(x => x.classList.toggle('on', x === b));
      Audio.sfx('click'); persist();
    };
  });
  wrap.querySelector('#setClose').onclick = () => { root.innerHTML = ''; };
  wrap.querySelector('#setWipe').onclick = () => {
    if (confirm('Erase ALL progress, saves and records? This cannot be undone.')) {
      Store.wipeAll();
      G.s = freshProfile();
      root.innerHTML = '';
      bus.emit('nav', 'menu');
      HUD.toast('All records erased.', 'warn');
    }
  };
}

/* ============ SAVE / LOAD ============ */

export function renderSaveLoad(mode) {
  const root = overlay();
  root.innerHTML = '';
  const wrap = elx('div', 'overlay-panel center save-panel');
  wrap.innerHTML = `<h3>${mode.toUpperCase()} GAME</h3>`;
  for (const s of Store.list()) {
    const row = elx('div', 'save-row panel');
    const d = s.empty ? '— empty —' : new Date(s.savedAt).toLocaleString() + ` · ${s.label} · threat ${s.threat}`;
    row.innerHTML = `<div><b>SLOT ${s.slot === 'auto' ? 'A (AUTO)' : s.slot}</b><span>${d}</span></div>`;
    const btn = elx('button', 'btn ' + (mode === 'save' ? '' : 'btn-ghost'), mode.toUpperCase());
    btn.disabled = mode === 'load' && s.empty;
    btn.onclick = () => {
      Audio.sfx('select');
      if (mode === 'save') {
        Store.save(s.slot);
        HUD.toast(`Saved to slot ${s.slot.toUpperCase()}`, 'good');
        renderSaveLoad(mode);
      } else {
        const st = Store.load(s.slot);
        if (!st) return HUD.toast('Load failed.', 'bad');
        G.s = st;
        Audio.setVolumes(G.s.settings.music, G.s.settings.sfx);
        resumeFromSave(true);
      }
    };
    row.appendChild(btn);
    wrap.appendChild(row);
  }
  const close = elx('button', 'btn btn-ghost', 'CLOSE');
  close.onclick = () => { root.innerHTML = ''; };
  wrap.appendChild(close);
  root.appendChild(wrap);
}

export function resumeFromSave(alreadyLoaded = false) {
  if (!alreadyLoaded) {
    const latest = Store.latest();
    if (!latest) { HUD.toast('No save record found.', 'warn'); return; }
    const st = Store.load(latest.slot);
    if (!st) { HUD.toast('Load failed.', 'bad'); return; }
    G.s = st;
    Audio.setVolumes(G.s.settings.music, G.s.settings.sfx);
  }
  clearOverlay();
  if (G.s.caseState) {
    bus.emit('nav', 'resumeCase');
  } else {
    bus.emit('nav', 'caseSelect');
  }
}

export function confirmNewGame() {
  const root = overlay();
  root.innerHTML = '';
  const wrap = elx('div', 'overlay-panel center settings-panel');
  wrap.innerHTML = `<h3>NEW GAME</h3>
    <p class="set-note">Start a new investigation. Existing saves stay in their slots — autosave will move to the new run.</p>
    <button class="btn btn-primary" id="ngYes">BEGIN — "WELCOME, INVESTIGATOR."</button>
    <button class="btn btn-ghost" id="ngNo">CANCEL</button>`;
  root.appendChild(wrap);
  wrap.querySelector('#ngYes').onclick = () => {
    const settings = G.s.settings;
    G.s = freshProfile();
    G.s.settings = settings;
    root.innerHTML = '';
    Audio.setVolumes(settings.music, settings.sfx);
    bus.emit('nav', 'startCase:0');
  };
  wrap.querySelector('#ngNo').onclick = () => { root.innerHTML = ''; };
}

/* ============ CASE COMPLETE ============ */

export function renderCaseComplete(stage, data) {
  stage.innerHTML = '';
  const wrap = elx('div', 'screen complete-screen');
  const evCount = G.s.evidence.length;
  const threat = G.s.threat.level;
  wrap.innerHTML = `
    <div class="complete-stamp">CASE CLOSED</div>
    <div class="complete-code">${data.code} — ${data.title}</div>
    <div class="complete-outcome panel">
      <b>OUTCOME: ${String(data.outcome).toUpperCase().replace(/_/g, ' ')}</b>
      <div class="complete-stats">
        <span>EVIDENCE ON RECORD: ${evCount}</span>
        <span>THREAT LEVEL: ${threat}/7</span>
      </div>
    </div>
    <div class="complete-note">Records saved. The next file is already waiting.</div>
    <div class="complete-btns">
      <button class="btn btn-primary" id="ccNext">CONTINUE ▸</button>
      <button class="btn btn-ghost" id="ccSelect">CASE SELECT</button>
    </div>`;
  stage.appendChild(wrap);
  Audio.sfx('success');
  wrap.querySelector('#ccNext').onclick = () => {
    Audio.sfx('select');
    const nm = G.manifest.cases.find(c => c.id === data.nextId);
    if (nm && nm.status === 'playable') bus.emit('nav', 'startCase:' + data.nextId);
    else bus.emit('nav', 'caseSelect');
  };
  wrap.querySelector('#ccSelect').onclick = () => bus.emit('nav', 'caseSelect');
}
