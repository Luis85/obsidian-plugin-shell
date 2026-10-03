import assert from 'node:assert/strict';
import {
  HANDOUT_LIMIT, HANDOUT_PATH, HandoutError, digest, ensure, makeSnapshot, renderHandout,
  parseAnswers, readSnapshot, validateHandout, refreshHandout,
} from '../../bin/adapters/framework/handout-model.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const base = makeSnapshot('docs/prds', [{ path: 'docs/prds/PRD-1.md', sha256: digest('# PRD') }]);
const full = () => renderHandout(base).replace(/- \[ \] \*\*REQUIRED\*\*/g, '- [x] **REQUIRED**')
  .replace(/  - Answer:.*$/gm, '  - Answer: Reviewed concrete decision with details in docs/prds/PRD-1.md#scope.')
  .replace(/  - Evidence:.*$/gm, '  - Evidence: Trio decision, reviewer recorded in meeting notes, 2026-09-29.')
  .replace(/(`run.mode`[^\n]*\n  - Answer:)[^\n]*/, '$1 skip')
  .replace(/(`ready\.(?:product|design|engineering)`[^\n]*\n  - Answer:)[^\n]*/g, '$1 approved; reviewer=Test reviewer; date=2026-09-29; limitations=Reviewed synthetic fixture.');

test('relocated handout model preserves compatibility identity and constants', () => {
  assert.equal(HANDOUT_PATH, 'PROJECT-SETUP-HANDOUT.md');
  assert.equal(HANDOUT_LIMIT, 2_000_000);
  assert.match(digest('bytes'), /^[a-f0-9]{64}$/);
  assert.throws(() => ensure(false, 'TEST_CODE', 'blocked'), error => error instanceof HandoutError && error.code === 'TEST_CODE');
});

test('rendering is deterministic, escaped and never auto-checks suggestions', () => {
  const suggestion = { answer: 'A\n<script>x</script>`', evidence: '<!-- evidence -->' };
  const text = renderHandout(base, { 'product.identity': suggestion });
  assert.equal(text, renderHandout(base, { 'product.identity': suggestion }));
  assert.equal((text.match(/^- \[ \]/gm) ?? []).length, 69);
  assert.equal((text.match(/^- \[x\]/gm) ?? []).length, 0);
  assert.ok(!text.includes('<script>'));
  assert.ok(!text.includes('<!-- evidence -->'));
});

test('required review matrix moves from blocked to ready without authorizing execution', () => {
  const empty = validateHandout(renderHandout(base), base);
  assert.equal(empty.ready, false);
  assert.equal(empty.requiredTotal, 49);
  assert.equal(empty.requiredAnswered, 0);
  const ready = validateHandout(full(), base);
  assert.equal(ready.ready, true);
  assert.equal(ready.optionalAnswered, 0);
  assert.equal(ready.executionAuthorized, false);
});

test('placeholders, blank evidence and changed requirement classification remain blocking', () => {
  for (const value of ['', 'N/A', 'TBD', '<TODO>', 'pending']) {
    assert.equal(validateHandout(full().replace(/(`product.problem`[^\n]*\n  - Answer:)[^\n]*/, '$1 '+value), base).ready, false);
  }
  assert.equal(validateHandout(full().replace(/  - Evidence:.*?\n/, '  - Evidence: \n'), base).ready, false);
  assert.ok(validateHandout(full().replace('**REQUIRED** `meeting.owners`', '**OPTIONAL** `meeting.owners`'), base).diagnostics.some(item => item.code === 'HANDOUT_REQUIREMENT_CHANGED'));
});

test('parser rejects unknown, duplicate, missing and repeated checklist fields', () => {
  const text = full();
  assert.ok(validateHandout(text.replace('`meeting.owners`', '`unknown.id`'), base).diagnostics.some(item => item.code === 'HANDOUT_UNKNOWN_ID'));
  assert.ok(validateHandout(text+'\n- [x] **REQUIRED** `meeting.owners` — Duplicate\n', base).diagnostics.some(item => item.code === 'HANDOUT_DUPLICATE_ID'));
  assert.ok(validateHandout(text.replace('`meeting.owners`', '`meeting-owner`'), base).diagnostics.some(item => item.code === 'HANDOUT_MISSING_ID'));
  assert.ok(validateHandout(text.replace('  - Answer:', '  - Answer: \n  - Answer:'), base).diagnostics.some(item => item.code === 'HANDOUT_DUPLICATE_FIELD'));
});

test('multiline fields work while fenced examples are ignored and unclosed fences block', () => {
  const multi = full().replace('  - Answer:', '  - Answer: Decision\n    Continued answer.\n  - Guidance: extra');
  assert.match(parseAnswers(multi).answers[0].answer, /Continued/);
  const fenced = full()+'\n```md\n- [x] **REQUIRED** `meeting.owners` — Example\n  - Answer: not real\n```\n';
  assert.equal(validateHandout(fenced, base).ready, true);
  assert.ok(validateHandout(full()+'\n```\n', base).diagnostics.some(item => item.code === 'HANDOUT_FENCE'));
});

test('source inventory additions, changes, removals and missing PRDs invalidate readiness', () => {
  for (const files of [[], [{ path:'docs/prds/PRD-1.md', sha256:digest('changed') }], [...base.files,{path:'docs/prds/PRD-2.md',sha256:digest('new')}]] ) {
    const current=makeSnapshot('docs/prds',files);
    assert.ok(validateHandout(full(),current).diagnostics.some(item => item.code === (files.length ? 'HANDOUT_SOURCES_STALE' : 'HANDOUT_SOURCES_STALE')));
  }
  const empty=makeSnapshot('docs/prds',[]);
  assert.ok(validateHandout(renderHandout(empty),empty).diagnostics.some(item => item.code === 'HANDOUT_PRDS_MISSING'));
});

test('snapshot metadata validates version, uniqueness, shape, fingerprint and size', () => {
  const text=renderHandout(base);
  assert.deepEqual(readSnapshot(text),base);
  assert.throws(() => readSnapshot(text.replace('"schemaVersion":1','"schemaVersion":2')), /HANDOUT_VERSION/);
  assert.throws(() => readSnapshot(text+'\n'+text.match(/<!-- workbench-handout-snapshot: .+ -->/)[0]), /HANDOUT_METADATA/);
  assert.throws(() => readSnapshot(text.replace(base.fingerprint,'0'.repeat(64))), /HANDOUT_METADATA/);
  const duplicate=makeSnapshot('docs/prds',[...base.files,...base.files]);
  const duplicateText=renderHandout(base).replace(JSON.stringify(base),JSON.stringify(duplicate));
  assert.throws(() => readSnapshot(duplicateText));
  assert.throws(() => parseAnswers('x'.repeat(HANDOUT_LIMIT+1)), /HANDOUT_TOO_LARGE/);
});

test('showcase mode adds conditional review and invalid run modes are rejected', () => {
  const showcase=full().replace('  - Answer: skip','  - Answer: showcase');
  assert.ok(validateHandout(showcase,base).diagnostics.some(item => item.code === 'HANDOUT_SHOWCASE_OPEN'));
  const completed=showcase.replace('- [ ] **OPTIONAL** `run.showcase`','- [x] **OPTIONAL** `run.showcase`');
  assert.equal(validateHandout(completed,base).ready,true);
  assert.ok(validateHandout(full().replace('  - Answer: skip','  - Answer: deploy'),base).diagnostics.some(item => item.code === 'HANDOUT_RUN_MODE'));
});

test('approval format and calendar dates remain explicit readiness gates', () => {
  for (const value of ['rejected; reviewer=Designer; date=2026-09-29','approved','approved; reviewer=; date=2026-09-29','approved; reviewer=Test; date=2026-02-30']) {
    const text=full().replace(/(`ready.design`[^\n]*\n  - Answer:)[^\n]*/,'$1 '+value);
    assert.ok(validateHandout(text,base).diagnostics.some(item => item.code === 'HANDOUT_APPROVAL_OPEN'));
  }
});

test('refresh preserves answers and notes, resets checks only for changed sources, and preserves CRLF', () => {
  const current=makeSnapshot('docs/prds',[{path:'docs/prds/PRD-1.md',sha256:digest('changed')}]);
  const notes='\n## Notes\nKeep exactly.\n```md\n- [x] **REQUIRED** `meeting.owners` — sample\n```\n';
  const original=full()+notes;
  assert.equal(refreshHandout(original,base),original);
  const refreshed=refreshHandout(original,current);
  assert.ok(refreshed.endsWith(notes));
  assert.equal(parseAnswers(refreshed).answers.filter(answer=>answer.checked).length,0);
  assert.equal(readSnapshot(refreshed).fingerprint,current.fingerprint);
  assert.ok(refreshHandout(full().replaceAll('\n','\r\n'),current).includes('\r\n'));
  assert.throws(() => refreshHandout(full().replace('`meeting.owners`','`missing.id`'),current), /HANDOUT_STRUCTURE/);
});
