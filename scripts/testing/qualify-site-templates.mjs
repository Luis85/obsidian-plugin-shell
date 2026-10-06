/** Qualify the opt-in Astro site templates (templates/sites) the way a user gets them: render each template with the
 * shell's own `site new` into a scratch shell root, twice (zero collections, and one collection snapshot of the
 * tests/fixtures/sites vault written by `site collections`), then run `npm ci` and `npm run build` inside each site with
 * its own exact lock. The built pages must show the fixture's view values and never its other frontmatter.
 * Maintainer-only: kits and generated projects carry the templates but not this script or its fixture.
 * One JSON summary on stdout; fails closed.
 *   node scripts/testing/qualify-site-templates.mjs [--dry-run] [--template <id>]... [--work-dir <empty dir>] [--keep] [--out <file>] */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../src/cli/adapters/framework/operations.ts';
import { readSiteCatalog } from '../../src/cli/domain/site-template.ts';

export const frameworkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const FIXTURE_VAULT = 'tests/fixtures/sites/vault';
/** A view value of the fixture that a collection build must render, and a frontmatter value no view shows. */
export const RENDERED = 'Finds notes by text';
export const PRIVATE = 'fixture-private-owner';
export const VARIANTS = ['empty', 'collection'];
export const USAGE = 'Usage: node scripts/testing/qualify-site-templates.mjs [--dry-run] [--template <id>]... [--work-dir <empty dir>] [--keep] [--out <file>]';
const OUTPUT_TAIL = 4000;

export function parseOptions(argv) {
  const options = { dryRun: false, keep: false, templates: [], workDir: null, out: null, help: false };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--keep') options.keep = true;
    else if (flag === '--help') options.help = true;
    else if (['--template', '--work-dir', '--out'].includes(flag)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) return { ...options, error: `${flag} needs a value` };
      if (flag === '--template') options.templates.push(value); else options[flag === '--out' ? 'out' : 'workDir'] = value;
    } else return { ...options, error: `Unknown option: ${flag}` };
  }
  return options;
}

/** Each template's first catalog collection when it names one, so the page shows it; otherwise `features`. */
export function collectionName(template) {
  const first = template.collections[0]?.name ?? '';
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(first) ? first : 'features';
}

async function operation(root, command, args, options) {
  const result = await executeOperation({ command, args, options }, { root, frameworkRoot });
  if (result.status !== 'applied') throw new Error(`${command} ${args.join(' ')}: ${result.status} ${JSON.stringify(result.diagnostics ?? result.data?.conflicts ?? [])}`);
  return result;
}
/** Renders one site with the shell's commands; the collection variant lists the fixture view and writes its snapshot. */
export async function renderSite(root, template, variant) {
  const name = `${template.id}-${variant}`, target = `projects/${name}`;
  const created = await operation(root, 'site new', [target], { template: template.id, yes: true });
  const collections = variant === 'collection' ? [{ name: collectionName(template), base: 'vault/Site/Features.base', view: 'Cards', vault: 'vault' }] : [];
  if (collections.length) {
    const path = join(root, target, 'workbench.project.json'), manifest = JSON.parse(await readFile(path, 'utf8'));
    await writeFile(path, `${JSON.stringify({ ...manifest, site: { ...manifest.site, collections } }, null, 2)}\n`);
    await operation(root, 'site collections', [target], { yes: true });
  }
  return { name, folder: join(root, target), files: created.data.applied.written.length, collections: collections.map(item => item.name) };
}

async function htmlFiles(folder) {
  const found = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path)); else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}
/** What a built site must prove: pages exist, a collection build renders the fixture values, nothing private leaks. */
export async function inspectBuild(folder, variant) {
  const pages = await htmlFiles(join(folder, 'dist')).catch(() => []);
  const text = (await Promise.all(pages.map(page => readFile(page, 'utf8')))).join('\n');
  const issues = [];
  if (!pages.length) issues.push('dist/ holds no HTML page');
  if (variant === 'collection' && !text.includes(RENDERED)) issues.push(`no page renders the fixture value "${RENDERED}"`);
  if (text.includes(PRIVATE)) issues.push(`a page contains the fixture's private frontmatter "${PRIVATE}"`);
  return { pages: pages.length, issues };
}

const npmCommand = () => process.env.QUALIFIED_NPM ? [process.execPath, process.env.QUALIFIED_NPM] : ['npm'];
export const BUILD_STEPS = [['npm ci', ['ci', '--no-fund', '--no-audit']], ['npm run build', ['run', 'build']]];
function runStep(folder, args) {
  const [command, ...prefix] = npmCommand(), started = Date.now();
  const result = spawnSync(command, [...prefix, ...args], { cwd: folder, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`;
  return { status: result.status === 0 ? 'passed' : 'failed', exitCode: result.status, durationMs: Date.now() - started, ...(result.status === 0 ? {} : { output: output.slice(-OUTPUT_TAIL) }) };
}
async function qualifySite(root, template, variant, dryRun) {
  const entry = { template: template.id, variant, steps: [] };
  let site;
  try { site = await renderSite(root, template, variant); entry.site = site.name; entry.collections = site.collections; entry.steps.push({ name: 'render', status: 'passed', files: site.files }); }
  catch (error) { entry.steps.push({ name: 'render', status: 'failed', error: error.message }); return entry; }
  for (const [name, args] of BUILD_STEPS) {
    const step = dryRun ? { status: 'skipped' } : runStep(site.folder, args);
    entry.steps.push({ name, command: ['npm', ...args].join(' '), ...step });
    if (step.status === 'failed') return entry;
  }
  if (!dryRun) {
    const inspected = await inspectBuild(site.folder, variant);
    entry.steps.push({ name: 'inspect', status: inspected.issues.length ? 'failed' : 'passed', pages: inspected.pages, ...(inspected.issues.length ? { issues: inspected.issues } : {}) });
  }
  return entry;
}

export async function qualifySiteTemplates(options) {
  const catalog = readSiteCatalog(JSON.parse(await readFile(join(frameworkRoot, 'templates/sites/catalog.json'), 'utf8')));
  const unknown = options.templates.filter(id => !catalog.templates.some(template => template.id === id));
  if (unknown.length) throw new Error(`Unknown template ${unknown.join(', ')}. Templates: ${catalog.templates.map(template => template.id).join(', ')}`);
  const templates = catalog.templates.filter(template => !options.templates.length || options.templates.includes(template.id));
  if (options.workDir) await mkdir(options.workDir, { recursive: true });
  if (options.workDir && (await readdir(options.workDir)).length) throw new Error(`--work-dir ${options.workDir} must be empty or absent`);
  const root = await realpath(options.workDir ?? await mkdtemp(join(tmpdir(), 'site-templates-')));
  const started = Date.now(), results = [];
  try {
    await cp(join(frameworkRoot, FIXTURE_VAULT), join(root, 'vault'), { recursive: true });
    for (const template of templates) for (const variant of VARIANTS) results.push(await qualifySite(root, template, variant, options.dryRun));
  } finally { if (!options.keep) await rm(root, { recursive: true, force: true }); }
  const failed = results.filter(result => result.steps.some(step => step.status === 'failed'));
  return { schema: 'workbench.site-templates/1', status: failed.length ? 'failed' : 'passed', dryRun: options.dryRun, astro: catalog.astro,
    durationMs: Date.now() - started, ...(options.keep ? { workDir: root } : {}), results };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help || options.error) { process.stdout.write(`${options.error ? `${options.error}\n` : ''}${USAGE}\n`); return options.error ? 2 : 0; }
  const summary = await qualifySiteTemplates(options), text = `${JSON.stringify(summary, null, 2)}\n`;
  if (options.out) { await mkdir(dirname(resolve(options.out)), { recursive: true }); await writeFile(resolve(options.out), text); }
  process.stdout.write(text);
  return summary.status === 'passed' ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main().catch(error => { process.stderr.write(`${error?.message ?? error}\n`); return 1; });
}
