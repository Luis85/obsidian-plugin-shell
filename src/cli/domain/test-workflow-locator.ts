import { keys, object } from './data.ts';
import { hasControls, requireSketch } from '#shared/contracts/sketch-errors.ts';
/**
 * Data-only, accessibility-first element locators for test workflows. A locator names exactly one strategy (ARIA role
 * with an optional accessible name, form label, placeholder, visible text or test id) and may be scoped `within` a
 * parent locator. There is no CSS, XPath or script strategy: every locator maps to one Playwright `getBy*` call.
 */
export interface TestWorkflowLocator {
  role?: string; name?: string; label?: string; placeholder?: string; text?: string; testId?: string;
  exact?: boolean; nth?: number; within?: TestWorkflowLocator;
}
export type TestWorkflowStrategy = 'role' | 'label' | 'placeholder' | 'text' | 'testId';
const testWorkflowStrategies: readonly TestWorkflowStrategy[] = ['role', 'label', 'placeholder', 'text', 'testId'];
/** ARIA roles Playwright's getByRole accepts that make sense for end-to-end steps. */
export const testWorkflowRoles: readonly string[] = ['alert', 'alertdialog', 'article', 'banner', 'button', 'cell', 'checkbox', 'columnheader', 'combobox',
  'complementary', 'contentinfo', 'dialog', 'form', 'grid', 'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'main',
  'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'option', 'progressbar', 'radio', 'radiogroup', 'region', 'row',
  'rowgroup', 'rowheader', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel',
  'textbox', 'toolbar', 'tooltip', 'tree', 'treeitem'];
const locatorLimits = { text: 200, nth: 99, depth: 3 };
const templatePattern = /\{\{\s*data\.([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)\s*\}\}/g;
/** Single-line text that may hold inert `{{data.path}}` templates; any other brace pair is refused. */
export function testWorkflowText(value: unknown, name: string, max: number, allowEmpty = false): string {
  requireSketch(typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0), 'WORKFLOW_FIELD', `${name} needs single-line text (${allowEmpty ? 0 : 1}–${max} characters).`);
  requireSketch(!hasControls(value), 'WORKFLOW_CONTROL', `${name} contains control characters or line breaks.`);
  requireSketch(!/\{\{|\}\}/.test(value.replace(templatePattern, '')), 'WORKFLOW_TEMPLATE', `${name}: write data references as {{data.path}}; nothing else may use double braces.`);
  return value;
}
/** A literal text as a regular expression source, for `contains` title checks. */
export const escapeTestWorkflowRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Data paths referenced by `{{data.path}}` templates, in order of appearance. */
export function testWorkflowTemplatePaths(value: string): string[] {
  return [...value.matchAll(templatePattern)].map(match => match[1]!);
}
/** Single-pass, literal substitution: a resolved value is never scanned again, so data cannot inject templates. */
export function fillTestWorkflowTemplates(value: string, resolve: (path: string) => string): string {
  return value.replace(templatePattern, (_match, path: string) => resolve(path));
}
function strategyOf(item: Record<string, unknown>, name: string): TestWorkflowStrategy {
  const used = testWorkflowStrategies.filter(key => item[key] !== undefined);
  requireSketch(used.length === 1, 'WORKFLOW_LOCATOR', `${name} needs exactly one of ${testWorkflowStrategies.join(', ')}.`);
  return used[0]!;
}
function readNth(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  requireSketch(Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= locatorLimits.nth, 'WORKFLOW_LOCATOR', `${name}.nth must be a whole number from 0 to ${locatorLimits.nth}.`);
  return Number(value);
}
function readStrategy(item: Record<string, unknown>, strategy: TestWorkflowStrategy, name: string): TestWorkflowLocator {
  if (strategy !== 'role') return { [strategy]: testWorkflowText(item[strategy], `${name}.${strategy}`, locatorLimits.text) };
  const role = item.role;
  requireSketch(typeof role === 'string' && testWorkflowRoles.includes(role), 'WORKFLOW_ROLE', `${name}.role must be an ARIA role such as button, link, textbox or heading.`);
  return { role, ...item.name === undefined ? {} : { name: testWorkflowText(item.name, name + '.name', locatorLimits.text) } };
}
/** Fails closed on unknown keys, several strategies, unknown roles, a name without a role and nesting deeper than three. */
export function readTestWorkflowLocator(value: unknown, name: string, depth = 0): TestWorkflowLocator {
  requireSketch(depth < locatorLimits.depth, 'WORKFLOW_LOCATOR', `${name}: within may nest at most ${locatorLimits.depth - 1} parent locators.`);
  const item = object(value);
  keys(item, [...testWorkflowStrategies, 'name', 'exact', 'nth', 'within']);
  const strategy = strategyOf(item, name);
  requireSketch(item.name === undefined || strategy === 'role', 'WORKFLOW_LOCATOR', `${name}.name belongs to role locators.`);
  requireSketch(item.exact === undefined || typeof item.exact === 'boolean', 'WORKFLOW_LOCATOR', `${name}.exact must be true or false.`);
  requireSketch(item.exact === undefined || strategy !== 'testId', 'WORKFLOW_LOCATOR', `${name}.exact does not apply to test ids, which always match exactly.`);
  const nth = readNth(item.nth, name);
  return { ...readStrategy(item, strategy, name), ...item.exact === undefined ? {} : { exact: item.exact === true },
    ...nth === undefined ? {} : { nth }, ...item.within === undefined ? {} : { within: readTestWorkflowLocator(item.within, name + '.within', depth + 1) } };
}
export function testWorkflowStrategy(locator: TestWorkflowLocator): TestWorkflowStrategy {
  return testWorkflowStrategies.find(key => locator[key] !== undefined)!;
}
/** Every text of a locator chain that may hold templates. */
export function testWorkflowLocatorTexts(locator: TestWorkflowLocator): string[] {
  const own = [locator.name, locator.label, locator.placeholder, locator.text, locator.testId].filter((item): item is string => item !== undefined);
  return [...own, ...locator.within ? testWorkflowLocatorTexts(locator.within) : []];
}
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const strategyNouns: Record<Exclude<TestWorkflowStrategy, 'role'>, string> = { label: 'field labelled', placeholder: 'field with placeholder', text: 'text', testId: 'test id' };
/** Human wording such as `button "Save" inside form "Sign up"`, used by docs and run reports. */
export function describeTestWorkflowLocator(locator: TestWorkflowLocator): string {
  const strategy = testWorkflowStrategy(locator);
  const own = strategy === 'role' ? `${locator.role!}${locator.name === undefined ? '' : ' ' + quoted(locator.name)}` : `${strategyNouns[strategy]} ${quoted(locator[strategy]!)}`;
  const suffix = `${locator.exact ? ' (exact)' : ''}${locator.nth === undefined ? '' : ` #${locator.nth + 1}`}`;
  return own + suffix + (locator.within ? ` inside ${describeTestWorkflowLocator(locator.within)}` : '');
}
