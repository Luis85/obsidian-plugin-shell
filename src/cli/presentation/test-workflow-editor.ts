import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { getPath, type FormValues } from '../domain/form-model.ts';
import { readTestWorkflowStep, testWorkflowStepKinds, testWorkflowStepShapes, type TestWorkflowStep } from '../domain/test-workflow.ts';
import type { TestWorkflowData, TestWorkflowFakeSource, TestWorkflowValue, TestWorkflowValues } from '../domain/test-workflow-data.ts';
import { testWorkflowRoles, testWorkflowStrategy, type TestWorkflowLocator } from '../domain/test-workflow-locator.ts';
/**
 * Authoring views for the workflow forms. A locator is written as one short line, parent first:
 * `form "Sign up" > button "Create account"`, `label "Email" exact`, `testid "submit"`, `listitem #2`.
 * Test data is written as `path=value` and `alias=config:<id>#<index>` lines; screenshot masks are locator lines.
 * Unchanged lines keep the original JSON.
 */
const keywords: Readonly<Record<string, 'label' | 'placeholder' | 'text' | 'testId'>> = { label: 'label', placeholder: 'placeholder', text: 'text', testid: 'testId' };
const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const unquote = (value: string) => value.replace(/\\(.)/g, '$1');
function segmentLine(locator: TestWorkflowLocator): string {
  const strategy = testWorkflowStrategy(locator);
  const own = strategy === 'role' ? `${locator.role!}${locator.name === undefined ? '' : ' ' + quote(locator.name)}` : `${strategy === 'testId' ? 'testid' : strategy} ${quote(locator[strategy]!)}`;
  return `${own}${locator.exact ? ' exact' : ''}${locator.nth === undefined ? '' : ` #${locator.nth + 1}`}`;
}
export function testWorkflowLocatorLine(locator: TestWorkflowLocator): string {
  return (locator.within ? testWorkflowLocatorLine(locator.within) + ' > ' : '') + segmentLine(locator);
}
/** Splits on ` > ` outside quotes. */
function segments(line: string): string[] {
  const parts: string[] = [];
  let quoted = false, start = 0;
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '\\') index++;
    else if (line[index] === '"') quoted = !quoted;
    else if (!quoted && line.startsWith(' > ', index)) { parts.push(line.slice(start, index)); start = index + 3; }
  }
  return [...parts, line.slice(start)].map(part => part.trim());
}
const segmentPattern = /^([A-Za-z]+)(?:\s+"((?:[^"\\]|\\.)*)")?((?:\s+(?:exact|#\d{1,3}))*)$/;
function segmentStrategy(head: string, value: string | undefined, text: string): TestWorkflowLocator {
  const keyword = keywords[head.toLowerCase()];
  if (keyword) {
    requireSketch(value !== undefined, 'WORKFLOW_LOCATOR_LINE', `${text}: ${head} needs a quoted value.`);
    return { [keyword]: value };
  }
  requireSketch(testWorkflowRoles.includes(head), 'WORKFLOW_LOCATOR_LINE', `${text}: ${head} is not an ARIA role or locator keyword.`);
  return { role: head, ...value === undefined ? {} : { name: value } };
}
function segmentFlags(flags: string): Pick<TestWorkflowLocator, 'exact' | 'nth'> {
  const nth = /#(\d+)/.exec(flags)?.[1];
  return { ...flags.includes('exact') ? { exact: true } : {}, ...nth ? { nth: Number(nth) - 1 } : {} };
}
function parseSegment(text: string, within: TestWorkflowLocator | undefined): TestWorkflowLocator {
  const match = segmentPattern.exec(text);
  requireSketch(match, 'WORKFLOW_LOCATOR_LINE', `${text}: write an element as role "name", label "…", placeholder "…", text "…" or testid "…", optionally with exact and #2.`);
  const [, head, raw, flags] = match;
  return { ...segmentStrategy(head!, raw === undefined ? undefined : unquote(raw), text), ...segmentFlags(flags ?? ''), ...within ? { within } : {} };
}
export function parseTestWorkflowLocatorLine(line: string): TestWorkflowLocator {
  return segments(line).reduce<TestWorkflowLocator | undefined>((within, text) => parseSegment(text, within), undefined)!;
}
type Operand = 'path' | 'value' | 'text' | 'key' | 'count' | 'state' | 'name';
const inputOperands: readonly string[] = ['path', 'value', 'text', 'key', 'count', 'state', 'name'];
/** The one operand the generic Input field edits for a kind (the screenshot name for screenshot steps). */
const operandOf = (kind: TestWorkflowStep['kind']): Operand | undefined => {
  const shape = testWorkflowStepShapes[kind];
  return [...shape.required, ...shape.optional].find((item): item is Operand => inputOperands.includes(item));
};
const stepDefaults: FormValues = { kind: 'click', target: '', input: '', match: 'default', fullPage: false, maskLines: [], caption: '', note: '' };
export function testWorkflowStepView(step?: TestWorkflowStep): FormValues {
  if (!step) return structuredClone(stepDefaults);
  const operand = operandOf(step.kind), input = operand ? step[operand] : undefined;
  return { ...structuredClone(stepDefaults), kind: step.kind, target: step.target ? testWorkflowLocatorLine(step.target) : '', input: input === undefined ? '' : String(input),
    match: step.match ?? 'default', fullPage: step.fullPage === true, maskLines: (step.mask ?? []).map(testWorkflowLocatorLine), caption: step.caption ?? '', note: step.note ?? '' };
}
const textOf = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const linesOf = (value: unknown) => Array.isArray(value) ? value.map(textOf).filter(Boolean) : [];
function stepKind(view: FormValues): TestWorkflowStep['kind'] {
  const kind = testWorkflowStepKinds.find(item => item === textOf(view.kind));
  requireSketch(kind, 'WORKFLOW_STEP', `Unknown step kind ${textOf(view.kind)}.`);
  return kind;
}
function inputPart(kind: TestWorkflowStep['kind'], input: string): FormValues {
  const operand = operandOf(kind);
  if (!operand || (input === '' && operand !== 'value')) return {};
  return { [operand]: operand === 'count' ? Number(input) : input };
}
function screenshotPart(kind: TestWorkflowStep['kind'], view: FormValues): FormValues {
  if (kind !== 'screenshot') return {};
  const mask = linesOf(view.maskLines).map(parseTestWorkflowLocatorLine), caption = textOf(view.caption);
  return { ...view.fullPage === true ? { fullPage: true } : {}, ...mask.length ? { mask } : {}, ...caption ? { caption } : {} };
}
function keptPart(view: FormValues, previous: TestWorkflowStep | undefined): FormValues {
  const note = textOf(view.note);
  return { ...previous?.id ? { id: previous.id } : {}, ...previous?.timeoutMs ? { timeoutMs: previous.timeoutMs } : {}, ...note ? { note } : {} };
}
/** Builds the step from the view and validates it with the definition reader; id and timeout of the edited step are kept. */
export function testWorkflowStepFromView(view: FormValues, previous?: TestWorkflowStep): TestWorkflowStep {
  const kind = stepKind(view), shape = testWorkflowStepShapes[kind], target = textOf(view.target);
  const raw: FormValues = { kind, ...keptPart(view, previous), ...target && shape.target !== 'none' ? { target: parseTestWorkflowLocatorLine(target) } : {},
    ...inputPart(kind, typeof view.input === 'string' ? view.input : ''), ...shape.optional.includes('match') && view.match !== 'default' ? { match: view.match } : {},
    ...screenshotPart(kind, view) };
  return readTestWorkflowStep(raw, 0);
}
function valueLines(values: TestWorkflowValues, prefix = ''): string[] {
  return Object.entries(values).flatMap(([key, value]) => typeof value === 'object' ? valueLines(value, `${prefix}${key}.`) : [`${prefix}${key}=${String(value)}`]);
}
const sourceLine = (alias: string, source: TestWorkflowFakeSource) =>
  `${alias}=${source.config ? `config:${source.config}` : `entity:${source.entity!}${source.seed === undefined ? '' : `@${source.seed}`}`}#${source.index}`;
export function testWorkflowDataView(data?: TestWorkflowData): FormValues {
  return { valueLines: valueLines(data?.values ?? {}), fakeLines: Object.entries(data?.fakeData ?? {}).map(([alias, source]) => sourceLine(alias, source)) };
}
function setValue(target: TestWorkflowValues, path: string[], value: TestWorkflowValue): void {
  const [head, ...rest] = path;
  if (!rest.length) { target[head!] = value; return; }
  const next = target[head!], child: TestWorkflowValues = typeof next === 'object' ? next : {};
  target[head!] = child;
  setValue(child, rest, value);
}
function fakeSource(line: string): [string, TestWorkflowFakeSource] {
  const match = /^([A-Za-z][A-Za-z0-9]*)=(config|entity):([a-z0-9-]+)(?:@(\d{1,10}))?(?:#(\d{1,3}))?$/.exec(line);
  requireSketch(match && (match[2] === 'entity' || match[4] === undefined), 'WORKFLOW_DATA_LINE', `${line}: write alias=config:<id>#<index> or alias=entity:<id>@<seed>#<index>.`);
  const [, alias, kind, id, seed, index] = match;
  return [alias!, { [kind!]: id!, ...seed === undefined ? {} : { seed: Number(seed) }, index: Number(index ?? 0) }];
}
const isLeaf = (value: unknown): value is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof value);
/** One `path=value` line; an unchanged line keeps the original JSON type of its value (numbers, booleans). */
function valueLine(line: string, unchanged: boolean, original: TestWorkflowValues | undefined): [string[], TestWorkflowValue] {
  const at = line.indexOf('=');
  requireSketch(at > 0, 'WORKFLOW_DATA_LINE', `${line}: write test values as path=value, for example user.email=someone@example.com.`);
  const path = line.slice(0, at).trim(), kept = unchanged ? getPath(original, path) : undefined;
  return [path.split('.'), isLeaf(kept) ? kept : line.slice(at + 1)];
}
/** Lines back to data; empty sections are left out, and no data at all is undefined. */
export function testWorkflowDataFromView(view: FormValues, previous?: TestWorkflowData): TestWorkflowData | undefined {
  const before = new Set(valueLines(previous?.values ?? {})), values: TestWorkflowValues = {};
  for (const line of linesOf(view.valueLines)) setValue(values, ...valueLine(line, before.has(line), previous?.values));
  const fakeData = Object.fromEntries(linesOf(view.fakeLines).map(fakeSource));
  const data = { ...Object.keys(values).length ? { values } : {}, ...Object.keys(fakeData).length ? { fakeData } : {} };
  return Object.keys(data).length ? data : undefined;
}
