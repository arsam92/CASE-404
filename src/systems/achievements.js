/* CASE 404 — achievement system.
   Data-driven from data/achievements.json. Unlocks are checked after major
   state changes (evidence, flags, case complete, relationships, threat).
   Progress is stored on G.s.achievements = { unlocked: {id: timestamp}, seen: [] }. */

import { G, reqOk } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';
import { HUD } from '../ui/hud.js';
import { Store } from '../engine/save.js';
import { Haptics } from './haptics.js';
import { Glitch } from './glitch.js';

let defs = null;

export const Achievements = {
  async load() {
    if (defs) return defs;
    try {
      const r = await fetch('data/achievements.json');
      const j = await r.json();
      defs = j.achievements || [];
    } catch {
      defs = [];
    }
    return defs;
  },

  ensureState() {
    if (!G.s.achievements) G.s.achievements = { unlocked: {}, seen: [] };
    if (!G.s.achievements.unlocked) G.s.achievements.unlocked = {};
    if (!G.s.achievements.seen) G.s.achievements.seen = [];
  },

  isUnlocked(id) {
    this.ensureState();
    return !!G.s.achievements.unlocked[id];
  },

  list() {
    return defs || [];
  },

  unlockedCount() {
    this.ensureState();
    return Object.keys(G.s.achievements.unlocked).length;
  },

  unlock(id, silent = false) {
    this.ensureState();
    if (G.s.achievements.unlocked[id]) return false;
    G.s.achievements.unlocked[id] = Date.now();
    if (!silent) this._announce(id);
    Store.auto();
    bus.emit('achievement', id);
    return true;
  },

  _announce(id) {
    const def = (defs || []).find(a => a.id === id);
    const title = def?.title || id;
    const icon = def?.icon || '★';
    HUD.toast(`${icon}  ACHIEVEMENT — ${title}`, 'good');
    Audio.sfx('success');
    try { Haptics.success(); } catch {}
    if (id === 'archive_glitch') {
      try { Glitch.burst('hard'); } catch {}
    }
  },

  async check() {
    await this.load();
    this.ensureState();
    this._sideFlags();
    let any = false;
    for (const a of defs) {
      if (G.s.achievements.unlocked[a.id]) continue;
      if (a.req && reqOk(a.req)) {
        G.s.achievements.unlocked[a.id] = Date.now();
        this._announce(a.id);
        any = true;
      }
    }
    if (any) Store.auto();
    return any;
  },

  _sideFlags() {
    if ((G.s.board?.links?.length || 0) >= 8) G.s.flags.ach_board8 = true;
    const met = Object.values(G.s.npc || {}).filter(n => n.met).length;
    if (met >= 10) G.s.flags.ach_met10 = true;
  }
};

bus.on('state-changed', () => { Achievements.check(); });
bus.on('fx:ev', () => { Achievements.check(); });
bus.on('fx:endcase', () => { Achievements.check(); });
bus.on('fx:threat', () => { Achievements.check(); });
bus.on('fx:achieve', e => { Achievements.unlock(e.id); });
