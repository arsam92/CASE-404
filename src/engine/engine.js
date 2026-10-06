/* CASE 404 — the phase runner. Walks a case's phases (narrative, location, hub,
   dialogue, contradiction, decision, courtroom, action, phone, epilogue).
   Case content is 100% data-driven from /data/cases/*.json — see docs/ADDING_CASES.md */

import { G, applyEffects, reqOk, newCaseState, recordCompletion, rel } from './state.js';
import { loadJSON } from './data.js';
import { bus } from './bus.js';
import { Store } from './save.js';
import { Audio } from './audio.js';
import { HUD, elx, avatarEl, lookupChar } from '../ui/hud.js';
import { renderLocationPhase, renderHubPhase } from '../ui/locations.js';
import { runDialogue } from '../systems/dialogue.js';
import { runCourtroom } from '../systems/courtroom.js';
import { EvidenceUI } from '../systems/evidence.js';
import { PhoneUI } from '../systems/phone.js';
import { BoardUI } from '../systems/board.js';
import { Threats } from '../systems/threat.js';
import { Endings } from '../systems/endings.js';
import * as Screens from '../ui/screens.js';

export const Engine = {
  stage: document.getElementById('stage'),
  hub: null,
  busy: false,

  async boot() {
    bus.on('nav', r => this.nav(r));
    bus.on('open', n => this.openOverlay(n));
    try {
      G.manifest = await loadJSON('data/manifest.json');
      G.chars = await loadJSON('data/characters.json');
      G.sharedEvidence = await loadJSON('data/evidence.json');
      G.storyPlan = await loadJSON('data/story-plan.json');
    } catch (e) {
      console.error(e);
      this.stage.innerHTML = `<div class="screen center"><div class="panel pad">Failed to load game data.<br><small>${e.message}</small></div></div>`;
      return;
    }
    const meta = Store.meta();
    if (meta?.settings) {
      G.s.settings = Object.assign(G.s.settings, meta.settings);
    }
    Audio.setVolumes(G.s.settings.music, G.s.settings.sfx);
    Screens.renderBoot(this.stage, () => {
      Store.metaSet({ booted: true, settings: G.s.settings });
      this.show('menu');
    });
  },

  nav(route) {
    Audio.init();
    if (route === 'select') route = 'caseSelect';
    if (route === 'menu') return this.show('menu');
    if (route === 'caseSelect') return this.show('caseSelect');
    if (route === 'archive') return this.show('archive');
    if (route === 'story') return this.show('story');
    if (route === 'pause') return Screens.renderPause();
    if (route === 'settings') return Screens.renderSettings();
    if (route === 'save') return Screens.renderSaveLoad('save');
    if (route === 'load') return Screens.renderSaveLoad('load');
    if (route === 'resume') return Screens.resumeFromSave();
    if (route === 'resumeCase') {
      const cs = G.s.caseState;
      if (cs) return this.startCase(cs.caseId, { resume: true });
      return this.show('caseSelect');
    }
    if (route === 'new') return Screens.confirmNewGame();
    if (route.startsWith('startCase:')) return this.startCase(+route.split(':')[1]);
    if (route.startsWith('replayCase:')) return this.startCase(+route.split(':')[1], { replay: true });
    if (route === 'quitToMenu') { Store.auto(); return this.show('menu'); }
  },

  openOverlay(name) {
    if (name === 'phone') return PhoneUI.open();
    if (name === 'board') return BoardUI.open();
    if (name === 'evidence') return EvidenceUI.openArchive();
  },

  clearStage() {
    bus.emit('transition');
    this.stage.innerHTML = '';
    HUD.topbar(false);
  },

  show(name) {
    this.clearStage();
    if (name === 'menu') return Screens.renderMenu(this.stage);
    if (name === 'caseSelect') return Screens.renderCaseSelect(this.stage);
    if (name === 'archive') return Screens.renderArchive(this.stage);
    if (name === 'story') return Screens.renderStoryArchive(this.stage);
  },

  async startCase(id, opts = {}) {
    let data;
    try { data = await loadJSON(`data/cases/case${String(id).padStart(3, '0')}.json`); }
    catch (e) { HUD.toast('Case file not found.'); return; }

    if (!opts.resume) {
      if (opts.replay) HUD.toast('Replaying case — records may change.', 'warn');
      G.s.caseState = newCaseState(id);
      G.s.progress.currentCase = id;
    } else if (!G.s.caseState || G.s.caseState.caseId !== id) {
      G.s.caseState = newCaseState(id);
    }
    G.caseData = data;
    this.hub = null;
    this.clearStage();
    HUD.topbar(true, { code: data.code, title: data.title });
    Audio.setMode(data.ambient || 'investigate');

    if (!opts.resume && data.entryEffects) applyEffects(data.entryEffects, { caseId: id });
    if (!opts.resume && data.brief) Screens.renderCaseBrief(this.stage, data, () => this.goto(data.startPhase));
    else this.goto(G.s.caseState.phase || data.startPhase);
    Store.auto();
  },

  async goto(phaseId) {
    if (!phaseId || phaseId === 'END') return;
    const phase = (G.caseData?.phases || []).find(p => p.id === phaseId);
    if (!phase) { console.error('missing phase', phaseId); HUD.toast('Script error: missing phase ' + phaseId); return; }
    bus.emit('transition');
    if (G.s.caseState) G.s.caseState.phase = phaseId;
    this.stage.innerHTML = '';
    if (phase.enterEffects) applyEffects(phase.enterEffects, { caseId: G.s.caseState?.caseId });
    for (const er of (phase.enterEffectsReq || [])) {
      if (reqOk(er.req)) applyEffects(er.effects || [], { caseId: G.s.caseState?.caseId });
    }
    if (phase.music) Audio.setMode(phase.music);
    Store.auto();

    switch (phase.type) {
      case 'narrative': return this._narrative(phase);
      case 'hub': this.hub = phaseId; return renderHubPhase(this.stage, phase, id => this.goto(id));
      case 'location': return renderLocationPhase(this.stage, phase, id => this.goto(id), () => this.goto(phase.back || this.hub));
      case 'dialogue': return runDialogue(this.stage, phase, () => this.goto(phase.next || this.hub));
      case 'present': return this._present(phase);
      case 'decision': return this._decision(phase);
      case 'courtroom': return runCourtroom(this.stage, phase, () => this.goto(phase.next));
      case 'action': return this._action(phase);
      case 'phone': return this._phoneEvent(phase);
      case 'epilogue': return this._epilogue(phase);
      default: console.error('unknown phase type', phase.type);
    }
  },

  _narrative(phase) {
    const wrap = elx('div', 'screen narrative');
    const box = elx('div', 'narr-box');
    wrap.appendChild(box);
    this.stage.appendChild(wrap);
    let i = 0;
    let current = null;

    const nextLine = () => {
      while (i < phase.lines.length) {
        const peek = phase.lines[i];
        if (peek.req && !reqOk(peek.req)) i++;
        else break;
      }
      if (i >= phase.lines.length) {
        return phase.next ? this.goto(phase.next) : (phase.back ? this.goto(phase.back) : null);
      }
      const line = phase.lines[i++];
      if (line.sfx) Audio.sfx(line.sfx);
      if (line.fx === 'flash') HUD.redFlash();
      box.innerHTML = '';
      const head = elx('div', 'narr-head');
      if (line.sp && line.sp !== 'NARRATOR') {
        head.appendChild(avatarEl(line.sp));
        const c = lookupChar(line.sp);
        head.appendChild(elx('div', 'narr-sp', (c ? c.name : line.sp)));
      } else {
        head.appendChild(elx('div', 'narr-sp narr-sp-sys', line.sys || ''));
      }
      box.appendChild(head);
      const p = elx('div', 'narr-text');
      box.appendChild(p);
      const tw = HUD.typewriter(p, line.t, G.s.settings.textSpeed, () => Audio.sfx('type'));
      current = tw;
      const hint = elx('div', 'narr-hint', i >= phase.lines.length ? '— tap to continue —' : '▼');
      box.appendChild(hint);
    };

    wrap.addEventListener('pointerup', () => {
      if (current && !current.done) current.finish();
      else nextLine();
    });
    nextLine();
  },

  _present(phase) {
    this.stage.querySelectorAll('.present-screen').forEach(e => e.remove());
    const wrap = elx('div', 'screen present-screen');
    wrap.innerHTML = `
      <div class="present-statement panel">
        <div class="narr-head"></div>
        <div class="narr-text"></div>
      </div>
      <div class="present-prompt">${phase.prompt || 'Present the evidence that contradicts this statement.'}</div>`;
    const head = wrap.querySelector('.narr-head');
    if (phase.sp && phase.sp !== 'NARRATOR') {
      head.appendChild(avatarEl(phase.sp));
      const c = lookupChar(phase.sp);
      head.appendChild(elx('div', 'narr-sp', c ? c.name : phase.sp));
    }
    wrap.querySelector('.narr-text').textContent = phase.statement;
    this.stage.appendChild(wrap);
    this._presentLoop(wrap, phase);
  },

  async _presentLoop(wrap, phase) {
    const evId = await EvidenceUI.presentSheet({ title: 'PRESENT EVIDENCE' });
    if (!evId) return this._presentLoop(wrap, phase);
    if (evId === phase.correct) {
      Audio.sfx('reveal'); HUD.redFlash();
      G.s.flags.ach_first_contradiction = true;
      await HUD.stamp('CONTRADICTION!');
      applyEffects(phase.effects || [], { caseId: G.s.caseState?.caseId });
      if (phase.break?.length) await this._playLines(wrap, phase.break);
      if (phase.next) this.goto(phase.next);
    } else {
      Audio.sfx('fail');
      G.s.caseState && (G.s.caseState.penalty += 1);
      HUD.toast('That does not contradict the statement. (' + G.s.caseState.penalty + ' missteps)', 'bad');
      if (phase.wrong?.length) await this._playLines(wrap, phase.wrong);
      this._presentLoop(wrap, phase);
    }
  },

  _playLines(wrap, lines) {
    lines = (lines || []).filter(l => !l.req || reqOk(l.req));
    if (!lines.length) return Promise.resolve();
    return new Promise(res => {
      const box = elx('div', 'narr-box inline');
      wrap.appendChild(box);
      let i = 0;
      const play = () => {
        if (i >= lines.length) { box.onclick = null; return res(); }
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
  },

  _decision(phase) {
    const wrap = elx('div', 'screen decision');
    wrap.appendChild(elx('div', 'decision-tag', phase.tag || 'DECISION'));
    wrap.appendChild(elx('div', 'decision-prompt', phase.prompt));
    const list = elx('div', 'decision-list');
    wrap.appendChild(list);
    this.stage.appendChild(wrap);
    for (const opt of phase.options) {
      if (opt.req && !reqOk(opt.req)) continue;
      const b = elx('button', 'decision-opt panel');
      b.innerHTML = `<b>${opt.label}</b>${opt.desc ? `<span>${opt.desc}</span>` : ''}`;
      b.onclick = async () => {
        Audio.sfx('select');
        b.disabled = true;
        if (opt.effects) applyEffects(opt.effects, { caseId: G.s.caseState?.caseId });
        if (opt.result?.length) await this._playLines(wrap, opt.result);
        this.goto(opt.goto || phase.next);
      };
      list.appendChild(b);
    }
    if (!phase.noEscape && phase.allowBack) {
      const back = elx('button', 'btn btn-ghost decision-back', 'Not yet.');
      back.onclick = () => this.goto(phase.back || this.hub);
      wrap.appendChild(back);
    }
  },

  _action(phase) {
    const wrap = elx('div', 'screen action-screen');
    this.stage.appendChild(wrap);
    let si = 0;
    const runStep = () => {
      if (si >= phase.steps.length) {
        if (phase.successEffects) applyEffects(phase.successEffects, { caseId: G.s.caseState?.caseId });
        Audio.sfx('success');
        return phase.next ? this.goto(phase.next) : (this.goto(this.hub));
      }
      const step = phase.steps[si];
      wrap.innerHTML = `<div class="action-tag">${phase.title || 'DANGER'}</div>
        <div class="narr-box"><div class="narr-text"></div></div>
        <div class="action-timer"><i></i></div>
        <div class="action-choices"></div>`;
      const txt = wrap.querySelector('.narr-text');
      const tw = HUD.typewriter(txt, step.t, G.s.settings.textSpeed, () => Audio.sfx('type'));
      const choices = wrap.querySelector('.action-choices');
      const timerBar = wrap.querySelector('.action-timer i');
      const time = step.time || 6;
      timerBar.style.transition = `width ${time}s linear`;
      let locked = false;

      const answer = (choice) => {
        if (locked) return;
        locked = true;
        if (choice && choice.correct) {
          Audio.sfx('select');
          if (choice.effects) applyEffects(choice.effects, { caseId: G.s.caseState?.caseId });
          (choice.lines?.length ? this._playLines(wrap, choice.lines) : Promise.resolve())
            .then(() => { si++; runStep(); });
        } else {
          Audio.sfx('fail');
          HUD.redFlash();
          G.s.caseState && (G.s.caseState.penalty += 1);
          const failLines = (choice && choice.lines) || step.failLines || [{ t: 'You hesitate. The moment passes. You try again.' }];
          this._playLines(wrap, failLines).then(runStep);
        }
      };

      setTimeout(() => { timerBar.style.width = '0%'; }, 60);
      setTimeout(() => { if (!locked) answer(null); }, time * 1000);

      const showChoices = () => {
        step.choices.forEach(ch => {
          const b = elx('button', 'decision-opt panel', `<b>${ch.label}</b>`);
          b.onclick = () => answer(ch);
          choices.appendChild(b);
        });
      };
      const wait = setInterval(() => { if (tw.done) { clearInterval(wait); showChoices(); } }, 100);
      setTimeout(() => { if (choices.children.length === 0) { clearInterval(wait); showChoices(); } }, 1400);
    };
    runStep();
  },

  _phoneEvent(phase) {
    const msg = {
      id: 'mev' + Date.now(),
      from: phase.from || 'UNKNOWN',
      text: phase.text,
      time: 'NOW',
      actions: phase.actions || null
    };
    G.s.phone.messages.push(msg);
    bus.emit('fx:msg', { from: msg.from, text: msg.text });
    PhoneUI.openWithAction(msg, () => {
      if (phase.next) this.goto(phase.next);
      else if (this.hub) this.goto(this.hub);
    });
  },

  _epilogue(phase) {
    const finish = () => {
      let outcome = phase.outcome;
      for (const or of (phase.outcomeReq || [])) {
        if (reqOk(or.req)) { outcome = or.outcome; break; }
      }
      if (outcome) this.completeCase(outcome, phase);
    };
    if (phase.lines?.length) {
      const wrap = elx('div', 'screen narrative');
      this.stage.appendChild(wrap);
      this._playLines(wrap, phase.lines).then(finish);
    } else finish();
  },

  completeCase(outcome, phase = {}) {
    const caseId = G.caseData.caseId;
    if (G.s.caseState && (G.s.caseState.penalty || 0) === 0) G.s.flags.ach_clean_record = true;
    recordCompletion(caseId, outcome);
    const nextId = phase.nextCase ?? (caseId + 1);
    if (G.manifest.cases.some(c => c.id === nextId)) applyEffects([`unlock:${nextId}`]);
    if (phase.completeEffects) applyEffects(phase.completeEffects, { caseId });
    G.s.caseState = null;
    Store.auto();
    Audio.setMode('menu');
    Screens.renderCaseComplete(this.stage, {
      caseId, outcome,
      title: G.caseData.title,
      code: G.caseData.code,
      lines: phase.lines || [],
      nextId
    });
  }
};

bus.on('fx:ev', e => {
  const def = EvidenceUI.findDef(e.id);
  HUD.toast(`EVIDENCE — ${def?.name || e.id}`, 'good');
  Audio.sfx('camera');
  Store.auto();
});
bus.on('fx:msg', e => {
  HUD.toast(`New message — ${e.from}`, 'msg');
  Audio.sfx('notify');
  Store.auto();
});
bus.on('fx:threat', e => Threats.raise(e.n));
bus.on('fx:unlock', e => HUD.toast(`CASE ${String(e.n).padStart(3, '0')} unlocked`, 'good'));
bus.on('fx:rel', e => {
  const c = lookupChar(e.id);
  const statLabel = { trust: 'Trust', fear: 'Fear', loyalty: 'Loyalty', suspicion: 'Suspicion', respect: 'Respect' }[e.stat] || e.stat;
  HUD.toast(`${c ? c.name : e.id}: ${statLabel} ${e.delta > 0 ? '+' : ''}${e.delta}`, e.delta >= 0 ? 'good' : 'bad');
});
