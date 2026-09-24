import { test } from 'node:test';
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
