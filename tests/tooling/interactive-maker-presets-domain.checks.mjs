import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readPresetCatalog, resolveProjectSelection, projectTargets, compatibleFrontends } from '../../bin/domain/project-presets.ts';
import { loadProjectCatalog, loadProjectGuide, projectInput } from '../../bin/adapters/project-create.ts';
import { loadGuide } from '../../bin/adapters/prototype.ts';
const raw = JSON.parse(await readFile(new URL('../../bin/guides/project-presets.json', import.meta.url), 'utf8'));
const catalog = await loadProjectCatalog(), guide = await loadProjectGuide();
const request = (selection = {}) => ({ schemaVersion: 1, catalogVersion: catalog.version, preset: 'cli', ...selection,
  prototypeRequest: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: { title: 'Desk', approved: true } } });
test('project family and frontend are separate; every requested runtime combination is represented', () => {
  for (const [preset, frontend, framework] of [['plugin', 'nuxt-ui', 'vue'], ['plugin', 'vanilla', 'none'], ['plugin', 'angular', 'angular'],
    ['webapp', 'nuxt-ui', 'vue'], ['webapp', 'vanilla', 'none'], ['website', 'vanilla', 'none'], ['website', 'nuxt-ui', 'vue'], ['cli', 'none', 'none']]) {
    const selected = resolveProjectSelection(catalog, { preset, frontend });
    assert.equal(selected.framework, framework); assert.deepEqual(selected.targets, [preset]);
  }
  assert.equal(resolveProjectSelection(catalog, { preset: 'cli' }).frontend, 'none');
  assert.deepEqual(projectTargets(catalog, 'hybrid', ['cli', 'plugin']), ['plugin', 'cli']);
  assert.deepEqual(compatibleFrontends(catalog, 'hybrid', ['website', 'cli']).map(item => item.id), ['nuxt-ui', 'vanilla']);
  assert.equal(resolveProjectSelection(catalog, { preset: 'hybrid', targets: ['cli', 'plugin'], frontend: 'angular' }).framework, 'angular');
});
test('compatibility fails closed instead of silently substituting a frontend or target', () => {
  for (const value of [{ preset: 'unknown' }, { preset: 'plugin' }, { preset: 'plugin', frontend: 'none' },
    { preset: 'cli', frontend: 'angular' }, { preset: 'plugin', frontend: 'vanilla', targets: ['plugin'] },
    { preset: 'hybrid', targets: ['plugin'], frontend: 'vanilla' }, { preset: 'hybrid', targets: ['cli', 'cli'], frontend: 'none' },
    { preset: 'hybrid', targets: ['website', 'plugin'], frontend: 'angular' }, { preset: 'hybrid', targets: ['desktop', 'cli'], frontend: 'vanilla' },
    { preset: 'hybrid', frontend: 'vanilla' }, { preset: 'cli', surprise: true }]) assert.throws(() => resolveProjectSelection(catalog, value));
  assert.throws(() => compatibleFrontends(catalog, 'unknown', ['cli']));
});
test('catalog supports data-only preset additions but cannot invent executable renderer capabilities', () => {
  const expanded = structuredClone(raw);
  expanded.presets.push({ id: 'internal-tools', label: 'Internal tool and CLI', targets: ['webapp', 'cli'], frontends: ['vanilla'] });
  const parsed = readPresetCatalog(expanded);
  assert.deepEqual(resolveProjectSelection(parsed, { preset: 'internal-tools', frontend: 'vanilla' }).targets, ['webapp', 'cli']);
  const mutations = [value => { value.schemaVersion = 2; }, value => { value.version = 0; }, value => { value.extra = true; },
    value => { value.runtimes.pop(); }, value => { value.runtimes[0].id = 'desktop'; }, value => { value.runtimes[1] = value.runtimes[0]; },
    value => { value.frontends[0].id = '../module'; }, value => { value.frontends[0].id = 'constructor'; }, value => { value.frontends[0].framework = 'angular'; },
    value => { value.frontends[2].targets.push('website'); }, value => { value.frontends[0].targets = []; }, value => { value.frontends.push(value.frontends[0]); },
    value => { value.frontends = []; }, value => { value.presets = []; }, value => { value.presets.push(value.presets[0]); },
    value => { value.presets[0].id = '../bad'; }, value => { value.presets[0].targets = []; }, value => { value.presets[4].targets = ['cli']; },
    value => { value.presets[0].frontends = []; }, value => { value.presets[0].frontends.push('unknown'); }, value => { value.presets[0].frontends.push('vanilla'); },
    value => { value.presets[0].label = '\u001b[31mHidden'; }, value => { value.frontends[0].ui = 'other'; }];
  for (const mutate of mutations) { const value = structuredClone(raw); mutate(value); assert.throws(() => readPresetCatalog(value)); }
});
test('versioned project interviews preserve legacy guide compatibility and explicit approval', async () => {
  const legacy = await loadGuide(); assert.equal(legacy.id, 'companion-prototype'); assert.equal(legacy.version, 1);
  assert.equal(guide.id, 'project-prototype');
  const fields = guide.steps.flatMap(step => step.fields);
  assert.ok(!fields.some(field => field.id === 'mode'));
  assert.ok(!JSON.stringify(fields.map(field => field.default)).includes('Use Vue 3'));
  assert.equal(projectInput(catalog, guide, request()).ready, true);
  const pending = request(); pending.prototypeRequest.answers.approved = false;
  assert.equal(projectInput(catalog, guide, pending).ready, false);
  pending.prototypeRequest.answers.conceptBoards = 'requested';
  assert.equal(projectInput(catalog, guide, pending).pending.length, 2);
  const invalid = [value => { value.schemaVersion = 2; }, value => { value.catalogVersion++; }, value => { value.extra = true; },
    value => { value.prototypeRequest.guideId = legacy.id; }, value => { value.prototypeRequest.guideVersion++; },
    value => { value.prototypeRequest.answers.pages = []; }, value => { value.prototypeRequest.answers.title = 'x'.repeat(90); }];
  for (const change of invalid) { const value = request(); change(value); assert.throws(() => projectInput(catalog, guide, value)); }
});
