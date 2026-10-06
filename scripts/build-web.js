#!/usr/bin/env node
/* Copies the web game into www/ for Capacitor packaging. */
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

const items = ['index.html', 'src', 'data', 'public', 'assets'];
for (const it of items) {
  const from = join(root, it);
  if (existsSync(from)) cpSync(from, join(www, it), { recursive: true });
}
console.log('[build-web] web assets copied to www/');
