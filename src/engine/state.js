/* CASE 404 — game state: single profile object that persists across cases.
   Everything the save system writes lives here. */

import { bus } from './bus.js';

export const STATS = ['trust', 'fear', 'loyalty', 'suspicion', 'respect'];

export const THREAT_LABELS = [
  'DORMANT',
  'ANONYMOUS MESSAGES',
  'BEING FOLLOWED',
  'LOVED ONES THREATENED',
  'EVIDENCE STOLEN',
  'DISAPPEARANCES',
  'BREAK-IN',
  'DIRECT ATTACK'
];

export function freshProfile() {
  return {
    version: 1,
    createdAt: Date.now(),
    lastPlayed: Date.now(),
    player: { name: 'James Carter' },
    settings: { music: 0.6, sfx: 0.8, textSpeed: 'normal', language: 'en' }, // slow|normal|fast|instant
    progress: {
      unlocked: 0,              // highest playable case index
      currentCase: 0,           // case currently in progress
      completed: {},            // caseId -> outcomeId
      choices: [],              // global record of major choices
      seenEndings: []
    },
    evidence: [],               // [{id, caseId, foundAt}]
    caseState: null,            // active case run: {caseId, phase, flags, objectives, penalty, verdict}
    npc: {},                    // id -> {trust, fear, loyalty, suspicion, respect, met, memory:[]}
    flags: {},                  // global story flags
    threat: { level: 0, events: [] },
    phone: { messages: [], calls: [], notes: [], photos: [] },
    board: { nodes: [], links: [] }
  };
}

export const G = { s: freshProfile(), caseData: null, manifest: null };

/* ---------- NPC relationships ---------- */

export function rel(id) {
  const r = (G.s.npc[id] ??= {
    trust: 0, fear: 0, loyalty: 50, suspicion: 0, respect: 0,
    met: false, memory: []
  });
  return r;
}

export function remember(id, fact) {
  const r = rel(id);
  r.met = true;
  if (!r.memory.includes(fact)) r.memory.push(fact);
}

/* ---------- condition engine ----------
   req examples: "ev:e103"  "!flag:bishop_pressed"  "rel:tomas.trust>=2"
                 "done:1"  "outcome:1:justice"  "threat>=3"  "ev:a&flag:b"      */

export function reqOk(req) {
  if (!req) return true;
  return String(req).split('&').every(part => {
    const p = part.trim();
    if (!p) return true;
    if (p.startsWith('!')) return !reqOk(p.slice(1));
    if (p.startsWith('ev:')) return hasEv(p.slice(3));
    if (p.startsWith('flag:')) return !!G.s.flags[p.slice(5)];
    if (p.startsWith('rel:')) {
      const m = p.slice(4).match(/^(\w+)\.(\w+)(>=|<=|>|<|=)(\d+)$/);
      if (!m) return false;
      const v = rel(m[1])[m[2]] ?? 0, n = +m[4];
      switch (m[3]) { case '>=': return v >= n; case '<=': return v <= n; case '>': return v > n; case '<': return v < n; case '=': return v === n; }
    }
    if (p.startsWith('done:')) return G.s.progress.completed[p.slice(5)] !== undefined;
    if (p.startsWith('outcome:')) {
      const [, c, o] = p.split(':');
      return G.s.progress.completed[+c] === o;
    }
    if (p.startsWith('threat>=')) return G.s.threat.level >= +p.slice(8);
    return true;
  });
}

/* ---------- evidence ---------- */

export function hasEv(id) { return G.s.evidence.some(e => e.id === id); }

export function addEv(id, caseId) {
  if (hasEv(id)) return false;
  G.s.evidence.push({ id, caseId: caseId ?? (G.caseData ? G.caseData.caseId : null), foundAt: Date.now() });
  bus.emit('evidence-added', id);
  return true;
}

/* ---------- effects engine ----------
   "ev:ID"                      add evidence
   "flag:NAME" / "unflag:NAME"  global flags
   "cflag:NAME"                 case-scoped flag
   "rel:NPC.stat+2"             relationship change
   "threat:N"                   raise threat level
   "msg:FROM|TEXT"              phone message
   "note:TEXT"                  phone note
   "call:FROM|TEXT"             call log entry
   "board:t:id|Label"           board node (t: person|org|case|thing|mystery)
   "board:link:A|B|label"       board connection
   "obj:id|Text" / "objdone:id" objectives
   "unlock:N"                   unlock case N
   "choice:NAME|summary"        record major decision
   "sfx:name" / "music:mode"
   "penalty:+1" / "verdict:strong|weak"
   "endcase:OUTCOME"            complete current case
*/

export function applyEffects(effects = [], ctx = {}) {
  const events = [];
  for (const raw of effects) {
    if (!raw) continue;
    const [head, ...rest] = String(raw).split(':');
    const tail = rest.join(':');
    switch (head) {
      case 'ev': if (addEv(tail)) events.push({ k: 'ev', id: tail }); break;
      case 'flag': G.s.flags[tail] = true; break;
      case 'unflag': delete G.s.flags[tail]; break;
      case 'cflag': if (G.s.caseState) G.s.caseState.flags[tail] = true; break;
      case 'rel': {
        const m = tail.match(/^(\w+)\.(\w+)([+-])(\d+)$/);
        if (m) {
          const r = rel(m[1]); r.met = true;
          const d = (m[3] === '+' ? 1 : -1) * (+m[4]);
          r[m[2]] = Math.max(-10, Math.min(100, (r[m[2]] ?? 0) + d));
          events.push({ k: 'rel', id: m[1], stat: m[2], delta: d });
        }
        break;
      }
      case 'threat': {
        const n = +tail;
        if (n > G.s.threat.level) { G.s.threat.level = n; events.push({ k: 'threat', n }); }
        break;
      }
      case 'msg': {
        const [from, text] = splitPipe(tail);
        G.s.phone.messages.push({ id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6), from, text, time: nowLabel(), actions: null, resolved: null });
        events.push({ k: 'msg', from, text });
        break;
      }
      case 'note': G.s.phone.notes.push({ text: tail, time: nowLabel() }); events.push({ k: 'note' }); break;
      case 'call': { const [from, text] = splitPipe(tail); G.s.phone.calls.unshift({ from, text, time: nowLabel() }); break; }
      case 'board': {
        if (rest[0] === 'link') {
          const [a, b, label] = splitPipe(rest.slice(1).join(':'));
          if (!G.s.board.links.some(l => l.a === a && l.b === b && l.label === label)) G.s.board.links.push({ a, b, label: label || '' });
        } else {
          const [type, idLabel] = [rest[0], rest.slice(1).join(':')];
          const [id, label] = splitPipe(idLabel);
          if (!G.s.board.nodes.some(nd => nd.id === id)) G.s.board.nodes.push({ id, label: label || id, type: type || 'thing', x: null, y: null });
        }
        events.push({ k: 'board' });
        break;
      }
      case 'obj': { const [id, text] = splitPipe(tail); if (G.s.caseState) { G.s.caseState.objectives ??= []; if (!G.s.caseState.objectives.some(o => o.id === id)) G.s.caseState.objectives.push({ id, text, done: false }); } events.push({ k: 'obj' }); break; }
      case 'objdone': if (G.s.caseState) (G.s.caseState.objectives ?? []).forEach(o => { if (o.id === tail) o.done = true; }); events.push({ k: 'obj' }); break;
      case 'unlock': { const n = +tail; if (n > G.s.progress.unlocked) { G.s.progress.unlocked = n; events.push({ k: 'unlock', n }); } break; }
      case 'choice': { const [name, summary] = splitPipe(tail); G.s.progress.choices.push({ name, summary, caseId: ctx.caseId ?? null, at: Date.now() }); events.push({ k: 'choice', name }); break; }
      case 'sfx': events.push({ k: 'sfx', name: tail }); break;
      case 'music': events.push({ k: 'music', mode: tail }); break;
      case 'penalty': if (G.s.caseState) G.s.caseState.penalty += +tail.replace('+', '') || 1; break;
      case 'verdict': if (G.s.caseState) G.s.caseState.verdict = tail; break;
      case 'endcase': events.push({ k: 'endcase', outcome: tail }); break;
      case 'remember': { const [id, fact] = splitPipe(tail); remember(id, fact); break; }
      default: console.warn('[fx] unknown effect', raw);
    }
  }
  G.s.lastPlayed = Date.now();
  for (const ev of events) bus.emit('fx:' + ev.k, ev);
  bus.emit('state-changed');
  return events;
}

function splitPipe(s) { const i = s.indexOf('|'); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]; }

export function nowLabel() {
  // In-world clock: the story starts Oct 5, Year One of the investigation.
  const base = Date.now();
  const d = new Date(base);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- case lifecycle ---------- */

export function newCaseState(caseId) {
  return { caseId, phase: null, flags: {}, objectives: [], penalty: 0, verdict: null };
}

export function recordCompletion(caseId, outcome) {
  const prev = G.s.progress.completed[caseId];
  // Keep the best outcome ever achieved (strong outcomes sort later in the outcome list).
  if (prev === undefined || outcomeRank(outcome) > outcomeRank(prev)) G.s.progress.completed[caseId] = outcome;
}

const OUTCOME_ORDER = ['failed', 'delayed', 'partial', 'pending', 'pass', 'pass_a', 'strong', 'justice'];
function outcomeRank(o) { const i = OUTCOME_ORDER.indexOf(o); return i < 0 ? 0 : i; }
