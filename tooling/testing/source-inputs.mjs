/** Hash actual executable inputs, including new files. Not a whole-repository attestation. */
import { sha256 } from '../../src/shared/platform/hash.ts';
export { sha256 } from '../../src/shared/platform/hash.ts';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { vendorArchive, decodeVendor } from '../styles/vendor-policy.mjs';
import { codeLines } from './code-lines.mjs';
import { loadThresholds } from '../quality/thresholds.mjs';

const inputRoots = ['src', 'tooling', 'tests', 'docs/design/obsidian-tokens.json', 'docs/testing/test-plan.json', '.github/workflows', 'package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', 'configs'];
export function physicalLines(text) {
  if (!text) return 0;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.split('\n').length - (normalized.endsWith('\n') ? 1 : 0);
}
let limits;
export function lineLimit(path) {
  if (!/\.(?:[cm]?[jt]sx?|vue|css|html)$/.test(path)) return null;
  limits ??= loadThresholds().codeLines;
  if (path === 'src/plugin/main.ts') return limits.mainTs;
  // Test files live in root tests/, tooling/tests/ and each source project's src/<name>/tests/.
  return /^(?:tests|tooling[/]tests|src[/][^/]+[/]tests)[/]/.test(path) ? limits.tests : limits.source;
}
// This optional executable sidecar is present with the companion concept. It
// must participate in archive transport and evidence freshness when installed.
// Missing concept content is valid in a foundation-only checkout; links are not.
async function optionalInput(root, name, directory = false) {
  const parts = name.split('/');
  let path = root;
  for (let i = 0; i < parts.length; i++) {
    path = join(path, parts[i]);
    let stat;
    try { stat = await lstat(path); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    if (stat.isSymbolicLink()) throw new Error('SOURCE_SYMLINK');
    const expectsDirectory = directory || i < parts.length - 1;
    if (expectsDirectory ? !stat.isDirectory() : !stat.isFile()) {
      throw new Error(expectsDirectory ? 'SOURCE_NOT_DIRECTORY' : 'SOURCE_NOT_REGULAR');
    }
  }
  return true;
}
async function defaultRoots(root) {
  const roots = [...inputRoots];
  // Optional installed capabilities and their actual reference input must travel
  // with source-only archives and invalidate receipts when their bytes change.
  for (const extra of ['workbench.sources.json', '.agents/skills/companion-prototype-design/SKILL.md']) {
    if (await optionalInput(root, extra)) roots.push(extra);
  }
  // Each optional folder must be a real directory; one already inside a root (configs/starters under configs) is not listed twice.
  const covered = path => roots.some(entry => path.startsWith(entry + '/'));
  // CI composite actions and runner scripts are executable CI inputs beside .github/workflows when present.
  for (const directory of ['.github/actions', '.github/scripts', 'configs/starters', 'templates', 'docs/concepts/companion/test-kit', '.claude/skills/companion-prototype-design']) {
    if (await optionalInput(root, directory, true) && !covered(directory)) roots.push(directory);
  }
  return roots;
}
export async function sourceInputs(root, roots) {
  roots = roots ?? await defaultRoots(root);
  const files = [];
  async function visit(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('SOURCE_SYMLINK');
    if (stat.isDirectory()) {
      for (const name of (await readdir(path)).sort()) await visit(join(path, name));
    } else if (stat.isFile()) {
      const name = relative(root, path).split('\\').join('/');
      const data = await readFile(path);
      const decoded = name === vendorArchive ? decodeVendor(data) : null;
      const limit = lineLimit(name);
      files.push({ path: name, sha256: sha256(data), bytes: data.length,
        lines: decoded ? codeLines(decoded.toString('utf8'), 'vendor.css') : limit === null ? null : codeLines(data.toString('utf8'), name),
        physicalLines: decoded ? physicalLines(decoded.toString('utf8')) : limit === null ? null : physicalLines(data.toString('utf8')), limit });
    } else throw new Error('SOURCE_NOT_REGULAR');
  }
  for (const path of roots) await visit(join(root, path));
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { algorithm: 'sha256', lineMetric: 'code-excluding-comments-and-blank-lines', roots, files, digest: sha256(JSON.stringify(files)) };
}
