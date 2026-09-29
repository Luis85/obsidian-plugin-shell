import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readDocumentationSettings as readDocsSettings } from '../../scripts/application-docs/adapters/settings.ts';
import { loadSettings, settingsPlan } from '../../bin/adapters/user-settings.ts';
import { documentationSettings } from '../../bin/adapters/settings-documentation.ts';
import { settingsMigrationPlan } from '../../bin/adapters/settings-migration.ts';
import { setupCheckpointPlan, resumeSetupCheckpoint } from '../../bin/adapters/setup-checkpoint.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { defaultSettings, readSettings, settingsSchema } from '../../bin/domain/user-settings.ts';
import { settingsForm } from '../../bin/presentation/settings.ts';
async function scratch(work) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-settings-integration-'));
  try { await work(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function save(root, request) { const plan = await settingsPlan(root, request); return applyPrepared(plan, plan.planHash); }
test('documentation-created settings can be loaded and edited by maker without losing the namespace', async () => scratch(async root => {
  const docs = await readDocsSettings(root, []);
  await mkdir(join(root, 'configs')); await writeFile(join(root, 'configs/user-settings.json'), docs.create);
  const original = JSON.parse(docs.create).documentation;
  assert.deepEqual((await loadSettings(root)).settings.documentation, original);
  await save(root, { schemaVersion: 1, preferences: { author: 'Alice', firstRun: { openBrowser: true } } });
  const merged = (await loadSettings(root)).settings;
  assert.equal(merged.preferences.author, 'Alice'); assert.deepEqual(merged.documentation, original);
  assert.deepEqual((await readDocsSettings(root, [])).settings, docs.settings);
  assert.equal((await readDocsSettings(root, [])).create, null);
  assert.equal(settingsSchema.properties.documentation.additionalProperties, false);
}));
test('nested documentation edits preserve sibling paths, policies and unrelated maker preferences', async () => scratch(async root => {
  await save(root, { schemaVersion: 1, preferences: { author: 'Alice' }, documentation: {
    root: 'notes/application', paths: { pages: 'notes/screens', components: 'notes/widgets' },
    preserveAuthoredContent: true, conflictPolicy: 'review', deleteMissing: false,
  } });
  await save(root, { schemaVersion: 1, documentation: { linkFormat: 'wikilink', paths: { pages: 'notes/pages' } } });
  const settings = (await loadSettings(root)).settings;
  assert.equal(settings.documentation.paths.pages, 'notes/pages'); assert.equal(settings.documentation.paths.components, 'notes/widgets');
  assert.equal(settings.documentation.preserveAuthoredContent, true); assert.equal(settings.preferences.author, 'Alice');
  assert.equal(documentationSettings(settings).linkFormat, 'wikilink');
  const clone = readSettings({ schemaVersion: 1 }, settings); clone.documentation.paths.pages = 'changed';
  assert.equal(settings.documentation.paths.pages, 'notes/pages');
}));
test('owner validation rejects unsafe or conflicting documentation before settings writes', async () => scratch(async root => {
  await save(root, { schemaVersion: 1 }); const path = join(root, 'configs/user-settings.json'), original = await readFile(path);
  for (const documentation of [null, [], { unknown: true }, { root: 'apps/product' }, { root: '../outside' },
    { preserveAuthoredContent: false }, { conflictPolicy: 'overwrite' }, { deleteMissing: true },
    { paths: { unknown: 'docs/new' } }, { recursive: 'yes' }, { include: [4] }, { indexFile: 'design/project.json' }]) {
    await assert.rejects(() => settingsPlan(root, { schemaVersion: 1, documentation }));
    assert.deepEqual(await readFile(path), original);
  }
  await assert.rejects(() => settingsPlan(root, { schemaVersion: 1, paths: { project: 'design/docs-index.json' }, documentation: {} }), /overlaps/);
  await writeFile(path, JSON.stringify({ schemaVersion: 1, documentation: { root: 'apps/product' } }));
  await assert.rejects(() => loadSettings(root), /overlaps/);
}));
test('checkpoint and path migration preserve documentation configuration and validate inline changes', async () => scratch(async root => {
  await save(root, { schemaVersion: 1, documentation: { root: 'docs/application', linkFormat: 'wikilink' } });
  const original = (await loadSettings(root)).settings.documentation;
  const checkpoint = await setupCheckpointPlan(root, { schemaVersion: 1, settings: { schemaVersion: 1, preferences: { author: 'Saved' } } });
  await applyPrepared(checkpoint, checkpoint.planHash);
  assert.deepEqual((await resumeSetupCheckpoint(root)).settings.documentation, original);
  const migration = await settingsMigrationPlan(root, { schemaVersion: 1, paths: { app: 'client' } });
  await applyPrepared(migration, migration.planHash);
  assert.deepEqual((await loadSettings(root)).settings.documentation, original);
  await assert.rejects(() => setupCheckpointPlan(root, { schemaVersion: 1, settings: { schemaVersion: 1, documentation: { root: 'client' } } }), /overlaps/);
  await assert.rejects(() => settingsMigrationPlan(root, { schemaVersion: 1, paths: { app: 'docs/application' } }), /overlaps/);
}));
test('advanced human preferences expose every first-run field, host directory, report and documentation paths', async () => {
  const prompts = [];
  const values = { 'First-run report JSON': 'reports/run.json', 'Existing vault configuration directory': '.vault-settings',
    'Default showcase port': '4500', 'Per-stage timeout in milliseconds': '120000', 'Readiness timeout in milliseconds': '8000',
    'Showcase duration in milliseconds': '60000', 'Application documentation root': 'notes/application', 'Documentation folder: pages': 'notes/screens' };
  const ui = { write: () => {}, ask: async () => { throw new Error('Unexpected plain prompt'); }, rich: {
    text: async ({ title, initial }) => { prompts.push(title); return values[title] ?? initial; },
    select: async (title, choices, initial) => {
      if (title.startsWith('Configure ') || title.startsWith('Reset documentation')) return 'yes';
      if (title === 'Dependency installation strategy') return 'ci';
      if (title === 'Prefer opening the showcase browser?') return 'yes';
      if (title === 'Documentation link format') return 'wikilink';
      return initial ?? choices[0].id;
    },
  } };
  const result = await settingsForm(ui, structuredClone(defaultSettings));
  assert.equal(result.paths.firstRunReport, 'reports/run.json'); assert.equal(result.preferences.vaultConfigDirectory, '.vault-settings');
  assert.deepEqual(result.preferences.firstRun, { install: 'ci', port: 4500, openBrowser: true, stepTimeoutMs: 120000, readyTimeoutMs: 8000, showcaseDurationMs: 60000 });
  assert.equal(result.documentation.paths.pages, 'notes/screens'); assert.equal(result.documentation.paths.components, 'notes/application/components');
  assert.equal(result.documentation.linkFormat, 'wikilink'); assert.equal(result.documentation.deleteMissing, false);
  assert.ok(prompts.includes('Documentation folder: prds'));
  assert.equal(defaultSettings.preferences.firstRun.port, 4173);
  values['Default showcase port'] = '1'; await assert.rejects(() => settingsForm(ui, structuredClone(defaultSettings)), /port must be/);
});

test('typed documentation follows the configured maker project path for export and import', async () => scratch(async root => {
  const { spawnSync } = await import('node:child_process');
  const { projectSetupPlan } = await import('../../bin/adapters/project-setup.ts');
  const { documentationPlan } = await import('../../scripts/application-docs/adapters/plan.ts');
  const { applyFilePlan } = await import('../../scripts/shared/file-plan.mjs');
  const { resolve } = await import('node:path');
  assert.equal(spawnSync('git', ['init', root]).status, 0); await mkdir(join(root, '.obsidian'));
  const setup = await projectSetupPlan({ root, frameworkRoot: resolve(import.meta.dirname, '../..') }, {
    schemaVersion: 1, settings: { schemaVersion: 1, paths: { project: 'specs/product.json' }, documentation: { root: 'docs/application' } },
    project: { name: 'Markdown integration', description: 'Preserve the configured path.', product: 'Edit canonical application bricks.' },
    prds: { mode: 'add', documents: [{ filename: 'scope.md', markdown: '---\ntype: prd\nid: PRD-ONE\n---\nOriginal scope.\n' }] },
    prototypeInterview: null, operations: [], boilerplate: false,
  });
  await applyPrepared(setup, setup.planHash);
  const exported = await documentationPlan(root, [], 'export'); assert.deepEqual(exported.conflicts, []); await applyFilePlan(exported.plan);
  const index = JSON.parse(await readFile(join(root, 'design/docs-index.json'), 'utf8'));
  const page = Object.values(index.entries).find(entry => entry.baseline.type === 'page'); assert.ok(page);
  const path = join(root, page.path), original = await readFile(path, 'utf8');
  const edited = original.replace(/^title: .*$/m, 'title: "Updated from Markdown"'); assert.notEqual(edited, original);
  await writeFile(path, edited);
  const imported = await documentationPlan(root, [], 'import'); assert.deepEqual(imported.conflicts, []);
  await applyFilePlan(imported.plan);
  const project = JSON.parse(await readFile(join(root, 'specs/product.json'), 'utf8'));
  assert.equal(project.design.nodes[0].label, 'Updated from Markdown');
  await assert.rejects(readFile(join(root, 'design/project.json')));
  assert.equal((await loadSettings(root)).settings.paths.project, 'specs/product.json');
  await rm(join(root, 'configs/project-setup.json'));
  await assert.rejects(() => documentationPlan(root, [], 'import'), /run setup first/);
}));
