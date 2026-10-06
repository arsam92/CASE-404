/* CASE 404 — entry point. Loads engine, unlocks audio on first gesture. */

import { Engine } from './engine/engine.js';
import { bus } from './engine/bus.js';
import { Audio } from './engine/audio.js';
import { Store } from './engine/save.js';
import './systems/glitch.js'; // ambient glitch loop
import { Achievements } from './systems/achievements.js';

function unlock() {
  Audio.init();
  bus.emit('audio:unlock');
  window.removeEventListener('pointerdown', unlock);
}
window.addEventListener('pointerdown', unlock);

/* Tap-through guard */
let lastTransition = 0;
let lastDownAt = 0;
bus.on('transition', () => { lastTransition = Date.now(); });
document.addEventListener('pointerdown', () => { lastDownAt = Date.now(); }, true);
document.addEventListener('click', e => {
  if (lastTransition && lastDownAt && lastDownAt <= lastTransition) {
    lastTransition = 0;
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) Store.auto();
});

Achievements.load().then(() => Engine.boot());
