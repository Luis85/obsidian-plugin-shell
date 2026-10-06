/**
 * Which gates a diff selects: suites by their test-file includes, by the sources the gate rules say they
 * protect, by change-type rules and (for the plan only) by workflow `paths:` filters; plus the narrowed
 * `check --fast` step list built from the same selection.
 */
import { isWithinRoot } from '../../../../scripts/shared/project-roots.mjs';
import type { CheckStep } from './check.ts';
import type { Changes } from './check-changes.ts';
import type { GateRules, Rule, SuiteDef, SuiteManifest, Toolkit, Workflow } from './gate-sources.ts';
import { loadGateRules, loadToolkit, workflowTrigger } from './gate-sources.ts';
/** Suite steps (the maker suite alone runs ~25 minutes in CI) outlive the 10-minute check step default. */
export const suiteTimeoutMs = 3_600_000;

type ReasonKind = 'suite-include' | 'suite-source' | 'rule' | 'workflow-paths';
/** Why something was selected: the matched pattern/rule and a bounded sample of the changed paths. */
export interface Reason { kind: ReasonKind; detail: string; paths: string[]; count: number }
type Selection = Map<string, Reason[]>;
const sampleSize = 5;
const maxRelated = 200;

function addReason(selection: Selection, key: string, kind: ReasonKind, detail: string, path: string): void {
  const reasons = selection.get(key) ?? [];
  const found = reasons.find(reason => reason.kind === kind && reason.detail === detail);
  if (!found) reasons.push({ kind, detail, paths: [path], count: 1 });
  else { found.count += 1; if (found.paths.length < sampleSize) found.paths.push(path); }
  selection.set(key, reasons);
}
const firstPattern = (toolkit: Toolkit, patterns: string[], path: string): string => patterns.find(pattern => toolkit.glob([pattern])(path)) ?? patterns[0] ?? '';
/** Change-type rules that match at least one changed path, with those paths. */
export function ruleHits(toolkit: Toolkit, rules: GateRules, paths: string[]): Array<{ rule: Rule; paths: string[] }> {
  const hits: Array<{ rule: Rule; paths: string[] }> = [];
  for (const rule of rules.rules) {
    const match = toolkit.glob(rule.paths), matched = paths.filter(match);
    if (matched.length) hits.push({ rule, paths: matched });
  }
  return hits;
}
function selectByTests(selection: Selection, toolkit: Toolkit, manifest: SuiteManifest, paths: string[]): void {
  for (const suite of manifest.suites) {
    const match = toolkit.matchSuite(suite);
    for (const path of paths) if (suite.include.length && match(path)) addReason(selection, suite.name, 'suite-include', firstPattern(toolkit, suite.include, path), path);
  }
}
function selectBySources(selection: Selection, toolkit: Toolkit, rules: GateRules, paths: string[]): void {
  for (const [suite, patterns] of Object.entries(rules.suiteSources)) {
    const match = toolkit.glob(patterns);
    for (const path of paths) if (match(path)) addReason(selection, suite, 'suite-source', firstPattern(toolkit, patterns, path), path);
  }
}
function selectByRules(selection: Selection, toolkit: Toolkit, rules: GateRules, paths: string[]): void {
  for (const { rule, paths: matched } of ruleHits(toolkit, rules, paths)) {
    for (const suite of rule.suites) for (const path of matched) addReason(selection, suite, 'rule', `rule ${rule.id}`, path);
  }
}
function selectByWorkflows(selection: Selection, toolkit: Toolkit, manifest: SuiteManifest, workflows: Workflow[], paths: string[]): void {
  for (const workflow of workflows) {
    const trigger = workflowTrigger(toolkit, workflow, paths);
    if (!trigger.runs || trigger.via === 'always' || !trigger.path) continue;
    for (const suite of manifest.suites) {
      if (suite.workflows?.includes(workflow.stem)) addReason(selection, suite.name, 'workflow-paths', `${workflow.stem} ${trigger.event} paths: ${trigger.pattern ?? trigger.via}`, trigger.path);
    }
  }
}
/** Suites selected by changed paths, in manifest order. Unknown suite names in the rules are ignored here (tests pin them). */
export function selectSuiteReasons(toolkit: Toolkit, manifest: SuiteManifest, rules: GateRules | null, paths: string[], workflows: Workflow[] = []): Selection {
  const selection: Selection = new Map();
  selectByTests(selection, toolkit, manifest, paths);
  if (rules) { selectBySources(selection, toolkit, rules, paths); selectByRules(selection, toolkit, rules, paths); }
  selectByWorkflows(selection, toolkit, manifest, workflows, paths);
  const known = new Map(manifest.suites.map((suite, index) => [suite.name, index]));
  return new Map([...selection].filter(([name]) => known.has(name)).sort((a, b) => known.get(a[0])! - known.get(b[0])!));
}
/** `check --fast` runs suites it can run unattended: node --test runners and Vitest suites that verify runs in a
 * named step of their own (the maker suite). The runtime Vitest suite is the related-test step's, not a suite step. */
export const fastRunnable = (suite: SuiteDef): boolean => suite.runner.type === 'node-test' || (suite.runner.type === 'vitest' && Boolean(suite.verifyStepId));

/** Suites `check --fast` can run that the changed paths select; empty without git, in generated projects or without the manifest tooling. */
export async function fastSuites(root: string, project: boolean, changes: Changes): Promise<FastContext['suites']> {
  if (project || changes.source !== 'git') return [];
  const toolkit = await loadToolkit(root);
  const manifest = toolkit ? await toolkit.manifest().catch(() => null) : null;
  if (!toolkit || !manifest) return [];
  const runnable = new Set(manifest.suites.filter(fastRunnable).map(suite => suite.name));
  const selection = selectSuiteReasons(toolkit, manifest, await loadGateRules(root), changes.paths);
  return [...selection].filter(([name]) => runnable.has(name)).map(([name, reasons]) => ({ name, reasons }));
}

interface FastContext {
  project: boolean; changes: Changes; typecheck: CheckStep; fullTest: CheckStep; vitestConfig: string[];
  full: () => CheckStep[]; fullLint: CheckStep | null; eslintRoots: string[]; fullEslint: CheckStep; makerTypes: CheckStep[];
  suites: Array<{ name: string; reasons: Reason[] }>; skipSuites?: boolean;
}
const preview = (files: string[]) => files.length > 3 ? `${files.slice(0, 3).join(' ')} … (${files.length} files)` : files.join(' ');
function skipped(step: CheckStep, reason: string, display: string): CheckStep { return { ...step, display, skip: reason }; }
/** True when the change set cannot be narrowed to related files: wide, deleted, non-code or configuration changes. */
function isWide(changes: Changes): boolean {
  return Boolean(changes.untraceable) || changes.files.length > maxRelated || changes.configuration.length > 0;
}
function limitedStep(full: CheckStep, wide: boolean, files: string[], where: string, narrow: (files: string[]) => CheckStep): CheckStep {
  if (wide) return full;
  if (!files.length) return skipped(full, `No changed files under ${where}.`, `${full.display} (no changed files)`);
  return narrow(files);
}
function lintStep(ctx: FastContext, wide: boolean): CheckStep[] {
  if (!ctx.fullLint) return [];
  const full = ctx.fullLint, roots = ['src', 'plugins', 'templates/companion/runtime'];
  const files = ctx.changes.files.filter(path => roots.some(root => isWithinRoot(path, root)));
  return [limitedStep(full, wide, files, roots.join(', '), list => ({ ...full, display: `${full.display} ${preview(list)}`, args: list }))];
}
function eslintStep(ctx: FastContext, wide: boolean): CheckStep {
  const full = ctx.fullEslint, files = ctx.changes.files.filter(path => ctx.eslintRoots.some(root => isWithinRoot(path, root)));
  const configIndex = full.args.indexOf('-c') + 2;
  return limitedStep(full, wide, files, ctx.eslintRoots.join(', '), list => ({ ...full,
    display: `eslint ${full.args.slice(0, configIndex).join(' ')} ${preview(list)} --max-warnings 0`,
    args: [...full.args.slice(0, configIndex), '--no-warn-ignored', ...list, '--max-warnings', '0'] }));
}
/** Fast mode narrows the test step to `vitest related` only when every change is traceable and bounded. */
function testStep(ctx: FastContext): CheckStep {
  const { changes, fullTest } = ctx, count = changes.files.length;
  if (changes.untraceable || changes.configuration.length) return fullTest;
  if (count > maxRelated) { changes.reason = `more than ${maxRelated} changed files; running the full suite`; return fullTest; }
  const base = changes.base?.ref ?? 'HEAD';
  if (!count) return { ...fullTest, display: 'vitest related (no changed source files)', skip: `No changed source files since ${base}.` };
  return { id: 'test', display: `vitest related --run (${count} changed file${count === 1 ? '' : 's'})`, entry: fullTest.entry, args: ['related', '--run', '--passWithNoTests', ...ctx.vitestConfig, ...changes.files] };
}
function suiteStep(ctx: FastContext): CheckStep[] {
  if (ctx.project) return [];
  const names = ctx.suites.map(suite => suite.name);
  const base: CheckStep = { id: 'suites', display: 'node scripts/testing/suites.mjs', entry: 'scripts/testing/suites.mjs', args: names, timeoutMs: suiteTimeoutMs };
  if (!names.length) return [{ ...base, display: 'node scripts/testing/suites.mjs (no matching suites)', skip: 'No changed path selects a node --test or maker suite.' }];
  if (ctx.skipSuites) return [{ ...base, display: `${base.display} ${names.join(' ')} (left to CI)`, skip: `--skip-suites: ${names.join(', ')} run in CI's Integration tier, not here.` }];
  return [{ ...base, display: `${base.display} ${names.join(' ')}` }];
}
/** The narrowed gate: typecheck as before, lint/eslint on changed files, related vitest, matching node suites. */
export function fastSteps(ctx: FastContext): CheckStep[] {
  if (ctx.changes.source !== 'git') return ctx.full();
  const wide = isWide(ctx.changes);
  if (ctx.changes.configuration.length && !ctx.changes.reason) ctx.changes.reason = `configuration files changed (${preview(ctx.changes.configuration)}); running the full lint and test steps`;
  return [ctx.typecheck, ...lintStep(ctx, wide), eslintStep(ctx, wide), testStep(ctx), ...suiteStep(ctx), ...ctx.makerTypes];
}
