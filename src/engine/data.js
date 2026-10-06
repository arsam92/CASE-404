/* CASE 404 — data loader with in-memory cache. All case content is JSON under /data. */

const cache = new Map();

export async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`[data] failed to load ${path} (${res.status})`);
  const json = await res.json();
  cache.set(path, json);
  return json;
}

export function cachedJSON(path) { return cache.get(path) || null; }
