import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256, physicalLines } from '../testing/source-inputs.mjs';
import { decodeVendor, vendorArchive } from '../styles/vendor-policy.mjs';

const executable = /\.(?:[cm]?[jt]sx?|vue)$/;
const nonExecutable = /\.(?:json|css|html|md)$/;
// Exact extensionless launchers. Node loads them as ES modules through the package "type"; measure them as .mjs.
const extensionless = new Map([['bin/app', 'mjs']]);
// The concept uses Python to assemble and test its offline artifact. Keep these
// exact bytes in the inventory, but never present them as JS/TS/Vue measurements.
// This is a language classification, not a directory or production exemption.
const conceptPython = /^(?:scripts|tests)\/concepts\/[^/]+\.py$/;
// Exact optional-language inventory. New paths require review; never exempt a directory.
const memoryPython = new Set([
  'scripts/hindsight/embedded.py',
  'tests/hindsight/test_embedded.py',
  'tests/hindsight/test_providers.py',
]);
// Exact POSIX shell inventory: the cloud environment setup script is pasted into a Claude Code environment, so it cannot be JS.
// Its behaviour is proven by tests/tooling/agent-cloud-setup.checks.mjs; it is never presented as a JS/TS/Vue measurement.
const shellScripts = new Set(['scripts/agent/cloud-setup.sh']);
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
    // Generated-project template sources (templates/): the companion runtime copied into generated projects, the
    // example-removal templates stored as `.ts.txt`/`.vue.txt` and the Astro site sources stored as `.ts.tmpl`/`.mjs.tmpl`,
    // measured as their source language in the templates view.
    const template = path.startsWith('templates/') && executable.test(path.replace(/\.(?:txt|tmpl)$/, ''));
    // Reviewed generated-output fixtures (golden SFCs, a retained pre-visual runtime module) are stored as `.vue.txt` /
    // `.ts.txt` so the analyzer and bundlers never resolve their generated-project imports; they stay measured as
    // Vue/TypeScript in the fixtures view.
    const golden = /^tests\/fixtures\/.+\.(?:vue|ts)\.txt$/.test(path);
    if (template) view = 'templates';
    else if (golden) view = 'fixtures';
    else if (executable.test(path) || extensionless.has(path)) {
      if (path.startsWith('src/') || path.startsWith('bin/')) view = 'production';
      else if (path.startsWith('tests/') || path.startsWith('harness/')) view = 'fixtures';
      else view = 'tooling';
    }
    const terminalPython = path === 'tests/tooling/interactive-maker-pty.py';
    const shell = shellScripts.has(path);
    const python = conceptPython.test(path) || memoryPython.has(path) || terminalPython;
    // Generated-project kit templates (README, AGENTS.md, JSON/YAML settings), the Claude Design folder's Markdown
    // templates and the Astro site templates' pages, styles and settings (.astro/.css/.json/.md/.yml) are rendered text, not code.
    const templateData = (path.startsWith('templates/examples/') && /\.(?:json|css|md)\.txt$/.test(path)) || /^templates\/companion\/devkit\/[\w.-]+\.tmpl$/.test(path)
      || /^templates\/design-folder\/[\w-]+\.md\.tmpl$/.test(path) || /^templates\/sites\/[\w./[\]-]+\.tmpl$/.test(path);
    if (view === 'unsupported' && !nonExecutable.test(path) && path !== vendorArchive && !templateData && !python && !shell) throw new Error(`METRIC_UNCLASSIFIED_INPUT: ${path}`);
    let templateRegion = null;
    if (/\.vue(?:\.txt)?$/.test(path)) {
      const { parse } = await import('vue/compiler-sfc');
      const parsed = parse(data.toString('utf8'), { filename: path });
      if (parsed.errors.length) throw new Error(`METRIC_INVALID_SFC: ${path}`);
      const template = parsed.descriptor.template;
      if (template) templateRegion = { startLine: template.loc.start.line, endLine: template.loc.end.line };
    }
    files.push({ path, sha256: sha256(data), bytes: data.length, physicalLines: physicalLines(data.toString('utf8')), view,
      ...(python || shell ? { measurement: 'not-measured', reason: shell
        ? 'POSIX shell environment setup script; behaviour tests are separate from JS/TS/Vue metrics.' : terminalPython
        ? 'Python standard-library PTY acceptance driver; real terminal evidence is separate from JS/TS/Vue metrics.'
        : memoryPython.has(path)
        ? 'Python optional memory tooling; stdlib adapter tests and live-provider acceptance are separate from JS/TS/Vue metrics.'
        : 'Python concept tooling; syntax, assembly and browser evidence are separate from JS/TS/Vue metrics.' } : {}),
      templateRegion, extension: extensionless.get(path) ?? (template || golden ? path.replace(/\.(?:txt|tmpl)$/, '').split('.').at(-1) : path.split('.').at(-1)) });
  }
  for (const path of ['src', 'scripts', 'tests', 'harness']) await visit(path);
  if ((await readdir(root)).includes('bin')) await visit('bin');
  if ((await readdir(root)).includes('templates')) await visit('templates');
  for (const name of (await readdir(root)).sort()) if (executable.test(name)) await visit(name);
  for (const name of ['package.json', 'package-lock.json']) await visit(name);
  if ((await readdir(root)).includes('configs')) await visit('configs');
  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.some(file => file.view === 'production')) throw new Error('METRIC_EMPTY_PRODUCTION');
  return { files, digest: sha256(JSON.stringify(files)) };
}
