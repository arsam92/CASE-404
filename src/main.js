/* CASE 404 — entry point. Loads engine, unlocks audio on first gesture. */

import { Engine } from './engine/engine.js';
import { bus } from './engine/bus.js';
import { Audio } from './engine/audio.js';
import { Store } from './engine/save.js';
import { initI18n } from './engine/i18n.js';

function unlock() {
  Audio.init();
  bus.emit('audio:unlock');
  window.removeEventListener('pointerdown', unlock);
}
window.addEventListener('pointerdown', unlock);

/* Tap-through guard (gesture-aware): when a screen transition happens under
   the finger, the trailing click of the OLD gesture must not activate whatever
   button appears underneath. Fresh gestures (pointerdown after the transition)
   always pass. */
let lastTransition = 0;
let lastDownAt = 0;
bus.on('transition', () => { lastTransition = Date.now(); });
document.addEventListener('pointerdown', () => { lastDownAt = Date.now(); }, true);
document.addEventListener('click', e => {
  if (lastTransition && lastDownAt && lastDownAt <= lastTransition) {
    lastTransition = 0; // this stale gesture is discarded once
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

// save settings before the page hides (mobile friendly)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) Store.auto();
});

await initI18n();
Engine.boot();
