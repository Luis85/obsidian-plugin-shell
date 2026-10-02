/** Declarative test-suite manifest: validation and fail-closed file classification. */
import { readFile, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';

const manifestPath = 'tests/suites.json';
const runnerTypes = ['node-test', 'vitest', 'playwright', 'command', 'npm-script', 'manual'];
const verifyModes = ['tooling', 'own-step', 'opt-in'];
const ignoredDirectories = new Set(['__pycache__', 'node_modules']);
const edit = `Edit ${manifestPath}`;

/** Supports `*`, `**`, `?` and `{a,b}`; matching is against repository-relative POSIX paths. */
export function globToRegExp(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      const slash = pattern[index + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      index += slash ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (char === '{') {
      const end = pattern.indexOf('}', index);
      if (end < 0) throw new Error(`SUITE_PATTERN_INVALID: ${pattern}`);
      source += `(?:${pattern.slice(index + 1, end).split(',').map(escape).join('|')})`;
      index = end;
    } else source += escape(char);
  }
  return new RegExp(`^${source}$`);
}
function escape(text) { return text.replace(/[.+^${}()|[\]\\]/g, '\\$&'); }

function assertStrings(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.some(item => typeof item !== 'string' || !item))
    throw new Error(`SUITE_MANIFEST_INVALID: ${label} must be ${allowEmpty ? 'a' : 'a non-empty'} string array`);
}
function validateRunner(suite, prerequisites) {
  const runner = suite.runner;
  if (!runner || !runnerTypes.includes(runner.type)) throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name}.runner.type must be one of ${runnerTypes.join(', ')}`);
  if (runner.type === 'vitest' && typeof runner.config !== 'string') throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name}.runner.config`);
  if (runner.type === 'npm-script' && typeof runner.script !== 'string') throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name}.runner.script`);
  if (runner.type === 'command') {
    if (!Array.isArray(runner.commands) || !runner.commands.length) throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name}.runner.commands`);
    for (const command of runner.commands) {
      if (Array.isArray(command)) assertStrings(command, `${suite.name} command`);
      else if (typeof command?.each === 'string') assertStrings(command.argv, `${suite.name} each.argv`);
      else throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name} command entries are argv arrays or { each, argv }`);
    }
  }
  for (const name of suite.prerequisites ?? []) {
    if (!Object.hasOwn(prerequisites, name)) throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name} names unknown prerequisite ${name}`);
  }
}
function validateSuite(suite, prerequisites) {
  if (!suite || typeof suite.name !== 'string' || !/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/.test(suite.name))
    throw new Error(`SUITE_MANIFEST_INVALID: suite name ${JSON.stringify(suite?.name)}`);
  if (typeof suite.purpose !== 'string' || !suite.purpose) throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name}.purpose`);
  assertStrings(suite.include, `${suite.name}.include`, { allowEmpty: true });
  assertStrings(suite.exclude ?? [], `${suite.name}.exclude`, { allowEmpty: true });
  assertStrings(suite.workflows ?? [], `${suite.name}.workflows`, { allowEmpty: true });
  if (!verifyModes.includes(suite.verify)) throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name}.verify must be one of ${verifyModes.join(', ')}`);
  if (suite.verify === 'tooling' && suite.runner?.type !== 'node-test') throw new Error(`SUITE_MANIFEST_INVALID: ${suite.name} verify tooling requires the node-test runner`);
  validateRunner(suite, prerequisites);
}

export function validateManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error('SUITE_MANIFEST_INVALID: schemaVersion must be 1');
  if (!Array.isArray(manifest.roots) || !manifest.roots.length || manifest.roots.some(root => typeof root?.path !== 'string'))
    throw new Error('SUITE_MANIFEST_INVALID: roots');
  assertStrings(manifest.helperRoots ?? [], 'helperRoots', { allowEmpty: true });
  const prerequisites = manifest.prerequisites ?? {};
  if (!Array.isArray(manifest.suites) || !manifest.suites.length) throw new Error('SUITE_MANIFEST_INVALID: suites');
  const names = new Set();
  for (const suite of manifest.suites) {
    validateSuite(suite, prerequisites);
    if (names.has(suite.name)) throw new Error(`SUITE_MANIFEST_INVALID: duplicate suite ${suite.name}`);
    names.add(suite.name);
  }
  for (const [alias] of Object.entries(manifest.aliases ?? {})) {
    if (names.has(alias)) throw new Error(`SUITE_MANIFEST_INVALID: alias ${alias} shadows a suite`);
  }
  for (const helper of manifest.helpers ?? []) assertStrings(helper?.include, 'helpers[].include');
  return manifest;
}

async function loadManifest(root, path = manifestPath) {
  let text;
  try { text = await readFile(join(root, path), 'utf8'); }
  catch (error) { throw new Error(`SUITE_MANIFEST_MISSING: ${path} (${error.code})`); }
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`SUITE_MANIFEST_JSON: ${path}`); }
  return validateManifest(parsed);
}

async function exists(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function walk(root, directory, files) {
  for (const entry of (await readdir(join(root, directory), { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const path = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`SUITE_INPUT_SYMLINK: ${path}`);
    if (entry.isDirectory()) { if (!ignoredDirectories.has(entry.name)) await walk(root, path, files); }
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function matcher(entry) {
  const include = entry.include.map(globToRegExp);
  const exclude = (entry.exclude ?? []).map(globToRegExp);
  return path => include.some(pattern => pattern.test(path)) && !exclude.some(pattern => pattern.test(path));
}

async function scanTopLevel(root, manifest, failures) {
  const declared = new Set([...manifest.roots.map(item => item.path), ...(manifest.helperRoots ?? [])]);
  for (const entry of await readdir(join(root, 'tests'), { withFileTypes: true })) {
    const path = `tests/${entry.name}`;
    if (entry.isDirectory() && !declared.has(path))
      failures.push(`UNDECLARED_TEST_DIRECTORY: ${path} is neither a scanned root nor a helper root. ${edit} "roots" or "helperRoots".`);
    else if (!entry.isDirectory() && path !== manifestPath)
      failures.push(`UNDECLARED_TEST_FILE: ${path} sits at the tests/ top level. Move it into a declared root.`);
  }
}

async function inventoryFailures(root, suite, files) {
  const { source, pattern, file } = suite.inventory;
  let text;
  try { text = await readFile(join(root, source), 'utf8'); }
  catch (error) {
    // Distributed kits omit maintainer-only runners together with their tests.
    if (error.code === 'ENOENT' && !files.length) return [];
    return [`SUITE_INVENTORY_SOURCE: suite ${suite.name} cannot read ${source} (${error.code ?? error.message}).`];
  }
  const declared = [...text.matchAll(new RegExp(pattern, 'g'))].map(match => file.replace('$1', match[1]));
  const expected = new Set(declared);
  const actual = new Set(files);
  return [
    ...[...expected].filter(path => !actual.has(path)).map(path => `SUITE_INVENTORY_MISMATCH: ${source} runs ${path}, which is not a file of suite ${suite.name}. ${edit} suite "${suite.name}".`),
    ...[...actual].filter(path => !expected.has(path)).map(path => `SUITE_INVENTORY_MISMATCH: suite ${suite.name} claims ${path}, but ${source} never runs it. Register it there or move it to another suite in ${manifestPath}.`),
  ];
}

/** Classifies every file under the declared roots into exactly one suite or helper entry. */
async function classify(root, manifest) {
  const failures = [];
  await scanTopLevel(root, manifest, failures);
  const suites = manifest.suites.map(suite => ({ suite, match: matcher(suite), files: [] }));
  const helpers = (manifest.helpers ?? []).map(helper => ({ helper, match: matcher(helper), files: [] }));
  for (const declared of manifest.roots) {
    const stat = await exists(join(root, declared.path));
    if (!stat) { if (!declared.optional) failures.push(`TEST_ROOT_MISSING: ${declared.path}`); continue; }
    for (const path of await walk(root, declared.path, [])) {
      const owners = [...suites.filter(entry => entry.match(path)).map(entry => ({ entry, label: `suite "${entry.suite.name}"` })),
        ...helpers.filter(entry => entry.match(path)).map(entry => ({ entry, label: `helper "${entry.helper.purpose ?? entry.helper.include[0]}"` }))];
      if (owners.length === 1) owners[0].entry.files.push(path);
      else if (!owners.length) failures.push(`UNCLASSIFIED_TEST_FILE: ${path} belongs to no suite. ${edit}: add a pattern to the owning suite's "include" (or a "helpers" entry for a non-test module).`);
      else failures.push(`AMBIGUOUS_TEST_FILE: ${path} is claimed by ${owners.map(owner => owner.label).join(' and ')}. ${edit}: narrow one "include" or add an "exclude".`);
    }
  }
  for (const { suite, files } of suites) {
    if (suite.include.length && !files.length && !suite.optional)
      failures.push(`EMPTY_SUITE: suite "${suite.name}" matches no files. ${edit}: fix its "include" patterns.`);
    if (suite.inventory) failures.push(...await inventoryFailures(root, suite, files));
  }
  return {
    suites: suites.map(({ suite, files }) => ({ ...suite, files })),
    helpers: helpers.flatMap(entry => entry.files),
    failures,
  };
}

/** Expands aliases and validates names, preserving order without duplicates. */
export function selectSuites(manifest, names) {
  const selected = [];
  for (const name of names) {
    const matches = name === 'tooling' ? manifest.suites.filter(suite => suite.verify === 'tooling')
      : manifest.suites.filter(suite => suite.name === name);
    if (!matches.length) throw new Error(`UNKNOWN_SUITE: ${name}. Known: ${manifest.suites.map(suite => suite.name).join(', ')}, tooling`);
    for (const suite of matches) if (!selected.includes(suite.name)) selected.push(suite.name);
  }
  return selected;
}

/** Suites that verify runs in its serialized tooling step, with their classified files. */
export async function toolingGroups(root) {
  const manifest = await loadManifest(root);
  const result = await classify(root, manifest);
  if (result.failures.length) throw new Error(result.failures.join('\n'));
  return result.suites.filter(suite => suite.verify === 'tooling').map(suite => ({ name: suite.name, files: suite.files }));
}

function scriptFailures(manifest, scripts) {
  const failures = [];
  for (const suite of manifest.suites) {
    const script = suite.npmScript;
    if (!script) continue;
    const command = scripts[script];
    if (typeof command !== 'string') { failures.push(`SUITE_SCRIPT_MISSING: package.json has no "${script}" script for suite "${suite.name}".`); continue; }
    const words = command.split(/\s+/);
    if (words.includes('scripts/testing/suites.mjs') && !words.includes(suite.name))
      failures.push(`SUITE_SCRIPT_MISMATCH: package.json "${script}" does not run suite "${suite.name}".`);
  }
  return failures;
}

/** Classification; with an evidence inventory also npm-script wiring and parity with evidence tooling. */
export async function checkSuites(root, { evidenceInventory } = {}) {
  const manifest = await loadManifest(root);
  const result = await classify(root, manifest);
  const failures = [...result.failures];
  if (evidenceInventory) {
    const scripts = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).scripts ?? {};
    failures.push(...scriptFailures(manifest, scripts));
    const verifyTooling = new Set(result.suites.filter(suite => suite.verify === 'tooling').flatMap(suite => suite.files));
    for (const path of await evidenceInventory()) {
      if (!verifyTooling.has(path)) failures.push(`TOOLING_NOT_IN_VERIFY: ${path} runs in evidence tooling but belongs to no verify "tooling" suite. ${edit}.`);
      verifyTooling.delete(path);
    }
    for (const path of verifyTooling) failures.push(`TOOLING_NOT_IN_EVIDENCE: ${path} is a verify tooling file outside the evidence tooling inventory (tests/tooling/**/*.{checks,test}.mjs).`);
  }
  return { manifest, ...result, failures };
}
