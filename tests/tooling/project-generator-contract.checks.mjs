import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { sourceInputs, sha256 } from '../../scripts/testing/source-inputs.mjs';
import assert from 'node:assert/strict';
import { generatorCli } from '../../scripts/companion/compiler/cli.ts';
import { NotImplementedError } from '../../scripts/companion/runtime/contract.ts';

test('shared generator command rejects invalid arguments before touching a project', async () => {
  await assert.rejects(generatorCli(['--input']), /GENERATOR_USAGE/);
  await assert.rejects(generatorCli(['--target', 'plugin']), /--input and --target are required/);
  await assert.rejects(generatorCli(['--approve', 'anything']), /GENERATOR_USAGE/);
});

test('unimplemented adapter errors preserve explicit source and operation identity', () => {
  const error = new NotImplementedError('authoring-vault', 'save-project');
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'NotImplementedError');
  assert.equal(error.message, 'NOT_IMPLEMENTED: authoring-vault/save-project');
  assert.throws(() => { throw error; }, { name: 'NotImplementedError', message: error.message });
});

test('root CLI and compiler policy are fingerprinted and covered as tooling', async () => {
  const inventory = await sourceInputs(process.cwd());
  for (const path of ['shell.mjs', 'tsconfig.generator.json']) {
    const entries = inventory.files.filter(file => file.path === path);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].sha256, sha256(await readFile(path)));
  }
  const config = JSON.parse(await readFile('.fallowrc.json', 'utf8'));
  assert.equal(config.boundaries.coverage.requireAllFiles, true);
  assert.ok(config.boundaries.zones.find(zone => zone.name === 'tooling').patterns.includes('shell.mjs'));
});
