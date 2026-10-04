import { lstat, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { excludesProjects, parseSyncedName, scopeWorkflow, syncedName, SYNCED_PREFIX } from './workflows.mjs';

/**
 * projects/<name>/ holds standalone projects built from concepts. Each one installs, builds and tests inside its own
 * folder with its own lock; the shell never imports from it and its gates ignore projects/. This module lists the
 * projects, validates their manifest and standalone contract, and keeps their own workflows synced into the root
 * .github/workflows (the only folder GitHub runs) without letting either side trigger or cancel the other.
 */
export const PROJECTS = 'projects';
export const MANIFEST = 'workbench.project.json';
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const REQUIRED_FILES = ['package.json', 'package-lock.json', 'README.md', 'AGENTS.md', '.nvmrc'];
const PROTOTYPE_ROOTS = ['docs/concepts/', 'docs/design/'];
const OUTSIDE_SPEC = /^(?:file|link|workspace|portal):/;
/** The one shell workflow that watches projects/ on purpose: it validates the boundary and never builds a project. */
export const BOUNDARY_WORKFLOW = 'projects-boundary.yml';

const exists = async path => { try { await lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

/** Every directory directly under projects/ (a stray file is reported, not skipped). */
export async function listProjects(root) {
  const folder = resolve(root, PROJECTS);
  if (!await exists(folder)) return [];
  const entries = await readdir(folder, { withFileTypes: true });
  return entries.filter(entry => entry.name !== 'README.md').map(entry => ({ name: entry.name, directory: entry.isDirectory() && !entry.isSymbolicLink() })).sort((a, b) => a.name.localeCompare(b.name));
}

function relativeRepositoryPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\')) return null;
  const normal = posix.normalize(value).replace(/\/$/, '');
  return normal === value.replace(/\/$/, '') && !normal.startsWith('../') && !posix.isAbsolute(normal) ? normal : null;
}

/** The manifest names the project and links it to the concept prototypes it was built from. */
export async function validateManifest(root, name) {
  const failures = [];
  const path = resolve(root, PROJECTS, name, MANIFEST);
  if (!await exists(path)) return { manifest: null, failures: [`PROJECT_MANIFEST_MISSING: ${PROJECTS}/${name}/${MANIFEST}`] };
  let manifest;
  try { manifest = await readJson(path); } catch (error) { return { manifest: null, failures: [`PROJECT_MANIFEST_INVALID: ${error.message}`] }; }
  if (manifest?.schemaVersion !== 1) failures.push('PROJECT_MANIFEST_SCHEMA: schemaVersion must be 1');
  if (manifest?.name !== name) failures.push(`PROJECT_MANIFEST_NAME: name must equal the folder name "${name}"`);
  if (typeof manifest?.title !== 'string' || !manifest.title.trim()) failures.push('PROJECT_MANIFEST_TITLE: title is required');
  const prototypes = manifest?.prototypes;
  if (!Array.isArray(prototypes) || !prototypes.length) failures.push('PROJECT_MANIFEST_PROTOTYPES: list at least one prototype');
  for (const [index, prototype] of (Array.isArray(prototypes) ? prototypes : []).entries()) {
    const target = relativeRepositoryPath(prototype?.path);
    if (!target || !PROTOTYPE_ROOTS.some(prefix => `${target}/`.startsWith(prefix))) failures.push(`PROJECT_PROTOTYPE_PATH: prototypes[${index}].path must be a normalized path under ${PROTOTYPE_ROOTS.join(' or ')}`);
    else if (!await exists(resolve(root, target))) failures.push(`PROJECT_PROTOTYPE_MISSING: ${target}`);
  }
  if (manifest?.origin !== undefined) {
    const starter = relativeRepositoryPath(manifest.origin?.starter);
    if (!starter || !await exists(resolve(root, starter))) failures.push('PROJECT_ORIGIN_STARTER: origin.starter must name an existing repository file');
  }
  return { manifest, failures };
}

/** Standalone means: own toolchain files, no dependency or config reaching out of the project folder. */
export async function validateStandalone(root, name) {
  const failures = [], folder = resolve(root, PROJECTS, name);
  for (const file of REQUIRED_FILES) if (!await exists(join(folder, file))) failures.push(`PROJECT_NOT_STANDALONE: missing ${file}`);
  if (await exists(join(folder, 'package.json'))) {
    const pkg = await readJson(join(folder, 'package.json'));
    if (pkg.workspaces) failures.push('PROJECT_NOT_STANDALONE: package.json declares workspaces');
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [dependency, spec] of Object.entries(pkg[field] ?? {})) if (OUTSIDE_SPEC.test(String(spec)) || String(spec).includes('..')) failures.push(`PROJECT_NOT_STANDALONE: ${field}.${dependency} points outside the registry (${spec})`);
    }
  }
  for (const entry of await readdir(folder)) {
    if (!/^tsconfig.*\.json$/.test(entry)) continue;
    const text = await readFile(join(folder, entry), 'utf8');
    if (/"(?:extends|path)"\s*:\s*"\.\.\//.test(text)) failures.push(`PROJECT_NOT_STANDALONE: ${entry} extends or references a path outside the project`);
  }
  return failures;
}

async function projectWorkflows(root, name) {
  const folder = resolve(root, PROJECTS, name, '.github/workflows');
  if (!await exists(folder)) return [];
  return (await readdir(folder)).filter(file => /\.ya?ml$/.test(file)).sort();
}

/** The synced copies every project currently implies, keyed by their root workflow file name. */
export async function expectedWorkflows(root, names) {
  const expected = new Map(), failures = [];
  for (const name of names) {
    for (const file of await projectWorkflows(root, name)) {
      const target = syncedName(name, file);
      if (expected.has(target)) { failures.push(`PROJECT_WORKFLOW_DUPLICATE: ${target}`); continue; }
      try { expected.set(target, scopeWorkflow(await readFile(resolve(root, PROJECTS, name, '.github/workflows', file), 'utf8'), { project: name, file })); }
      catch (error) { failures.push(`${PROJECTS}/${name}/.github/workflows/${file}: ${error.message}`); }
    }
  }
  return { expected, failures };
}

async function rootWorkflows(root) {
  return (await readdir(resolve(root, '.github/workflows'))).filter(file => /\.ya?ml$/.test(file)).sort();
}

/** Synced copies must match their project source byte for byte; a copy without a project source is an orphan. */
export async function workflowDrift(root, expected) {
  const failures = [];
  const synced = (await rootWorkflows(root)).filter(file => file.startsWith(SYNCED_PREFIX));
  for (const file of synced) {
    if (!parseSyncedName(file)) failures.push(`PROJECT_WORKFLOW_NAME: .github/workflows/${file}`);
    else if (!expected.has(file)) failures.push(`PROJECT_WORKFLOW_ORPHAN: .github/workflows/${file} has no project source; run npm run projects:sync`);
  }
  for (const [file, text] of expected) {
    const path = resolve(root, '.github/workflows', file);
    if (!await exists(path)) failures.push(`PROJECT_WORKFLOW_NOT_SYNCED: .github/workflows/${file}; run npm run projects:sync`);
    else if (await readFile(path, 'utf8') !== text) failures.push(`PROJECT_WORKFLOW_DRIFT: .github/workflows/${file} differs from its project source; run npm run projects:sync`);
  }
  return failures;
}

/** Shell workflows must not run for a change that only touches projects/. */
export async function shellIsolation(root) {
  const failures = [];
  for (const file of (await rootWorkflows(root)).filter(name => !name.startsWith(SYNCED_PREFIX) && name !== BOUNDARY_WORKFLOW)) {
    if (!excludesProjects(await readFile(resolve(root, '.github/workflows', file), 'utf8'))) failures.push(`SHELL_WORKFLOW_NOT_ISOLATED: .github/workflows/${file} needs paths-ignore: [projects/**] (or a final '!projects/**' in paths) on push and pull_request`);
  }
  return failures;
}

/** Dependabot reads only the root configuration, so each project needs its own npm entry there. */
export async function dependabotCoverage(root, names) {
  const path = resolve(root, '.github/dependabot.yml');
  if (!names.length) return [];
  if (!await exists(path)) return ['PROJECT_DEPENDABOT_MISSING: .github/dependabot.yml'];
  const updates = parseDocument(await readFile(path, 'utf8')).toJS()?.updates ?? [];
  return names.filter(name => !updates.some(update => update?.['package-ecosystem'] === 'npm' && [update.directory, ...(update.directories ?? [])].includes(`/${PROJECTS}/${name}`)))
    .map(name => `PROJECT_DEPENDABOT_MISSING: add an npm update for /${PROJECTS}/${name} to .github/dependabot.yml`);
}

export async function checkProjects(root = process.cwd()) {
  root = resolve(root);
  const failures = [], projects = [];
  const entries = await listProjects(root);
  for (const entry of entries) {
    if (!entry.directory) { failures.push(`PROJECT_NOT_A_FOLDER: ${PROJECTS}/${entry.name}`); continue; }
    if (!NAME.test(entry.name)) { failures.push(`PROJECT_NAME: ${PROJECTS}/${entry.name} must be lowercase words joined by single hyphens`); continue; }
    const { manifest, failures: manifestFailures } = await validateManifest(root, entry.name);
    const own = [...manifestFailures, ...await validateStandalone(root, entry.name)];
    failures.push(...own.map(failure => `${PROJECTS}/${entry.name}: ${failure}`));
    projects.push({ name: entry.name, title: manifest?.title ?? null, prototypes: (manifest?.prototypes ?? []).map(prototype => prototype?.path), workflows: await projectWorkflows(root, entry.name) });
  }
  const names = projects.map(project => project.name);
  const { expected, failures: scopeFailures } = await expectedWorkflows(root, names);
  failures.push(...scopeFailures, ...await workflowDrift(root, expected), ...await shellIsolation(root), ...await dependabotCoverage(root, names));
  return { status: failures.length ? 'failed' : 'passed', projects, syncedWorkflows: [...expected.keys()], failures };
}

/** Writes every synced copy and removes orphans. Refuses to write anything while a project workflow cannot be scoped. */
export async function syncWorkflows(root = process.cwd()) {
  root = resolve(root);
  const names = (await listProjects(root)).filter(entry => entry.directory && NAME.test(entry.name)).map(entry => entry.name);
  const { expected, failures } = await expectedWorkflows(root, names);
  if (failures.length) return { status: 'failed', written: [], removed: [], failures };
  const written = [], removed = [];
  for (const [file, text] of expected) {
    const path = resolve(root, '.github/workflows', file);
    if (await exists(path) && await readFile(path, 'utf8') === text) continue;
    await writeFile(path, text); written.push(file);
  }
  for (const file of (await rootWorkflows(root)).filter(name => name.startsWith(SYNCED_PREFIX) && !expected.has(name))) {
    await rm(resolve(root, '.github/workflows', file)); removed.push(file);
  }
  return { status: 'passed', written, removed, failures: [] };
}

function print(result, json) {
  if (json) { console.log(JSON.stringify(result, null, 2)); return; }
  for (const project of result.projects ?? []) console.log(`${project.name.padEnd(20)} ${project.title ?? '(no manifest)'}  prototypes: ${project.prototypes.join(', ') || 'none'}  workflows: ${project.workflows.join(', ') || 'none'}`);
  for (const file of result.written ?? []) console.log(`synced   .github/workflows/${file}`);
  for (const file of result.removed ?? []) console.log(`removed  .github/workflows/${file}`);
  for (const failure of result.failures ?? []) console.error(failure);
  console.log(`projects: ${result.status}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command = 'check', ...flags] = process.argv.slice(2);
  const json = flags.includes('--json');
  try {
    if (flags.some(flag => flag !== '--json')) throw new Error(`Unknown option: ${flags.find(flag => flag !== '--json')}`);
    const run = { check: checkProjects, list: checkProjects, sync: syncWorkflows }[command];
    if (!run) throw new Error(`Unknown command "${command}". Use: check | list | sync [--json]`);
    const result = await run();
    print(result, json);
    if (command !== 'list' && result.status !== 'passed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
