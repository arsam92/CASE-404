/* CASE 404 — the player's in-game smartphone: messages, calls, case files,
   evidence shortcut, board shortcut, contacts, notes. A core gameplay surface. */

import { G, applyEffects, rel } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';
import { Store } from '../engine/save.js';
import { elx, lookupChar } from '../ui/hud.js';
import { EvidenceUI } from './evidence.js';

const layer = () => document.getElementById('phoneLayer');

const APPS = [
  { id: 'messages', name: 'Messages', glyph: '✉' },
  { id: 'calls', name: 'Calls', glyph: '☏' },
  { id: 'files', name: 'Case Files', glyph: '▣' },
  { id: 'evidence', name: 'Evidence', glyph: '◈' },
  { id: 'board', name: 'Board', glyph: '⌗' },
  { id: 'contacts', name: 'Contacts', glyph: '☰' },
  { id: 'notes', name: 'Notes', glyph: '✎' },
  { id: 'settings', name: 'Settings', glyph: '⚙' }
];

export const PhoneUI = {
  _onDone: null,
  _currentApp: 'home',

  open(app = 'home') {
    Audio.sfx('whoosh');
    const root = layer();
    root.innerHTML = '';
    root.classList.add('open');
    const phone = elx('div', 'phone');
    phone.innerHTML = `
      <div class="phone-notch"></div>
      <div class="phone-status"><span id="phClock">--:--</span><span>CASE 404 · ▮▮▮</span></div>
      <div class="phone-body" id="phBody"></div>
      <button class="phone-home" id="phHome">◉</button>`;
    root.appendChild(phone);
    phone.querySelector('#phHome').onclick = () => {
      Audio.sfx('click');
      if (this._currentApp === 'home') this.close();
      else this.renderApp('home');
    };
    const d = new Date();
    phone.querySelector('#phClock').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    this.renderApp(app);
    Store.auto();
  },

  close() {
    bus.emit('transition');
    const root = layer();
    root.classList.remove('open');
    root.innerHTML = '';
    if (this._onDone) { const cb = this._onDone; this._onDone = null; cb(); }
  },

  openWithAction(msg, onDone) {
    this._onDone = onDone;
    this.open('messages');
    setTimeout(() => this.renderThread(msg.from, msg.id), 60);
  },

  /* ---------------- home ---------------- */

  renderHome(body) {
    body.appendChild(elx('div', 'ph-wallpaper', '<div class="ph-wp-404">404</div>'));
    const grid = elx('div', 'ph-apps');
    const unread = G.s.phone.messages.filter(m => !m.read).length;
    for (const app of APPS) {
      const b = elx('button', 'ph-app');
      b.innerHTML = `<span class="ph-glyph">${app.glyph}</span><span>${app.name}</span>${app.id === 'messages' && unread ? `<i class="ph-badge">${unread}</i>` : ''}`;
      b.onclick = () => { Audio.sfx('click'); this.renderApp(app.id); };
      grid.appendChild(b);
    }
    body.appendChild(grid);
  },

  /* ---------------- app router ---------------- */

  renderApp(id) {
    this._currentApp = id;
    const body = document.getElementById('phBody');
    if (!body) return;
    body.innerHTML = '';
    const bar = elx('div', 'ph-appbar');
    if (id !== 'home') {
      const back = elx('button', 'ph-back', '‹');
      back.onclick = () => { Audio.sfx('click'); this.renderApp('home'); };
      bar.appendChild(back);
    }
    bar.appendChild(elx('span', 'ph-apptitle', (APPS.find(a => a.id === id) || { name: 'CASE 404' }).name.toUpperCase()));
    body.appendChild(bar);
    switch (id) {
      case 'home': return this.renderHome(body);
      case 'messages': return this.renderMessages(body);
      case 'calls': return this.renderCalls(body);
      case 'files': return this.renderFiles(body);
      case 'evidence': this.close(); return EvidenceUI.openArchive();
      case 'board': this.close(); return bus.emit('open', 'board');
      case 'contacts': return this.renderContacts(body);
      case 'notes': return this.renderNotes(body);
      case 'settings': this.close(); return bus.emit('nav', 'settings');
    }
  },

  /* ---------------- messages ---------------- */

  renderMessages(body) {
    const threads = {};
    for (const m of G.s.phone.messages) (threads[m.from] ??= []).push(m);
    const list = elx('div', 'ph-list');
    const keys = Object.keys(threads);
    if (!keys.length) list.appendChild(elx('div', 'empty-note', 'No messages.'));
    for (const from of keys) {
      const msgs = threads[from];
      const last = msgs[msgs.length - 1];
      const row = elx('button', 'ph-thread panel');
      row.innerHTML = `<div class="ph-thread-from ${from === 'UNKNOWN' ? 'unknown' : ''}">${from}</div>
        <div class="ph-thread-last">${last.text.slice(0, 42)}${last.text.length > 42 ? '…' : ''}</div>
        <div class="ph-thread-time">${msgs.filter(m => !m.read).length || ''}</div>`;
      row.onclick = () => { Audio.sfx('click'); this.renderThread(from); };
      list.appendChild(row);
    }
    body.appendChild(list);
  },

  renderThread(from, focusId) {
    const body = document.getElementById('phBody');
    body.innerHTML = '';
    const bar = elx('div', 'ph-appbar');
    const back = elx('button', 'ph-back', '‹');
    back.onclick = () => { Audio.sfx('click'); this.renderApp('messages'); };
    bar.appendChild(back);
    bar.appendChild(elx('span', 'ph-apptitle ' + (from === 'UNKNOWN' ? 'unknown' : ''), from.toUpperCase()));
    body.appendChild(bar);

    const convo = elx('div', 'ph-convo');
    const msgs = G.s.phone.messages.filter(m => m.from === from);
    for (const m of msgs) {
      m.read = true;
      const b = elx('div', 'ph-bubble' + (m.from === 'UNKNOWN' || m.from === 'SYSTEM' ? ' them' : ' them'));
      b.innerHTML = `<p>${m.text}</p><span class="ph-bt">${m.time || ''}</span>`;
      convo.appendChild(b);
      if (m.actions && !m.resolved) {
        const act = elx('div', 'ph-actions');
        for (const a of m.actions) {
          const ab = elx('button', 'ph-action-btn', a.label);
          ab.onclick = () => {
            Audio.sfx('select');
            m.resolved = a.label;
            if (a.effects) applyEffects(a.effects, { caseId: G.s.caseState?.caseId });
            if (a.response) {
              setTimeout(() => {
                G.s.phone.messages.push({ id: 'm' + Date.now(), from: m.from, text: a.response, time: 'NOW', read: false });
                Audio.sfx('notify');
                this.renderThread(from);
                Store.auto();
              }, 700);
            } else {
              this.renderThread(from);
            }
            Store.auto();
          };
          act.appendChild(ab);
        }
        convo.appendChild(act);
      }
    }
    body.appendChild(convo);
    convo.scrollTop = convo.scrollHeight;

    const done = elx('button', 'btn btn-ghost ph-done', 'CLOSE PHONE');
    done.onclick = () => { Audio.sfx('click'); this.close(); };
    body.appendChild(done);
  },

  /* ---------------- calls ---------------- */

  renderCalls(body) {
    const list = elx('div', 'ph-list');
    if (!G.s.phone.calls.length) list.appendChild(elx('div', 'empty-note', 'No call history.'));
    for (const c of G.s.phone.calls) {
      list.appendChild(elx('div', 'ph-callrow panel', `<b>${c.from}</b><span>${c.text}</span><i>${c.time}</i>`));
    }
    body.appendChild(list);
  },

  /* ---------------- case files ---------------- */

  renderFiles(body) {
    const cs = G.s.caseState;
    const caseMeta = G.manifest?.cases.find(c => c.id === (cs?.caseId ?? G.s.progress.currentCase));
    const wrap = elx('div', 'ph-files');
    if (caseMeta) {
      wrap.innerHTML = `<div class="ph-file-code">${caseMeta.code}</div>
        <div class="ph-file-title">${caseMeta.title}</div>
        <p class="ph-file-brief">${caseMeta.brief || ''}</p>`;
    }
    if (cs?.objectives?.length) {
      const obj = elx('div', 'ph-objectives', '<h4>OBJECTIVES</h4>');
      for (const o of cs.objectives) {
        obj.appendChild(elx('div', 'ph-obj' + (o.done ? ' done' : ''), `${o.done ? '☑' : '☐'} ${o.text}`));
      }
      wrap.appendChild(obj);
    }
    const threat = elx('div', 'ph-threatlvl', `<h4>THREAT LEVEL</h4><div class="tl-row">${'▮'.repeat(G.s.threat.level)}${'▯'.repeat(Math.max(0, 7 - G.s.threat.level))} <b>${G.s.threat.level}/7</b></div>`);
    wrap.appendChild(threat);
    const done = Object.entries(G.s.progress.completed);
    if (done.length) {
      const comp = elx('div', 'ph-completed', '<h4>CLOSED CASES</h4>');
      for (const [id, outcome] of done) {
        const cm = G.manifest?.cases.find(c => c.id === +id);
        comp.appendChild(elx('div', 'ph-donecase', `${cm ? cm.code : 'CASE ' + id} — outcome: ${outcome.toUpperCase()}`));
      }
      wrap.appendChild(comp);
    }
    body.appendChild(wrap);
  },

  /* ---------------- contacts ---------------- */

  renderContacts(body) {
    const list = elx('div', 'ph-list');
    const met = Object.entries(G.s.npc).filter(([, r]) => r.met);
    if (!met.length) list.appendChild(elx('div', 'empty-note', 'No contacts yet.'));
    for (const [id, r] of met) {
      const c = lookupChar(id) || G.chars?.[id] || { name: id, role: 'UNKNOWN' };
      const row = elx('div', 'ph-contact panel');
      row.innerHTML = `<b>${c.name}</b><span>${c.role || ''}</span>
        <div class="ph-relbars">
          ${['trust', 'fear', 'loyalty'].map(s => `<div class="ph-relbar"><span>${s}</span><i style="width:${Math.max(0, Math.min(100, r[s] ?? 0))}%"></i></div>`).join('')}
        </div>`;
      list.appendChild(row);
    }
    body.appendChild(list);
  },

  /* ---------------- notes ---------------- */

  renderNotes(body) {
    const wrap = elx('div', 'ph-notes');
    const list = elx('div', 'ph-notelist');
    if (!G.s.phone.notes.length) list.appendChild(elx('div', 'empty-note', 'No notes.'));
    for (const n of G.s.phone.notes) list.appendChild(elx('div', 'ph-note panel', `<p>${n.text}</p><i>${n.time}</i>`));
    wrap.appendChild(list);
    const input = elx('input', 'ph-note-input');
    input.placeholder = 'Type a note...';
    input.maxLength = 120;
    const add = elx('button', 'btn btn-primary', 'ADD NOTE');
    add.onclick = () => {
      if (!input.value.trim()) return;
      G.s.phone.notes.push({ text: input.value.trim(), time: 'NOTE' });
      Audio.sfx('click');
      Store.auto();
      this.renderApp('notes');
    };
    wrap.append(input, add);
    body.appendChild(wrap);
  }
};

/* clicking outside the phone closes it */
document.getElementById('phoneLayer')?.addEventListener('pointerdown', e => {
  if (e.target.id === 'phoneLayer') PhoneUI.close();
});
