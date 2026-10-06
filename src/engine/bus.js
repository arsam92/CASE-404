/* CASE 404 — tiny event bus. All cross-module communication flows through here
   to keep modules decoupled (no circular imports). */

export const bus = {
  _m: {},
  on(evt, fn) { (this._m[evt] ??= []).push(fn); return () => this.off(evt, fn); },
  off(evt, fn) { const a = this._m[evt]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
  emit(evt, data) { (this._m[evt] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error('[bus]', evt, e); } }); }
};
