/** Pure, diff-based self-review rules. Each rule inspects only added (or, where stated, removed) lines. */
import { codeText } from '../../src/cli/tooling/delivery/rules-common.mjs';

// Directive patterns are assembled from fragments so this guard's own source never
// matches itself when a change that adds it is reviewed.
const lintDisable = /(?:eslint|oxlint)-disable/;
const tsSuppression = /@ts-(?:ignore|expect-error|nocheck)/;
const coverageIgnore = /(?:istanbul|v8|c8) ignore/;
const fallowIgnore = /fallow(?:-ignore)/;
const anyCast = new RegExp(`\\bas ${'any'}\\b`);
const unknownCast = new RegExp(`\\bas ${'unknown'} as\\b`);
const screenshotAssertion = new RegExp(`\\b(?:toHave${'Screenshot'}|toMatch(?:Inline|File)?${'Snapshot'})\\s*\\(`);
const retiredLauncher = /(?:^|[^\w./\\-])(?:\.\/)?(?:shell|app)\.mjs\b/;

// Focused-test patterns run on code text, where a non-empty string or template literal reads as '…'.
const testDeclaration = /\b(?:test|it|describe|suite|context|bench)\b(?:\s*\.\s*[\w$]+)*\s*\(/;
const focusCall = /\.\s*(?:only|fixme|skipIf|runIf|todo)\s*\(/;
// Jest/Jasmine aliases declare a test only with a title and then a callback (or a call continued on the next line).
const aliasDeclaration = /\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(\s*(?:$|(['"`])…?\1\s*(?:$|,\s*(?:$|async\b|function\b|\(|[\w$]+\s*=>)))/;
const skipCall = /([\w$]+)\s*\.\s*skip\s*\(\s*(?:(['"`])…\2)?/g;
const declarationReceivers = new Set(['test', 'it', 'describe', 'suite', 'context', 'bench']);
const constantOption = /\b(?:skip|todo)\s*:\s*true\b/;
const reasonOption = /\b(?:skip|todo)\s*:\s*['"`]/;
const optionLine = /^\s*\{?\s*(?:skip|todo)\s*:/;

/**
 * True when a code line focuses, skips or marks a test as todo. A runtime skip that states its reason
 * (`t.skip('why')` inside a test body) is not a finding; `test.skip(`, `.only(`, `.todo(`, a reasonless
 * `t.skip()` and `skip: true` or `todo: true` are. A constant reason (`skip: 'why'`, `todo: 'why'`) disables a test only
 * as declaration options, so it counts on a declaration line or as a line of a multi-line options object; elsewhere it
 * is a data field (a check-step model's `skip`). A conditional reason (`skip: cond && 'why'`) is a runtime skip.
 */
function focusedTest(code) {
  if (focusCall.test(code) || aliasDeclaration.test(code) || constantOption.test(code)) return true;
  if (reasonOption.test(code) && (optionLine.test(code) || testDeclaration.test(code))) return true;
  return [...code.matchAll(skipCall)].some(match => declarationReceivers.has(match[1]) || !match[2]);
}

const designWorkspace = path => path.startsWith('docs/concepts/');
const codePath = path => /\.(?:[cm]?[jt]sx?|vue)$/.test(path);
const testPath = path => /(?:^|\/)(?:tests|__tests__)\//.test(path) || /\.(?:test|spec|checks)\.[cm]?[jt]sx?$/.test(path);
const generatedPath = path => /(?:^|\/)(?:fixtures|__generated__|generated)\//.test(path) || /\.generated\./.test(path);
// docs/concepts is the design working directory: repository gates ignore it and each concept keeps its own verification.
const reviewedCode = path => codePath(path) && !designWorkspace(path);
const reviewedTest = path => testPath(path) && !generatedPath(path) && !designWorkspace(path);
const vitestConfigPath = path => /(?:^|\/)vitest[^/]*\.config\.[cm]?[jt]s$/.test(path);
const lintConfigPath = path => path.startsWith('configs/lint/');
// The owner approval record is CODEOWNERS-reviewed and only approves exact lines, so it is not itself a threshold change.
const approvalRecord = 'configs/quality/self-review-approvals.json';
const qualityConfigPath = path => (path.startsWith('configs/quality/') && path !== approvalRecord) || path === 'tooling/quality/thresholds.mjs' || /(?:^|\/)\.?fallowrc[^/]*$/.test(path);
const commentLine = text => /^\s*(?:\/\/|\/\*|\*|<!--)/.test(text);
/** A source line as code: string and template literal contents removed (a non-empty one reads as '…'), comments kept. */
const sourceCode = text => codeText(text, contents => (contents.trim() ? '…' : ''));

/**
 * Line rules: `side` selects added or removed lines; `code: true` matches the line as code (string and template
 * literal contents removed, comments kept, so a real directive comment still counts); `skipComments` ignores pure
 * comment lines. A `pattern` is a regular expression or a predicate over the matched text.
 */
const lineRules = [
  { rule: 'SR-LINT-DISABLE', applies: reviewedCode, pattern: lintDisable, code: true,
    message: 'lint rule disabled by comment; fix the finding or get the owner to approve this exact suppression' },
  { rule: 'SR-TS-SUPPRESSION', applies: reviewedCode, pattern: tsSuppression, code: true,
    message: 'TypeScript error suppression added; fix the types instead of silencing the compiler' },
  { rule: 'SR-COVERAGE-IGNORE', applies: reviewedCode, pattern: coverageIgnore, code: true,
    message: 'coverage ignore comment added; test the code instead of excluding it from the gate' },
  { rule: 'SR-ANALYZER-IGNORE', applies: reviewedCode, pattern: fallowIgnore, code: true,
    message: 'analyzer ignore comment added; remove the dead export or document the entry point in review' },
  { rule: 'SR-UNSAFE-CAST', applies: reviewedCode, pattern: anyCast, code: true, skipComments: true,
    message: 'unchecked cast to a catch-all type added; narrow with a type guard or a validated parser' },
  { rule: 'SR-UNSAFE-CAST', applies: reviewedCode, pattern: unknownCast, code: true, skipComments: true,
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
  { rule: 'SR-SCREENSHOT-BASELINE', applies: testPath, pattern: screenshotAssertion, code: true,
    message: 'screenshot/snapshot baseline assertion added; UI evidence is for human review, never an accepted baseline' },
  { rule: 'SR-FOCUSED-TEST', applies: reviewedTest, pattern: focusedTest, code: true,
    message: 'focused, skipped or todo test added; remove it or fix the test' },
  { rule: 'SR-RETIRED-LAUNCHER', applies: path => path !== 'CHANGELOG.md', pattern: retiredLauncher,
    message: 'reference to a retired launcher; use `node bin/app` or the npm scripts instead' },
];

function matches(rule, text) {
  if (rule.skipComments && commentLine(text)) return false;
  const subject = rule.code ? sourceCode(text) : text;
  return typeof rule.pattern === 'function' ? rule.pattern(subject) : rule.pattern.test(subject);
}
/** Findings of one rule in one file; a removed-line finding says so in `side`, since its line number is in the base. */
function matchLines(file, rule) {
  const removed = rule.side === 'removed';
  return (removed ? file.removed : file.added)
    .filter(entry => matches(rule, entry.text))
    .map(entry => ({ rule: rule.rule, file: file.path, line: entry.line, ...(removed ? { side: 'removed' } : {}), message: rule.message }));
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
