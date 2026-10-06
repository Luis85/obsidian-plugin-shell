/**
 * End-to-end opt-in policy (owner-requested): every step that drives a real browser or a real Obsidian host, and the
 * provisioning that exists only for it, runs in the Integration tier only when a run opts in, and always in the Release
 * tier. The classification below is the single list the workflows, docs/development/WORKFLOWS.md and the negative
 * fixtures in tests/tooling/qualification-e2e-opt-in.checks.mjs follow. Conditions are settled with the same
 * three-valued evaluator `node bin/app ci` uses, so "cannot be decided" fails closed like "wrong".
 */
import { evaluateCondition } from '../../src/cli/domain/ci-expression.ts';

/** The one opt-in signal, written the same way in every workflow: the Release tier, a dispatch/call input or the label. */
export const e2eOptIn = "inputs.tier == 'release' || inputs.e2e == true || contains(github.event.pull_request.labels.*.name, 'e2e')";
/** Commands that are end-to-end. `unless` names the flag that keeps a mixed qualifier to its non-browser part. */
const e2eCommands = Object.freeze([
  { kind: 'served UI in Chromium (Playwright)', pattern: /\brun test:e2e\b|\btest:ui-quality\b/ },
  { kind: 'UI review gallery', pattern: /\bui:gallery\b/ },
  { kind: 'real Obsidian host', pattern: /\btest:obsidian\b|scripts\/dev\/obsidian-dev\.mjs|check-native\.mjs|evidence-cli\.mjs run native\b|obsidian-launcher@/ },
  { kind: 'served browser evidence', pattern: /evidence-cli\.mjs run browser\b/ },
  { kind: 'browser suite', pattern: /\.browser\.(?:mjs|py)\b|run-browser-checks\.py|tests\/browser\.test\.py|qualify-styles\.mjs|check-browser-specimen\.mjs/ },
  { kind: 'browser provisioning', pattern: /@playwright\/test\/cli\.js install|-m playwright install|pip install [^\n]*\bplaywright==/ },
  { kind: 'browser acceptance of generated output', pattern: /airship\/qualify\.mjs/ },
  { kind: 'browser acceptance of generated output', pattern: /qualify-angular-setup\.mjs|qualify:compiler\b|qualify-storybook\.mjs|qualify-project-starters\.mjs[^\n]*--execute/, unless: '--no-browser' },
  { kind: 'cloud-session handoff with e2e', pattern: /qualify-project-handoff\.mjs/, unless: '--skip-e2e' },
]);
const setupAction = './.github/actions/setup-qualified';
const valueGate = /^\$\{\{\s*([\s\S]+?)\s*&&\s*'[^']*'\s*\|\|\s*''\s*\}\}$/;
const choice = /^\$\{\{\s*([\s\S]+?)\s*&&\s*'([^']*)'\s*\|\|\s*'([^']*)'\s*\}\}$/;
const strip = condition => { const text = String(condition).trim(), match = /^\$\{\{([\s\S]*)\}\}$/.exec(text); return (match ? match[1] : text).trim(); };

/** The e2e command kinds a run text holds, line by line, so a `--no-browser` on one line never excuses another. */
export function e2eKinds(run) {
  const kinds = new Set();
  for (const line of String(run ?? '').split('\n'))
    for (const entry of e2eCommands) if (entry.pattern.test(line) && !(entry.unless && line.includes(entry.unless))) kinds.add(entry.kind);
  return [...kinds];
}
/** Kinds plus the extra gate a `setup-qualified` Chromium input carries (`${{ <gate> && 'with-deps' || '' }}`). */
function classifyStep(step) {
  const kinds = e2eKinds(step.run);
  const browser = step.uses === setupAction ? step.with?.playwright : undefined;
  if (browser === undefined || browser === '') return { kinds, gates: [] };
  const gate = valueGate.exec(String(browser).trim());
  return { kinds: [...kinds, 'browser provisioning'], gates: [gate ? gate[1] : 'true'] };
}
/** GitHub evaluates an absent event or input field as null (here ''); runner and matrix values outside a scenario stay unknown. */
function scenario(values) {
  return path => Object.hasOwn(values, path) ? values[path] : /^(?:github|inputs)\./.test(path) ? '' : undefined;
}
const linux = { 'runner.os': 'Linux' };
const ready = { ...linux, 'github.event_name': 'pull_request', 'github.event.action': 'synchronize', 'github.event.pull_request.draft': 'false', 'github.head_ref': 'feature/x' };
export const e2eScenarios = Object.freeze({
  release: scenario({ ...linux, 'inputs.tier': 'release', 'github.event_name': 'push', 'github.ref': 'refs/heads/release/1.2.3' }),
  readyPullRequest: scenario(ready),
  pushToMain: scenario({ ...linux, 'github.event_name': 'push', 'github.ref': 'refs/heads/main' }),
  labelledPullRequest: scenario({ ...ready, 'github.event.pull_request.labels.*.name': 'e2e' }),
  dispatchWithoutE2e: scenario({ ...linux, 'github.event_name': 'workflow_dispatch', 'inputs.tier': 'integration', 'inputs.e2e': 'false' }),
  dispatchWithE2e: scenario({ ...linux, 'github.event_name': 'workflow_dispatch', 'inputs.tier': 'integration', 'inputs.e2e': 'true' }),
  e2eLabelAdded: scenario({ ...ready, 'github.event.action': 'labeled', 'github.event.label.name': 'e2e', 'github.event.pull_request.labels.*.name': 'e2e' }),
  otherLabelAdded: scenario({ ...ready, 'github.event.action': 'labeled', 'github.event.label.name': 'bug', 'github.event.pull_request.labels.*.name': 'e2e' }),
});
/** `true`, `false` or `undefined` (not decidable) for every present condition joined with `&&`. */
export function gateValue(conditions, lookup) {
  const present = conditions.filter(condition => condition !== undefined && condition !== null && String(condition).trim() !== '');
  if (!present.length) return true;
  return evaluateCondition(present.map(condition => `(${strip(condition)})`).join(' && '), { lookup, success: true });
}
/** A job's check name in a scenario: literal, or `${{ <condition> && 'a' || 'b' }}`; anything else is undecidable. */
export function checkName(job, lookup) {
  const name = String(job.name ?? ''), match = choice.exec(name.trim());
  if (!match) return name.includes('${{') ? undefined : name;
  const value = evaluateCondition(match[1], { lookup, success: true });
  return value === undefined ? undefined : value ? match[2] : match[3];
}
const triggerMap = on => typeof on === 'string' ? { [on]: null } : Array.isArray(on) ? Object.fromEntries(on.map(name => [name, null])) : on ?? {};

/**
 * Throws a WORKFLOW_E2E_* / WORKFLOW_LABEL_* code. Returns whether the workflow holds e2e work, its call tier default and
 * every e2e step (job id, step name, kinds) for reports.
 */
export function inspectE2eWorkflow(data) {
  const on = triggerMap(data.on), pullRequest = Object.hasOwn(on, 'pull_request'), steps = new Map(), ids = new Map();
  for (const [id, job] of Object.entries(data.jobs).filter(([, job]) => job && !job.uses)) {
    ids.set(job, id);
    steps.set(job, (job.steps ?? []).map(step => ({ step, ...classifyStep(step) })).filter(entry => entry.kinds.length));
  }
  const e2e = [...steps.values()].some(list => list.length);
  if (e2e) {
    for (const trigger of ['workflow_call', 'workflow_dispatch'].filter(name => Object.hasOwn(on, name)))
      if (on[trigger]?.inputs?.e2e?.type !== 'boolean') throw new Error(`WORKFLOW_E2E_INPUT_MISSING: ${trigger} needs a boolean e2e input`);
    if (pullRequest && !(on.pull_request?.types ?? []).includes('labeled')) throw new Error('WORKFLOW_E2E_LABEL_TRIGGER_MISSING: adding the e2e label must start the e2e run');
  }
  const optedIn = pullRequest ? e2eScenarios.labelledPullRequest : e2eScenarios.dispatchWithE2e;
  for (const [job, list] of steps) for (const { step, gates } of list) {
    const conditions = [job.if, step.if, ...gates], name = `${ids.get(job)}: ${step.name ?? step.run ?? step.uses}`;
    if (gateValue(conditions, e2eScenarios.release) !== true) throw new Error(`WORKFLOW_E2E_NOT_RELEASE_MANDATORY: ${name}`);
    for (const lookup of [e2eScenarios.readyPullRequest, e2eScenarios.pushToMain, e2eScenarios.dispatchWithoutE2e])
      if (gateValue(conditions, lookup) !== false) throw new Error(`WORKFLOW_E2E_NOT_OPT_IN: ${name}`);
    if (gateValue(conditions, optedIn) !== true) throw new Error(`WORKFLOW_E2E_OPT_IN_IGNORED: ${name}`);
  }
  // Label runs of a workflow without e2e work (the Definition of Done re-reads labels) are that workflow's own business.
  if (e2e && pullRequest && (on.pull_request?.types ?? []).includes('labeled')) {
    if (!/github\.event\.label\.name/.test(String(data.concurrency?.group ?? data.concurrency ?? ''))) throw new Error('WORKFLOW_LABEL_CANCELS_RUN: a label event must not share the concurrency group of a full run');
    for (const [job, list] of steps) {
      if (gateValue([job.if], e2eScenarios.otherLabelAdded) !== false) throw new Error(`WORKFLOW_LABEL_RERUNS_GATES: another label reruns ${ids.get(job)}`);
      if (list.length || gateValue([job.if], e2eScenarios.e2eLabelAdded) === false) continue;
      // Only an aggregator may run on the label, and under another check name: it must never stand in for the full run's check.
      const named = checkName(job, e2eScenarios.e2eLabelAdded);
      if (!job.needs || named === undefined || named === checkName(job, e2eScenarios.readyPullRequest)) throw new Error(`WORKFLOW_LABEL_RERUNS_GATES: the e2e label reruns ${ids.get(job)}, which has no e2e steps`);
    }
  }
  const report = [...steps].flatMap(([job, list]) => list.map(({ step, kinds }) => ({ job: ids.get(job), step: step.name ?? step.uses ?? 'run', kinds })));
  return { e2e, callTierDefault: on.workflow_call?.inputs?.tier?.default, steps: report };
}
/** Release reachability: every workflow with e2e work is called by release.yml with an effective tier of release. */
export function releaseE2eFailures(e2eWorkflows, releaseCalls) {
  return e2eWorkflows.filter(({ file, callTierDefault }) => !releaseCalls.some(call => call.workflow === file && (call.tier ?? callTierDefault) === 'release'))
    .map(({ file }) => `${file}: WORKFLOW_E2E_RELEASE_CALL_MISSING: release.yml must call it with tier release`);
}
