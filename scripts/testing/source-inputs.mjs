/** Hash actual executable inputs, including new files. Not a whole-repository attestation. */
import { sha256 } from '../shared/hash.mjs';
export { sha256 } from '../shared/hash.mjs';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { vendorArchive, decodeVendor } from '../styles/vendor-policy.mjs';
import { codeLines } from './code-lines.mjs';

const inputRoots = ['src', 'harness', 'scripts', 'tests', 'docs/design/obsidian-tokens.json', 'docs/testing/test-plan.json', '.github/workflows', 'package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', 'eslint.config.mjs', '.fallowrc.json', '.oxlintrc.json', 'vite.config.mjs', 'vite.harness.config.mjs', 'vitest.config.mjs', 'vitest.production.config.mjs', 'playwright.config.ts'];
export function physicalLines(text) {
  if (!text) return 0;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.split('\n').length - (normalized.endsWith('\n') ? 1 : 0);
}
export function lineLimit(path) {
  if (!/\.(?:[cm]?[jt]sx?|vue|css|html)$/.test(path)) return null;
  if (path === 'src/main.ts') return 100;
  return path.startsWith('tests/') ? 450 : 400;
}
// This optional executable sidecar is present with the companion concept. It
// must participate in archive transport and evidence freshness when installed.
// Missing concept content is valid in a foundation-only checkout; links are not.
async function defaultRoots(root) {
  const roots = [...inputRoots];
  // Foundation-only fixtures can omit the compiler, but installed launcher and
  // compiler configuration bytes must participate in transport and freshness.
  for (const extra of ['shell.mjs', 'tsconfig.generator.json', 'tsconfig.framework.json']) {
    let stat;
    try { stat = await lstat(join(root, extra)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink()) throw new Error('SOURCE_SYMLINK');
    if (!stat.isFile()) throw new Error('SOURCE_NOT_REGULAR');
    roots.push(extra);
  }
  const sidecar = 'docs/concepts/companion/test-kit';
  let path = root;
  for (const part of sidecar.split('/')) {
    path = join(path, part);
    let stat;
    try { stat = await lstat(path); }
    catch (error) { if (error.code === 'ENOENT') return roots; throw error; }
    if (stat.isSymbolicLink()) throw new Error('SOURCE_SYMLINK');
    if (!stat.isDirectory()) throw new Error('SOURCE_NOT_DIRECTORY');
  }
  roots.push(sidecar);
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
