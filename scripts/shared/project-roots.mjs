/** Code roots of a project, derived from its own configuration instead of a hard-coded `src`.
 * A generated project names its product folders (for example `<codebaseFolder>/generated`) in
 * tsconfig.project.json and its test roots in tests/suites.json; the shell repository has neither. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readJson(root, path) {
  try { return JSON.parse(readFileSync(join(root, path), 'utf8')); } catch { return null; }
}
/** The literal folder in front of each tsconfig.project.json include glob (`a/b/**\/*.ts` -> `a/b`). */
function tsconfigRoots(root) {
  const include = readJson(root, 'tsconfig.project.json')?.include;
  const roots = new Set();
  for (const pattern of Array.isArray(include) ? include : []) {
    const base = String(pattern).replace(/\\/g, '/').split('/**')[0].replace(/\/+$/, '');
    if (base && !base.includes('*') && !base.startsWith('.') && !base.split('/').includes('..')) roots.add(base);
  }
  return [...roots];
}
/** Declared test roots (tests/suites.json) plus the conventional `tests` folder. */
function testRoots(root) {
  const declared = readJson(root, 'tests/suites.json')?.roots;
  return ['tests', ...(Array.isArray(declared) ? declared.map(entry => String(entry?.path ?? '')).filter(Boolean) : [])];
}
const within = (path, base) => path === base || path.startsWith(`${base}/`);
/** Drop roots nested inside another listed root, keeping the first-seen order. */
export function outermostRoots(roots) {
  const unique = [...new Set(roots)];
  return unique.filter(path => !unique.some(other => other !== path && within(path, other)));
}
/** Product source roots: `src` plus configured roots that are not test roots. */
export function sourceRoots(root) {
  const tests = testRoots(root);
  return outermostRoots(['src', ...tsconfigRoots(root).filter(path => !tests.some(base => within(path, base)))]);
}
/** Every code root an edit or change can belong to: sources, `tests` and configured roots. */
export function codeRoots(root) {
  return outermostRoots(['src', 'tests', ...tsconfigRoots(root)]);
}
/** Only roots that exist as folders (tools such as ESLint fail on missing paths). */
function existingRoots(root, roots) {
  return roots.filter(path => existsSync(join(root, path)));
}
/** ESLint targets: `src` (always named, so a missing folder is reported) plus existing product roots. */
export function lintRoots(root) {
  return ['src', ...existingRoots(root, sourceRoots(root).filter(path => path !== 'src'))];
}
export const isWithinRoot = within;
