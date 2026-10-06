/** One reviewed thresholds file for every quality gate. Projects may tighten values, never loosen them. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const thresholdsPath = 'configs/quality/thresholds.json';
// scripts/quality -> project root; every project ships scripts/ and configs/ together.
const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
const coverage = (lines, statements, functions, branches) => ({ lines, statements, functions, branches });
/** The loosest values any project may use: the framework's reviewed gates. */
export const thresholdFloors = deepFreeze({
  coverage: {
    selectedCore: coverage(95, 90, 90, 90), production: coverage(90, 90, 90, 85), productionCore: coverage(95, 95, 95, 90),
    maker: coverage(90, 90, 90, 85), makerCore: coverage(95, 95, 95, 90), compiler: { lines: 95, functions: 90, branches: 90 },
  },
  codeLines: { source: 400, tests: 450, mainTs: 100 },
  maintainability: { cyclomatic: 10, cognitive: 15, duplicationPercent: 3, duplicationMinTokens: 50, duplicationMinLines: 5 },
  performance: { warmInitializationMs: 200, itemsReadinessMs: 500, mainJsBytes: 1048576, stylesCssBytes: 163840 },
});
function deepFreeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child);
  return Object.freeze(value);
}
function fail(code, path) { throw new Error(`${code}: ${path}`); }
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function sameKeys(actual, expected, path) {
  if (!isRecord(actual)) fail('THRESHOLDS_INVALID', path);
  const keys = Object.keys(actual).sort(), wanted = Object.keys(expected).sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) fail('THRESHOLDS_KEYS', path);
}
/** Coverage values are minimums (higher is stricter); every other value is a ceiling (lower is stricter). */
function checkValue(value, floor, path, minimum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail('THRESHOLDS_INVALID', path);
  if (minimum ? value > 100 : !Number.isInteger(value) && !path.endsWith('Percent')) fail('THRESHOLDS_INVALID', path);
  if (minimum ? value < floor : value > floor) fail('THRESHOLD_LOOSENED', `${path} ${value} (framework ${minimum ? 'minimum' : 'maximum'} ${floor})`);
}
export function validateThresholds(value) {
  sameKeys(value, { schemaVersion: 1, ...thresholdFloors }, 'thresholds');
  if (value.schemaVersion !== 1) fail('THRESHOLDS_VERSION', 'schemaVersion');
  for (const [group, entries] of Object.entries(thresholdFloors)) {
    sameKeys(value[group], entries, group);
    for (const [name, floor] of Object.entries(entries)) {
      if (typeof floor === 'number') { checkValue(value[group][name], floor, `${group}.${name}`, false); continue; }
      sameKeys(value[group][name], floor, `${group}.${name}`);
      for (const [metric, minimum] of Object.entries(floor)) checkValue(value[group][name][metric], minimum, `${group}.${name}.${metric}`, true);
    }
  }
  return deepFreeze(structuredClone(value));
}
/** Missing, unreadable or loosened thresholds fail closed; no gate falls back to a default. */
export function loadThresholds(root = defaultRoot) {
  let text;
  try { text = readFileSync(join(root, thresholdsPath), 'utf8'); } catch { fail('THRESHOLDS_MISSING', thresholdsPath); }
  let value;
  try { value = JSON.parse(text); } catch { fail('THRESHOLDS_INVALID', thresholdsPath); }
  return validateThresholds(value);
}
