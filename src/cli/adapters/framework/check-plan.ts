/**
 * `check --plan`: the definition of done for a diff, computed without running anything. It joins the changed
 * set (merge-base(<base>, HEAD) .. working tree) to gates through the suites manifest, the workflows' `paths:`
 * filters and configs/quality/gate-rules.json, and always ends with the pre-PR `npm run verify`.
 */
import { join } from 'node:path';
import { OperationError, result, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { readJson } from './files.ts';
import { checkSteps, type CheckSelection } from './check.ts';
import { runGit, type BaseInfo, type Git } from './check-changes.ts';
import { fastRunnable, ruleHits, selectSuiteReasons, type Reason } from './check-selection.ts';
import { loadDurations, loadGateRules, loadToolkit, loadWorkflows, workflowTrigger, type GateDef, type GateRules, type SuiteDef, type SuiteManifest, type Toolkit, type TriggerResult, type Workflow } from './gate-sources.ts';

interface Why { kind: Reason['kind'] | 'change-type'; detail: string; paths: string[]; count: number }
interface PlanCi { workflow: string; runs: boolean; event: string; via: TriggerResult['via'] | 'unknown-workflow'; path?: string }
interface PlanGate {
  id: string; label: string; command: string; kind: 'check' | 'suite' | 'script' | 'verify'; required: boolean; viaCheck: boolean;
  why: Why[]; estimateSeconds: number | null; prerequisites: string[]; needs: string[]; ci: PlanCi[]; steps?: unknown[];
  /** Suite gates: the test-pyramid levels of the suite's files (its `level`, then any override levels). */
  levels?: string[];
}
interface Sources { rules: GateRules; toolkit: Toolkit; manifest: SuiteManifest | null; workflows: Workflow[]; durations: Record<string, number>; scripts: Set<string> }
const sample = 5;
const mergeWhy = (list: Why[], extra: Why): Why[] => [...list, extra];
function needsOf(names: string[]): string[] {
  const needs = new Set<string>();
  for (const name of names) {
    if (/chromium|playwright|browser/.test(name)) needs.add('browser');
    else if (/native/.test(name)) needs.add('native');
    else if (/python/.test(name)) needs.add('python');
    else needs.add(name);
  }
  return [...needs].sort();
}
function ciFor(sources: Sources, stems: string[], paths: string[]): PlanCi[] {
  return stems.map(stem => {
    const workflow = sources.workflows.find(item => item.stem === stem);
    if (!workflow) return { workflow: stem, runs: false, event: 'none', via: 'unknown-workflow' };
    const trigger = workflowTrigger(sources.toolkit, workflow, paths);
    return { workflow: stem, runs: trigger.runs, event: trigger.event, via: trigger.via, ...(trigger.path ? { path: trigger.path } : {}) };
  });
}
function baseFlag(base: BaseInfo | null): string { return base?.source === 'option' ? ` --base ${base.ref}` : ''; }
function scriptGate(id: string, def: GateDef, base: BaseInfo | null, why: Why[], sources: Sources, paths: string[]): PlanGate {
  const command = def.command.join(' ') + (def.kind === 'check' ? baseFlag(base) : '');
  return { id, label: def.label, command, kind: def.kind, required: true, viaCheck: false, why, estimateSeconds: null,
    prerequisites: def.prerequisites, needs: needsOf(def.prerequisites), ci: ciFor(sources, def.workflows, paths) };
}
function ruleWhy(hit: { rule: { id: string; paths: string[] }; paths: string[] }): Why {
  return { kind: 'change-type', detail: `rule ${hit.rule.id}: ${hit.rule.paths.join(', ')}`, paths: hit.paths.slice(0, sample), count: hit.paths.length };
}
/** Gates demanded by change-type rules, with `check` first whenever anything but documentation changed. */
function ruleGates(sources: Sources, paths: string[], hits: ReturnType<typeof ruleHits>): Map<string, Why[]> {
  const gates = new Map<string, Why[]>();
  for (const hit of hits) for (const id of hit.rule.gates) gates.set(id, mergeWhy(gates.get(id) ?? [], ruleWhy(hit)));
  if (paths.length && !gates.has('check')) gates.set('check', [{ kind: 'change-type', detail: 'any non-documentation change', paths: paths.slice(0, sample), count: paths.length }]);
  const ordered = [...gates].sort(([a], [b]) => Number(b === 'check') - Number(a === 'check'));
  return new Map(ordered.filter(([id]) => sources.rules.gates[id]));
}
function suiteGate(sources: Sources, suite: SuiteDef, reasons: Reason[], paths: string[]): PlanGate {
  const direct = reasons.some(reason => reason.kind !== 'workflow-paths');
  const prerequisites = suite.prerequisites ?? [];
  const covered = direct && (fastRunnable(suite) || suite.runner.type === 'vitest');
  const levels = [...new Set([suite.level, ...Object.keys(suite.levels ?? {})].filter((level): level is string => typeof level === 'string'))];
  return { id: `suite:${suite.name}`, label: `Suite ${suite.name}`, command: `node tooling/testing/suites.mjs ${suite.name}`, kind: 'suite', required: direct, viaCheck: covered, levels,
    why: reasons.map(reason => ({ kind: reason.kind, detail: reason.detail, paths: reason.paths, count: reason.count })),
    estimateSeconds: sources.durations[suite.name] ?? null, prerequisites, needs: needsOf(prerequisites), ci: ciFor(sources, suite.workflows ?? [], paths) };
}
function collectNotes(hits: ReturnType<typeof ruleHits>) {
  const notes: string[] = [], flags: Array<{ code: string; message: string; paths: string[] }> = [];
  for (const { rule, paths } of hits) {
    for (const note of rule.notes) notes.push(note);
    for (const flag of rule.flags) flags.push({ ...flag, paths: paths.slice(0, sample) });
  }
  return { notes, flags };
}
function docsOnlyGates(sources: Sources, base: BaseInfo | null, paths: string[]): PlanGate[] {
  const why: Why = { kind: 'change-type', detail: 'documentation-only diff', paths: paths.slice(0, sample), count: paths.length };
  return sources.rules.docsOnly.gates.filter(id => { const need = sources.rules.gates[id]?.requiresScript; return !need || sources.scripts.has(need); })
    .map(id => scriptGate(id, sources.rules.gates[id]!, base, [why], sources, paths));
}
function finalGates(sources: Sources, base: BaseInfo | null, paths: string[]): PlanGate[] {
  const why: Why = { kind: 'change-type', detail: 'always: the pre-PR full gate', paths: [], count: 0 };
  return sources.rules.final.map(id => scriptGate(id, sources.rules.gates[id]!, base, [why], sources, paths));
}
function codeGates(sources: Sources, selection: CheckSelection, hits: ReturnType<typeof ruleHits>, paths: string[]): PlanGate[] {
  const base = selection.changes?.base ?? null;
  const gates = [...ruleGates(sources, paths, hits)].map(([id, why]) => scriptGate(id, sources.rules.gates[id]!, base, why, sources, paths));
  const check = gates.find(gate => gate.id === 'check');
  if (check) check.steps = selection.steps.map(step => ({ id: step.id, command: step.display, ...(step.skip ? { status: 'skipped', reason: step.skip } : {}) }));
  const manifest = sources.manifest;
  if (!manifest) return gates;
  const chosen = selectSuiteReasons(sources.toolkit, manifest, sources.rules, paths, sources.workflows);
  for (const [name, reasons] of chosen) {
    const suite = manifest.suites.find(item => item.name === name);
    if (suite) gates.push(suiteGate(sources, suite, reasons, paths));
  }
  return gates;
}
async function readScripts(root: string): Promise<Set<string>> {
  try {
    const parsed = await readJson(join(root, 'package.json'));
    const scripts = typeof parsed === 'object' && parsed !== null && 'scripts' in parsed ? parsed.scripts : null;
    return new Set(typeof scripts === 'object' && scripts !== null ? Object.keys(scripts) : []);
  } catch { return new Set(); }
}
async function loadSources(root: string): Promise<Sources | null> {
  const toolkit = await loadToolkit(root), rules = await loadGateRules(root);
  if (!toolkit || !rules) return null;
  const manifest = await toolkit.manifest().catch(() => null);
  return { rules, toolkit, manifest, workflows: await loadWorkflows(root), durations: await loadDurations(root), scripts: await readScripts(root) };
}
function estimate(gates: PlanGate[]) {
  const needed = gates.filter(gate => gate.required && gate.kind === 'suite');
  const seconds = needed.reduce((sum, gate) => sum + (gate.estimateSeconds ?? 0), 0);
  return { seconds, complete: needed.every(gate => gate.estimateSeconds !== null), scope: 'required suites with a measured duration; other gates are not measured' };
}
function workflowSummary(sources: Sources | null, paths: string[]) {
  if (!sources) return [];
  return sources.workflows.map(workflow => ({ workflow: workflow.stem, name: workflow.name, ...workflowTrigger(sources.toolkit, workflow, paths) })).filter(item => item.runs);
}
function unavailablePlan(selection: CheckSelection): Result {
  const reason = selection.changes?.reason ?? 'git is unavailable';
  const gates = [{ id: 'check', label: 'Full agent gate', command: 'node bin/app check', kind: 'check', required: true, viaCheck: false, why: [{ kind: 'change-type', detail: reason, paths: [], count: 0 }],
    estimateSeconds: null, prerequisites: [], needs: [], ci: [], steps: selection.steps.map(step => ({ id: step.id, command: step.display })) }];
  const outcome = result('check', { gate: 'check', mode: 'plan', scope: selection.scope, verify: 'not-run', execution: 'not-run', base: null, changes: { source: 'unavailable', reason }, classification: [], gates, notes: [reason], flags: [], workflows: [], estimate: { seconds: 0, complete: false, scope: 'unknown' }, next: 'node bin/app check' }, 'planned');
  outcome.diagnostics.push({ code: 'GIT_UNAVAILABLE', message: reason, severity: 'warning' });
  return outcome;
}
/** A generated project has no shell rules: its plan is the fast check and its own verify. */
function projectGates(selection: CheckSelection): PlanGate[] {
  const why: Why = { kind: 'change-type', detail: 'generated project: shell gate rules do not apply', paths: [], count: 0 };
  const steps = selection.steps.map(step => ({ id: step.id, command: step.display, ...(step.skip ? { status: 'skipped', reason: step.skip } : {}) }));
  return [
    { id: 'check', label: 'Agent gate', command: 'node bin/app check --fast', kind: 'check', required: true, viaCheck: false, why: [why], estimateSeconds: null, prerequisites: [], needs: [], ci: [], steps },
    { id: 'verify', label: 'Generated-project full gate', command: 'npm run verify:project', kind: 'verify', required: true, viaCheck: false, why: [{ ...why, detail: 'always: the pre-PR full gate' }], estimateSeconds: null, prerequisites: [], needs: [], ci: [] },
  ];
}
function shellGates(sources: Sources, selection: CheckSelection, hits: ReturnType<typeof ruleHits>, docsOnly: boolean): PlanGate[] {
  const paths = selection.changes?.paths ?? [], base = selection.changes?.base ?? null;
  const gates = docsOnly ? docsOnlyGates(sources, base, paths) : codeGates(sources, selection, hits, paths);
  return [...gates, ...finalGates(sources, base, paths)];
}
function isDocsOnly(sources: Sources | null, paths: string[]): boolean {
  if (!sources || !paths.length) return false;
  const docs = sources.toolkit.glob(sources.rules.docsGlobs);
  return paths.every(path => docs(path));
}
function changeSummary(changes: NonNullable<CheckSelection['changes']>) {
  return { source: changes.source, files: changes.files.length, paths: changes.paths.length, sample: changes.paths.slice(0, 20), ...(changes.reason ? { reason: changes.reason } : {}) };
}
function planNotes(sources: Sources | null, hits: ReturnType<typeof ruleHits>, docsOnly: boolean) {
  const { notes, flags } = collectNotes(docsOnly ? [] : hits);
  if (docsOnly && sources) notes.push(sources.rules.docsOnly.note);
  return { notes, flags };
}
async function buildPlan(root: string, selection: CheckSelection): Promise<Result> {
  const changes = selection.changes;
  if (!changes || changes.source !== 'git') return unavailablePlan(selection);
  const sources = selection.scope === 'generated-project' ? null : await loadSources(root);
  const paths = changes.paths, hits = sources ? ruleHits(sources.toolkit, sources.rules, paths) : [];
  const docsOnly = isDocsOnly(sources, paths);
  const gates = sources ? shellGates(sources, selection, hits, docsOnly) : projectGates(selection);
  const classification = docsOnly ? ['docs-only'] : hits.map(hit => hit.rule.id);
  return result('check', { gate: 'check', mode: 'plan', scope: selection.scope, verify: 'not-run', execution: 'not-run', base: changes.base, changes: changeSummary(changes),
    classification, gates, ...planNotes(sources, hits, docsOnly), workflows: workflowSummary(sources, paths), estimate: estimate(gates), next: gates.at(-1)?.command ?? 'npm run verify' }, 'planned');
}
export async function checkPlanOperation(request: Request, context: Context, git: Git = runGit): Promise<Result> {
  if (request.options.fast === true) throw new OperationError('INVALID_OPTION', '--plan computes the gates for the diff and cannot be combined with --fast.', 'node bin/app check --plan');
  const selection = await checkSteps(context.root, true, git, stringOption(request.options, 'base'));
  return buildPlan(context.root, selection);
}
