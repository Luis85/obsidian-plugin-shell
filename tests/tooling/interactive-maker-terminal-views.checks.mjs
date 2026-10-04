import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { renderHuman } from '../../bin/presentation/terminal/terminal-render.ts';
import { starterText } from '../../bin/presentation/terminal/starter-terminal.ts';

const plain = { color: false, unicode: false }, rich = { color: true, unicode: true };
const view = (value, style = plain) => renderHuman({ diagnostics: [], ...value }, style);

test('status and doctor views list checks, warnings and the first actionable next step', () => {
  const healthy = view({ command: 'status', status: 'ok', data: { root: '/p', manifest: { id: 'demo', version: '1.0.0', name: 'Demo', minAppVersion: '1.5.0' },
    configuration: {}, imported: true, designStale: false, generated: true, dependencies: true, acceptanceObligations: 3, next: 'generate' } });
  assert.equal(healthy.diagnosticsShown, true);
  for (const text of ['demo 1.0.0 "Demo" (minAppVersion 1.5.0)', 'yes (shell.config.json)', 'Design        imported', 'Dependencies  installed', '3 obligations pending',
    '[ok]   Dependencies installed', '[ok]   Project configured', 'Generation matches the accepted design', 'Next: node bin/app generate']) assert.ok(healthy.text.includes(text), text);
  const fresh = view({ command: 'doctor', status: 'blocked', data: { root: '/p', imported: true, designStale: true, generated: false, dependencies: false },
    diagnostics: [{ code: 'DEPENDENCIES_MISSING', message: 'Install.', next: 'install --yes' }] }, rich);
  for (const text of ['no manifest.json', 'Configured    no', 'imported, changed since generation', 'missing', 'DEPENDENCIES_MISSING', 'fix: node bin/app install --yes', '\u001b[1mNext:']) assert.ok(fresh.text.includes(text), text);
  assert.ok(!view({ command: 'status', status: 'ok', data: { root: '/p' } }).text.includes('Next:'));
  assert.ok(view({ command: 'status', status: 'ok', data: { root: '/p', imported: false } }).text.includes('not imported'));
});

test('maker discovery renders one recipe in detail and many as an aligned list', () => {
  const one = view({ command: 'make', status: 'ok', data: { makers: [{ id: 'feature', description: 'Adds a feature.', status: 'stable', options: ['--dry-run', '--name', '--json'],
    prerequisites: ['node'], sideEffects: ['writes src'], network: false }] } });
  for (const text of ['feature: Adds a feature.', 'Options  --name', 'Needs    node', 'Next: node bin/app make feature <name> --dry-run']) assert.ok(one.text.includes(text), text);
  const bare = view({ command: 'make', status: 'ok', data: { makers: [{ id: 'x', description: 'X.', status: 'beta', options: ['--yes'], prerequisites: [], sideEffects: [], network: true }] } });
  assert.ok(bare.text.includes('Options  none'));
  const many = view({ command: 'make', status: 'ok', data: { makers: [{ id: 'a', status: 'stable', description: 'A.' }, { id: 'longer', status: 'beta', description: 'B.' }] } });
  assert.ok(many.text.includes('  a       stable       A.') && many.text.includes('make describe <recipe>'));
});

test('check view shows failing output, step timing, exit codes and a gate-specific next step', () => {
  const steps = [
    { id: 'typecheck', command: 'vue-tsc', status: 'passed', durationMs: 1500 },
    { id: 'test', command: 'vitest run', status: 'failed', durationMs: 20, exitCode: 2, code: 'PROCESS_FAILED', outputTail: 'line one\nline two' },
    { id: 'lint', command: 'eslint', status: 'skipped', reason: 'cancelled' },
    { id: 'maker', command: 'maker', status: 'not-run' },
    { id: 'odd', command: 'odd', status: 'unknown', exitCode: null },
  ];
  const failed = view({ command: 'check', status: 'failed', data: { scope: 'shell-repository', mode: 'full', steps, summary: { passed: 1, failed: 1, skipped: 1, durationMs: 2000 },
    changes: { source: 'git', files: 3, reason: 'configuration changed' } }, diagnostics: [{ code: 'CHECK_FAILED', message: 'x', next: 'check' }] });
  for (const text of ['--- test (PROCESS_FAILED) last output ---', '  line two', '3 changed source files (configuration changed)', '1.5s', '20ms  exit 2', 'cancelled', 'not run',
    'Summary  1 passed, 1 failed, 1 skipped in 2.0s', 'Next: node bin/app check']) assert.ok(failed.text.includes(text), text);
  const planned = view({ command: 'check', status: 'planned', data: { scope: 'shell-repository', mode: 'fast', steps: [], changes: { source: 'unavailable', files: 0 } } });
  assert.ok(planned.text.includes('git unavailable') && planned.text.includes('Next: node bin/app check --fast'));
  const passedProject = view({ command: 'check', status: 'ok', data: { scope: 'generated-project', mode: 'full', summary: { passed: 0, failed: 0, skipped: 0, durationMs: 1 } } });
  assert.ok(passedProject.text.includes('npm run verify:project for the full gate'));
  const passedShell = view({ command: 'check', status: 'ok', data: { scope: 'shell-repository', mode: 'full', steps: [], summary: { passed: 0, failed: 0, skipped: 0, durationMs: 1 } } });
  assert.ok(passedShell.text.includes('Run verify for the full gate'));
});

test('submission view groups rules by category with remediation for non-passing rules', () => {
  const rules = [
    { id: 'manifest-json', category: 'manifest', status: 'pass', message: 'ok' },
    { id: 'readme', category: 'repository', status: 'fail', message: 'missing', remediation: 'Add README.md' },
    { id: 'build-styles', category: 'build', status: 'warn', message: 'absent', remediation: 'Build again' },
  ];
  const data = { rules, summary: { pass: 1, warn: 1, fail: 1 } }, diagnostics = [{ code: 'SUBMISSION_RULES_FAILED', message: 'x', next: 'Add README.md' }];
  const text = view({ command: 'check submission', status: 'blocked', data, diagnostics }).text;
  for (const part of ['Manifest\n', 'Repository\n', 'Build\n', '[FAIL] readme', '[warn] build-styles', 'fix: Add README.md', 'Summary  1 pass, 1 warn, 1 fail', 'Next: Add README.md']) assert.ok(text.includes(part), part);
  assert.ok(!text.includes('Lint\n'));
  assert.ok(view({ command: 'check submission', status: 'blocked', data, diagnostics }, rich).text.includes('    fix: Add README.md'));
  assert.ok(!view({ command: 'check submission', status: 'ok', data: {} }).text.includes('Next:'));
});

test('plan view counts changes, lists at most 25 and points to the exact approval', () => {
  const changes = Array.from({ length: 30 }, (_, index) => ({ status: index ? 'create' : 'unchanged', path: `file-${index}.md` }));
  const planned = view({ command: 'setup', status: 'planned', data: { planHash: 'a'.repeat(64), changes, conflicts: ['edited file'], saved: 'setup.plan.json' } });
  for (const text of ['1 unchanged, 29 create', 'Conflicts   edited file', 'Saved plan  setup.plan.json', 'create     file-1.md', '… more changes in --json', `--apply ${'a'.repeat(64)}`]) assert.ok(planned.text.includes(text), text);
  assert.ok(!planned.text.includes('file-0.md'));
  const applied = view({ command: 'setup', status: 'applied', data: { planHash: 'b', changes: [], applied: { written: ['x', 'y'] } } });
  assert.ok(applied.text.includes('Changes    none') && applied.text.includes('Written    2 files'));
  assert.match(applied.text, /^Next: node bin\/app setup status \(lists the remaining generate, install and verify stages/m);
  const other = view({ command: 'generate', status: 'applied', data: { planHash: 'b', changes: [], applied: { written: ['x'] } } });
  assert.ok(!other.text.includes('Next:'));
  assert.ok(view({ command: 'setup', status: 'applied', data: { planHash: 'b', changes: [], applied: {} } }).text.includes('0 files'));
});

test('generic and failed results stay bounded, never print raw JSON, and help routes to the help renderer', () => {
  const long = 'x'.repeat(120), data = { text: long, multi: 'a\nb', list: [1, 2], empty: [], many: [1, 2, 3, 4, 5, 6, 7], objects: [{}], nested: { a: { b: { c: 1 } } }, nothing: null };
  const generic = view({ command: 'version', status: 'ok', data }).text;
  for (const text of ['(120 chars; see --json)', '(3 chars; see --json)', 'list', '1, 2', 'none', '1, 2, 3, 4, 5, 6, … 1 more', 'nested.a  1 fields', 'nothing', 'Full result: add --json.']) assert.ok(generic.includes(text), text);
  assert.match(generic, /^ {2}objects +1 \(listed below\)$/m);
  // Records become rows; next hints and output paths are never shortened.
  const starters = Array.from({ length: 26 }, (_, index) => ({ id: `starter-${index}`, title: `Starter ${index}`, category: 'Foundations', inputs: [{ id: 'id' }] }));
  const listed = view({ command: 'starters list', status: 'ok', data: { folder: 'configs/starters', starters } }).text;
  assert.ok(listed.includes('starters  26 (listed below)') && !listed.includes('26 items'));
  assert.match(listed, /^ {4}starter-25 +title: Starter 25; category: Foundations$/m);
  const archive = '/very/long/' + 'nested/'.repeat(20) + 'workbench-kit.zip', next = 'node bin/app ' + 'step '.repeat(30) + 'done';
  const packed = view({ command: 'framework pack', status: 'ok', data: { archive, next, note: 'n'.repeat(120) } }).text;
  assert.ok(packed.includes(archive) && packed.includes(next) && packed.includes('(120 chars; see --json)'));
  const many = view({ command: 'version', status: 'ok', data: Object.fromEntries(Array.from({ length: 35 }, (_, index) => ['k' + index, index])) }).text;
  assert.ok(many.includes('… 5 more fields'));
  assert.equal(view({ command: 'version', status: 'ok', data: null }).text, 'version: ok\n');
  assert.equal(view({ command: 'setup', status: 'failed', data: { suggestions: ['x'] } }).text, 'setup: failed\n');
  assert.ok(view({ command: 'setup', status: 'failed', data: { recovery: { status: 'kept' } } }).text.includes('recovery.status'));
  const help = view({ command: 'help', status: 'ok', data: { commands: [], scope: 'golden-path', goldenPath: [], groups: [], makers: [], examples: [] } });
  assert.equal(help.diagnosticsShown, false); assert.ok(!help.text.startsWith('help: ok'));
});

test('starter summaries cover listing, cancellation, review and post-install guidance', () => {
  assert.equal(starterText({ status: 'failed', data: null }), null);
  assert.equal(starterText({ status: 'cancelled', data: null }), 'new: cancelled; nothing was written.\n');
  assert.ok(starterText({ status: 'ok', data: { starters: [] } }).includes('No starters installed.'));
  const listing = starterText({ status: 'ok', data: { starters: [{ id: 'blank', difficulty: 'beginner', category: 'plugin', title: 'Blank', description: 'Empty.' }] } });
  assert.ok(listing.includes('blank') && listing.includes('Blank: Empty.') && listing.includes('Create one: node bin/app new'));
  const summary = { identity: { id: 'demo', name: 'Demo', author: 'Team' }, directory: '/work/demo', vault: '.test-vault', files: 12, acceptanceTodos: 2, warnings: ['a'] };
  const fromStarter = starterText({ status: 'applied', data: { planHash: 'h', conflicts: ['c1'], summary: { ...summary, starter: { id: 'blank', title: 'Blank', version: '1.0.0', sha256: 'f'.repeat(64) } },
    next: 'Review it.', install: { 'npm ci': { exitCode: 0 } }, nextSteps: ['cd demo'], guide: { readme: 'README.md', implementation: 'IMPL.md' } } });
  for (const text of ['Starter    blank (Blank 1.0.0, sha256 ffffffffffff)', 'by Team', '12 generated', '2 acceptance obligations', '1 scaffold boundaries', 'Conflicts  c1',
    'Review it.', 'npm ci: exit 0', 'Next steps:', '  cd demo', 'Read README.md and IMPL.md.']) assert.ok(fromStarter.includes(text), text);
  const fromJson = starterText({ status: 'planned', data: { planHash: 'h', conflicts: [], summary: { ...summary, identity: { id: 'demo', name: 'Demo', author: '' }, warnings: [],
    source: { file: 'export.json', sha256: 'e'.repeat(64), schemaVersion: 6 } } } });
  for (const text of ['From       export.json (companion project schema 6, sha256 eeeeeeeeeeee)', 'Warnings   none', 'Conflicts  none']) assert.ok(fromJson.includes(text), text);
  assert.ok(!fromJson.includes(' by '));
});
