import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256, physicalLines } from '../testing/source-inputs.mjs';
import { decodeVendor, vendorArchive } from '../styles/vendor-policy.mjs';

const executable = /\.(?:[cm]?[jt]sx?|vue)$/;
// Obsidian Bases files (.base) are YAML view configuration read as data, like JSON; nothing executes them.
const nonExecutable = /(?:\.(?:json|css|html|md|base)|(?:^|\/)\.gitignore)$/;
// The concept uses Python to assemble and test its offline artifact. Keep these
// exact bytes in the inventory, but never present them as JS/TS/Vue measurements.
// This is a language classification, not a directory or production exemption.
const conceptPython = /^(?:tooling|src\/companion\/tests)\/concepts\/[^/]+\.py$/;
// Exact optional-language inventory. New paths require review; never exempt a directory.
const memoryPython = new Set([
  'src/cli/tooling/hindsight/embedded.py',
  'tooling/tests/hindsight/test_embedded.py',
  'tooling/tests/hindsight/test_providers.py',
]);
// Exact POSIX shell inventory: the cloud environment setup script is pasted into a Claude Code environment, so it cannot be JS.
// Its behaviour is proven by tooling/tests/agent-cloud-setup.checks.mjs; it is never presented as a JS/TS/Vue measurement.
const shellScripts = new Set(['tooling/agent/cloud-setup.sh']);
// Test and fixture trees: root tests/, tooling/tests/ and each source project's src/<name>/tests/ (all of it was tests/).
const fixtureTree = /^(?:tests|tooling\/tests|src\/[^/]+\/tests)\//;
// The production view is the code that lived under src before the split. The former scripts/ code now sits in
// src/shared and src/cli/tooling (the tooling view, as before); the two modules that were src/cli/domain/errors.ts and
// templates/companion/runtime/contract.ts keep their production and templates views. src/cli/sdk (the former plugins/ folder,
// outside the inventory before) joins the diagnostic tooling view rather than newly gating production.
const formerSrcShared = new Set(['src/shared/contracts/sketch-errors.ts']);
const formerTemplates = new Set(['src/shared/companion/runtime-contract.ts']);
const formerScripts = path => path.startsWith('src/cli/tooling/') || path.startsWith('src/cli/sdk/') || (path.startsWith('src/shared/') && !formerSrcShared.has(path) && !formerTemplates.has(path));
// The companion concept (the former docs/concepts) keeps its own assembly and verification; it was never inventoried here.
const companionConcept = new Set(['src/companion/app', 'src/companion/editor']);
export async function maintainabilityInventory(root) {
  const files = [];
  async function visit(path) {
    const absolute = join(root, path);
    if (companionConcept.has(path) || path.endsWith('/node_modules')) return;
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
    const template = (path.startsWith('templates/') || formerTemplates.has(path)) && executable.test(path.replace(/\.(?:txt|tmpl)$/, ''));
    // Reviewed generated-output fixtures (golden SFCs, a retained pre-visual runtime module) are stored as `.vue.txt` /
    // `.ts.txt` so the analyzer and bundlers never resolve their generated-project imports; they stay measured as
    // Vue/TypeScript in the fixtures view.
    const golden = fixtureTree.test(path) && /\/fixtures\/.+\.(?:vue|ts)\.txt$/.test(path);
    if (template) view = 'templates';
    else if (golden) view = 'fixtures';
    else if (executable.test(path)) {
      if (fixtureTree.test(path) || path.startsWith('src/plugin/harness/')) view = 'fixtures';
      else if (path.startsWith('src/') && !formerScripts(path)) view = 'production';
      else view = 'tooling';
    }
    const terminalPython = path === 'src/cli/tests/interactive-maker-pty.py';
    const shell = shellScripts.has(path);
    const python = conceptPython.test(path) || memoryPython.has(path) || terminalPython;
    // Generated-project kit templates (README, AGENTS.md, JSON/YAML settings), the Claude Design folder's Markdown
    // templates and the Astro site templates' pages, styles and settings (.astro/.css/.json/.md/.yml) are rendered text, not code.
    const templateData = (path.startsWith('templates/examples/') && /\.(?:json|css|md)\.txt$/.test(path)) || /^templates\/companion\/devkit\/[\w.-]+\.tmpl$/.test(path)
      || /^templates\/design-folder\/[\w-]+\.md\.tmpl$/.test(path) || /^templates\/sites\/[\w./-]+\.tmpl$/.test(path);
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
      templateRegion, extension: (template || golden ? path.replace(/\.(?:txt|tmpl)$/, '').split('.').at(-1) : path.split('.').at(-1)) });
  }
  for (const path of ['src', 'tooling', 'tests']) await visit(path);
  if ((await readdir(root)).includes('templates')) await visit('templates');
  for (const name of (await readdir(root)).sort()) if (executable.test(name)) await visit(name);
  for (const name of ['package.json', 'package-lock.json']) await visit(name);
  if ((await readdir(root)).includes('configs')) await visit('configs');
  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.some(file => file.view === 'production')) throw new Error('METRIC_EMPTY_PRODUCTION');
  return { files, digest: sha256(JSON.stringify(files)) };
}
