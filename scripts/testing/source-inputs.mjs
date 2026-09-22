/** Hash actual executable inputs, including new files. Not a whole-repository attestation. */
import { createHash } from 'node:crypto';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { vendorArchive, decodeVendor } from '../styles/vendor-policy.mjs';

const inputRoots = ['src', 'harness', 'scripts', 'tests', 'docs/design/obsidian-tokens.json', 'docs/testing/test-plan.json', '.github/workflows', 'package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', 'eslint.config.mjs', '.fallowrc.json', '.oxlintrc.json', 'vite.config.mjs', 'vite.harness.config.mjs', 'vitest.config.mjs', 'vitest.production.config.mjs', 'playwright.config.ts'];
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
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
export async function sourceInputs(root, roots = inputRoots) {
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
        lines: decoded ? physicalLines(decoded.toString('utf8')) : limit === null ? null : physicalLines(data.toString('utf8')), limit });
    } else throw new Error('SOURCE_NOT_REGULAR');
  }
  for (const path of roots) await visit(join(root, path));
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { algorithm: 'sha256', roots, files, digest: sha256(JSON.stringify(files)) };
}
