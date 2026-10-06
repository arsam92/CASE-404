/* CASE 404 — courtroom system: witness testimonies with PRESS / PRESENT controls,
   contradiction breaks, inline court decisions and verdict tracking.
   Not a simple A/B menu: the player navigates statements, presses testimony,
   and presents evidence to break lies. */

import { G, applyEffects, reqOk } from '../engine/state.js';
import { Audio } from '../engine/audio.js';
import { HUD, elx, avatarEl, lookupChar } from '../ui/hud.js';
import { EvidenceUI } from './evidence.js';

export function runCourtroom(stage, phase, done) {
  const wrap = elx('div', 'screen court-screen');
  wrap.innerHTML = `
    <div class="court-head">
      <span class="court-loc">MERIDIAN COUNTY COURTHOUSE — ${phase.room || 'COURTROOM 3'}</span>
      <span class="court-pen" title="Missteps">MISSTEPS <b id="courtPen">0</b></span>
    </div>
    <div class="court-stage" id="courtStage"></div>
    <div class="court-panel panel">
      <div class="court-banner" id="courtBanner"></div>
      <div class="court-text" id="courtText"></div>
      <div class="court-press" id="courtPress"></div>
      <div class="court-controls" id="courtControls"></div>
    </div>`;
  stage.appendChild(wrap);

  const stageEl = wrap.querySelector('#courtStage');
  const bannerEl = wrap.querySelector('#courtBanner');
  const textEl = wrap.querySelector('#courtText');
  const pressEl = wrap.querySelector('#courtPress');
  const ctrlEl = wrap.querySelector('#courtControls');
  const penEl = wrap.querySelector('#courtPen');

  let penalty = G.s.caseState?.penalty || 0;
  penEl.textContent = penalty;
  let si = 0;                 // script segment index
  let typing = null;

  const setPen = n => { penalty = n; penEl.textContent = n; if (G.s.caseState) G.s.caseState.penalty = n; };

  function showStage(sp) {
    stageEl.innerHTML = '';
    if (!sp || sp === 'NARRATOR') return;
    const c = lookupChar(sp);
    const box = elx('div', 'court-stand');
    box.appendChild(avatarEl(sp, 'big'));
    box.appendChild(elx('div', 'court-name', c ? c.name : sp));
    stageEl.appendChild(box);
  }

  function typeLine(sp, t) {
    return new Promise(res => {
      showStage(sp);
      const c = lookupChar(sp);
      bannerEl.textContent = c ? c.name.toUpperCase() : (sp === 'NARRATOR' ? '' : String(sp).toUpperCase());
      textEl.textContent = '';
      pressEl.innerHTML = '';
      ctrlEl.innerHTML = '';
      typing = HUD.typewriter(textEl, t, G.s.settings.textSpeed, () => Audio.sfx('type'));
      const cont = elx('button', 'btn court-cont', t ? 'CONTINUE ▾' : '... ▾');
      cont.onclick = () => {
        if (typing && !typing.done) return typing.finish();
        res();
      };
      ctrlEl.appendChild(cont);
    });
  }

  async function playLines(lines) {
    for (const line of lines) {
      if (line.sfx) Audio.sfx(line.sfx);
      if (line.fx === 'flash') HUD.redFlash();
      await typeLine(line.sp || 'NARRATOR', line.t);
    }
  }

  /* ---------------- testimony ---------------- */

  async function runTestimony(seg) {
    const broken = new Set();
    const pressed = new Set();
    let idx = 0;

    bannerEl.textContent = seg.title || 'WITNESS TESTIMONY';
    Audio.sfx('gavel');

    const renderStatement = () => {
      const st = seg.statements[idx];
      showStage(seg.witness);
      const c = lookupChar(seg.witness);
      bannerEl.textContent = (seg.title || 'TESTIMONY') + `  ·  ${idx + 1}/${seg.statements.length}`;
      textEl.innerHTML = `<span class="court-quote">“${st.t}”</span>`;
      pressEl.innerHTML = '';
      ctrlEl.innerHTML = '';

      const prevB = elx('button', 'btn btn-ghost', '◀');
      const pressB = elx('button', 'btn btn-ghost', 'PRESS');
      const presB = elx('button', 'btn btn-primary', 'PRESENT EVIDENCE');
      const nextB = elx('button', 'btn btn-ghost', '▶');
      if (idx === 0) prevB.disabled = true;

      prevB.onclick = () => { Audio.sfx('click'); idx = Math.max(0, idx - 1); renderStatement(); };
      pressB.onclick = () => runPress(st);
      presB.onclick = () => runPresent(st);
      nextB.onclick = () => {
        Audio.sfx('click');
        if (idx < seg.statements.length - 1) { idx++; renderStatement(); return; }
        finishTestimony();
      };
      ctrlEl.append(prevB, pressB, presB, nextB);
    };

    const runPress = (st) => {
      Audio.sfx('click');
      const qs = st.press || [];
      const unused = qs.map((q, i) => ({ q, i })).filter(x => !pressed.has(st.id + ':' + x.i));
      if (!unused.length) {
        pressEl.innerHTML = `<div class="court-press-line">“I have already told you everything I know.”</div>`;
        return;
      }
      const u = unused[0];
      pressed.add(st.id + ':' + u.i);
      pressEl.innerHTML = `<div class="court-press-q">YOU: ${u.q.q}</div>`;
      const answer = elx('div', 'court-press-line');
      pressEl.appendChild(answer);
      const tw = HUD.typewriter(answer, `“${u.q.a}”`, G.s.settings.textSpeed, () => Audio.sfx('type'));
      if (u.q.effects) applyEffects(u.q.effects, { caseId: G.s.caseState?.caseId });
      if (u.q.hint) setTimeout(() => HUD.toast(u.q.hint, 'warn'), 900);
    };

    const runPresent = async (st) => {
      const evId = await EvidenceUI.presentSheet({ title: 'PRESENT EVIDENCE' });
      if (!evId) return;
      if (st.weak && evId === st.breakWith && !broken.has(st.id)) {
        broken.add(st.id);
        Audio.sfx('reveal'); HUD.redFlash();
        await HUD.stamp('CONTRADICTION!');
        await playLines(st.break || [{ sp: seg.witness, t: 'I... I don\'t remember saying that.' }]);
        if (st.effects) applyEffects(st.effects, { caseId: G.s.caseState?.caseId });
        if (idx < seg.statements.length - 1) { idx++; renderStatement(); }
        else finishTestimony();
      } else if (st.weak && broken.has(st.id)) {
        HUD.toast('Already broken. Move on.', 'warn');
      } else {
        Audio.sfx('fail');
        setPen(penalty + 1);
        HUD.toast('The court is not convinced. Misstep recorded.', 'bad');
        await playLines([{ sp: 'judge', t: 'Counsel will present relevant evidence only.' }]);
        renderStatement();
      }
    };

    const finishTestimony = () => {
      const unbroken = seg.statements.filter(s => s.weak && !broken.has(s.id));
      if (unbroken.length) {
        ctrlEl.innerHTML = '';
        bannerEl.textContent = 'CROSS-EXAMINATION';
        textEl.innerHTML = `Some testimony went unchallenged.<br>Ending now will <b>weaken the verdict</b>.`;
        const keepB = elx('button', 'btn btn-ghost', 'KEEP PRESSING');
        const endB = elx('button', 'btn btn-danger', 'END TESTIMONY');
        keepB.onclick = () => { idx = seg.statements.findIndex(s => s.weak && !broken.has(s.id)); renderStatement(); };
        endB.onclick = async () => {
          if (G.s.caseState) G.s.caseState.verdict = 'weak';
          applyEffects(['verdict:weak'], { caseId: G.s.caseState?.caseId });
          await playLines(seg.endLines || [{ sp: 'judge', t: 'The witness may step down.' }]);
          si++; nextSeg();
        };
        ctrlEl.append(keepB, endB);
      } else {
        (async () => {
          applyEffects(['verdict:strong'], { caseId: G.s.caseState?.caseId });
          if (G.s.caseState) G.s.caseState.verdict = 'strong';
          await playLines(seg.endLines || [{ sp: 'judge', t: 'The witness may step down.' }]);
          si++; nextSeg();
        })();
      }
    };

    renderStatement();
  }

  /* ---------------- court choice ---------------- */

  async function runChoice(seg) {
    bannerEl.textContent = seg.tag || 'DECISION';
    textEl.textContent = seg.prompt;
    pressEl.innerHTML = '';
    ctrlEl.innerHTML = '';
    for (const opt of seg.options) {
      if (opt.req && !reqOk(opt.req)) continue;
      const b = elx('button', 'btn ' + (opt.cls || 'btn-ghost'), opt.label);
      b.onclick = async () => {
        Audio.sfx('select');
        if (opt.effects) applyEffects(opt.effects, { caseId: G.s.caseState?.caseId });
        if (opt.choice) applyEffects(['choice:' + opt.choice + '|' + opt.label], { caseId: G.s.caseState?.caseId });
        if (opt.result?.length) await playLines(opt.result);
        si++; nextSeg();
      };
      ctrlEl.appendChild(b);
    }
  }

  /* ---------------- segment walker ---------------- */

  async function nextSeg() {
    if (si >= phase.script.length) {
      wrap.remove();
      return done();
    }
    const seg = phase.script[si];
    if (seg.effects) applyEffects(seg.effects, { caseId: G.s.caseState?.caseId });
    switch (seg.seg) {
      case 'line': await playLines([{ sp: seg.sp, t: seg.t, sfx: seg.sfx, fx: seg.fx }]); si++; nextSeg(); break;
      case 'lines': await playLines(seg.lines); si++; nextSeg(); break;
      case 'testimony': await runTestimony(seg); break;
      case 'choice': await runChoice(seg); break;
      default: si++; nextSeg();
    }
  }

  nextSeg();
}
