import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { handoutSections } from '../../scripts/framework/handout-questions.ts';
import { digest, makeSnapshot, renderHandout, parseAnswers, readSnapshot, validateHandout, refreshHandout, HANDOUT_PATH } from '../../scripts/framework/handout-model.ts';
import { loadHandoutWorkspace, prepareHandout, prepareHandoutRefresh, inspectHandout, portablePath } from '../../scripts/framework/handout-workspace.ts';
const base = makeSnapshot('docs/prds', [{ path: 'docs/prds/PRD-1.md', sha256: digest('# PRD') }]);
const full = () => renderHandout(base).replace(/- \[ \] \*\*REQUIRED\*\*/g, '- [x] **REQUIRED**')
  .replace(/  - Answer:.*$/gm, '  - Answer: Reviewed concrete decision with details in docs/prds/PRD-1.md#scope.')
  .replace(/  - Evidence:.*$/gm, '  - Evidence: Trio decision, reviewer recorded in meeting notes, 2026-09-29.')
  .replace(/(`run.mode`[^\n]*\n  - Answer:)[^\n]*/, '$1 skip')
  .replace(/(`ready\.(?:product|design|engineering)`[^\n]*\n  - Answer:)[^\n]*/g, '$1 approved; reviewer=Test reviewer; date=2026-09-29; limitations=Reviewed synthetic fixture.');
async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'workbench-handout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'docs/prds'), { recursive: true });
  await writeFile(join(root, 'docs/prds/PRD-1.md'), '---\ntype: prd\nid: PRD-1\n---\n# Example\n## Scope\nA synthetic workflow.\n');
  return root;
}
test('every section has a description and required plus optional checklist items', () => {
  assert.equal(handoutSections.length, 20);
  for (const section of handoutSections) {
    assert.ok(section.description.length > 30);
    assert.ok(section.questions.some(question => question.required));
    assert.ok(section.questions.some(question => !question.required));
  }
  assert.equal(handoutSections.flatMap(section => section.questions).length, 69);
});
test('rendering is deterministic and never auto-checks observed facts or suggested defaults', () => {
  const text = renderHandout(base, { 'product.identity': { answer: 'Example', evidence: 'settings' } });
  assert.equal(text, renderHandout(base, { 'product.identity': { answer: 'Example', evidence: 'settings' } }));
  assert.equal((text.match(/^- \[ \]/gm) ?? []).length, 69);
  assert.equal((text.match(/^- \[x\]/gm) ?? []).length, 0);
  assert.ok(text.includes('Answer: Example'));
});
test('the generated template is blocked until required decisions are reviewed', () => {
  const report = validateHandout(renderHandout(base), base);
  assert.equal(report.ready, false);
  assert.equal(report.requiredTotal, 49);
  assert.equal(report.requiredAnswered, 0);
  assert.equal(report.executionAuthorized, false);
});
test('reviewed required answers can be structurally ready while optional items remain unchecked', () => {
  const report = validateHandout(full(), base);
  assert.deepEqual(report.diagnostics, []);
  assert.equal(report.ready, true);
  assert.equal(report.optionalAnswered, 0);
  assert.equal(report.executionAuthorized, false);
});
test('checked placeholders never count as completed requirements', () => {
  const report = validateHandout(renderHandout(base).replaceAll('- [ ]', '- [x]'), base);
  assert.equal(report.ready, false);
  assert.ok(report.diagnostics.some(item => item.code === 'HANDOUT_REQUIRED_OPEN'));
});
test('blank answers, evidence and bare N/A do not pass', () => {
  for (const value of ['', 'N/A', 'TBD', '<TODO>', 'pending']) {
    const text = full().replace(/(`product.problem`[^\n]*\n  - Answer:)[^\n]*/, '$1 ' + value);
    assert.equal(validateHandout(text, base).ready, false);
  }
  const text = full().replace(/  - Evidence:.*?\n/, '  - Evidence: \n');
  assert.equal(validateHandout(text, base).ready, false);
});
test('required classification cannot be downgraded by editing the Markdown', () => {
  const text = full().replace('**REQUIRED** `meeting.owners`', '**OPTIONAL** `meeting.owners`');
  assert.ok(validateHandout(text, base).diagnostics.some(item => item.code === 'HANDOUT_REQUIREMENT_CHANGED'));
});
test('missing, unknown and duplicate IDs fail validation', () => {
  const text = full();
  assert.ok(validateHandout(text.replace('`meeting.owners`', '`unknown.id`'), base).diagnostics.some(item => item.code === 'HANDOUT_UNKNOWN_ID'));
  assert.ok(validateHandout(text + '\n- [x] **REQUIRED** `meeting.owners` — Duplicate\n', base).diagnostics.some(item => item.code === 'HANDOUT_DUPLICATE_ID'));
  assert.ok(validateHandout(text.replace('`meeting.owners`', '`meeting-owner`'), base).diagnostics.some(item => item.code === 'HANDOUT_MISSING_ID'));
});
test('repeated fields are rejected even when the first field is empty', () => {
  const text = full().replace('  - Answer:', '  - Answer: \n  - Answer:');
  assert.ok(validateHandout(text, base).diagnostics.some(item => item.code === 'HANDOUT_DUPLICATE_FIELD'));
});
test('multiline answers and exact Markdown references can be consumed by an agent', () => {
  const text = full().replace('  - Answer:', '  - Answer: Decision\n    Continuation with docs/pages/Example.md#validation.\n    More detail.\n  - Guidance: extra\n  - AnswerX:');
  assert.ok(parseAnswers(text).answers[0].answer.includes('Continuation'));
});
test('fenced examples cannot impersonate answered checklist items', () => {
  const text = full() + '\n```md\n- [x] **REQUIRED** `meeting.owners` — Example\n  - Answer: not real\n```\n';
  assert.equal(validateHandout(text, base).ready, true);
  assert.equal(validateHandout(full() + '\n```\n', base).ready, false);
});
test('source changes, additions and deletions invalidate readiness', () => {
  for (const files of [[], [{ path: 'docs/prds/PRD-1.md', sha256: digest('changed') }], [...base.files, { path: 'docs/prds/PRD-2.md', sha256: digest('new') }]]) {
    assert.ok(validateHandout(full(), makeSnapshot('docs/prds', files)).diagnostics.some(item => item.code === 'HANDOUT_SOURCES_STALE'));
  }
});
test('no PRDs cannot produce a ready handout', () => {
  const empty = makeSnapshot('docs/prds', []);
  assert.ok(validateHandout(renderHandout(empty), empty).diagnostics.some(item => item.code === 'HANDOUT_PRDS_MISSING'));
});
test('metadata corruption, duplicate metadata and unsupported versions are rejected', () => {
  const text = renderHandout(base);
  assert.throws(() => readSnapshot(text.replace('"schemaVersion":1', '"schemaVersion":2')), /HANDOUT_VERSION/);
  assert.throws(() => readSnapshot(text + '\n' + text.match(/<!-- workbench-handout-snapshot: .+ -->/)[0]), /HANDOUT_METADATA/);
  assert.throws(() => readSnapshot(text.replace(base.fingerprint, '0'.repeat(64))), /HANDOUT_METADATA/);
});
test('showcase introduces a conditional review requirement and no execution authorization', () => {
  const text = full().replace('  - Answer: skip', '  - Answer: showcase');
  assert.ok(validateHandout(text, base).diagnostics.some(item => item.code === 'HANDOUT_SHOWCASE_OPEN'));
  assert.equal(validateHandout(text.replace('- [ ] **OPTIONAL** `run.showcase`', '- [x] **OPTIONAL** `run.showcase`'), base).ready, true);
  assert.equal(validateHandout(text, base).executionAuthorized, false);
});
test('an invalid first-run value is rejected', () => {
  assert.ok(validateHandout(full().replace('  - Answer: skip', '  - Answer: deploy'), base).diagnostics.some(item => item.code === 'HANDOUT_RUN_MODE'));
});
test('source refresh preserves every answer and free-form note, resetting review only when inputs changed', () => {
  const current = makeSnapshot('docs/prds', [{ path: 'docs/prds/PRD-1.md', sha256: digest('changed') }]);
  const notes = '\n## Personal meeting notes\nKeep this note exactly.\n```md\n- [x] **REQUIRED** `meeting.owners` — an example\n```\n';
  const text = full() + notes;
  assert.equal(refreshHandout(text, base), text);
  const refreshed = refreshHandout(text, current);
  assert.ok(refreshed.endsWith(notes));
  assert.equal(parseAnswers(refreshed).answers.filter(answer => answer.checked).length, 0);
  assert.equal(parseAnswers(refreshed).answers[0].answer, parseAnswers(text).answers[0].answer);
  assert.equal(readSnapshot(refreshed).fingerprint, current.fingerprint);
});
test('refresh preserves CRLF line endings and refuses damaged structure', () => {
  const changed = makeSnapshot('docs/prds', []);
  const text = full().replaceAll('\n', '\r\n');
  assert.ok(refreshHandout(text, changed).includes('\r\n'));
  assert.throws(() => refreshHandout(full().replace('`meeting.owners`', '`missing.id`'), changed), /HANDOUT_STRUCTURE/);
});
test('prefilled values cannot inject checklist lines or executable HTML', () => {
  const text = renderHandout(base, { 'product.identity': { answer: 'A\n- [x] **REQUIRED** `meeting.owners` — injected <script>x</script>', evidence: '<!-- x -->' } });
  assert.equal(parseAnswers(text).answers.length, 69);
  assert.equal((text.match(/^- \[x\]/gm) ?? []).length, 0);
  assert.ok(!text.includes('<script>'));
});
test('workspace collection is read-only, deterministic and never embeds PRD bodies', async t => {
  const root = await workspace(t);
  const before = await readFile(join(root, 'docs/prds/PRD-1.md'), 'utf8');
  const first = await prepareHandout(root), second = await prepareHandout(root);
  assert.deepEqual(first, second);
  assert.equal(first.entries[0].path, HANDOUT_PATH);
  assert.ok(!first.entries[0].content.includes('A synthetic workflow.'));
  assert.equal(await readFile(join(root, 'docs/prds/PRD-1.md'), 'utf8'), before);
  await assert.rejects(readFile(join(root, HANDOUT_PATH)), { code: 'ENOENT' });
});
test('existing handwritten or edited handouts are preserved exactly', async t => {
  const root = await workspace(t);
  await writeFile(join(root, HANDOUT_PATH), '# Human-owned handout\nPrivate meeting notes.\n');
  const prepared = await prepareHandout(root);
  assert.equal(prepared.entries.length, 0);
  assert.equal(prepared.summary.action, 'preserved');
  await assert.rejects(prepareHandoutRefresh(root), /HANDOUT_METADATA/);
});
test('user settings can configure PRD paths and first-run suggestions without authorization', async t => {
  const root = await workspace(t);
  await mkdir(join(root, 'configs'), { recursive: true });
  await mkdir(join(root, 'requirements'), { recursive: true });
  await writeFile(join(root, 'requirements/one.md'), '# One');
  await writeFile(join(root, 'configs/user-settings.json'), JSON.stringify({ paths: { prds: 'requirements', source: 'app' }, preferences: { firstRun: 'showcase' }, secrets: { token: 'DO-NOT-EMBED-THIS' } }));
  const prepared = await prepareHandout(root);
  const text = prepared.entries[0].content;
  assert.ok(text.includes('requirements/one.md'));
  assert.ok(text.includes('source=app'));
  assert.ok(!text.includes('DO-NOT-EMBED-THIS'));
  assert.ok(text.includes('Answer: showcase'));
  assert.equal((text.match(/^- \[x\]/gm) ?? []).length, 0);
});
test('a CLI PRD override wins over settings', async t => {
  const root = await workspace(t);
  await mkdir(join(root, 'configs'), { recursive: true });
  await writeFile(join(root, 'configs/user-settings.json'), JSON.stringify({ paths: { prds: 'requirements' } }));
  assert.equal((await loadHandoutWorkspace(root, { prds: 'docs/prds' })).prdCount, 1);
});
test('virtual setup configuration fingerprints match the files that the setup plan will write', async t => {
  const root = await workspace(t);
  const content = JSON.stringify({ project: { name: 'Example', id: 'example', author: 'Team', description: 'Demo' }, paths: { codebaseFolder: 'src', testsFolder: 'tests' } }, null, 2) + '\n';
  const prepared = await prepareHandout(root, { virtualFiles: { 'shell.config.json': content } });
  await writeFile(join(root, 'shell.config.json'), content);
  await writeFile(join(root, HANDOUT_PATH), prepared.entries[0].content);
  assert.ok(!(await inspectHandout(root)).diagnostics.some(item => item.code === 'HANDOUT_SOURCES_STALE'));
});
test('adding or changing settings and PRDs after creation is detected', async t => {
  const root = await workspace(t);
  const prepared = await prepareHandout(root);
  await writeFile(join(root, HANDOUT_PATH), prepared.entries[0].content);
  await writeFile(join(root, 'docs/prds/PRD-2.md'), '# New');
  assert.ok((await inspectHandout(root)).diagnostics.some(item => item.code === 'HANDOUT_SOURCES_STALE'));
});
test('absolute, traversing, Windows and protected PRD paths are rejected', () => {
  for (const path of ['../outside', '/etc', 'C:\\data', '.git', '.obsidian', 'a/../b', 'a//b', '.', 'node_modules/docs', 'a\\b']) assert.throws(() => portablePath(path), /HANDOUT_PATH/);
});
test('symlink input and output paths are refused', async t => {
  const root = await workspace(t);
  await symlink(join(root, 'docs/prds/PRD-1.md'), join(root, 'docs/prds/link.md'));
  await assert.rejects(prepareHandout(root), /HANDOUT_SYMLINK/);
  await rm(join(root, 'docs/prds/link.md'));
  await symlink(join(root, 'docs/prds/PRD-1.md'), join(root, HANDOUT_PATH));
  await assert.rejects(prepareHandout(root), /HANDOUT_SYMLINK/);
});
test('malformed settings and invalid preference values fail without writing', async t => {
  const root = await workspace(t);
  await mkdir(join(root, 'configs'), { recursive: true });
  await writeFile(join(root, 'configs/user-settings.json'), '{no');
  await assert.rejects(prepareHandout(root), /HANDOUT_SETTINGS_JSON/);
  await writeFile(join(root, 'configs/user-settings.json'), JSON.stringify({ preferences: { firstRun: 'deploy' } }));
  await assert.rejects(prepareHandout(root), /HANDOUT_RUN_MODE/);
});
test('oversized and binary inputs fail closed', async t => {
  const root = await workspace(t);
  await writeFile(join(root, 'docs/prds/too-large.md'), 'x'.repeat(1_000_001));
  await assert.rejects(prepareHandout(root), /HANDOUT_INPUT_LIMIT/);
  await rm(join(root, 'docs/prds/too-large.md'));
  await writeFile(join(root, 'docs/prds/binary.md'), Buffer.from([0, 0, 1]));
  await assert.rejects(prepareHandout(root), /HANDOUT_INPUT_LIMIT/);
});
test('standalone CLI previews without writing, creates only explicitly and preserves edits', async t => {
  const root = await workspace(t);
  const cli = resolve('scripts/handout.mjs');
  const run = (...args) => spawnSync(process.execPath, ['--experimental-strip-types', cli, ...args, '--root', root, '--json'], { encoding: 'utf8' });
  const preview = run('generate', '--dry-run');
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).status, 'planned');
  await assert.rejects(readFile(join(root, HANDOUT_PATH)), { code: 'ENOENT' });
  assert.equal(JSON.parse(run('generate', '--write').stdout).status, 'applied');
  await writeFile(join(root, HANDOUT_PATH), '# Existing human note');
  assert.equal(JSON.parse(run('generate', '--write').stdout).status, 'unchanged');
  assert.equal(await readFile(join(root, HANDOUT_PATH), 'utf8'), '# Existing human note');
});
test('standalone CLI returns a nonzero blocked status for an incomplete handout and rejects mixed effects', async t => {
  const root = await workspace(t);
  const cli = resolve('scripts/handout.mjs');
  const run = (...args) => spawnSync(process.execPath, ['--experimental-strip-types', cli, ...args, '--root', root, '--json'], { encoding: 'utf8' });
  run('generate', '--write');
  assert.equal(run('validate').status, 1);
  assert.equal(JSON.parse(run('inspect').stdout).data.executionAuthorized, false);
  assert.equal(run('generate', '--write', '--dry-run').status, 1);
  assert.equal(run('validate', '--write').status, 1);
  assert.equal(run('generate', '--unknown').status, 1);
});
test('refresh follows a changed configured PRD folder rather than silently retaining the old one', async t => {
  const root = await workspace(t);
  const prepared = await prepareHandout(root);
  await writeFile(join(root, HANDOUT_PATH), prepared.entries[0].content);
  await mkdir(join(root, 'requirements'));
  await writeFile(join(root, 'requirements/new.md'), '# New PRD');
  await mkdir(join(root, 'configs'));
  await writeFile(join(root, 'configs/user-settings.json'), JSON.stringify({ paths: { prds: 'requirements' } }));
  const refresh = await prepareHandoutRefresh(root);
  assert.equal(readSnapshot(refresh.entries[0].content).prdsRoot, 'requirements');
  assert.equal(readSnapshot(refresh.entries[0].content).prdsMode, 'configured');
});
test('an explicit PRD override is preserved during validation and refresh', async t => {
  const root = await workspace(t);
  await mkdir(join(root, 'chosen'));
  await writeFile(join(root, 'chosen/one.md'), '# Chosen PRD');
  const prepared = await prepareHandout(root, { prds: 'chosen' });
  await writeFile(join(root, HANDOUT_PATH), prepared.entries[0].content);
  assert.ok(!(await inspectHandout(root)).diagnostics.some(item => item.code === 'HANDOUT_SOURCES_STALE'));
  await writeFile(join(root, 'chosen/two.md'), '# Another PRD');
  const refresh = await prepareHandoutRefresh(root);
  assert.equal(readSnapshot(refresh.entries[0].content).prdsRoot, 'chosen');
  assert.equal(readSnapshot(refresh.entries[0].content).prdsMode, 'explicit');
});
test('fingerprints detect BOM-only source changes and settings JSON supports UTF-8 BOM', async t => {
  const root = await workspace(t);
  const before = await loadHandoutWorkspace(root);
  const path = join(root, 'docs/prds/PRD-1.md');
  await writeFile(path, '\uFEFF' + await readFile(path, 'utf8'));
  assert.notEqual((await loadHandoutWorkspace(root)).snapshot.fingerprint, before.snapshot.fingerprint);
  await writeFile(join(root, 'shell.config.json'), '\uFEFF' + JSON.stringify({ project: { name: 'BOM example' } }));
  assert.ok((await prepareHandout(root)).entries[0].content.includes('BOM example'));
});
test('selected optional items need complete answers, while unchecked optional items do not block', () => {
  const text = full().replace('- [ ] **OPTIONAL** `meeting.agenda`', '- [x] **OPTIONAL** `meeting.agenda`').replace(/(`meeting.agenda`[^\n]*\n  - Answer:)[^\n]*/, '$1 <TBD>');
  assert.ok(validateHandout(text, base).diagnostics.some(item => item.code === 'HANDOUT_OPTIONAL_OPEN'));
});
test('checked but rejected or missing trio approvals cannot produce readiness', () => {
  for (const value of ['rejected; reviewer=Designer; date=2026-09-29', 'approved', 'approved; reviewer=; date=2026-09-29']) {
    const text = full().replace(/(`ready.design`[^\n]*\n  - Answer:)[^\n]*/, '$1 ' + value);
    assert.ok(validateHandout(text, base).diagnostics.some(item => item.code === 'HANDOUT_APPROVAL_OPEN'));
  }
});
test('an impossible approval date is rejected', () => {
  assert.ok(validateHandout(full().replace('date=2026-09-29', 'date=2026-02-30'), base).diagnostics.some(item => item.code === 'HANDOUT_APPROVAL_OPEN'));
});

test('legacy handout entry delegates to the integrated reviewed-plan protocol', async t => {
  const root = await workspace(t);
  const run = (entry, args) => spawnSync(process.execPath, ['--experimental-strip-types', resolve(entry), ...args, '--root', root, '--json'], { encoding: 'utf8' });
  const legacy = run('scripts/handout.mjs', ['generate', '--dry-run']);
  const integrated = run('bin/app', ['handout', 'generate', '--dry-run']);
  assert.equal(legacy.status, 0, legacy.stderr + legacy.stdout);
  assert.equal(integrated.status, 0, integrated.stderr + integrated.stdout);
  assert.deepEqual(JSON.parse(legacy.stdout), JSON.parse(integrated.stdout));
  await assert.rejects(readFile(join(root, HANDOUT_PATH)), { code: 'ENOENT' });
  const created = run('scripts/handout.mjs', ['generate', '--write']);
  assert.equal(created.status, 0, created.stderr + created.stdout);
  const outcome = JSON.parse(created.stdout);
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.command, 'handout generate');
  assert.ok(outcome.data.applied.written.includes(HANDOUT_PATH));
});

test('canonical sha256 helper preserves framework and handout byte fingerprints', async () => {
  const { sha256 } = await import('../../scripts/shared/hash.mjs');
  const { hash } = await import('../../scripts/framework/files.ts');
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (const bytes of ['Unicode ⛄', Buffer.from([0, 255, 1, 0])]) {
    assert.equal(hash(bytes), sha256(bytes));
    assert.equal(digest(bytes), sha256(bytes));
  }
});

test('shared filesystem presence preserves broken symlinks and missing-path semantics', async t => {
  const { exists, statIfPresent } = await import('../../scripts/shared/fs-presence.mjs');
  const root = await workspace(t);
  const missing = join(root, 'missing.md');
  assert.equal(await exists(missing), false);
  assert.equal(await statIfPresent(missing), null);
  const path = join(root, 'docs/prds/PRD-1.md');
  assert.equal(await exists(path), true);
  const link = join(root, 'broken-link.md');
  await symlink(missing, link);
  assert.equal(await exists(link), true);
  assert.equal((await statIfPresent(link)).isSymbolicLink(), true);
});
