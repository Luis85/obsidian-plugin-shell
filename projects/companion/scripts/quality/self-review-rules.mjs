/** Pure, diff-based self-review rules. Each rule inspects only added (or, where stated, removed) lines. */

// Directive patterns are assembled from fragments so this guard's own source never
// matches itself when a change that adds it is reviewed.
const lintDisable = /(?:eslint|oxlint)-disable/;
const tsSuppression = /@ts-(?:ignore|expect-error|nocheck)/;
const coverageIgnore = /(?:istanbul|v8|c8) ignore/;
const fallowIgnore = /fallow(?:-ignore)/;
const anyCast = new RegExp(`\\bas ${'any'}\\b`);
const unknownCast = new RegExp(`\\bas ${'unknown'} as\\b`);
const screenshotAssertion = new RegExp(`\\b(?:toHave${'Screenshot'}|toMatch(?:Inline|File)?${'Snapshot'})\\s*\\(`);
const focusedTest = /\.(?:only|skip|fixme|skipIf|runIf)\s*\(|\b(?:it|test|describe|suite)\.todo\b|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(|\b(?:skip|todo)\s*:\s*(?:true\b|['"])/;
const retiredLauncher = /(?:^|[^\w./\\-])(?:\.\/)?(?:shell|app)\.mjs\b/;

const codePath = path => /\.(?:[cm]?[jt]sx?|vue)$/.test(path);
const testPath = path => /(?:^|\/)(?:tests|__tests__)\//.test(path) || /\.(?:test|spec|checks)\.[cm]?[jt]sx?$/.test(path);
const generatedPath = path => /(?:^|\/)(?:fixtures|__generated__|generated)\//.test(path) || /\.generated\./.test(path);
const vitestConfigPath = path => /(?:^|\/)vitest[^/]*\.config\.[cm]?[jt]s$/.test(path);
const lintConfigPath = path => path.startsWith('configs/lint/');
const qualityConfigPath = path => path.startsWith('configs/quality/') || path === 'scripts/quality/thresholds.mjs' || /(?:^|\/)\.?fallowrc[^/]*$/.test(path);
const commentLine = text => /^\s*(?:\/\/|\/\*|\*|<!--)/.test(text);

/** Line rules: `side` selects added or removed lines; `code: true` skips pure comment lines; `outsideStrings` skips quoted fixture text. */
const lineRules = [
  { rule: 'SR-LINT-DISABLE', applies: codePath, pattern: lintDisable,
    message: 'lint rule disabled by comment; fix the finding or get the owner to approve this exact suppression' },
  { rule: 'SR-TS-SUPPRESSION', applies: codePath, pattern: tsSuppression,
    message: 'TypeScript error suppression added; fix the types instead of silencing the compiler' },
  { rule: 'SR-COVERAGE-IGNORE', applies: codePath, pattern: coverageIgnore,
    message: 'coverage ignore comment added; test the code instead of excluding it from the gate' },
  { rule: 'SR-ANALYZER-IGNORE', applies: codePath, pattern: fallowIgnore,
    message: 'analyzer ignore comment added; remove the dead export or document the entry point in review' },
  { rule: 'SR-UNSAFE-CAST', applies: codePath, pattern: anyCast, code: true,
    message: 'unchecked cast to a catch-all type added; narrow with a type guard or a validated parser' },
  { rule: 'SR-UNSAFE-CAST', applies: codePath, pattern: unknownCast, code: true,
    message: 'double cast through the unknown type added; narrow with a type guard or a validated parser' },
  { rule: 'SR-COVERAGE-THRESHOLD', applies: vitestConfigPath, pattern: /\b(?:lines|statements|functions|branches)\s*:|\bthresholds\b/,
    message: 'coverage threshold literal added in a Vitest config; thresholds come from configs/quality/thresholds.json and may only tighten' },
  { rule: 'SR-COVERAGE-THRESHOLD', applies: vitestConfigPath, pattern: /\bexclude\s*:|\bcoverage\.exclude\b/,
    message: 'coverage exclusion changed in a Vitest config; do not exclude production code from the gate' },
  { rule: 'SR-COVERAGE-THRESHOLD', applies: vitestConfigPath, pattern: /\bthresholds\b/, side: 'removed',
    message: 'coverage threshold wiring removed from a Vitest config; the gate must keep reading the reviewed thresholds' },
  { rule: 'SR-LINT-CONFIG', applies: lintConfigPath, pattern: /['"](?:off|warn|allow)['"]|\bignores\b|\bignorePatterns\b/,
    message: 'lint rule turned off, downgraded or ignored in the lint configuration; needs explicit owner approval' },
  { rule: 'SR-LINT-CONFIG', applies: lintConfigPath, pattern: /['"](?:error|deny)['"]/, side: 'removed',
    message: 'lint rule severity removed from the lint configuration; needs explicit owner approval' },
  { rule: 'SR-SCREENSHOT-BASELINE', applies: testPath, pattern: screenshotAssertion,
    message: 'screenshot/snapshot baseline assertion added; UI evidence is for human review, never an accepted baseline' },
  { rule: 'SR-FOCUSED-TEST', applies: path => testPath(path) && !generatedPath(path), pattern: focusedTest, outsideStrings: true,
    message: 'focused, skipped or todo test added; remove it or fix the test' },
  { rule: 'SR-RETIRED-LAUNCHER', applies: path => path !== 'CHANGELOG.md', pattern: retiredLauncher,
    message: 'reference to a retired launcher; use `node bin/app` or the npm scripts instead' },
];

/** True when `index` sits inside a quoted string, so fixture text that merely contains a pattern is not a finding. */
function insideString(text, index) {
  let quote = '';
  for (let position = 0; position < index; position++) {
    const char = text[position];
    if (quote && char === '\\') position++;
    else if (quote === char) quote = '';
    else if (!quote && (char === "'" || char === '"')) quote = char;
  }
  return quote !== '';
}
function matches(rule, text) {
  const match = rule.pattern.exec(text);
  return Boolean(match) && !(rule.code && commentLine(text)) && !(rule.outsideStrings && insideString(text, match.index));
}
function matchLines(file, rule) {
  const lines = rule.side === 'removed' ? file.removed : file.added;
  return lines
    .filter(entry => matches(rule, entry.text))
    .map(entry => ({ rule: rule.rule, file: file.path, line: entry.line, message: rule.message }));
}

function qualityConfigChange(file) {
  if (!qualityConfigPath(file.path)) return [];
  const first = file.added[0] ?? file.removed[0];
  if (!first && file.status !== 'D') return [];
  const count = file.added.length + file.removed.length;
  return [{ rule: 'SR-QUALITY-CONFIG', file: file.path, line: first?.line ?? 1,
    message: `quality configuration changed (${file.added.length} added, ${file.removed.length} removed of ${count}); thresholds and ignore lists may only tighten, and loosening needs owner approval` }];
}
function snapshotBaselineFile(file) {
  if (file.status !== 'A' && file.status !== 'R') return [];
  if (!/(?:^|\/)(?:__snapshots__|[^/]+-snapshots)\//.test(file.path) && !/\.snap$/.test(file.path)) return [];
  return [{ rule: 'SR-SCREENSHOT-BASELINE', file: file.path, line: 1, message: 'snapshot baseline file added; UI evidence is for human review, never an accepted baseline' }];
}

/** Violations from added/removed lines and file paths of every non-deleted change. */
export function lineViolations(files) {
  const found = [];
  for (const file of files) {
    if (file.status !== 'D') for (const rule of lineRules) if (rule.applies(file.path)) found.push(...matchLines(file, rule));
    found.push(...qualityConfigChange(file), ...snapshotBaselineFile(file));
  }
  return found;
}
