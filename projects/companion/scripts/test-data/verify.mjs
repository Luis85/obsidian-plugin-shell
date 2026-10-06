import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createFixtureEngine } from './engine.mjs';
import { createFixtureAdapter } from './adapters.mjs';
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
const engine = createFixtureEngine(), first = engine.generate(manifest);
assert.deepEqual(engine.generate(manifest), first, 'Seeded fixtures must be deterministic');
const adapter = createFixtureAdapter(manifest); adapter.dispose();
console.log(JSON.stringify({status:'fixture-contracts-verified',operations:first.operations.length,files:first.files.length,bytes:first.bytes,nativeAcceptance:'not-run'}));
