import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkDocsLaunchers, findReferences, globToRegExp, parseAllowlist } from '../quality/check-docs-launchers.mjs';

// Built from parts so this file does not itself contain the retired names.
const shellLauncher = ['shell', 'mjs'].join('.');
const appLauncher = ['app', 'mjs'].join('.');
const kitPath = ['tools', 'shell-cli', 'bin', 'app'].join('/');
const emptyAllowlist = JSON.stringify({ entries: [] });
const entry = (glob, rules, reason = 'historical record') => ({ glob, rules, reason });

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'docs-launchers-'));
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}
async function withFixture(files, run) {
  const root = await fixture(files);
  try { return await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('reference scanner flags retired launchers and the kit path but not look-alikes', () => {
  assert.deepEqual(findReferences(`node ${shellLauncher} setup\nok\nnode bin/${appLauncher}`), [
    { rule: 'retired-launcher', line: 1 }, { rule: 'retired-launcher', line: 3 },
  ]);
  assert.deepEqual(findReferences(`run ${kitPath} first-run`), [{ rule: 'kit-layout-path', line: 1 }]);
  assert.deepEqual(findReferences(`node bin/app check\nmy-${appLauncher} and ${appLauncher}x and ${shellLauncher}-copy`), []);
});

test('globs match whole paths with single and double star semantics', () => {
  assert.ok(globToRegExp('docs/research/**').test('docs/research/a/b.md'));
  assert.ok(globToRegExp('docs/*.md').test('docs/a.md'));
  assert.ok(!globToRegExp('docs/*.md').test('docs/a/b.md'));
  assert.ok(!globToRegExp('docs/a.md').test('docs/aXmd'));
});

test('allowlist entries need a reason, known rules and a glob', () => {
  assert.throws(() => parseAllowlist('{}'), /ALLOWLIST_SHAPE_INVALID/);
  assert.throws(() => parseAllowlist(JSON.stringify({ entries: [entry('a.md', ['retired-launcher'], ' ')] })), /ALLOWLIST_ENTRY_INVALID/);
  assert.throws(() => parseAllowlist(JSON.stringify({ entries: [entry('a.md', ['unknown'])] })), /ALLOWLIST_ENTRY_INVALID/);
  assert.throws(() => parseAllowlist(JSON.stringify({ entries: [entry('a.md', [])] })), /ALLOWLIST_ENTRY_INVALID/);
  assert.equal(parseAllowlist(JSON.stringify({ entries: [entry('a.md', ['retired-launcher'])] })).length, 1);
});

test('checker fails on a live doc, skill, template and source reference with file and line', async () => {
  await withFixture({
    'README.md': `Run node ${shellLauncher} help\n`,
    '.claude/skills/x/SKILL.md': `\nnode ${appLauncher} memory status\n`,
    'templates/companion/guide.md': `see ${kitPath}\n`,
    'src/launch.ts': `export const cli = 'bin/${shellLauncher}';\n`,
    'node_modules/pkg/readme.md': `node ${shellLauncher}\n`,
  }, async root => {
    await assert.rejects(checkDocsLaunchers(root, emptyAllowlist), error => {
      for (const expected of ['README.md:1: retired-launcher', '.claude/skills/x/SKILL.md:2: retired-launcher', 'templates/companion/guide.md:1: kit-layout-path', 'src/launch.ts:1: retired-launcher']) assert.match(error.message, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.doesNotMatch(error.message, /node_modules/);
      return true;
    });
  });
});

test('checker passes clean trees and allowlisted historical references, and rejects stale or wrong-rule entries', async () => {
  await withFixture({ 'README.md': 'node bin/app check\n', 'docs/research/old.md': `node ${shellLauncher} doctor\n` }, async root => {
    const allowlist = rules => JSON.stringify({ entries: [entry('docs/research/**', rules)] });
    assert.deepEqual(await checkDocsLaunchers(root, allowlist(['retired-launcher'])), { status: 'passed', scanned: 2, allowedHistorical: 1, allowlistEntries: 1 });
    await assert.rejects(checkDocsLaunchers(root, allowlist(['kit-layout-path'])), /docs\/research\/old\.md:1: retired-launcher[\s\S]*stale allowlist entry/);
    await assert.rejects(checkDocsLaunchers(root, JSON.stringify({ entries: [entry('docs/other/**', ['retired-launcher']), entry('docs/research/**', ['retired-launcher'])] })), /docs\/other\/\*\*: stale allowlist entry/);
  });
});

test('the repository itself is clean under the committed allowlist, via the npm-facing CLI', () => {
  const result = spawnSync(process.execPath, ['scripts/quality/check-docs-launchers.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'passed');
  const rejected = spawnSync(process.execPath, ['scripts/quality/check-docs-launchers.mjs', '--extra'], { encoding: 'utf8' });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /NO_ARGUMENTS_SUPPORTED/);
});

test('nested agent worktrees are separate checkouts and are not scanned, but look-alike folders are', async () => {
  const files = { [`.claude/worktrees/agent-a/docs/old.md`]: `node ${shellLauncher}\n`, 'docs/ok.md': 'node bin/app check\n' };
  await withFixture(files, async root => {
    assert.deepEqual(await checkDocsLaunchers(root, emptyAllowlist), { status: 'passed', scanned: 1, allowedHistorical: 0, allowlistEntries: 0 });
  });
  await withFixture({ 'docs/worktrees/old.md': `node ${shellLauncher}\n` }, async root => {
    await assert.rejects(checkDocsLaunchers(root, emptyAllowlist), /docs\/worktrees\/old\.md:1: retired-launcher/);
  });
});
