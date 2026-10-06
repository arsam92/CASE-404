/* CASE 404 — localization runtime. 19 language packs, RTL-aware. */
import { G } from './state.js';

let catalog = null;
let current = 'en';

export const LANGUAGES = [
  ['en','English'],['fa','فارسی'],['ar','العربية'],['ja','日本語'],['de','Deutsch'],
  ['fr','Français'],['es','Español'],['it','Italiano'],['pt-BR','Português (Brasil)'],
  ['ko','한국어'],['zh-CN','简体中文'],['ru','Русский'],['tr','Türkçe'],['pl','Polski'],
  ['nl','Nederlands'],['id','Bahasa Indonesia'],['hi','हिन्दी'],['uk','Українська'],['vi','Tiếng Việt']
];

export async function initI18n() {
  if (!catalog) catalog = await fetch('./i18n/locales.json').then(r => r.json());
  current = G.s?.settings?.language || localStorage.getItem('case404.language') || 'en';
  if (!catalog[current]) current = 'en';
  applyDirection();
  return current;
}

export function t(key, fallback = key) {
  return catalog?.[current]?.keys?.[key] ?? catalog?.en?.keys?.[key] ?? fallback;
}

export function language() { return current; }

export function setLanguage(code) {
  if (!catalog?.[code]) return false;
  current = code;
  if (G.s?.settings) G.s.settings.language = code;
  localStorage.setItem('case404.language', code);
  applyDirection();
  document.dispatchEvent(new CustomEvent('case404:language', { detail: { code } }));
  return true;
}

export function applyDirection() {
  const pack = catalog?.[current] || catalog?.en;
  document.documentElement.lang = current;
  document.documentElement.dir = pack?.dir || 'ltr';
  document.body.dataset.lang = current;
}

export function languageOptions() {
  return LANGUAGES.map(([code,label]) => ({ code, label }));
}
