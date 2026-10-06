/* CASE 404 — save system (localStorage). 3 manual slots + autosave + meta. */

import { G, freshProfile } from './state.js';

const PREFIX = 'case404_';
const SLOTS = ['auto', '1', '2', '3'];

function key(slot) { return PREFIX + 'save_' + slot; }

function serialize() {
  return JSON.stringify({ savedAt: Date.now(), state: G.s });
}

function deserialize(raw) {
  const obj = JSON.parse(raw);
  if (!obj || !obj.state) throw new Error('corrupt save');
  // Forward-merge onto a fresh profile so new fields never break old saves.
  return Object.assign(freshProfile(), obj.state);
}

export const Store = {
  slots: SLOTS,

  save(slot) {
    localStorage.setItem(key(slot), serialize());
    localStorage.setItem(PREFIX + 'lastSlot', slot);
    return true;
  },

  load(slot) {
    const raw = localStorage.getItem(key(slot));
    if (!raw) return null;
    try { return deserialize(raw); } catch (e) { console.error(e); return null; }
  },

  auto() { try { this.save('auto'); } catch (e) { /* storage full */ } },

  list() {
    return SLOTS.map(slot => {
      const raw = localStorage.getItem(key(slot));
      if (!raw) return { slot, empty: true };
      try {
        const o = JSON.parse(raw);
        return {
          slot, empty: false, savedAt: o.savedAt,
          caseId: o.state?.progress?.currentCase ?? 0,
          label: o.state?.caseState ? `CASE ${String(o.state.caseState.caseId).padStart(3, '0')}` : '—',
          threat: o.state?.threat?.level ?? 0
        };
      } catch { return { slot, empty: true }; }
    });
  },

  latest() {
    let best = null;
    for (const slot of SLOTS) {
      const raw = localStorage.getItem(key(slot));
      if (!raw) continue;
      try { const o = JSON.parse(raw); if (!best || o.savedAt > best.savedAt) best = { slot, ...o }; }
      catch { /* skip */ }
    }
    return best;
  },

  deleteSlot(slot) { localStorage.removeItem(key(slot)); },

  meta() {
    const raw = localStorage.getItem(PREFIX + 'meta');
    if (!raw) return { booted: false, settings: null };
    try { return JSON.parse(raw); } catch { return { booted: false, settings: null }; }
  },

  metaSet(m) { try { localStorage.setItem(PREFIX + 'meta', JSON.stringify(m)); } catch { /* ignore */ } },

  wipeAll() {
    for (const slot of SLOTS) localStorage.removeItem(key(slot));
    localStorage.removeItem(PREFIX + 'meta');
    localStorage.removeItem(PREFIX + 'lastSlot');
  }
};
