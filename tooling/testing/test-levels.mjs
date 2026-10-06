/**
 * Test-pyramid levels declared in tests/suites.json ("testLevels", bottom of the pyramid first). Every classified test
 * file resolves to exactly one level: its suite's `level`, or the one `levels` pattern of that suite that claims it.
 * A level with `paths` owns those paths exclusively. `e2e` is a whole-suite property that must agree with the e2e
 * opt-in policy (tooling/quality/e2e-policy.mjs), which gates every browser and real-host command in the workflows.
 */
import { accessSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globToRegExp } from '../../src/cli/tooling/testing/suite-manifest.mjs';

const manifestPath = 'tests/suites.json';
const edit = `Edit ${manifestPath}`;
const levelName = /^[a-z][a-z0-9-]*$/;
const e2eLevel = 'e2e';
/** Runners that can execute a subset of a suite's files; other runners always run the whole suite. */
const narrowableRunners = Object.freeze(['node-test', 'vitest']);
const defaultWarnings = [{ upper: 'e2e', lower: 'integration', maxRatio: 1 }, { upper: 'integration', lower: 'unit', maxRatio: 1 }];

const isStrings = value => Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item);
const compile = patterns => { const list = patterns.map(globToRegExp); return path => list.some(pattern => pattern.test(path)); };

/** The declared levels in pyramid order, or the failures that make the declaration unusable. */
export function declaredLevels(manifest) {
  const list = manifest.testLevels, failures = [];
  if (!Array.isArray(list) || !list.length) return { levels: [], failures: [`TEST_LEVELS_UNDECLARED: ${manifestPath} needs a "testLevels" list, bottom of the pyramid first.`] };
  const names = new Set();
  for (const level of list) {
    const name = level?.name;
    if (typeof name !== 'string' || !levelName.test(name)) failures.push(`TEST_LEVELS_INVALID: level name ${JSON.stringify(name)} must be lowercase words.`);
    else if (names.has(name)) failures.push(`TEST_LEVELS_INVALID: level "${name}" is declared twice.`);
    else names.add(name);
    if (typeof level?.summary !== 'string' || !level.summary) failures.push(`TEST_LEVELS_INVALID: level "${name}" needs a summary.`);
    if (level?.paths !== undefined && !isStrings(level.paths)) failures.push(`TEST_LEVELS_INVALID: level "${name}" paths must be a non-empty string array. ${edit}.`);
  }
  return { levels: failures.length ? [] : list, failures };
}

/** `{ pattern, level, match }` entries of a suite's `levels` map (level → patterns); malformed entries become failures. */
function overrides(suite, known, failures) {
  if (suite.levels === undefined) return [];
  if (!suite.levels || typeof suite.levels !== 'object' || Array.isArray(suite.levels)) {
    failures.push(`SUITE_LEVEL_OVERRIDES_INVALID: suite "${suite.name}" "levels" maps a level to file patterns. ${edit}.`);
    return [];
  }
  const entries = [];
  for (const [level, patterns] of Object.entries(suite.levels)) {
    if (!known.has(level)) failures.push(`SUITE_LEVEL_UNKNOWN: suite "${suite.name}" "levels" names unknown level "${level}". Known: ${[...known].join(', ')}.`);
    else if (level === suite.level) failures.push(`SUITE_LEVEL_OVERRIDES_INVALID: suite "${suite.name}" overrides files to its own level "${level}"; drop that entry.`);
    else if (!isStrings(patterns)) failures.push(`SUITE_LEVEL_OVERRIDES_INVALID: suite "${suite.name}" "levels.${level}" must be a non-empty string array. ${edit}.`);
    else for (const pattern of patterns) entries.push({ pattern, level, match: globToRegExp(pattern) });
  }
  if (suite.level === e2eLevel || entries.some(entry => entry.level === e2eLevel))
    if (entries.length) failures.push(`E2E_LEVEL_OVERRIDE: suite "${suite.name}" mixes e2e with other levels. The e2e opt-in policy gates whole suite commands, so e2e is a suite "level" and an e2e suite takes no "levels" overrides. ${edit}.`);
  return entries;
}

function suiteFiles(suite, known, failures, removed) {
  if (typeof suite.level !== 'string') { failures.push(`SUITE_LEVEL_MISSING: suite "${suite.name}" has no "level". ${edit}: add "level": one of ${[...known].join(', ')}.`); return []; }
  if (!known.has(suite.level)) { failures.push(`SUITE_LEVEL_UNKNOWN: suite "${suite.name}" has level "${suite.level}". Known: ${[...known].join(', ')}.`); return []; }
  const entries = overrides(suite, known, failures), used = new Set(), files = [];
  for (const path of suite.files) {
    const hits = entries.filter(entry => entry.match.test(path));
    if (hits.length > 1) { failures.push(`AMBIGUOUS_TEST_LEVEL: ${path} matches ${hits.map(hit => `"${hit.pattern}" (${hit.level})`).join(' and ')} in suite "${suite.name}". ${edit}: narrow one pattern.`); continue; }
    if (hits[0]) used.add(hits[0]);
    files.push({ path, suite: suite.name, level: hits[0]?.level ?? suite.level });
  }
  for (const entry of entries) if (suite.files.length && !used.has(entry) && !removed.has(entry.pattern))
    failures.push(`UNUSED_LEVEL_PATTERN: suite "${suite.name}" pattern "${entry.pattern}" (${entry.level}) matches none of its files. ${edit}: remove or fix it.`);
  return files;
}

/** Example-owned files (tooling/examples/ownership.json) that `examples:remove` deleted from `root`. */
export function removedExampleFiles(root) {
  let ownership;
  try { ownership = JSON.parse(readFileSync(resolve(root, 'tooling/examples/ownership.json'), 'utf8')); } catch { return new Set(); }
  const paths = Array.isArray(ownership?.files) ? ownership.files.map(file => file?.path).filter(path => typeof path === 'string') : [];
  return new Set(paths.filter(path => { try { accessSync(resolve(root, path)); return false; } catch { return true; } }));
}

/** A level with `paths` owns them exclusively, so a reserved level (acceptance, e2e) cannot drift either way. */
function pathFailures(levels, files) {
  const failures = [];
  for (const level of levels.filter(item => item.paths)) {
    const under = compile(level.paths);
    for (const file of files) {
      if (under(file.path) && file.level !== level.name) failures.push(`TEST_LEVEL_PATH_MISMATCH: ${file.path} sits under the ${level.name} paths (${level.paths.join(', ')}) but resolves to ${file.level} in suite "${file.suite}". ${edit}.`);
      else if (!under(file.path) && file.level === level.name) failures.push(`TEST_LEVEL_PATH_MISMATCH: ${file.path} resolves to ${level.name}, which is reserved for ${level.paths.join(', ')}. ${edit} or move the file.`);
    }
  }
  return failures;
}

/**
 * Resolves every classified file of `suites` (suite-manifest's classification) to its level. `removed` holds example
 * files that `examples:remove` deleted (tooling/examples/ownership.json paths missing on disk): an override naming
 * exactly one of them may match nothing, every other unmatched override still fails.
 */
export function resolveLevels(manifest, suites, { removed = new Set() } = {}) {
  const declared = declaredLevels(manifest);
  if (declared.failures.length) return { levels: [], files: [], failures: declared.failures };
  const known = new Set(declared.levels.map(level => level.name)), failures = [];
  const files = suites.flatMap(suite => suiteFiles(suite, known, failures, removed));
  failures.push(...pathFailures(declared.levels, files));
  return { levels: declared.levels, files, failures };
}

/** The text the e2e policy classifies for a suite: its npm script, runner commands and file patterns, one per line. */
export function suiteCommandText(suite) {
  const runner = suite.runner ?? {};
  const lines = [suite.npmScript ? `npm run ${suite.npmScript}` : '', runner.type === 'npm-script' ? `npm run ${runner.script}` : ''];
  for (const command of runner.commands ?? []) lines.push(Array.isArray(command) ? command.join(' ') : [command.each, ...command.argv].join(' '));
  return [...lines, ...suite.include].filter(Boolean).join('\n');
}
/**
 * An e2e suite must be opt-in (verify never runs it) and run commands the e2e policy recognizes, so any workflow step
 * running it is gated by the opt-in; a suite whose commands the policy calls end-to-end must be level e2e.
 */
export function e2ePolicyFailures(manifest, e2eKinds) {
  const failures = [];
  for (const suite of manifest.suites) {
    const kinds = e2eKinds ? e2eKinds(suiteCommandText(suite)) : null;
    if (suite.level === e2eLevel) {
      if (suite.verify !== 'opt-in') failures.push(`E2E_SUITE_NOT_OPT_IN: suite "${suite.name}" is e2e but verify mode "${suite.verify}" runs it unconditionally. ${edit}: use "verify": "opt-in".`);
      if (kinds && !kinds.length) failures.push(`E2E_SUITE_NOT_IN_POLICY: suite "${suite.name}" is e2e, but scripts/quality/e2e-policy.mjs does not classify its commands as end-to-end, so a workflow step running it would escape the e2e opt-in. Add its command to the policy's e2e command list.`);
    } else if (kinds?.length) failures.push(`E2E_POLICY_LEVEL_MISMATCH: suite "${suite.name}" runs commands the e2e opt-in policy classifies as ${kinds.join(', ')}, but its level is "${suite.level}". ${edit}: use "level": "e2e".`);
  }
  return failures;
}

function warningRules(manifest, known) {
  const rules = manifest.pyramid?.warnWhen ?? defaultWarnings.filter(rule => known.has(rule.upper) && known.has(rule.lower));
  if (!Array.isArray(rules)) throw new Error('PYRAMID_CONFIG_INVALID: pyramid.warnWhen must be a list');
  for (const rule of rules) {
    if (!known.has(rule?.upper) || !known.has(rule?.lower) || !(typeof rule.maxRatio === 'number' && rule.maxRatio > 0))
      throw new Error(`PYRAMID_CONFIG_INVALID: ${JSON.stringify(rule)} needs known "upper"/"lower" levels and a positive "maxRatio"`);
  }
  return rules;
}
/** File counts per level (bottom first), suites per level, measured seconds of single-level suites and shape warnings. */
export function pyramidReport(manifest, resolved, durations = {}) {
  const rows = resolved.levels.map(level => ({ level: level.name, summary: level.summary, files: 0, suites: [], measuredSeconds: 0, measuredSuites: [] }));
  const byName = new Map(rows.map(row => [row.level, row]));
  const suiteLevels = new Map();
  for (const file of resolved.files) {
    const row = byName.get(file.level);
    row.files += 1;
    if (!row.suites.includes(file.suite)) row.suites.push(file.suite);
    suiteLevels.set(file.suite, new Set([...(suiteLevels.get(file.suite) ?? []), file.level]));
  }
  const mixed = [];
  for (const [suite, levels] of suiteLevels) {
    if (levels.size > 1) { mixed.push({ suite, levels: rows.map(row => row.level).filter(name => levels.has(name)), measuredSeconds: durations[suite] ?? null }); continue; }
    const row = byName.get([...levels][0]);
    if (durations[suite] !== undefined) { row.measuredSeconds += durations[suite]; row.measuredSuites.push(suite); }
  }
  const warnings = warningRules(manifest, new Set(byName.keys())).flatMap(({ upper, lower, maxRatio }) => {
    const top = byName.get(upper).files, bottom = byName.get(lower).files;
    return top > bottom * maxRatio ? [`PYRAMID_INVERTED: ${upper} has ${top} test files, more than ${maxRatio} × the ${bottom} ${lower} files below it.`] : [];
  });
  return { levels: rows, mixedSuites: mixed, total: resolved.files.length, warnings };
}

/** Which files of each suite a `--level` selection runs; whole-suite runners are skipped unless every file matches. */
export function selectByLevel(suites, resolved, wanted) {
  const selected = [], skipped = [];
  for (const suite of suites) {
    const files = resolved.files.filter(file => file.suite === suite.name);
    const matching = files.filter(file => wanted.includes(file.level)).map(file => file.path);
    if (!matching.length) continue;
    const whole = matching.length === files.length;
    if (whole) selected.push({ suite, files: suite.files, narrowed: false });
    else if (narrowableRunners.includes(suite.runner.type)) selected.push({ suite, files: matching, narrowed: true });
    else skipped.push({ name: suite.name, reason: `mixes ${[...new Set(files.map(file => file.level))].join('+')} files and its ${suite.runner.type} runner cannot select files; run it by name` });
  }
  return { selected, skipped };
}
