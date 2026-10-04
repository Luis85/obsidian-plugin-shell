import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { main } from '../../bin/adapters/framework-cli.ts';

export const frameworkRoot = resolve(import.meta.dirname, '../..');
const fixtureRoot = join(frameworkRoot, 'tests/fixtures/adoption');
const text = value => Array.isArray(value) ? value.join('\n') + '\n' : JSON.stringify(value, null, 2) + '\n';

/** Writes one adoption fixture tree (tests/fixtures/adoption/<name>.tree.json) into an empty directory. */
export async function materialize(name, directory) {
  const tree = JSON.parse(await readFile(join(fixtureRoot, `${name}.tree.json`), 'utf8'));
  for (const [path, content] of Object.entries(tree.files)) {
    const file = join(directory, ...path.split('/'));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text(content));
  }
}
export async function fixtureNames() {
  const { readdir } = await import('node:fs/promises');
  return (await readdir(fixtureRoot)).filter(name => name.endsWith('.tree.json')).map(name => name.replace(/\.tree\.json$/, '')).sort();
}
/** A real temporary project, optionally seeded from a fixture tree; removed afterwards. */
export async function withProject(name, check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'adopt-')));
  const directory = join(root, 'project');
  await mkdir(directory);
  try {
    if (name) await materialize(name, directory);
    return await check(directory, root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const noGit = { present: false, dirty: null, remoteHost: null, dirtyNote: null };
export const noTargets = { angular: { version: null, major: null, source: null }, node: { version: null, major: null, source: null }, typescript: { version: null, major: null, source: null } };
export const targets = { angular: { version: '22.0.0', major: 22, source: 'configs/starters/webapp-angular.json' }, node: { version: '24.21.0', major: 24, source: '.nvmrc' }, typescript: { version: '6.0.3', major: 6, source: 'package.json' } };
/** An in-memory inventory for the pure analysis: `files` maps a path to text, JSON data or null (counted, not read). */
export function inventoryOf(files, { git: gitFacts = noGit, name = 'sample', scan = {} } = {}) {
  const texts = new Map(), list = [];
  for (const [path, content] of Object.entries(files)) {
    list.push({ path, bytes: typeof content === 'string' ? content.length : 10 });
    if (content !== null) texts.set(path, typeof content === 'string' ? content : JSON.stringify(content));
  }
  const facts = { files: list.length, bytesRead: 0, truncated: false, maxFiles: 20000, maxFileBytes: 262144, skipped: { directories: [], symlinks: 0, oversize: 0, binary: 0, unreadable: 0 }, ...scan };
  return { name, files: list, texts, git: gitFacts, scan: facts };
}
export function git(directory, ...args) {
  const run = spawnSync('git', args, { cwd: directory, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' } });
  if (run.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${run.stderr}`);
  return run.stdout;
}
export function initRepository(directory, { commit = true } = {}) {
  git(directory, 'init', '-q', '-b', 'main');
  if (commit) { git(directory, 'add', '-A'); git(directory, 'commit', '-q', '-m', 'baseline'); }
}
function capture(isTTY = false) {
  let output = '';
  const stream = new PassThrough();
  stream.isTTY = isTTY;
  stream.on('data', chunk => { output += String(chunk); });
  return { stream, read: () => output };
}
/** Runs the framework CLI composition root in process with captured streams (no TTY, so nothing prompts). */
export async function run(argv, { stdin } = {}) {
  const out = capture(), error = capture();
  const code = await main(argv, frameworkRoot, { input: Readable.from(stdin === undefined ? [] : [stdin]), output: out.stream, error: error.stream, env: { CI: 'true', NO_COLOR: '1' } });
  return { code, stdout: out.read(), stderr: error.read() };
}
export async function runJson(argv) {
  const result = await run([...argv, '--json']);
  return { ...result, json: JSON.parse(result.stdout) };
}
