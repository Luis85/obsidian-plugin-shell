import assert from 'node:assert/strict';
import { readdir, writeFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { join } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { parseArguments, execute } from '../adapters/commands.ts';
import { brainstormFeaturePlan } from '../adapters/brainstorm.ts';
import { brainstormScratch, captureRequest, readText, readScratchJson, writeJson } from './interactive-maker-brainstorm-fixture.mjs';

const cli = (options, argv, stdin = '') => execute(parseArguments(argv), { ...options, input: Readable.from([stdin]) });
async function snapshot(root) {
  const entries = await readdir(root, { recursive: true });
  return Promise.all(entries.sort().map(async path => [path, await readText(root, path).catch(error => error.code)]));
}
test('agent command options fail closed before any read of requests or write of files', async () => brainstormScratch(async options => {
  const before = await snapshot(options.root);
  const cases = [
    [['brainstorm', 'feature', '--input', '-', '--kind', 'clickdummy', '--json'], 'BRAINSTORM_OPTION'],
    [['brainstorm', 'guide', '--out', 'x', '--json'], 'BRAINSTORM_OPTION'],
    [['brainstorm', 'schema', '--apply', 'hash', '--json'], 'BRAINSTORM_OPTION'],
    [['brainstorm', 'context', '--input', '-', '--json'], 'BRAINSTORM_OPTION'],
    [['brainstorm', 'validate', '--input', '-', '--out', 'x', '--json'], 'BRAINSTORM_OPTION'],
    [['brainstorm', 'verify', '--input', '-', '--out', 'x', '--json'], 'BRAINSTORM_OPTION'],
    [['brainstorm', 'verify', '--json'], 'BRAINSTORM_OUTPUT'],
    [['brainstorm', 'project', '--input', '-', '--json'], 'BRAINSTORM_COMMAND'],
    [['brainstorm', 'feature', '--json'], 'BRAINSTORM_INPUT'],
    [['brainstorm', 'validate', '--input', '../outside.json', '--json'], 'SETTINGS_PATH'],
  ];
  for (const [argv, code] of cases) {
    await assert.rejects(() => cli(options, argv, JSON.stringify(captureRequest)), error => error?.code === code, argv.join(' '));
  }
  assert.deepEqual(await snapshot(options.root), before, 'no diagnostic path writes');
}));

test('a missing saved project blocks feature brainstorming instead of inventing a project', async () =>
  brainstormScratch(async options => {
    for (const argv of [['brainstorm', 'context', '--json'], ['brainstorm', 'validate', '--input', '-', '--json']]) {
      await assert.rejects(() => cli(options, argv, JSON.stringify(captureRequest)),
        error => error?.code === 'BRAINSTORM_PROJECT_REQUIRED' && /project brainstorming is planned separately/.test(error.message));
    }
    assert.deepEqual(await readdir(options.root), []);
  }, { project: false }));

test('file input, project binding and custom output produce the exact reviewed handoff', async () => brainstormScratch(async (options, document) => {
  const context = await cli(options, ['brainstorm', 'context', '--json']);
  assert.deepEqual(context.pages, []);
  assert.deepEqual(context.features, []);
  const bound = { ...captureRequest, projectId: document.project.id, baseSha256: context.baseSha256 };
  await writeJson(options.root, 'request.json', { ...bound, projectId: 'another-project' });
  await assert.rejects(() => cli(options, ['brainstorm', 'validate', '--input', 'request.json', '--json']),
    error => error?.code === 'BRAINSTORM_PROJECT');
  await writeJson(options.root, 'request.json', bound);
  const validated = await cli(options, ['brainstorm', 'validate', '--input', 'request.json', '--json']);
  assert.deepEqual(validated.candidate, { project: document.project, surfaces: 2, transitions: 1, features: 1 });
  const argv = ['brainstorm', 'feature', '--input', 'request.json', '--out', 'plans/capture', '--json'];
  const preview = await cli(options, argv);
  assert.deepEqual(preview.changes.map(change => change.status + ' ' + change.path), [
    'create plans/capture/feature.definition.json', 'create plans/capture/candidate.project.json',
    'create docs/concepts/brainstorms/capture-inbox.json', 'create plans/capture/README.md']);
  const applied = await cli(options, [...argv.slice(0, -1), '--apply', preview.planHash, '--json']);
  assert.equal(applied.status, 'applied');
  assert.equal(await readText(options.root, 'plans/capture/README.md'), [
    '# Capture inbox — brainstorm handoff', '', 'Quickly capture and inspect ideas', '',
    'Status: draft. No source code, tests or feature acceptance are implied by this definition.', '',
    '## Canonical handoff', '- Feature definition: plans/capture/feature.definition.json',
    '- Canonical candidate project: plans/capture/candidate.project.json',
    '- Additive, exact-base feature concept: docs/concepts/brainstorms/capture-inbox.json', '',
    '## Feature surfaces', '- Inbox: node-1 (/capture-inbox/inbox)', '- Details: node-3 (/capture-inbox/details)', '',
    'Actors/entities and acceptance criteria remain planning information; use the canonical semantic, requirement and visual editors to refine them.',
    'Sitemap transitions describe intended navigation and do not prove executable page events.', '',
    '## Import (independent review and approval)',
    '1. Inspect the concept: node bin/app concept inspect --input docs/concepts/brainstorms/capture-inbox.json --json',
    '2. Review the separate import plan: node bin/app concept import --input docs/concepts/brainstorms/capture-inbox.json --json',
    '3. If approved, repeat the import command with --apply <fresh-planHash> --json.',
    'Use the configured project importer. If this root is an unconfigured maker workspace, configure a project before importing.', '',
    '## Generated source',
    '- No source was requested. Use a new reviewed brainstorm or the existing shell generator after importing the feature.', '',
    '## Execution (separate approval; no implicit npm or browser processes)', '- No automated verification requested.',
    '- Project/native acceptance and publication remain separate from compilation and local test/build results.', ''].join('\n'),
    'omitted optional lines leave no stray blank line and the file ends with exactly one newline');
  const definition = await readScratchJson(options.root, 'plans/capture/feature.definition.json');
  assert.deepEqual([definition.status, definition.acceptance, definition.execution, definition.generatedSource],
    ['draft', 'not-verified', 'not-run', null]);
  assert.deepEqual(definition.feature, bound);
}));

test('a differing existing brainstorm is preserved byte-for-byte and never regenerated', async () => brainstormScratch(async options => {
  const first = await brainstormFeaturePlan(captureRequest, options);
  await execute(parseArguments(['brainstorm', 'feature', '--input', '-', '--apply', first.planHash, '--json']),
    { ...options, input: Readable.from([JSON.stringify(captureRequest)]) });
  const before = await snapshot(options.root);
  const changed = { ...captureRequest, purpose: 'A different purpose for the same feature' };
  await assert.rejects(() => cli(options, ['brainstorm', 'feature', '--input', '-', '--json'], JSON.stringify(changed)),
    error => error?.code === 'BRAINSTORM_OUTPUT_EXISTS');
  await assert.rejects(() => cli(options, ['brainstorm', 'feature', '--input', '-', '--apply', first.planHash, '--json'],
    JSON.stringify(changed)), error => error?.code === 'BRAINSTORM_OUTPUT_EXISTS');
  assert.deepEqual(await snapshot(options.root), before);
  await rm(join(options.root, 'brainstorms/capture-inbox/README.md'));
  const repaired = await brainstormFeaturePlan(captureRequest, options);
  assert.deepEqual(repaired.plan.changes.filter(change => change.status !== 'unchanged').map(change => change.status + ' ' + change.path),
    ['create brainstorms/capture-inbox/README.md'], 'only the missing identical handoff can be recreated');
  await writeFile(join(options.root, 'brainstorms/capture-inbox/README.md'), 'edited by a person\n');
  await assert.rejects(() => brainstormFeaturePlan(captureRequest, options), error => error?.code === 'BRAINSTORM_OUTPUT_EXISTS');
}));
