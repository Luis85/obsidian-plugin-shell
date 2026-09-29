/** Exercise the real catalog so newly added commands cannot break the manual. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { outputs } from '../../scripts/documentation/manual.mjs';

test('the real starter commands have complete generated manual entries', async () => {
  const files = await outputs();
  const model = JSON.parse(files['commands.json']);
  const starters = model.commands.filter(command => command.id.startsWith('starters '));
  assert.equal(starters.length, 8);
  assert.ok(starters.every(command => command.group === 'starters'));
  assert.ok(starters.every(command => command.examples.length > 0));
  assert.match(files['reference.md'], /starters run/);
});
