import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { release } from 'node:os';
import { sourceInputs, sha256 } from './source-inputs.mjs';
import { resolveBrowserExecutable } from '../../src/cli/tooling/testing/browser-executable.mjs';
import { validateRetained } from '../../src/cli/tooling/release/candidate.mjs';

const protocol = 'executable-evidence/2';
const producerNames = ['runtime', 'browser', 'tooling', 'coverage', 'artifact', 'native'];
async function filesUnder(root, directory, pattern) {
  const files = [];
  async function visit(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const next = join(path, item.name);
      if (item.isSymbolicLink()) throw new Error('EVIDENCE_SYMLINK');
      if (item.isDirectory()) await visit(next);
      else if (item.isFile() && pattern.test(item.name)) files.push(relative(root, next).replaceAll('\\', '/'));
    }
  }
  await visit(join(root, directory));
  return files.sort();
}
export async function fileIdentity(root, file) {
  const path = resolve(root, file);
  if (relative(root, path).startsWith('..') || (await lstat(path)).isSymbolicLink()) throw new Error('EVIDENCE_PATH');
  const bytes = await readFile(path);
  return { file, bytes: bytes.length, sha256: sha256(bytes) };
}
export async function assetIdentity(root) {
  return await Promise.all(['main.js', 'manifest.json', 'styles.css'].map(file => fileIdentity(root, `dist/${file}`)));
}
export async function candidateIdentity(root, before, supplied) {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  if (!supplied && before.checkout.kind !== 'clean') throw new Error('EVIDENCE_RETAINED_CANDIDATE_REQUIRED');
  const directory = supplied ?? `reports/release/${manifest.version}-${before.checkout.revision}`;
  const location = resolve(root, directory); const name = relative(root, location).replaceAll('\\', '/');
  if (name.startsWith('..') || !name) throw new Error('EVIDENCE_CANDIDATE_PATH');
  const record = JSON.parse(await readFile(join(location, 'candidate.json'), 'utf8'));
  const retained = await validateRetained(location, supplied ? record.sourceCommit : before.checkout.revision, manifest.version);
  const assets = await assetIdentity(root);
  if (assets.some(asset => retained.assetHashes[asset.file.slice(5)] !== asset.sha256)) throw new Error('EVIDENCE_CANDIDATE_ASSETS');
  return { directory: name, record: await fileIdentity(root, `${name}/candidate.json`), sourceCommit: retained.sourceCommit, version: retained.version, lockHash: retained.lockHash, assetHashes: retained.assetHashes };
}
async function checkoutIdentity(root) {
  try { await lstat(join(root, '.git')); }
  catch (error) {
    if (error.code === 'ENOENT') return { kind: 'archive', revision: null };
    throw new Error('EVIDENCE_GIT_STATE');
  }
  try {
    const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const canonical = async path => {
      const value = await realpath(path);
      return process.platform === 'win32' ? value.toLowerCase() : value;
    };
    if (await canonical(root) !== await canonical(git(['rev-parse', '--show-toplevel']))) throw new Error('ROOT_MISMATCH');
    const revision = git(['rev-parse', '--verify', 'HEAD']);
    if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('REVISION_INVALID');
    return { kind: git(['status', '--porcelain', '--untracked-files=all']) ? 'modified' : 'clean', revision };
  } catch { throw new Error('EVIDENCE_GIT_STATE'); }
}
export async function evidenceIdentity(root, producer) {
  if (!producerNames.includes(producer)) throw new Error('EVIDENCE_PRODUCER');
  const source = await sourceInputs(root);
  // The additive crosswalk is an execution policy input; the finite baseline stays unchanged.
  const crosswalk = await fileIdentity(root, 'docs/testing/acceptance-crosswalk.json');
  const nativeChecks = await fileIdentity(root, 'docs/testing/native-evidence-checks.json');
  // An archive is identified by absence of its own metadata, not by a failed Git
  // command or ancestor-repository discovery. Broken real checkouts fail closed.
  const checkout = await checkoutIdentity(root);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const modules = { runtime: ['vitest'], browser: ['@playwright/test'], tooling: [], coverage: ['vitest', '@vitest/coverage-v8'], artifact: ['postcss', 'postcss-selector-parser'], native: ['@playwright/test'] }[producer];
  const tools = { node: process.versions.node };
  for (const name of modules) {
    const actual = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
    if (actual !== (pkg.devDependencies?.[name] ?? pkg.dependencies?.[name])) throw new Error('EVIDENCE_TOOL_VERSION');
    tools[name] = actual;
  }
  const policyFiles = source.files.filter(file => file.path.startsWith('tooling/testing/evidence-'));
  if (!policyFiles.length) throw new Error('EVIDENCE_PROTOCOL_MISSING');
  let browser = null;
  if (producer === 'browser') {
    const resolved = resolveBrowserExecutable({ root });
    if (!resolved.executablePath) throw new Error(`EVIDENCE_BROWSER_UNAVAILABLE: ${resolved.hint}`);
    const executable = resolved.executablePath;
    const bytes = await readFile(executable);
    browser = { executable, bytes: bytes.length, sha256: sha256(bytes) };
  }
  return { sourceDigest: sha256(JSON.stringify({ source: source.digest, crosswalk, nativeChecks })), sourceInputsDigest: source.digest, checkout, lock: await fileIdentity(root, 'package-lock.json'),
    protocol: { id: protocol, sha256: sha256(JSON.stringify({ policyFiles, crosswalk, nativeChecks })) }, tools,
    environment: { platform: process.platform, release: release(), architecture: process.arch, timezone: 'UTC', locale: 'C.UTF-8', browser } };
}
const registrationImport = /^import\s+(['"])([^'"]+\.checks\.mjs)\1;?$/;
/** Portable test modules (e.g. a skill's own .checks.mjs) that a tooling file registers through nothing but
 * side-effect imports. node:test reports their cases under the defining module, so evidence credits them to
 * the registering inventory file; a file that also holds code or other imports registers nothing. */
export async function toolingRegistrations(root, files) {
  const owners = new Map();
  for (const file of files) {
    const lines = (await readFile(join(root, file), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/)
      .map(line => line.trim()).filter(line => line && !line.startsWith('//'));
    const imports = lines.map(line => registrationImport.exec(line));
    if (!imports.length || imports.some(match => !match)) continue;
    for (const match of imports) owners.set(relative(root, resolve(root, dirname(file), match[2])).split(sep).join('/'), file);
  }
  return owners;
}
/** Top-level node:test modules of every test home: cross-project tests/tooling, tooling/tests and each source project's
 * src/<name>/tests. Nested folders (support, fixtures, tooling/tests/hindsight) run elsewhere. */
async function toolingTestFiles(root) {
  const absent = error => { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return []; throw error; };
  const projects = (await readdir(join(root, 'src'), { withFileTypes: true }).catch(absent)).filter(item => item.isDirectory());
  const files = [];
  for (const home of ['tests/tooling', 'tooling/tests', ...projects.map(item => `src/${item.name}/tests`)]) {
    for (const item of await readdir(join(root, home), { withFileTypes: true }).catch(absent)) {
      if (item.isSymbolicLink()) throw new Error('EVIDENCE_SYMLINK');
      if (item.isFile() && /\.(checks|test)\.mjs$/.test(item.name)) files.push(`${home}/${item.name}`);
    }
  }
  return files;
}
export async function suiteInventory(root, producer) {
  if (['runtime', 'coverage'].includes(producer)) return filesUnder(root, 'src/plugin/tests/unit', /\.test\.ts$/);
  if (producer === 'browser') return filesUnder(root, 'src/plugin/tests/e2e', /\.spec\.ts$/);
  // Acceptance criterion tests (tests/acceptance, configs/delivery/delivery.json `acceptance`) run with the tooling suites; the folder is absent until an increment generates stubs.
  if (producer === 'tooling') {
    const acceptance = await lstat(join(root, 'tests/acceptance')).then(() => filesUnder(root, 'tests/acceptance', /\.checks\.mjs$/), () => []);
    return [...await toolingTestFiles(root), ...acceptance].sort();
  }
  return [producer === 'native' ? 'tooling/testing/check-native.mjs' : 'tooling/quality/check-artifacts.mjs'];
}
