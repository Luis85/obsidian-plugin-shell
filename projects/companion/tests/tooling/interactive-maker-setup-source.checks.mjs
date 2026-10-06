import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { setupSource as relocated } from '../../bin/adapters/framework/setup-source.ts';
import { companionStarterSet } from '../../bin/adapters/framework/starter-project.ts';
import { defaults, identity } from '../../bin/adapters/framework/configuration.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const frameworkRoot = resolve(import.meta.dirname, '../..');
const context = { root: frameworkRoot, frameworkRoot };

test('relocated setup source preserves compatibility and ordinary input passthrough', async () => {
  const request = { command: 'setup', args: [], options: { input: 'project.json' } };
  const result = await relocated(request, context, null);
  assert.equal(result.input, 'project.json');
  assert.equal(result.context, context);
  assert.equal(result.origin, null);
});

test('relocated setup source refuses conflicting starts and native options without starters', async () => {
  await assert.rejects(relocated({ command: 'setup', args: [], options: { input: 'a.json', blank: true } }, context, null), { code: 'SETUP_START_CONFLICT' });
  await assert.rejects(relocated({ command: 'setup', args: [], options: { extension: 'menu' } }, context, null), { code: 'NATIVE_OPTIONS_REQUIRE_STARTER' });
});

test('relocated setup source converts a verified starter into stdin authoring input', async () => {
  const { starters } = await companionStarterSet(context);
  assert.ok(starters.length > 0);
  const { definition, sha256 } = starters[0], starter = { id: definition.id, version: definition.version, sha256 };
  const config = defaults(identity({ id: 'starter-test', name: 'Starter Test', author: 'Test', version: '0.1.0', description: '' }));
  const result = await relocated({ command: 'setup', args: [], options: { starter: starter.id } }, context, config);
  assert.equal(result.input, '-');
  assert.equal(result.origin.id, starter.id);
  assert.equal(result.origin.version, starter.version);
  assert.equal(result.origin.sha256, starter.sha256);
  assert.equal(typeof result.context.inputText, 'string');
  const document = JSON.parse(result.context.inputText);
  assert.equal(document.project.id, 'starter-test');
  assert.equal(document.schemaVersion, 6);
});
