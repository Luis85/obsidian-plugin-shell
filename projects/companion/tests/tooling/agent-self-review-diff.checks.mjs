import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { collectChanges, parseUnifiedDiff, resolveBase } from '../../scripts/quality/self-review-diff.mjs';

const git = (root, ...args) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
async function repo(t, files) {
  const root = await mkdtemp(join(tmpdir(), 'self review diff ü-')); t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'trunk');
  await put(root, files); git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'base');
  return root;
}
async function put(root, files) {
  for (const [path, text] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); }
}

test('[SELF-REVIEW-DIFF-01] the unified diff parser returns only added and removed lines with their line numbers', () => {
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts', 'index 111..222 100644', '--- a/src/a.ts', '+++ b/src/a.ts',
    '@@ -2 +2,2 @@', '-const old = 1;', '+const next = 1;', '+++ looks like a header but is content', '\\ No newline at end of file',
    '@@ -10,0 +12 @@', '+const tail = 3;',
    'diff --git a/src/new.ts b/src/new.ts', 'new file mode 100644', 'index 000..333', '--- /dev/null', '+++ b/src/new.ts', '@@ -0,0 +1,2 @@', '+one', '+two',
    'diff --git a/src/gone.ts b/src/gone.ts', 'deleted file mode 100644', 'index 444..000', '--- a/src/gone.ts', '+++ /dev/null', '@@ -1 +0,0 @@', '-bye',
    'diff --git a/img.png b/img.png', 'index 555..666 100644', 'Binary files a/img.png and b/img.png differ',
    'diff --git a/old name.ts b/new name.ts', 'similarity index 90%', 'rename from old name.ts', 'rename to new name.ts', '--- a/old name.ts', '+++ b/new name.ts', '@@ -1 +1 @@', '-x', '+y', '',
  ].join('\n');
  const [changed, created, deleted, binary, renamed] = parseUnifiedDiff(diff);
  assert.equal(changed.path, 'src/a.ts');
  assert.deepEqual(changed.added, [{ line: 2, text: 'const next = 1;' }, { line: 3, text: '++ looks like a header but is content' }, { line: 12, text: 'const tail = 3;' }]);
  assert.deepEqual(changed.removed, [{ line: 2, text: 'const old = 1;' }]);
  assert.deepEqual([created.status, created.added.map(line => line.line)], ['A', [1, 2]]);
  assert.deepEqual([deleted.status, deleted.path, deleted.removed.length, deleted.added.length], ['D', 'src/gone.ts', 1, 0]);
  assert.deepEqual([binary.path, binary.binary, binary.added.length], ['img.png', true, 0]);
  assert.deepEqual([renamed.status, renamed.path, renamed.oldPath, renamed.added.length], ['R', 'new name.ts', 'old name.ts', 1]);
});

test('[SELF-REVIEW-DIFF-02] collected changes cover committed-vs-base edits, new untracked files and context-free hunks', async t => {
  const root = await repo(t, { 'src/a.ts': 'keep();\nchange();\nkeep2();\n', 'docs/old.md': 'old\n' });
  await put(root, { 'src/a.ts': 'keep();\nchanged();\nkeep2();\n', 'tests/new.checks.mjs': 'one\ntwo\n', 'bin/blob.bin': 'a\u0000b' });
  git(root, 'rm', '-q', 'docs/old.md');
  const files = collectChanges(root, git(root, 'rev-parse', 'HEAD').trim());
  const byPath = Object.fromEntries(files.map(file => [file.path, file]));
  assert.deepEqual(byPath['src/a.ts'].added, [{ line: 2, text: 'changed();' }]);
  assert.deepEqual(byPath['src/a.ts'].removed, [{ line: 2, text: 'change();' }]);
  assert.equal(byPath['docs/old.md'].status, 'D');
  assert.deepEqual([byPath['tests/new.checks.mjs'].status, byPath['tests/new.checks.mjs'].added], ['A', [{ line: 1, text: 'one' }, { line: 2, text: 'two' }]]);
  assert.deepEqual(byPath['bin/blob.bin'].added, []);
});

test('[SELF-REVIEW-DIFF-03] the base resolves to the merge-base with origin/main, then main, or an explicit ref and fails clearly otherwise', async t => {
  const root = await repo(t, { 'a.txt': 'a\n' });
  const first = git(root, 'rev-parse', 'HEAD').trim();
  assert.throws(() => resolveBase(root), /SELF_REVIEW_BASE: cannot resolve a merge-base with origin\/main/);
  git(root, 'branch', 'main');
  assert.deepEqual(resolveBase(root), { ref: 'main', sha: first });
  git(root, 'update-ref', 'refs/remotes/origin/main', first);
  await put(root, { 'a.txt': 'b\n' }); git(root, 'commit', '-qam', 'second');
  assert.deepEqual(resolveBase(root), { ref: 'origin/main', sha: first });
  assert.equal(resolveBase(root, 'HEAD').sha, git(root, 'rev-parse', 'HEAD').trim());
  assert.throws(() => resolveBase(root, 'no-such-ref'), /SELF_REVIEW_BASE: cannot resolve base ref "no-such-ref"/);
});
