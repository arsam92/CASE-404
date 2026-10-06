/* CASE 404 — evidence system: archive browser + the "present evidence" sheet
   used by contradictions and courtroom battles. */

import { G, hasEv } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';
import { elx, lookupChar } from '../ui/hud.js';

const overlay = () => document.getElementById('overlay');

const IMPORTANCE_COLORS = { key: 'var(--red)', important: 'var(--gold)', optional: 'var(--dim)', misleading: '#b06bff', hidden: 'var(--green)' };

export const EvidenceUI = {

  findDef(id) {
    return (G.caseData?.evidence || []).find(e => e.id === id)
      || (G.sharedEvidence?.[id])
      || null;
  },

  defName(id) { return this.findDef(id)?.name || id; },

  card(def, meta, small) {
    const d = elx('div', 'ev-card panel' + (small ? ' small' : ''));
    const imp = def.importance || 'important';
    d.innerHTML = `
      <div class="ev-card-top">
        <span class="ev-id">${meta?.label || def.id}</span>
        <span class="ev-imp" style="color:${IMPORTANCE_COLORS[imp] || 'var(--dim)'}">${imp.toUpperCase()}</span>
      </div>
      <div class="ev-name">${def.name}</div>
      <div class="ev-desc">${def.desc || ''}</div>`;
    return d;
  },

  /* ---------- archive ---------- */

  openArchive() {
    Audio.sfx('click');
    const root = overlay();
    root.innerHTML = '';
    const wrap = elx('div', 'overlay-panel full');
    wrap.innerHTML = `<div class="ov-head"><h3>EVIDENCE ARCHIVE</h3><button class="ov-close">✕</button></div>`;
    wrap.querySelector('.ov-close').onclick = () => { root.innerHTML = ''; };
    const list = elx('div', 'ev-archive');
    wrap.appendChild(list);
    root.appendChild(wrap);

    const found = G.s.evidence;
    if (!found.length) {
      list.appendChild(elx('div', 'empty-note', 'No evidence collected yet.<br>Inspect locations and talk to people.'));
      return;
    }
    const byCase = {};
    for (const e of found) (byCase[e.caseId ?? '?'] ??= []).push(e);
    const caseIds = Object.keys(byCase).sort((a, b) => a - b);
    for (const cid of caseIds) {
      const caseMeta = (G.manifest?.cases || []).find(c => c.id === +cid);
      const sec = elx('div', 'ev-case-sec');
      sec.appendChild(elx('div', 'ev-case-title', caseMeta ? `${caseMeta.code} — ${caseMeta.title}` : `CASE ${cid}`));
      const grid = elx('div', 'ev-grid');
      for (const e of byCase[cid]) {
        const def = this.findDef(e.id);
        if (!def) continue;
        const card = this.card(def, { label: def.label || def.id.toUpperCase() }, true);
        card.onclick = () => this.detail(e.id, () => this.openArchive());
        grid.appendChild(card);
      }
      sec.appendChild(grid);
      list.appendChild(sec);
    }
  },

  detail(id, onBack) {
    const def = this.findDef(id);
    if (!def) return;
    Audio.sfx('click');
    const root = overlay();
    root.innerHTML = '';
    const wrap = elx('div', 'overlay-panel full ev-detail');
    const head = elx('div', 'ov-head');
    head.innerHTML = `<h3>EVIDENCE FILE</h3><button class="ov-close">✕</button>`;
    head.querySelector('.ov-close').onclick = () => { root.innerHTML = ''; onBack && onBack(); };
    wrap.appendChild(head);

    const imp = def.importance || 'important';
    const body = elx('div', 'ev-detail-body');
    body.innerHTML = `
      <div class="ev-big-id">${def.label || def.id.toUpperCase()}</div>
      <h2 class="ev-name">${def.name}</h2>
      <div class="ev-meta-rows">
        ${def.source ? row('SOURCE', def.source) : ''}
        ${def.time ? row('TIME', def.time) : ''}
        ${def.location ? row('LOCATION', def.location) : ''}
        ${def.related ? row('RELATED', def.related) : ''}
        ${def.cases ? row('CASES', def.cases) : ''}
      </div>
      <p class="ev-desc-full">${def.desc || ''}</p>
      ${def.interp ? `<div class="ev-interp"><h4>POSSIBLE INTERPRETATIONS</h4>${def.interp.map(i => `<p>• ${i}</p>`).join('')}</div>` : ''}`;
    body.querySelectorAll('.ev-mrow').forEach(() => { });
    wrap.appendChild(body);
    root.appendChild(wrap);

    function row(k, v) { return `<div class="ev-mrow"><span>${k}</span><b>${v}</b></div>`; }
  },

  /* ---------- present sheet (contradiction / courtroom) ---------- */
};

EvidenceUI.presentSheet = function (opts = {}) {
  return new Promise(resolve => {
    Audio.sfx('whoosh');
    const root = overlay();
    root.innerHTML = '';
    const wrap = elx('div', 'present-sheet');
    wrap.innerHTML = `<div class="ps-handle"></div>
      <div class="ps-title">${opts.title || 'PRESENT EVIDENCE'}</div>
      <div class="ps-hint">Select the evidence that contradicts the statement.</div>
      <div class="ps-grid"></div>
      <button class="btn btn-ghost ps-cancel">Cancel</button>`;
    const grid = wrap.querySelector('.ps-grid');
    const found = G.s.evidence;
    if (!found.length) grid.appendChild(elx('div', 'empty-note', 'You carry no evidence.'));
    for (const e of found) {
      const def = EvidenceUI.findDef(e.id);
      if (!def) continue;
      const c = elx('button', 'ps-item panel');
      c.innerHTML = `<span class="ps-id">${def.label || def.id.toUpperCase()}</span><span>${def.name}</span>`;
      c.onclick = () => { bus.emit('transition'); root.innerHTML = ''; resolve(e.id); };
      grid.appendChild(c);
    }
    wrap.querySelector('.ps-cancel').onclick = () => { bus.emit('transition'); root.innerHTML = ''; resolve(null); };
    root.appendChild(wrap);
  });
};
