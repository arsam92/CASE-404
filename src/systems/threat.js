/* CASE 404 — threat system. Threat levels 0-7 escalate as the player digs
   into CASE 404. Each escalation produces a visible, audible event and is
   recorded in the dossier. Levels also gate story requirements (req "threat>=N"). */

import { G, THREAT_LABELS } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';
import { Store } from '../engine/save.js';
import { HUD, elx } from '../ui/hud.js';

export const Threats = {
  raise(n) {
    if (n <= G.s.threat.level) return;
    G.s.threat.level = n;
    G.s.threat.events.push({ level: n, label: THREAT_LABELS[n] || 'UNKNOWN', at: Date.now() });
    Audio.sfx('threat');
    HUD.redFlash();

    const hud = document.getElementById('hud');
    const b = elx('div', 'threat-banner');
    b.innerHTML = `<div class="tb-lvl">THREAT LEVEL ${n}</div><div class="tb-lbl">${THREAT_LABELS[n] || ''}</div>`;
    hud.appendChild(b);
    requestAnimationFrame(() => b.classList.add('show'));
    setTimeout(() => { b.classList.remove('show'); setTimeout(() => b.remove(), 500); }, 3400);
    Store.auto();
  }
};
