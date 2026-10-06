import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import {
  defaultIncrementsRoot, defaultIssuesRoot, defaultPullRequestsRoot, defaultSettings, effectivePaths, incrementsRoot, issuesRoot, pullRequestsRoot, readSettings, settingsSchema,
} from '../../bin/domain/user-settings.ts';
import { settingsMigrationPlan } from '../../bin/adapters/settings-migration.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { loadSettings, settingsPlan } from '../../bin/adapters/user-settings.ts';
import { settingsForm } from '../../bin/presentation/settings.ts';

async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'increment-settings-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function put(root, path, content) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content); }
const read = (root, path) => readFile(join(root, path), 'utf8');
const delivery = `${JSON.stringify({ schemaVersion: 1, handoff: { glob: 'docs/increments/*.md', ignore: ['docs/increments/README.md'], type: 'Increment' },
  pullRequests: { glob: 'docs/pull-requests/*.md', type: 'PullRequest', incrementKey: 'increment' } }, null, 2)}\n`;
async function project(root, withDelivery = true) {
  const settings = await settingsPlan(root, { schemaVersion: 1 }); await applyPrepared(settings, settings.planHash);
  await put(root, 'docs/increments/delivery.md', '---\ntype: Increment\nid: delivery\n---\n# Delivery\r\n');
  await put(root, 'docs/increments/README.md', '# Increments\n');
  await put(root, 'docs/pull-requests/delivery-1.md', '---\ntype: PullRequest\nid: delivery-1\nincrement: delivery\n---\n');
  if (withDelivery) await put(root, 'configs/delivery/delivery.json', delivery);
}
const moved = { schemaVersion: 1, paths: { increments: 'plan/increments', pullRequests: 'plan/pull-requests' } };

test('the increment and pull-request folders are optional settings that resolve to the DoR defaults', () => {
  const settings = readSettings({ schemaVersion: 1 });
  assert.deepEqual(Object.keys(settings.paths), Object.keys(defaultSettings.paths));
  assert.equal(JSON.stringify(settings.paths), JSON.stringify(defaultSettings.paths));
  assert.deepEqual([incrementsRoot(settings.paths), pullRequestsRoot(settings.paths)], ['docs/increments', 'docs/pull-requests']);
  assert.deepEqual([defaultIncrementsRoot, defaultPullRequestsRoot, defaultIssuesRoot, issuesRoot(settings.paths)], ['docs/increments', 'docs/pull-requests', 'docs/issues', 'docs/issues']);
  const effective = effectivePaths(settings.paths);
  assert.equal(effective.issues, 'docs/issues'); assert.equal(effective.increments, 'docs/increments'); assert.equal(effective.pullRequests, 'docs/pull-requests'); assert.equal(effective.design, 'docs/design');
  const configured = readSettings({ schemaVersion: 1, paths: { increments: 'plan/increments', pullRequests: 'plan/prs' } });
  assert.deepEqual([incrementsRoot(configured.paths), pullRequestsRoot(configured.paths)], ['plan/increments', 'plan/prs']);
  assert.equal(issuesRoot(readSettings({ schemaVersion: 1, paths: { issues: 'plan/issues' } }).paths), 'plan/issues');
  for (const key of ['increments', 'pullRequests', 'issues']) assert.deepEqual(settingsSchema.properties.paths.properties[key], { type: 'string', minLength: 1, maxLength: 240 });
});

test('folder settings refuse Markdown files, hidden and protected directories and overlapping locations', () => {
  const refuse = (paths, pattern) => assert.throws(() => readSettings({ schemaVersion: 1, paths }), pattern, JSON.stringify(paths));
  refuse({ increments: 'docs/increments.md' }, /visible folder/);
  refuse({ issues: 'docs/issues.MD' }, /visible folder/);
  refuse({ issues: 'docs/pull-requests/issues' }, /must not overlap/);
  refuse({ pullRequests: 'docs/.hidden/prs' }, /visible folder|dot segments/);
  refuse({ increments: 'node_modules/increments' }, /protected/);
  refuse({ increments: ' docs/x' }, /whitespace/);
  refuse({ increments: 'docs/prds/increments' }, /must not overlap/);
  refuse({ increments: 'plan', pullRequests: 'plan/prs' }, /must not overlap/);
  refuse({ prds: 'docs/pull-requests/prds' }, /paths\.pullRequests to docs\/pull-requests and paths\.issues to docs\/issues/);
  refuse({ unknown: 'x' }, /Unknown fields/);
});

test('migrating the folders moves their files and retargets delivery.json in one reviewed plan', () => scratch(async root => {
  await project(root);
  const before = await read(root, 'docs/increments/delivery.md');
  const plan = await settingsMigrationPlan(root, moved);
  assert.deepEqual(plan.data.moves.map(move => [move.key, move.from, move.to]), [['increments', 'docs/increments', 'plan/increments'], ['pullRequests', 'docs/pull-requests', 'plan/pull-requests']]);
  assert.match(plan.data.next, /delivery\.json now points the Definition of Ready at the moved folders/);
  assert.equal(await read(root, 'configs/delivery/delivery.json'), delivery);
  await assert.rejects(read(root, 'plan/increments/delivery.md'));
  await applyPrepared(plan, plan.planHash);
  assert.equal(await read(root, 'plan/increments/delivery.md'), before);
  assert.equal(await read(root, 'plan/increments/README.md'), '# Increments\n');
  assert.match(await read(root, 'plan/pull-requests/delivery-1.md'), /^id: delivery-1$/m);
  await assert.rejects(read(root, 'docs/increments/delivery.md'));
  assert.equal(await read(root, 'configs/delivery/delivery.json'), delivery.replace('"docs/increments/*.md"', '"plan/increments/*.md"')
    .replace('"docs/increments/README.md"', '"plan/increments/README.md"').replace('"docs/pull-requests/*.md"', '"plan/pull-requests/*.md"'));
  const saved = (await loadSettings(root)).settings.paths;
  assert.deepEqual([saved.increments, saved.pullRequests], ['plan/increments', 'plan/pull-requests']);
}));

test('a migration without delivery.json moves only the folders', () => scratch(async root => {
  await project(root, false); await put(root, 'docs/issues/delivery.md', '---\ntype: Issue\nid: delivery\n---\n');
  const issues = await settingsMigrationPlan(root, { schemaVersion: 1, paths: { issues: 'plan/issues' } }); await applyPrepared(issues, issues.planHash);
  assert.match(await read(root, 'plan/issues/delivery.md'), /^type: Issue$/m); assert.equal((await loadSettings(root)).settings.paths.issues, 'plan/issues');
  const plan = await settingsMigrationPlan(root, { schemaVersion: 1, paths: { pullRequests: 'plan/pull-requests' } });
  assert.doesNotMatch(plan.data.next, /delivery\.json/);
  assert.ok(!plan.plan.changes.some(change => change.path.startsWith('configs/delivery')));
  await applyPrepared(plan, plan.planHash);
  assert.match(await read(root, 'plan/pull-requests/delivery-1.md'), /^increment: delivery$/m);
  assert.match(await read(root, 'docs/increments/delivery.md'), /^id: delivery$/m);
}));

test('delivery.json drift refuses the migration and a later change invalidates the reviewed plan', () => scratch(async root => {
  await project(root);
  await put(root, 'configs/delivery/delivery.json', delivery.replace('"docs/increments/*.md"', '"docs/handoffs/*.md"'));
  await assert.rejects(() => settingsMigrationPlan(root, moved), /^DeliveryDocumentError: DELIVERY_PATHS_DRIFT: delivery\.json handoff\.glob is docs\/handoffs\/\*\.md/);
  await assert.rejects(read(root, 'plan/increments/delivery.md'));
  await put(root, 'configs/delivery/delivery.json', delivery);
  const plan = await settingsMigrationPlan(root, moved);
  await put(root, 'configs/delivery/delivery.json', delivery.replace('"type": "Increment"', '"type": "Increment" '));
  await assert.rejects(() => applyPrepared(plan, plan.planHash), /delivery\.json changed after migration review/);
  await assert.rejects(read(root, 'plan/increments/delivery.md'));
  assert.match(await read(root, 'docs/increments/delivery.md'), /^id: delivery$/m);
}));

test('the advanced settings form offers both folders and writes them only when changed', async () => {
  const answers = {};
  const ui = { write: () => {}, ask: async () => { throw new Error('Unexpected plain prompt'); }, rich: {
    text: async ({ title, initial }) => answers[title] ?? initial,
    select: async (title, choices, initial) => title === 'Configure advanced paths and first-run preferences?' ? 'yes' : title.startsWith('Configure ') ? 'no' : initial ?? choices[0].id,
  } };
  const unchanged = await settingsForm(ui, structuredClone(defaultSettings));
  assert.deepEqual(Object.keys(unchanged.paths), Object.keys(defaultSettings.paths));
  answers['Pull-request documents folder'] = 'plan/pull-requests'; answers['Issue documents folder'] = 'plan/issues';
  const changed = await settingsForm(ui, structuredClone(defaultSettings));
  assert.equal(changed.paths.pullRequests, 'plan/pull-requests'); assert.equal(changed.paths.issues, 'plan/issues'); assert.equal(changed.paths.increments, undefined);
  delete answers['Pull-request documents folder']; delete answers['Issue documents folder'];
  const kept = await settingsForm(ui, readSettings({ schemaVersion: 1, paths: { increments: 'docs/increments' } }));
  assert.equal(kept.paths.increments, 'docs/increments');
});
