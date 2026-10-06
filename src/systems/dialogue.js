/* CASE 404 — dialogue engine: branching NPC conversations with conditional
   options, evidence-gated reveals and present-evidence confrontations. */

import { G, applyEffects, reqOk, rel } from '../engine/state.js';
import { Audio } from '../engine/audio.js';
import { HUD, elx, avatarEl, lookupChar } from '../ui/hud.js';
import { EvidenceUI } from './evidence.js';
import { t } from '../engine/i18n.js';

export function runDialogue(stage, phase, done) {
  const dlg = (G.caseData.dialogues || {})[phase.npc] || (G.sharedDialogues || {})[phase.npc];
  if (!dlg) { console.error('no dialogue for', phase.npc); return done(); }
  const char = lookupChar(phase.npc) || G.chars?.[phase.npc];
  const nodes = dlg.nodes;

  const wrap = elx('div', 'screen dialogue-screen');
  stage.appendChild(wrap);

  const frame = elx('div', 'dialogue-frame');
  frame.innerHTML = `
    <div class="dlg-head">
      <div class="dlg-id"></div>
      <div class="dlg-rel"></div>
    </div>
    <div class="dlg-body panel">
      <div class="dlg-line"><div class="narr-head"></div><div class="narr-text"></div></div>
      <div class="dlg-opts"></div>
      <div class="dlg-next narr-hint">▼</div>
    </div>`;
  wrap.appendChild(frame);

  const relBox = frame.querySelector('.dlg-rel');
  const lineHead = frame.querySelector('.narr-head');
  const lineText = frame.querySelector('.narr-text');
  const optsBox = frame.querySelector('.dlg-opts');
  const nextHint = frame.querySelector('.dlg-next');

  const showRel = () => {
    const r = rel(phase.npc);
    relBox.innerHTML = ['trust', 'fear', 'suspicion'].map(s =>
      `<span class="rel-chip rel-${s}">${s.toUpperCase()} ${clampBar(r[s])}</span>`).join('');
  };
  const clampBar = v => {
    const n = Math.max(0, Math.min(10, Math.round((v ?? 0) / 10)));
    return '◆'.repeat(Math.max(1, n));
  };

  function showNode(nodeId) {
    if (nodeId === 'END' || nodeId === 'end' || nodeId === '__end') {
      wrap.remove();
      return done();
    }
    const node = nodes[nodeId];
    if (!node) { console.error('missing node', nodeId); return done(); }
    frame.onclick = null; // never carry a tap handler across nodes
    if (node.effects) applyEffects(node.effects, { caseId: G.s.caseState?.caseId });
    showRel();

    lineHead.innerHTML = '';
    const speaker = node.sp || phase.npc;
    if (speaker !== 'NARRATOR' && speaker !== 'YOU') {
      lineHead.appendChild(avatarEl(speaker));
      const c = lookupChar(speaker);
      lineHead.appendChild(elx('div', 'narr-sp', c ? c.name : speaker));
    } else if (speaker === 'YOU') {
      lineHead.appendChild(elx('div', 'narr-sp you-sp', 'YOU'));
    }
    lineText.textContent = '';
    optsBox.innerHTML = '';
    nextHint.style.display = 'none';

    const tw = HUD.typewriter(lineText, node.t || '', G.s.settings.textSpeed, () => Audio.sfx('type'));

    const showOptions = () => {
      const opts = (node.opts || []).filter(o => reqOk(o.req));
      if (!opts.length) {
        // no options → tap to continue to next node
        nextHint.style.display = 'block';
        frame.onclick = () => {
          if (!tw.done) return tw.finish();
          frame.onclick = null;
          showNode(node.next || '__end');
        };
        return;
      }
      for (const opt of opts) {
        const b = elx('button', 'dlg-opt', opt.present ? `▶ ${opt.t}` : `> ${opt.t}`);
        b.onclick = async () => {
          Audio.sfx('click');
          if (opt.effects) applyEffects(opt.effects, { caseId: G.s.caseState?.caseId });
          if (opt.present) {
            // confrontation: pick evidence
            const evId = await EvidenceUI.presentSheet({ title: t('confront','CONFRONT WITH EVIDENCE') });
            if (!evId) return; // cancelled — choose again
            if (evId === opt.correct) {
              Audio.sfx('reveal'); HUD.redFlash();
              await HUD.stamp('CONTRADICTION!');
              if (opt.effects) applyEffects(opt.effects, { caseId: G.s.caseState?.caseId });
              await playInline(opt.break || [{ t: '...' }]);
              showNode(opt.goto || '__end');
            } else {
              Audio.sfx('fail');
              G.s.caseState && (G.s.caseState.penalty += 1);
              HUD.toast(t('wrongEvidence','They do not waver. Wrong evidence.'), 'bad');
              await playInline(opt.wrong || [{ t: '"That proves nothing," ' + (lookupChar(phase.npc)?.name?.split(' ')[0] || 'they') + ' says flatly.' }]);
              showNode(nodeId); // stay — let the player pick another option
            }
          } else {
            showNode(opt.goto || node.next || '__end');
          }
        };
        optsBox.appendChild(b);
      }
    };

    const waitOpts = setInterval(() => {
      if (tw.done) { clearInterval(waitOpts); showOptions(); }
    }, 100);
    setTimeout(() => { if (!optsBox.children.length && (node.opts || []).filter(o => reqOk(o.req)).length) { clearInterval(waitOpts); showOptions(); } }, 1600);
  }

  function playInline(lines) {
    return new Promise(res => {
      const box = elx('div', 'dlg-inline');
      frame.querySelector('.dlg-body').appendChild(box);
      let i = 0;
      const play = () => {
        if (i >= lines.length) { box.remove(); return res(); }
        const line = lines[i++];
        if (line.sfx) Audio.sfx(line.sfx);
        box.innerHTML = '';
        const head = elx('div', 'narr-head');
        if (line.sp && line.sp !== 'NARRATOR') {
          head.appendChild(avatarEl(line.sp));
          const c = lookupChar(line.sp);
          head.appendChild(elx('div', 'narr-sp', c ? c.name : line.sp));
        }
        box.appendChild(head);
        const p = elx('div', 'narr-text');
        box.appendChild(p);
        const tw = HUD.typewriter(p, line.t, G.s.settings.textSpeed, () => Audio.sfx('type'));
        box.onclick = () => { if (!tw.done) tw.finish(); else play(); };
      };
      play();
    });
  }

  showNode(dlg.start || phase.node || 'start');
}
