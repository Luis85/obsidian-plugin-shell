import assert from 'node:assert/strict';
import { access, chmod, mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readGit, remoteHost } from '../adapters/framework/adopt-git.ts';
import { defaultLimits, scanProject } from '../adapters/framework/adopt-scan.ts';
import { readTargets } from '../adapters/framework/adopt-targets.ts';
import { fileSymlink } from '../../../tests/support/file-symlink.mjs';
import { frameworkRoot, git, initRepository, withProject } from './interactive-maker-adopt-fixture.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const put = async (root, path, content = 'x') => { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), content); };
const paths = scanned => scanned.files.map(file => file.path);
const exists = path => access(path).then(() => true, () => false);

test('the scan lists a real project in a stable order, reads only configuration and sources and skips outputs', async () => {
  await withProject('angular-standalone', async root => {
    for (const path of ['node_modules/x/package.json', 'dist/main.js', '.angular/cache/a.json', 'coverage/lcov.info', '.git/HEAD', 'build/out.js', 'src/deep/node_modules/y.ts']) await put(root, path);
    await put(root, 'docs/workbench/ADOPTION-PLAN.md', '# Workbench adoption plan: x');
    const first = await scanProject(root), second = await scanProject(root);
    assert.deepEqual(first.files, second.files); assert.deepEqual(paths(first), [...paths(first)].sort());
    assert.ok(paths(first).includes('src/app/app.routes.ts')); assert.ok(first.texts.has('package.json') && first.texts.has('src/app/app.routes.ts') && first.texts.has('.nvmrc') && first.texts.has('tsconfig.json'));
    assert.ok(!first.texts.has('src/styles.scss') && !first.texts.has('src/app/orders/orders.component.spec.ts') && !first.texts.has('eslint.config.js'));
    assert.ok(!paths(first).some(path => /node_modules|^dist|\.angular|^coverage|^\.git\/|^build/.test(path)) && !paths(first).includes('docs/workbench/ADOPTION-PLAN.md'));
    assert.ok(first.scan.skipped.directories.includes('node_modules') && first.scan.skipped.directories.includes('src/deep/node_modules'));
    assert.equal(first.scan.files, first.files.length); assert.equal(first.scan.truncated, false); assert.ok(first.scan.bytesRead > 0);
  });
});
test('symbolic links are never followed or read, even when they point outside the project', async t => {
  await withProject(null, async (project, root) => {
    await put(root, 'outside/package.json', '{"name":"secret"}'); await put(root, 'outside/secret/key.ts', 'export const key = 1;'); await put(project, 'package.json', '{"name":"inside"}');
    await symlink(join(root, 'outside'), join(project, 'linked-dir'), 'junction');
    if (!await fileSymlink(t, join(root, 'outside/package.json'), join(project, 'linked.json'))) return;
    const scanned = await scanProject(project);
    assert.deepEqual(paths(scanned), ['package.json']); assert.equal(scanned.scan.skipped.symlinks, 2);
    assert.ok([...scanned.texts.values()].every(text => !text.includes('secret')));
  });
});
test('huge, binary and unreadable inputs are counted and skipped without reading them', async () => {
  await withProject(null, async project => {
    await put(project, 'src/huge.ts', 'a'.repeat(defaultLimits.maxFileBytes + 1)); await put(project, 'package.json', Buffer.concat([Buffer.from('{"a":'), Buffer.alloc(300000, 32), Buffer.from('1}')]).toString());
    await put(project, 'src/blob.ts', Buffer.from([0x61, 0, 0x62])); await put(project, 'src/ok.ts', 'export const ok = 1;');
    const scanned = await scanProject(project);
    assert.deepEqual(paths(scanned), ['package.json', 'src/blob.ts', 'src/huge.ts', 'src/ok.ts']); assert.deepEqual([...scanned.texts.keys()], ['src/ok.ts']);
    assert.equal(scanned.scan.skipped.oversize, 2); assert.equal(scanned.scan.skipped.binary, 1);
    const missing = await scanProject(join(project, 'package.json')); assert.deepEqual(paths(missing), []); assert.equal(missing.scan.skipped.unreadable, 1);
    if (process.platform !== 'win32' && process.getuid?.() !== 0) { await chmod(join(project, 'src/ok.ts'), 0); assert.equal((await scanProject(project)).scan.skipped.unreadable, 1); }
  });
});
test('file, depth, source and byte limits stop the scan and mark it truncated', async () => {
  await withProject(null, async project => {
    for (let index = 0; index < 6; index++) await put(project, `src/f${index}.ts`, 'export const a = 1;');
    await put(project, 'a/b/c/d/e.ts', 'x');
    const limits = { ...defaultLimits };
    const files = await scanProject(project, { ...limits, maxFiles: 3 }); assert.equal(files.files.length, 3); assert.equal(files.scan.truncated, true);
    const depth = await scanProject(project, { ...limits, maxDepth: 2 }); assert.ok(!paths(depth).includes('a/b/c/d/e.ts')); assert.equal(depth.scan.truncated, true);
    const sources = await scanProject(project, { ...limits, maxSourceFiles: 2 }); assert.equal(sources.texts.size, 2); assert.equal(sources.scan.truncated, true);
    const bytes = await scanProject(project, { ...limits, maxTotalBytes: 30 }); assert.equal(bytes.scan.truncated, true); assert.ok(bytes.scan.bytesRead <= 30);
    const exact = await scanProject(project, { ...limits, maxFiles: 7 }); assert.equal(exact.scan.truncated, false); assert.equal(exact.files.length, 7);
    const controller = new AbortController(); controller.abort(); assert.deepEqual(paths(await scanProject(project, limits, controller.signal)), []);
  });
});
test('an extracted CLI kit is recorded by its marker only and hostile names stay inert', async () => {
  await withProject('hostile', async project => {
    const kit = 'tools/shell-cli'; await put(project, `${kit}/bin/kit.json`, '{}'); await put(project, `${kit}/bin/app`, '#!/usr/bin/env node'); await put(project, 'tools/shell-cli/src/big.ts', 'export {}'); await put(project, 'bin/app', 'not a kit');
    const scanned = await scanProject(project);
    assert.ok(paths(scanned).includes('tools/shell-cli/bin/kit.json') && !paths(scanned).includes('tools/shell-cli/src/big.ts') && paths(scanned).includes('bin/app'));
    assert.ok(scanned.scan.skipped.directories.includes('tools/shell-cli (CLI kit)'));
    assert.ok(paths(scanned).includes('src/__proto__/prototype.ts') && paths(scanned).includes('src/weird name (1).ts'));
  });
});
test('git facts: absent, clean, dirty, untracked, linked worktree and unreadable configuration', async () => {
  await withProject('angular-standalone', async project => {
    assert.deepEqual(await readGit(project), { present: false, dirty: null, remoteHost: null, dirtyNote: null });
    initRepository(project);
    assert.deepEqual(await readGit(project), { present: true, dirty: false, remoteHost: null, dirtyNote: null });
    await put(project, 'notes.txt', 'new'); assert.equal((await readGit(project)).dirty, true);
    git(project, 'add', '-A'); git(project, 'commit', '-q', '-m', 'notes'); await writeFile(join(project, 'package.json'), '{}'); assert.equal((await readGit(project)).dirty, true);
    git(project, 'remote', 'add', 'origin', 'https://builder:ghp_SECRET123@github.com/acme/portal.git');
    const facts = await readGit(project); assert.equal(facts.remoteHost, 'github.com'); assert.ok(!JSON.stringify(facts).includes('SECRET') && !JSON.stringify(facts).includes('builder'));
  });
  await withProject(null, async project => {
    await mkdir(join(project, '.git')); const empty = await readGit(project);
    assert.equal(empty.present, true); assert.equal(empty.dirty, null); assert.match(empty.dirtyNote, /could not be read/);
  });
  await withProject(null, async project => {
    await writeFile(join(project, '.git'), 'gitdir: ../elsewhere'); const linked = await readGit(project);
    assert.equal(linked.present, true); assert.equal(linked.dirty, null); assert.match(linked.dirtyNote, /linked worktree or submodule/);
  });
});
test('git is not run when the repository configuration could execute commands, and the control proves it would', async () => {
  await withProject('react-vite', async project => {
    initRepository(project);
    const marker = join(project, '..', 'marker-ran');
    git(project, 'config', 'filter.evil.clean', `node -e "require('fs').writeFileSync(process.argv[1],'x')" ${JSON.stringify(marker)} && cat`);
    await writeFile(join(project, '.gitattributes'), '* filter=evil\n');
    // Control: an ordinary status in this repository runs the clean filter once a file's stat data is stale.
    await writeFile(join(project, 'src/App.tsx'), (await import('node:fs/promises').then(fs => fs.readFile(join(project, 'src/App.tsx'), 'utf8'))));
    git(project, 'status', '--porcelain'); assert.equal(await exists(marker), true, 'control: git itself runs the configured filter');
    await import('node:fs/promises').then(fs => fs.rm(marker));
    await writeFile(join(project, 'src/App.tsx'), (await import('node:fs/promises').then(fs => fs.readFile(join(project, 'src/App.tsx'), 'utf8'))));
    const facts = await readGit(project);
    assert.equal(facts.dirty, null); assert.match(facts.dirtyNote, /declares filters, includes or fsmonitor settings/); assert.equal(await exists(marker), false, 'adopt must not execute the repository filter');
  });
  for (const config of ['[include]\n\tpath = ../x\n', '[core]\n\tfsmonitor = true\n', '[includeIf "gitdir:~/"]\n\tpath = x\n']) {
    await withProject(null, async project => { await mkdir(join(project, '.git')); await writeFile(join(project, '.git/config'), config); assert.equal((await readGit(project)).dirty, null); });
  }
});
test('git status that cannot run (no git binary) yields an unknown state with an explanation', async () => {
  await withProject('react-vite', async project => {
    initRepository(project); const path = process.env.PATH;
    try { process.env.PATH = ''; const facts = await readGit(project); assert.equal(facts.dirty, null); assert.match(facts.dirtyNote, /could not be run safely/); } finally { process.env.PATH = path; }
    const controller = new AbortController(); controller.abort(); assert.equal((await readGit(project, controller.signal)).dirty, null);
  });
});
test('remote hosts drop credentials, ports and paths and reject anything that is not a host name', () => {
  const origin = url => `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`;
  const cases = { 'https://user:pass@GitHub.com/a/b.git': 'github.com', 'git@gitlab.example.com:group/repo.git': 'gitlab.example.com', 'ssh://git@host.internal:2222/x.git': 'host.internal', 'https://example.org:8443/a': 'example.org',
    '/srv/git/repo.git': null, '../sibling': null, 'file:///srv/repo': null, 'https://-bad.example/x': null };
  for (const [url, host] of Object.entries(cases)) assert.equal(remoteHost(origin(url)), host, url);
  assert.equal(remoteHost(null), null); assert.equal(remoteHost('[remote "upstream"]\n\turl = https://example.org/x'), null); assert.equal(remoteHost(''), null);
});
test('the Workbench targets come from the installed starter, kit template files and package pins, never from constants', async () => {
  const real = await readTargets(frameworkRoot);
  assert.deepEqual(real.angular, { version: '22.0.0', major: 22, source: 'configs/starters/webapp-angular.json' }); assert.equal(real.node.major, 24); assert.equal(real.node.source, '.nvmrc'); assert.deepEqual([real.typescript.version, real.typescript.source], ['6.0.3', 'package.json']);
  await withProject(null, async root => {
    assert.deepEqual(await readTargets(root), { angular: { version: null, major: null, source: null }, node: { version: null, major: null, source: null }, typescript: { version: null, major: null, source: null } });
    await put(root, 'configs/starters/hybrid-angular.json', JSON.stringify({ generator: { angularPins: { '@angular/core': '23.1.0' } } })); await put(root, '.nvmrc', 'v26\n'); await put(root, 'package.json', JSON.stringify({ devDependencies: { typescript: '^7.0.1' } }));
    // Without bin/kit.json the checkout is its own template: a stray bin/template copy is never consulted.
    await put(root, 'bin/template/.nvmrc', 'v30\n'); await put(root, 'bin/template/package.json', JSON.stringify({ devDependencies: { typescript: '^9.0.0' } }));
    const source = await readTargets(root);
    assert.deepEqual(source.angular, { version: '23.1.0', major: 23, source: 'configs/starters/hybrid-angular.json' }); assert.deepEqual(source.node, { version: '26', major: 26, source: '.nvmrc' }); assert.deepEqual([source.typescript.version, source.typescript.source], ['7.0.1', 'package.json']);
    await put(root, 'configs/starters/webapp-angular.json', '{ broken'); await put(root, '.nvmrc', 'lts/*\n');
    const broken = await readTargets(root); assert.equal(broken.angular.version, '23.1.0'); assert.equal(broken.node.version, null, 'an unusable pin is unknown, never replaced by another layout');
    await put(root, 'configs/starters/webapp-angular.json', JSON.stringify({ generator: { angularPins: {} } })); assert.equal((await readTargets(root)).angular.version, null);
    await put(root, 'bin/kit.json', '{}');
    await assert.rejects(readTargets(root), /kit manifest|KIT_/i, 'a kit marker without a verified kit is refused');
  });
});
