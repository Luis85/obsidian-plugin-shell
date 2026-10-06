import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { firstRunDefaults, readFirstRunPreferences, readFirstRunRequest, installCommand, firstRunSchema } from '../../bin/domain/first-run.ts';
import { readSettings, defaultSettings } from '../../bin/domain/user-settings.ts';
import { firstRunWizard } from '../../bin/presentation/first-run.ts';
import { parseArguments } from '../../bin/adapters/commands.ts';
test('first-run preferences merge without granting permission, preserving explicit false', () => {
  assert.deepEqual(readFirstRunPreferences({}), firstRunDefaults);
  assert.deepEqual(readFirstRunRequest({ schemaVersion: 1, mode: 'verify' }), { schemaVersion: 1, mode: 'verify', ...firstRunDefaults });
  const defaults = { ...firstRunDefaults, openBrowser: true, port: 4555 };
  assert.equal(readFirstRunRequest({ schemaVersion: 1, mode: 'showcase', openBrowser: false }, defaults).openBrowser, false);
  assert.equal(readFirstRunRequest({ schemaVersion: 1, mode: 'verify' }, defaults).openBrowser, false);
  const settings = readSettings({ schemaVersion: 1, preferences: { firstRun: { port: 4555, openBrowser: true } } });
  assert.equal(settings.preferences.firstRun.port, 4555); assert.equal(settings.preferences.firstRun.install, 'auto');
  settings.preferences.firstRun.port = 8888; assert.equal(defaultSettings.preferences.firstRun.port, 4173);
  assert.equal(readSettings({ schemaVersion: 1 }).paths.firstRunReport, 'reports/first-run.json');
  assert.throws(() => readSettings({ schemaVersion: 1, paths: { firstRunReport: 'apps/product/first-run.json' } }));
  assert.equal(firstRunSchema.additionalProperties, false);
});
test('first-run refuses unsafe options, unknown fields and contradictory modes', () => {
  for (const change of [{ install: 'yarn' }, { port: 0 }, { port: 65536 }, { port: '4173' }, { port: 5000.5 }, { openBrowser: 'yes' },
    { stepTimeoutMs: 0 }, { stepTimeoutMs: 3600001 }, { readyTimeoutMs: -1 }, { showcaseDurationMs: Infinity }, { command: 'rm' }]) assert.throws(() => readFirstRunPreferences(change));
  for (const value of [{}, { schemaVersion: 2, mode: 'verify' }, { schemaVersion: 1, mode: 'skip' }, { schemaVersion: 1, mode: 'verify', openBrowser: true }, { schemaVersion: 1, mode: 'showcase', host: '0.0.0.0' }]) assert.throws(() => readFirstRunRequest(value));
});
test('auto install selection never repairs a resolved lock silently or falls back after ci failure', () => {
  assert.equal(installCommand('auto', null), 'install');
  assert.equal(installCommand('auto', { lockfileVersion: 3, packages: { '': { dependencies: { alpha: '1.0.0' } } } }), 'install');
  assert.equal(installCommand('auto', { lockfileVersion: 3, packages: { '': {} } }), 'ci');
  assert.equal(installCommand('auto', { lockfileVersion: 3, packages: { '': { dependencies: { alpha: '2.0.0' } }, 'node_modules/alpha': { version: '1.0.0' } } }), 'ci');
  assert.equal(installCommand('ci', null), 'ci'); assert.equal(installCommand('install', {}), 'install');
  for (const value of [{}, { lockfileVersion: 9, packages: {} }, { lockfileVersion: 3, packages: {} }]) assert.throws(() => installCommand('auto', value));
});
test('first-run skip is the default human choice and requires no filesystem or toolchain', async () => {
  let prompts = 0;
  const ui = { write: () => {}, ask: async () => { prompts++; return ''; } };
  assert.equal(await firstRunWizard(ui, { root: '/must-not-be-read', frameworkRoot: '/none' }), undefined);
  assert.equal(prompts, 1);
  assert.equal(parseArguments(['first-run', 'schema', '--json']).command, 'first-run');
});
