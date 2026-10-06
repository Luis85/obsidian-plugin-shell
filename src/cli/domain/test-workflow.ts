import { keys, list, object, text } from './data.ts';
import { hasControls, requireSketch } from '#shared/contracts/sketch-errors.ts';
import { definitionId } from './form-model.ts';
import { readTestWorkflowLocator, testWorkflowText, type TestWorkflowLocator } from './test-workflow-locator.ts';
import { readTestWorkflowData, type TestWorkflowData } from './test-workflow-data.ts';
import { readTestWorkflowTarget, type TestWorkflowTarget } from './test-workflow-target.ts';
/** A browser test workflow is data: where the app is, which test data it uses and ordered steps with assertions. */
export type TestWorkflowStatus = 'draft' | 'active' | 'retired';
export type TestWorkflowStepKind = 'goto' | 'click' | 'fill' | 'select' | 'check' | 'uncheck' | 'press' | 'waitFor'
  | 'expectVisible' | 'expectHidden' | 'expectText' | 'expectUrl' | 'expectTitle' | 'expectCount' | 'expectValue' | 'screenshot';
export type TestWorkflowWaitState = 'visible' | 'hidden' | 'attached' | 'detached';
export type TestWorkflowMatch = 'exact' | 'contains';
export interface TestWorkflowStep {
  kind: TestWorkflowStepKind; id?: string; note?: string; timeoutMs?: number; target?: TestWorkflowLocator;
  path?: string; value?: string; text?: string; key?: string; count?: number; state?: TestWorkflowWaitState; match?: TestWorkflowMatch;
  /** Screenshot steps: a unique kebab-case file name, full-page capture, elements to mask and a caption for reviewers. */
  name?: string; fullPage?: boolean; mask?: TestWorkflowLocator[]; caption?: string;
}
export interface TestWorkflowViewport { width: number; height: number }
export interface TestWorkflowDefinition {
  schemaVersion: 1; id: string; title: string; purpose: string; status: TestWorkflowStatus; target: TestWorkflowTarget;
  viewport: TestWorkflowViewport; timeoutMs: number; data?: TestWorkflowData; steps: TestWorkflowStep[];
}
type Operand = 'path' | 'value' | 'text' | 'key' | 'count' | 'state' | 'match' | 'name' | 'fullPage' | 'mask' | 'caption';
interface StepShape { target: 'required' | 'optional' | 'none'; required: Operand[]; optional: Operand[] }
const shape = (target: StepShape['target'], required: Operand[] = [], optional: Operand[] = []): StepShape => ({ target, required, optional });
/** Which element and operands each step kind takes; anything else is an unknown field. */
export const testWorkflowStepShapes: Readonly<Record<TestWorkflowStepKind, StepShape>> = Object.freeze({
  goto: shape('none', ['path']), click: shape('required'), fill: shape('required', ['value']), select: shape('required', ['value']),
  check: shape('required'), uncheck: shape('required'), press: shape('optional', ['key']), waitFor: shape('required', [], ['state']),
  expectVisible: shape('required'), expectHidden: shape('required'), expectText: shape('required', ['text'], ['match']),
  expectUrl: shape('none', ['path'], ['match']), expectTitle: shape('none', ['text'], ['match']), expectCount: shape('required', ['count']),
  expectValue: shape('required', ['value']), screenshot: shape('optional', ['name'], ['fullPage', 'mask', 'caption']),
});
export const testWorkflowStepKinds: readonly TestWorkflowStepKind[] = ['goto', 'click', 'fill', 'select', 'check', 'uncheck', 'press', 'waitFor',
  'expectVisible', 'expectHidden', 'expectText', 'expectUrl', 'expectTitle', 'expectCount', 'expectValue', 'screenshot'];
const testWorkflowStatuses: readonly TestWorkflowStatus[] = ['draft', 'active', 'retired'];
export const testWorkflowLimits = Object.freeze({ steps: 200, timeoutMs: 60_000, minTimeoutMs: 100, defaultTimeoutMs: 5000, minViewport: 200, maxViewport: 4000, count: 1000, screenshots: 30, masks: 10 });
const testWorkflowDefaults = Object.freeze({ viewport: { width: 1280, height: 800 } });
/** Absolute, root-relative paths only: no scheme, host, backslash, whitespace, parent segment or control character. */
const pathPattern = /^\/(?!\/)[^\s\\]*$/;
const keyPattern = /^(?:(?:Control|Shift|Alt|Meta)\+){0,3}(?:[A-Za-z0-9]|Enter|Tab|Escape|Backspace|Delete|Space|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right)|F(?:[1-9]|1[0-2]))$/;
function choice<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  const found = allowed.find(item => item === value);
  requireSketch(found, 'WORKFLOW_FIELD', `${name} must be one of ${allowed.join(', ')}.`);
  return found;
}
function wholeNumber(value: unknown, name: string, min: number, max: number): number {
  requireSketch(Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max, 'WORKFLOW_FIELD', `${name} must be a whole number from ${min} to ${max}.`);
  return Number(value);
}
function readTestWorkflowPath(value: unknown, name: string): string {
  const path = testWorkflowText(value, name, 500);
  requireSketch(pathPattern.test(path) && !path.split(/[/?#]/).includes('..') && !path.includes('{{'), 'WORKFLOW_PATH', `${name} must be a root-relative path such as / or /checkout.html#done, without a host, .. or templates.`);
  return path;
}
function screenshotName(value: unknown, name: string): string {
  const id = text(value, name, 60);
  requireSketch(definitionId.test(id), 'WORKFLOW_SCREENSHOT', `${name} must be a lowercase kebab-case name; it becomes <name>.png.`);
  return id;
}
function flag(value: unknown, name: string): boolean {
  requireSketch(typeof value === 'boolean', 'WORKFLOW_FIELD', `${name} must be true or false.`);
  return value;
}
const masks = (value: unknown, name: string) => list(value, name, testWorkflowLimits.masks).map((item, index) => readTestWorkflowLocator(item, `${name}[${index}]`));
const operandReaders: Readonly<Record<Operand, (value: unknown, name: string) => unknown>> = {
  name: screenshotName, fullPage: flag, mask: masks, caption: (value, name) => testWorkflowText(value, name, 300),
  path: readTestWorkflowPath, value: (value, name) => testWorkflowText(value, name, 1000, true), text: (value, name) => testWorkflowText(value, name, 1000),
  key: (value, name) => { requireSketch(typeof value === 'string' && keyPattern.test(value), 'WORKFLOW_KEY', `${name} must be a key such as Enter, Tab, Escape, ArrowDown, a, Control+a.`); return value; },
  count: (value, name) => wholeNumber(value, name, 0, testWorkflowLimits.count),
  state: (value, name) => choice(value, ['visible', 'hidden', 'attached', 'detached'], name), match: (value, name) => choice(value, ['exact', 'contains'], name),
};
function stepMeta(item: Record<string, unknown>, name: string, ids: Set<string>): Pick<TestWorkflowStep, 'id' | 'note' | 'timeoutMs'> {
  const id = item.id === undefined ? undefined : text(item.id, name + '.id', 80);
  requireSketch(id === undefined || (definitionId.test(id) && !ids.has(id)), 'WORKFLOW_STEP_ID', `${name}.id must be a unique lowercase kebab-case id.`);
  if (id) ids.add(id);
  const note = item.note === undefined ? undefined : testWorkflowText(item.note, name + '.note', 300);
  const timeoutMs = item.timeoutMs === undefined ? undefined : wholeNumber(item.timeoutMs, name + '.timeoutMs', testWorkflowLimits.minTimeoutMs, testWorkflowLimits.timeoutMs);
  return { ...id ? { id } : {}, ...note ? { note } : {}, ...timeoutMs ? { timeoutMs } : {} };
}
/** One step; `ids` collects step ids so duplicates are refused across the workflow. */
export function readTestWorkflowStep(value: unknown, index: number, ids: Set<string> = new Set()): TestWorkflowStep {
  const item = object(value), name = `steps[${index}]`;
  const kind = choice(item.kind, testWorkflowStepKinds, name + '.kind'), rule = testWorkflowStepShapes[kind];
  keys(item, ['kind', 'id', 'note', 'timeoutMs', ...rule.target === 'none' ? [] : ['target'], ...rule.required, ...rule.optional]);
  requireSketch(rule.target !== 'required' || item.target !== undefined, 'WORKFLOW_STEP', `${name} (${kind}) needs a target locator.`);
  const operands: Partial<TestWorkflowStep> = {};
  for (const operand of [...rule.required, ...rule.optional]) {
    requireSketch(item[operand] !== undefined || !rule.required.includes(operand), 'WORKFLOW_STEP', `${name} (${kind}) needs ${operand}.`);
    if (item[operand] !== undefined) Object.assign(operands, { [operand]: operandReaders[operand](item[operand], `${name}.${operand}`) });
  }
  requireSketch(!(operands.fullPage && item.target !== undefined), 'WORKFLOW_SCREENSHOT', `${name}: fullPage captures the page; omit it to capture the target element.`);
  return { kind, ...stepMeta(item, name, ids), ...item.target === undefined ? {} : { target: readTestWorkflowLocator(item.target, name + '.target') }, ...operands };
}
/** Screenshot names become file names, so they are unique and bounded per workflow. */
function requireScreenshotNames(steps: readonly TestWorkflowStep[]): void {
  const names = steps.flatMap(step => step.name === undefined ? [] : [step.name]);
  requireSketch(names.length <= testWorkflowLimits.screenshots, 'WORKFLOW_SCREENSHOT', `A workflow takes at most ${testWorkflowLimits.screenshots} screenshots.`);
  const duplicate = names.find((item, index) => names.indexOf(item) !== index);
  requireSketch(duplicate === undefined, 'WORKFLOW_SCREENSHOT', `Screenshot name ${duplicate ?? ''} is used twice; each becomes one file.`);
}
function readViewport(value: unknown): TestWorkflowViewport {
  if (value === undefined) return { ...testWorkflowDefaults.viewport };
  const item = object(value); keys(item, ['width', 'height']);
  const { minViewport: min, maxViewport: max } = testWorkflowLimits;
  return { width: wholeNumber(item.width, 'viewport.width', min, max), height: wholeNumber(item.height, 'viewport.height', min, max) };
}
function readSteps(value: unknown): TestWorkflowStep[] {
  const ids = new Set<string>(), steps = list(value, 'steps', testWorkflowLimits.steps).map((item, index) => readTestWorkflowStep(item, index, ids));
  requireSketch(steps.length > 0, 'WORKFLOW_STEPS', 'A workflow needs at least one step.');
  requireSketch(steps[0]!.kind === 'goto', 'WORKFLOW_STEPS', 'The first step must be goto, so every run starts from a known page.');
  requireScreenshotNames(steps);
  return steps;
}
/** Structural validation that fails closed: unknown keys, unsafe paths and URLs, control characters, unknown step kinds, empty workflows, bounds. */
export function readTestWorkflow(value: unknown): TestWorkflowDefinition {
  const item = object(value);
  keys(item, ['$schema', 'schemaVersion', 'id', 'title', 'purpose', 'status', 'target', 'viewport', 'timeoutMs', 'data', 'steps']);
  requireSketch(item.schemaVersion === 1, 'WORKFLOW_VERSION', 'Unsupported workflow schemaVersion; use 1.');
  const id = text(item.id, 'id', 80), title = text(item.title, 'title', 120);
  requireSketch(definitionId.test(id), 'WORKFLOW_ID', 'id must be a lowercase kebab-case id; it is also the file name.');
  requireSketch(!hasControls(title), 'WORKFLOW_FIELD', 'title must be single-line text.');
  const data = item.data === undefined ? undefined : readTestWorkflowData(item.data);
  return { schemaVersion: 1, id, title, purpose: text(item.purpose, 'purpose', 2000), status: choice(item.status, testWorkflowStatuses, 'status'),
    target: readTestWorkflowTarget(item.target, 'target'), viewport: readViewport(item.viewport),
    timeoutMs: item.timeoutMs === undefined ? testWorkflowLimits.defaultTimeoutMs : wholeNumber(item.timeoutMs, 'timeoutMs', testWorkflowLimits.minTimeoutMs, testWorkflowLimits.timeoutMs),
    ...data ? { data } : {}, steps: readSteps(item.steps) };
}
/** Canonical file text with the editor schema hint. */
export function testWorkflowJson(definition: TestWorkflowDefinition): string {
  return JSON.stringify({ $schema: '../../schemas/test-workflow.schema.json', ...definition }, null, 2) + '\n';
}
