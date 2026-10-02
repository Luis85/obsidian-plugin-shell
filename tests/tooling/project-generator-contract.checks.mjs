import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { sourceInputs, sha256 } from '../../scripts/testing/source-inputs.mjs';
import assert from 'node:assert/strict';
import { matches, NotImplementedError } from '../../scripts/companion/runtime/contract.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';

test('generate rejects removed target/vault compatibility options', () => {
  assert.throws(() => parseCliArguments(['generate', '--target', 'plugin']), /--target/);
  assert.throws(() => parseCliArguments(['generate', '--vault', '.']), /--vault/);
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
  for (const path of ['bin/app', 'configs/types/tsconfig.generator.json', 'docs/concepts/companion/companion-project.json']) {
    const entries = inventory.files.filter(file => file.path === path);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].sha256, sha256(await readFile(path)));
  }
  const config = JSON.parse(await readFile('configs/quality/fallow.json', 'utf8'));
  assert.equal(config.boundaries.coverage.requireAllFiles, true);
  assert.ok(config.entry.includes('bin/app.ts'));
  assert.ok(!config.entry.includes('app.mjs') && !config.entry.includes('shell.mjs'));
});

test('runtime contracts reject accessors, sparse arrays, symbols and nested undefined without invoking code', () => {
  let calls=0;
  const object={type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false};
  assert.equal(matches({get value(){calls++;return 'unsafe';}},object),false);
  assert.equal(calls,0);assert.equal(matches({value:undefined},object),false);
  assert.equal(matches({value:'safe',[Symbol('hidden')]:'unsafe'},object),false);
  assert.equal(matches(new Array(2),{type:'array',items:{type:'string'}}),false);
  assert.equal(matches(undefined,null),true);
  assert.equal(matches({value:'safe'},object),true);
});
