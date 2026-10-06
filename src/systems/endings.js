/* CASE 404 — endings architecture. Five endings (A-E), computed from the full
   decision record: accusations, alliances, betrayals, evidence kept or lost.
   The final case (CASE 023) calls Endings.compute() to resolve the outcome.
   This module ships as the complete architecture; the data-driven requirements
   live in data/story-plan.json (endings.matrix). */

import { G } from '../engine/state.js';

export const ENDINGS = {
  A: {
    id: 'A', title: 'JUSTICE',
    desc: 'The full chain is proven in open court. The Registry falls. The erased are restored to the record.'
  },
  B: {
    id: 'B', title: 'WRONG ACCUSATION',
    desc: 'A name is spoken. The gavel falls. But the truth walks out of the courtroom wearing someone else\'s guilt.'
  },
  C: {
    id: 'C', title: 'TRUTH WITHOUT PROOF',
    desc: 'You know everything. You can prove nothing. The record stays closed — but so do your eyes, and you write it all down.'
  },
  D: {
    id: 'D', title: 'BETRAYAL',
    desc: 'The hand you trusted sold your name. The file with your face on it is the next one to go missing.'
  },
  E: {
    id: 'E', title: '404',
    desc: 'The deepest truth: CASE 404 was never missing. It was waiting — for the one investigator who would not stop.'
  }
};

export const Endings = {
  list() { return ENDINGS; },

  compute(profile = G.s) {
    const f = profile.flags || {};
    const done = profile.progress.completed || {};
    const trust = id => profile.npc?.[id]?.trust ?? 0;

    if (f.registry_exposed && f.archive_restored && trust('sarah') >= 40 && trust('emma') >= 30) return ENDINGS.E;
    if (f.trusted_betrayal) return ENDINGS.D;
    if (f.wrong_final_accusation) return ENDINGS.B;
    if (f.registry_exposed && !f.archive_restored) return ENDINGS.C;
    if (f.registry_exposed) return ENDINGS.A;
    return ENDINGS.C;
  },

  markSeen(id) {
    if (!G.s.progress.seenEndings.includes(id)) G.s.progress.seenEndings.push(id);
  }
};
