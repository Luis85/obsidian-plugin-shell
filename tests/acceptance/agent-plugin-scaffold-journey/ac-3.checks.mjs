// Increment: [[docs/increments/agent-plugin-scaffold-journey]]
// AC-3: `new --extension kanban` on the `custom-file-view` starter renames the sample format (file type id and name, goals, acceptance, pages and notes) without touching other words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { companionStarters, loadDefinitions } from '../../../src/cli/adapters/starters/repository.ts';
import { customizeStarter } from '../../../src/cli/adapters/starters/customize.ts';

const root = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const catalog = companionStarters(await loadDefinitions(root));
const starter = id => catalog.find(entry => entry.definition.id === id);
const format = /\.folio\b|\bFolio\b/;

test('[AC-3] new --extension kanban writes a project that names the kanban format everywhere', { timeout: 300000 }, async t => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'scaffold-extension-')));
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  await cp(join(root, 'configs'), join(cwd, 'configs'), { recursive: true });
  const run = spawnSync(process.execPath, [join(root, 'bin/app'), 'new', 'kanban-board', '--starter', 'custom-file-view', '--extension', 'kanban', '--no-git', '--yes', '--json'],
    { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 50_000_000 });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const project = JSON.parse(await readFile(join(cwd, 'kanban-board/design/project.json'), 'utf8'));
  const [fileType] = project.design.nativeIntegrations.fileTypes;
  assert.deepEqual([fileType.id, fileType.name, fileType.extension], ['kanban', 'Kanban document', 'kanban']);
  assert.match(project.design.goal, /save \.kanban documents/);
  assert.ok(project.design.prds[0].requirements.every(requirement => !format.test(requirement.acceptance)), 'acceptance criteria');
  assert.doesNotMatch(JSON.stringify([project.design, project.notes]), format, 'goals, acceptance, pages and notes');
});

test('[AC-3] the rename touches only the sample format and leaves other words and starters intact', () => {
  const before = JSON.stringify(catalog);
  const renamed = customizeStarter(starter('custom-file-view'), { extension: 'kanban' });
  const unchanged = customizeStarter(starter('custom-file-view'), { extension: 'folio' });
  assert.equal(JSON.stringify(unchanged.design), JSON.stringify(starter('custom-file-view').definition.generator.document.design), 'the default extension is a no-op');
  assert.equal(JSON.stringify(renamed.design.nativeIntegrations.fileTypes[0].initialContent), JSON.stringify(unchanged.design.nativeIntegrations.fileTypes[0].initialContent), 'file content is data, not a name');
  assert.match(JSON.stringify(customizeStarter(starter('companion-plugin'), {})), /portfolio/, 'words that merely contain the format are untouched');
  assert.throws(() => customizeStarter(starter('custom-file-view'), { extension: 'md' }), /NATIVE_INTEGRATION_INVALID/);
  assert.equal(JSON.stringify(catalog), before, 'the catalog starter is never mutated');
});
