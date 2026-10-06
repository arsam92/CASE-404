/* CASE 404 — investigation locations & hub screens. Tap hotspots to inspect
   objects; some hold clues, some hold nothing, some hold clues that only
   matter several cases later. */

import { G, applyEffects, reqOk } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';
import { HUD, elx } from '../ui/hud.js';

const LOC_GLYPHS = {
  door: '⌂', table: '▤', phone: '☏', computer: '▣', window: '▨', trash: '▥',
  cabinet: '▦', case: '◫', desk: '▤', camera: '◉', vault: '▩', server: '▩',
  book: '≣', bed: '▭', lamp: '☀', coat: '⛄', car: 'ⓐ', floor: '▨',
  notice: '☰', box: '⊡', print: '◎', sheet: '≡', bag: '◗', locker: '▤',
  terminal: '▩', coffee: '☕', photo: '◱', file: '≣', shelf: '≣', backdoor: '⌷',
  ticket: '◫', booth: '⌂', desk2: '▤'
};

export function renderHubPhase(stage, phase, goto) {
  const wrap = elx('div', 'screen hub-screen');
  wrap.innerHTML = `
    <div class="hub-head">
      <div class="hub-title">${phase.title || 'WHERE TO?'}</div>
      ${phase.desc ? `<div class="hub-desc">${phase.desc}</div>` : ''}
    </div>
    <div class="hub-opts"></div>`;
  const opts = wrap.querySelector('.hub-opts');
  stage.innerHTML = '';
  stage.appendChild(wrap);
  if (phase.music) Audio.setMode(phase.music);

  for (const opt of (phase.options || [])) {
    const idx = opt.flag ? `${phase.id}:${opt.flag}` : null;
    if (idx && G.s.caseState?.flags['hubseen:' + idx] && opt.once) continue;
    const locked = opt.req && !reqOk(opt.req);
    const b = elx('button', 'hub-opt panel' + (locked ? ' locked' : ''));
    const seen = idx && G.s.caseState?.flags['hubseen:' + idx];
    b.innerHTML = `<span class="hub-glyph">${opt.glyph || '◈'}</span>
      <span class="hub-opt-text"><b>${opt.label}</b>${opt.sub ? `<i>${opt.sub}</i>` : ''}</span>
      ${locked ? '<span class="hub-lock">LOCKED</span>' : (seen ? '<span class="hub-visited">✓</span>' : '')}`;
    b.onclick = () => {
      if (locked) { Audio.sfx('fail'); HUD.toast(opt.lockedMsg || 'Not yet. Something is missing.'); return; }
      Audio.sfx('whoosh');
      if (idx) G.s.caseState.flags['hubseen:' + idx] = true;
      goto(opt.goto);
    };
    opts.appendChild(b);
  }

  const canProceed = !phase.proceedReq || reqOk(phase.proceedReq);
  const go = elx('button', 'btn btn-primary hub-proceed', phase.proceedLabel || 'PROCEED ▸');
  go.disabled = !canProceed;
  go.onclick = () => { Audio.sfx('select'); goto(phase.proceedGoto || phase.next); };
  wrap.appendChild(go);
  if (!canProceed && phase.proceedHint) wrap.appendChild(elx('div', 'hub-hint', phase.proceedHint));
}

export function renderLocationPhase(stage, phase, goto, leave) {
  const wrap = elx('div', 'screen loc-screen');
  wrap.innerHTML = `
    <div class="loc-head">
      <div class="loc-name">${phase.title || phase.loc?.toUpperCase()}</div>
      <div class="loc-sub">${phase.subtitle || 'TAP OBJECTS TO INSPECT'}</div>
    </div>
    <div class="loc-grid" id="locGrid"></div>
    <button class="btn btn-ghost loc-leave">◂ LEAVE</button>`;
  stage.innerHTML = '';
  stage.appendChild(wrap);
  if (phase.music) Audio.setMode(phase.music);

  const grid = wrap.querySelector('#locGrid');
  wrap.querySelector('.loc-leave').onclick = () => { Audio.sfx('door'); leave(); };

  for (const hs of (phase.hotspots || [])) {
    const b = elx('button', 'loc-hotspot panel');
    b.innerHTML = `<span class="hs-glyph">${LOC_GLYPHS[hs.glyph] || '◈'}</span><span class="hs-name">${hs.name}</span>`;
    b.onclick = () => inspect(hs, b);
    grid.appendChild(b);
  }

  async function inspect(hs, btn) {
    if (wrap.querySelector('.inspect-panel')) return; // one inspection at a time
    Audio.sfx('click');
    const inspects = (hs.inspects || []).filter(i => reqOk(i.req));
    // find first unconsumed inspect
    let chosen = null, chosenKey = null;
    for (let i = 0; i < inspects.length; i++) {
      const key = `hs:${phase.loc}:${hs.id}:${i}`;
      if (!G.s.caseState?.flags[key]) { chosen = inspects[i]; chosenKey = key; break; }
    }
    if (!chosen) {
      chosen = { lines: [{ t: hs.idle || 'Nothing further here.' }] };
    } else {
      G.s.caseState.flags[chosenKey] = true;
    }

    // dim hotspot + show inspect overlay panel
    const panel = elx('div', 'inspect-panel');
    panel.innerHTML = `<div class="inspect-title">${hs.name.toUpperCase()}</div><div class="inspect-text"></div><div class="inspect-hint narr-hint">▼</div>`;
    wrap.appendChild(panel);
    const textEl = panel.querySelector('.inspect-text');

    for (const line of chosen.lines) {
      if (line.sfx) Audio.sfx(line.sfx);
      if (line.fx === 'flash') HUD.redFlash();
      await new Promise(res => {
        const tw = HUD.typewriter(textEl, line.t, G.s.settings.textSpeed, () => Audio.sfx('type'));
        panel.onclick = () => { if (!tw.done) tw.finish(); else { panel.onclick = null; res(); } };
      });
      textEl.innerHTML += '';
    }
    if (chosen.effects) applyEffects(chosen.effects, { caseId: G.s.caseState?.caseId });
    bus.emit('transition');
    await new Promise(res => setTimeout(res, 150));
    panel.classList.add('fade');
    setTimeout(() => panel.remove(), 350);
  }
}
