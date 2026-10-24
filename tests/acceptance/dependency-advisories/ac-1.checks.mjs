// Increment: [[docs/increments/dependency-advisories]]
// AC-1: Given the committed `package-lock.json`, every installed `undici`, `fast-uri`, `happy-dom` and `moment` resolves outside the advisory ranges (undici 8.0.0-8.12.1, fast-uri 3.0.0-3.1.8, happy-dom 17.0.0-21.0.3, moment 2.29.2-2.30.1), and a fresh install passes `npm run check:security`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
// Published advisory ranges (inclusive) from the live audit that blocked 0.5.0.
const advisories = { undici: ['8.0.0', '8.12.1'], 'fast-uri': ['3.0.0', '3.1.8'], 'happy-dom': ['17.0.0', '21.0.3'], moment: ['2.29.2', '2.30.1'] };
const parts = version => version.split('.').map(Number);
const compare = (a, b) => parts(a).map((n, i) => n - parts(b)[i]).find(n => n !== 0) ?? 0;
const inRange = (version, [low, high]) => compare(version, low) >= 0 && compare(version, high) <= 0;

test('[AC-1] the range check names versions inside and outside an advisory range', () => {
  assert.equal(inRange('8.11.0', advisories.undici), true);
  assert.equal(inRange('8.12.1', advisories.undici), true);
  assert.equal(inRange('8.12.3', advisories.undici), false);
  assert.equal(inRange('2.29.4', advisories.moment), true);
  assert.equal(inRange('2.31.0', advisories.moment), false);
});

test('[AC-1] every locked copy of the four packages resolves outside its advisory range', async () => {
  const { packages } = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  for (const [name, range] of Object.entries(advisories)) {
    const copies = Object.entries(packages).filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`));
    assert.ok(copies.length > 0, `${name} is locked`);
    for (const [path, entry] of copies) assert.equal(inRange(entry.version, range), false, `${path}@${entry.version}`);
  }
});

test('[AC-1] the exact happy-dom pin and the nested moment follow the patched versions', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const { packages } = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  assert.equal(manifest.devDependencies['happy-dom'], '21.0.4');
  assert.equal(packages['node_modules/eslint-plugin-obsidianmd/node_modules/obsidian'].dependencies.moment, '2.29.4', 'the upstream pin the override replaces');
  assert.equal(packages['node_modules/eslint-plugin-obsidianmd/node_modules/obsidian/node_modules/moment'], undefined, 'no nested vulnerable copy');
  assert.equal(packages['node_modules/moment'].version, '2.31.0');
});
