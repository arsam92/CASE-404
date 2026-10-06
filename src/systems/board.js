/* CASE 404 — investigation board: an interactive connection graph (SVG).
   Nodes = people, organizations, cases, objects, mysteries.
   Links are discovered through play (board:link effects) — never revealed all at once. */

import { G } from '../engine/state.js';
import { bus } from '../engine/bus.js';
import { Audio } from '../engine/audio.js';
import { Store } from '../engine/save.js';
import { elx } from '../ui/hud.js';

const layer = () => document.getElementById('boardLayer');

const TYPE_STYLE = {
  person: { fill: '#14233f', stroke: '#4da3ff' },
  org: { fill: '#2a2410', stroke: '#e8b04b' },
  case: { fill: '#1a1f30', stroke: '#8fa0bd' },
  thing: { fill: '#12281f', stroke: '#3ddc84' },
  mystery: { fill: '#2a1218', stroke: '#ff3b4e' }
};

export const BoardUI = {
  scale: 1,
  panX: 0,
  panY: 0,

  open() {
    Audio.sfx('whoosh');
    const root = layer();
    root.innerHTML = '';
    root.classList.add('open');
    const wrap = elx('div', 'board-wrap');
    wrap.innerHTML = `
      <div class="board-head">
        <h3>INVESTIGATION BOARD</h3>
        <div class="board-tools">
          <button id="bZoomOut">−</button><button id="bZoomIn">+</button><button id="bFit">FIT</button>
          <button class="board-close">✕</button>
        </div>
      </div>
      <div class="board-canvas" id="boardCanvas"></div>
      <div class="board-legend">
        <span style="color:#4da3ff">● PERSON</span><span style="color:#e8b04b">● ORGANIZATION</span>
        <span style="color:#3ddc84">● OBJECT</span><span style="color:#8fa0bd">● CASE</span><span style="color:#ff3b4e">● ???</span>
      </div>`;
    root.appendChild(wrap);
    wrap.querySelector('.board-close').onclick = () => { bus.emit('transition'); root.classList.remove('open'); root.innerHTML = ''; };
    wrap.querySelector('#bZoomIn').onclick = () => this.setZoom(this.scale * 1.2);
    wrap.querySelector('#bZoomOut').onclick = () => this.setZoom(this.scale / 1.2);
    wrap.querySelector('#bFit').onclick = () => { this.scale = 1; this.panX = 0; this.panY = 0; this.render(); };

    this.render();
  },

  setZoom(z) {
    this.scale = Math.max(0.4, Math.min(2.2, z));
    const g = document.getElementById('boardG');
    if (g) g.setAttribute('transform', `translate(${this.panX},${this.panY}) scale(${this.scale})`);
  },

  render() {
    const canvas = document.getElementById('boardCanvas');
    if (!canvas) return;
    const nodes = G.s.board.nodes;
    const links = G.s.board.links;

    // auto-layout for nodes without position
    const W = 760, H = 900;
    nodes.forEach((n, i) => {
      if (n.x == null) {
        const ang = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
        const ring = 170 + (i % 3) * 90;
        n.x = W / 2 + Math.cos(ang) * ring;
        n.y = H / 2 + Math.sin(ang) * ring * 0.8;
      }
    });

    canvas.innerHTML = `<svg id="boardSvg" width="100%" height="100%" viewBox="0 0 ${W} ${H}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#31405f"/>
        </marker>
        <pattern id="boardDots" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill="#17203a"/>
        </pattern>
      </defs>
      <g id="boardG" transform="translate(${this.panX},${this.panY}) scale(${this.scale})">
        <rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="url(#boardDots)"/>
        <g id="boardLinks"></g>
        <g id="boardNodes"></g>
      </g>
    </svg>`;

    const gLinks = canvas.querySelector('#boardLinks');
    const gNodes = canvas.querySelector('#boardNodes');
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

    for (const l of links) {
      const a = byId[l.a], b = byId[l.b];
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 24;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`);
      path.setAttribute('class', 'board-link');
      path.setAttribute('marker-end', 'url(#arrow)');
      gLinks.appendChild(path);
      if (l.label) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', mx); t.setAttribute('y', my - 6);
        t.setAttribute('class', 'board-link-label');
        t.textContent = l.label;
        gLinks.appendChild(t);
      }
    }

    for (const n of nodes) {
      const st = TYPE_STYLE[n.type] || TYPE_STYLE.thing;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'board-node' + (n.type === 'mystery' ? ' mystery' : ''));
      g.setAttribute('transform', `translate(${n.x},${n.y})`);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const label = (n.label || n.id).toUpperCase();
      const w = Math.max(74, label.length * 7.6 + 22);
      rect.setAttribute('x', -w / 2); rect.setAttribute('y', -20);
      rect.setAttribute('width', w); rect.setAttribute('height', 40);
      rect.setAttribute('rx', 8);
      rect.setAttribute('fill', st.fill);
      rect.setAttribute('stroke', st.stroke);
      g.appendChild(rect);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('y', 5);
      t.setAttribute('fill', st.stroke);
      t.textContent = label;
      g.appendChild(t);
      this._drag(g, n);
      gNodes.appendChild(g);
    }

    // background pan
    const svg = canvas.querySelector('#boardSvg');
    svg.addEventListener('pointerdown', e => {
      if (e.target.closest('.board-node')) return;
      const sx = e.clientX, sy = e.clientY, ox = this.panX, oy = this.panY;
      const move = ev => {
        this.panX = ox + (ev.clientX - sx);
        this.panY = oy + (ev.clientY - sy);
        this.setZoom(this.scale);
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  },

  _drag(g, node) {
    g.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const start = e.clientX, start2 = e.clientY;
      const ox = node.x, oy = node.y;
      const move = ev => {
        node.x = ox + (ev.clientX - start) / this.scale;
        node.y = oy + (ev.clientY - start2) / this.scale;
        g.setAttribute('transform', `translate(${node.x},${node.y})`);
        // live-update links by re-render (cheap enough at this scale)
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        this.render();
        Store.auto();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
};

document.getElementById('boardLayer')?.addEventListener('pointerdown', e => {
  if (e.target.id === 'boardLayer') { const r = layer(); r.classList.remove('open'); r.innerHTML = ''; }
});
