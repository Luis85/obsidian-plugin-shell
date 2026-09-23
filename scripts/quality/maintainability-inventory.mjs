import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256, physicalLines } from '../testing/source-inputs.mjs';
import { decodeVendor, vendorArchive } from '../styles/vendor-policy.mjs';
import { parse } from 'vue/compiler-sfc';

const executable = /\.(?:[cm]?[jt]sx?|vue)$/;
const nonExecutable = /\.(?:json|css|html|md)$/;
export async function maintainabilityInventory(root) {
  const files = [];
  async function visit(path) {
    const absolute = join(root, path);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error(`METRIC_SYMLINK: ${path}`);
    if (stat.isDirectory()) {
      for (const name of (await readdir(absolute)).sort()) await visit(`${path}/${name}`);
      return;
    }
    if (!stat.isFile()) throw new Error(`METRIC_NOT_REGULAR: ${path}`);
    const data = await readFile(absolute);
    if (path === vendorArchive) decodeVendor(data);
    let view = 'unsupported';
    const template = path.startsWith('scripts/examples/templates/') && executable.test(path.replace(/\.txt$/, ''));
    if (template) view = 'templates';
    else if (executable.test(path)) {
      if (path.startsWith('src/')) view = 'production';
      else if (path.startsWith('tests/') || path.startsWith('harness/')) view = 'fixtures';
      else view = 'tooling';
    }
    const templateData = path.startsWith('scripts/examples/templates/') && /\.(?:json|css|md)\.txt$/.test(path);
    if (view === 'unsupported' && !nonExecutable.test(path) && path !== vendorArchive && !templateData) throw new Error(`METRIC_UNCLASSIFIED_INPUT: ${path}`);
    let templateRegion = null;
    if (/\.vue(?:\.txt)?$/.test(path)) {
      const parsed = parse(data.toString('utf8'), { filename: path });
      if (parsed.errors.length) throw new Error(`METRIC_INVALID_SFC: ${path}`);
      const template = parsed.descriptor.template;
      if (template) templateRegion = { startLine: template.loc.start.line, endLine: template.loc.end.line };
    }
    files.push({ path, sha256: sha256(data), bytes: data.length, physicalLines: physicalLines(data.toString('utf8')), view,
      templateRegion, extension: template ? path.replace(/\.txt$/, '').split('.').at(-1) : path.split('.').at(-1) });
  }
  for (const path of ['src', 'scripts', 'tests', 'harness']) await visit(path);
  for (const name of (await readdir(root)).sort()) if (executable.test(name)) await visit(name);
  for (const name of ['package.json', 'package-lock.json', '.fallowrc.json']) await visit(name);
  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.some(file => file.view === 'production')) throw new Error('METRIC_EMPTY_PRODUCTION');
  return { files, digest: sha256(JSON.stringify(files)) };
}
