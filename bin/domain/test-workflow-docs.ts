import { collectionTableText } from './collection-register.ts';
import { describeTestWorkflowLocator } from './test-workflow-locator.ts';
import { describeTestWorkflowTarget, type TestWorkflowTarget } from './test-workflow-target.ts';
import type { TestWorkflowDefinition, TestWorkflowStep } from './test-workflow.ts';
/** Deterministic Markdown and frontmatter for a workflow's documentation note; the adapter owns markers and files. */
export interface TestWorkflowDataRow { reference: string; source: string; value: string }
/** A recorded run belongs to one exact definition (the SHA-256 of its canonical JSON). */
export interface TestWorkflowRunRecord { result: 'passed' | 'failed'; at: string; summary: string; definition: string; screenshots?: string[] }
const testWorkflowNoteType = 'TestWorkflow';
const quoted = (value: string) => `"${value}"`;
const loc = (step: TestWorkflowStep) => step.target ? describeTestWorkflowLocator(step.target) : 'the page';
const matchWord = (step: TestWorkflowStep, exact: string, contains: string) => (step.match ?? (step.kind === 'expectText' ? 'contains' : 'exact')) === 'exact' ? exact : contains;
type Describe = (step: TestWorkflowStep) => string;
/** `Screenshot "checkout" (full page), masking 1 element: caption` — evidence for review, never an assertion. */
function screenshotText(step: TestWorkflowStep): string {
  const scope = step.target ? ` of ${loc(step)}` : step.fullPage ? ' (full page)' : ' (viewport)';
  const masked = step.mask?.length ? `, masking ${step.mask.length} element${step.mask.length === 1 ? '' : 's'}` : '';
  return `Screenshot ${quoted(step.name!)}${scope}${masked}${step.caption ? `: ${step.caption}` : ''}`;
}
const describers: Readonly<Record<TestWorkflowStep['kind'], Describe>> = {
  goto: step => `Visit ${step.path!}`, click: step => `Click ${loc(step)}`, fill: step => `Fill ${loc(step)} with ${quoted(step.value!)}`,
  select: step => `Select ${quoted(step.value!)} in ${loc(step)}`, check: step => `Check ${loc(step)}`, uncheck: step => `Uncheck ${loc(step)}`,
  press: step => `Press ${step.key!}${step.target ? ` in ${loc(step)}` : ''}`, waitFor: step => `Wait until ${loc(step)} is ${step.state ?? 'visible'}`,
  expectVisible: step => `Expect ${loc(step)} to be visible`, expectHidden: step => `Expect ${loc(step)} to be hidden`,
  expectText: step => `Expect ${loc(step)} to ${matchWord(step, 'have text', 'contain text')} ${quoted(step.text!)}`,
  expectUrl: step => `Expect the URL ${matchWord(step, 'to be', 'to contain')} ${step.path!}`,
  expectTitle: step => `Expect the page title ${matchWord(step, 'to be', 'to contain')} ${quoted(step.text!)}`,
  expectCount: step => `Expect ${step.count!} × ${loc(step)}`, expectValue: step => `Expect ${loc(step)} to have value ${quoted(step.value!)}`,
  screenshot: screenshotText,
};
/** One line per step, such as `Click button "Save"`; templates stay visible as written. */
export function describeTestWorkflowStep(step: TestWorkflowStep): string {
  return describers[step.kind](step);
}
const isTestWorkflowAssertion = (step: TestWorkflowStep) => step.kind.startsWith('expect');
/** Plain Markdown text: characters that would start links, emphasis, code, HTML or tables are escaped. */
const markdown = (value: string) => value.replace(/[\\`*_[\]<>#|]/g, '\\$&');
const code = (value: string) => '`' + value.replace(/`/g, "'") + '`';
const targetHelp: Readonly<Record<TestWorkflowTarget['kind'], string>> = {
  static: 'A project folder with index.html, served read-only by `node bin/app workflow run` on an ephemeral 127.0.0.1 port.',
  prototype: 'A prepared prototype package; the run serves the built artifact named by its prototype.manifest.json on 127.0.0.1 and reports not-run until it is built.',
  url: 'An app you already serve on loopback (for example a generated project\'s npm start preview); the run never starts it and blocks every other origin.',
};
function stepLine(step: TestWorkflowStep, index: number): string {
  const extras = [step.id ? `(id ${code(step.id)})` : '', step.note ? `— ${markdown(step.note)}` : ''].filter(Boolean).join(' ');
  return `${index + 1}. ${markdown(describeTestWorkflowStep(step))}${extras ? ' ' + extras : ''}`;
}
function dataSection(rows: readonly TestWorkflowDataRow[]): string[] {
  if (!rows.length) return ['## Test data', '', 'No test data: every value is written in the steps.', ''];
  return ['## Test data', '', '| Reference | Source | Value |', '| --- | --- | --- |',
    ...rows.map(row => `| ${code(row.reference)} | ${collectionTableText(row.source)} | ${collectionTableText(row.value) || '—'} |`), ''];
}
function runSection(definition: TestWorkflowDefinition, run: TestWorkflowRunRecord | undefined): string[] {
  const how = `Run ${code(`node bin/app workflow run --name ${definition.id} --json`)}, then record it with ${code(`node bin/app workflow record --name ${definition.id} --json`)}.`;
  if (!run) return ['## Last recorded run', '', `No run recorded for this version of the workflow. ${how}`, ''];
  const shots = (run.screenshots ?? []).map(path => `- ${code(path)}`);
  return ['## Last recorded run', '', `${run.result === 'passed' ? 'Passed' : 'Failed'} at ${run.at}: ${markdown(run.summary)}`, '',
    ...shots.length ? ['Screenshots of that run (local report files, not committed):', '', ...shots, ''] : [], how, ''];
}
function screenshotSection(definition: TestWorkflowDefinition): string[] {
  const shots = definition.steps.flatMap((step, index) => step.kind === 'screenshot' ? [`- Step ${index + 1}: ${markdown(describeTestWorkflowStep(step))}`] : []);
  return shots.length ? ['## Screenshots', '', 'Captured for human review in each run report; never compared with a baseline.', '', ...shots, ''] : [];
}
/** The generated block: overview, target, numbered steps, assertions, screenshots, resolved test data and the last recorded run. */
export function renderTestWorkflowDocs(definition: TestWorkflowDefinition, rows: readonly TestWorkflowDataRow[], run?: TestWorkflowRunRecord): string {
  const assertions = definition.steps.flatMap((step, index) => isTestWorkflowAssertion(step) ? [`- Step ${index + 1}: ${markdown(describeTestWorkflowStep(step))}`] : []);
  const lines = [`# ${markdown(definition.title)}`, '',
    `> Test workflow ${code(definition.id)} · ${definition.status} · viewport ${definition.viewport.width}×${definition.viewport.height} · step timeout ${definition.timeoutMs} ms`, '',
    '## Purpose', '', definition.purpose, '', '## Target', '', `${code(describeTestWorkflowTarget(definition.target))}: ${targetHelp[definition.target.kind]}`, '',
    '## Steps', '', ...definition.steps.map(stepLine), '', '## Assertions', '', ...assertions.length ? assertions : ['No assertions: this workflow only checks that every step can be performed.'], '',
    ...screenshotSection(definition), ...dataSection(rows), ...runSection(definition, run),
    `Generated from ${code(`configs/tests/workflows/${definition.id}.json`)} by ${code(`node bin/app workflow docs --name ${definition.id}`)}. Edit the definition, not this block.`];
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Machine-owned note properties; the recorded run is carried forward while the definition is unchanged. */
export function testWorkflowFrontmatter(definition: TestWorkflowDefinition, run?: TestWorkflowRunRecord): Record<string, string | string[]> {
  const recorded = run ? { lastRun: run.result, lastRunAt: run.at, lastRunSummary: run.summary, lastRunDefinition: run.definition, ...run.screenshots?.length ? { lastRunScreenshots: run.screenshots } : {} } : {};
  return { type: testWorkflowNoteType, id: definition.id, title: definition.title, target: describeTestWorkflowTarget(definition.target), status: definition.status, ...recorded };
}
