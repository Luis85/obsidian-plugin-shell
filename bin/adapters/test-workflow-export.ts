import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { hasPortableProjectSegments, hasProtectedProjectRoot } from '../../scripts/shared/project-path.ts';
import { literal } from '../compiler/emitters/model.ts';
import { requireSketch } from '../domain/errors.ts';
import type { TestWorkflowDefinition, TestWorkflowStep } from '../domain/test-workflow.ts';
import { resolveTestWorkflowText } from '../domain/test-workflow-data.ts';
import { describeTestWorkflowStep } from '../domain/test-workflow-docs.ts';
import { escapeTestWorkflowRegExp, testWorkflowStrategy, type TestWorkflowLocator } from '../domain/test-workflow-locator.ts';
import { describeTestWorkflowTarget } from '../domain/test-workflow-target.ts';
import { prepared, type Prepared } from './storage.ts';
/**
 * An equivalent `@playwright/test` spec for a project's own suite. The translation is data-only: every resolved text
 * becomes a JSON string literal, every locator a `getBy*` call and every check a web-first `expect`. Nothing from the
 * workflow becomes code, so authored text cannot add statements to the generated file.
 */
type Resolve = (text: string) => string;
const text = (value: string, resolve: Resolve) => literal(resolve(value));
/** `, { name: …, exact: true }` with only the options that are set. */
function optionsCode(entries: ReadonlyArray<readonly [string, string | undefined]>): string {
  const parts = entries.filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value!}`);
  return parts.length ? `, { ${parts.join(', ')} }` : '';
}
const getters = { label: 'getByLabel', placeholder: 'getByPlaceholder', text: 'getByText' } as const;
function locatorCode(locator: TestWorkflowLocator, resolve: Resolve): string {
  const scope = locator.within ? locatorCode(locator.within, resolve) : 'page', strategy = testWorkflowStrategy(locator);
  const exact: readonly [string, string | undefined] = ['exact', locator.exact === undefined ? undefined : String(locator.exact)];
  const name: readonly [string, string | undefined] = ['name', locator.name === undefined ? undefined : text(locator.name, resolve)];
  const call = strategy === 'role' ? `getByRole(${literal(locator.role)}${optionsCode([name, exact])})`
    : strategy === 'testId' ? `getByTestId(${text(locator.testId!, resolve)})` : `${getters[strategy]}(${text(locator[strategy]!, resolve)}${optionsCode([exact])})`;
  return `${scope}.${call}${locator.nth === undefined ? '' : `.nth(${locator.nth})`}`;
}
/** Each emitter receives the element expression and `{ timeout: N }` (the step timeout or the workflow default). */
type Emit = (step: TestWorkflowStep, element: string, resolve: Resolve, timeout: string) => string;
const pageUrl = 'url.pathname + url.search + url.hash';
const emitters: Readonly<Record<TestWorkflowStep['kind'], Emit>> = {
  goto: (step, _e, _r, t) => `await page.goto(${literal(step.path)}, ${t});`, click: (_s, element, _r, t) => `await ${element}.click(${t});`,
  fill: (step, element, resolve, t) => `await ${element}.fill(${text(step.value!, resolve)}, ${t});`,
  select: (step, element, resolve, t) => `await ${element}.selectOption(${text(step.value!, resolve)}, ${t});`,
  check: (_s, element, _r, t) => `await ${element}.check(${t});`, uncheck: (_s, element, _r, t) => `await ${element}.uncheck(${t});`,
  press: (step, element, _r, t) => step.target ? `await ${element}.press(${literal(step.key)}, ${t});` : `await page.keyboard.press(${literal(step.key)});`,
  waitFor: (step, element, _r, t) => `await ${element}.waitFor({ state: ${literal(step.state ?? 'visible')}, ...${t} });`,
  expectVisible: (_s, element, _r, t) => `await expect(${element}).toBeVisible(${t});`, expectHidden: (_s, element, _r, t) => `await expect(${element}).toBeHidden(${t});`,
  expectText: (step, element, resolve, t) => `await expect(${element}).${step.match === 'exact' ? 'toHaveText' : 'toContainText'}(${text(step.text!, resolve)}, ${t});`,
  expectUrl: (step, _e, _r, t) => `await expect(page).toHaveURL(url => ${step.match === 'contains' ? `(${pageUrl}).includes(${literal(step.path)})` : `${pageUrl} === ${literal(step.path)}`}, ${t});`,
  expectTitle: (step, _e, resolve, t) => `await expect(page).toHaveTitle(${step.match === 'contains' ? `new RegExp(${literal(escapeTestWorkflowRegExp(resolve(step.text!)))})` : text(step.text!, resolve)}, ${t});`,
  expectCount: (step, element, _r, t) => `await expect(${element}).toHaveCount(${step.count!}, ${t});`,
  expectValue: (step, element, resolve, t) => `await expect(${element}).toHaveValue(${text(step.value!, resolve)}, ${t});`,
  screenshot: screenshotCode,
};
/** A PNG in the test's own output folder (test-results), for human review; never an image comparison or a committed snapshot. */
function screenshotCode(step: TestWorkflowStep, element: string, resolve: Resolve, timeout: string): string {
  const mask = step.mask?.length ? `, mask: [${step.mask.map(item => locatorCode(item, resolve)).join(', ')}]` : '';
  const capture = `path: test.info().outputPath(${literal(step.name + '.png')})${step.target ? '' : `, fullPage: ${step.fullPage === true}`}, animations: "disabled", caret: "hide"${mask}`;
  return `await ${step.target ? element : 'page'}.screenshot({ ${capture}, ...${timeout} });`;
}
function stepCode(step: TestWorkflowStep, index: number, resolve: Resolve, defaultTimeout: number): string {
  const timeout = `{ timeout: ${step.timeoutMs ?? defaultTimeout} }`, element = step.target ? locatorCode(step.target, resolve) : 'page';
  const title = literal(`${index + 1}. ${describeTestWorkflowStep(step)}`);
  return `    await test.step(${title}, async () => {\n      ${emitters[step.kind](step, element, resolve, timeout)}\n    });`;
}
/** The generated spec text; templates are resolved to literals at export time from the same seeded data as a run. */
export function testWorkflowSpec(definition: TestWorkflowDefinition, context: Record<string, unknown>): string {
  const resolve: Resolve = value => resolveTestWorkflowText(value, context);
  const steps = definition.steps.map((step, index) => stepCode(step, index, resolve, definition.timeoutMs)).join('\n');
  return `// Generated from configs/tests/workflows/${definition.id}.json by node bin/app workflow export. Regenerate instead of editing.
// Target: ${describeTestWorkflowTarget(definition.target).replace(/[\r\n]/g, ' ')}. Serve it at this project's Playwright baseURL; goto paths are root-relative.
// Screenshot steps save PNGs to the test output folder for human review; they are never compared with stored images.
import { test, expect } from '@playwright/test';

test.describe(${literal(`[${definition.id}] ${definition.title}`)}, () => {
  test.use({ viewport: { width: ${definition.viewport.width}, height: ${definition.viewport.height} } });
  test(${literal(definition.title)}, async ({ page }) => {
${steps}
  });
});
`;
}
function testWorkflowExportFolder(out: string): string {
  const folder = out.replace(/\/+$/, '');
  requireSketch(hasPortableProjectSegments(folder) && !hasProtectedProjectRoot(folder) && !folder.startsWith('configs/') && !folder.split('/').some(part => part.startsWith('.')),
    'WORKFLOW_EXPORT_OUT', 'Use --out with a project-relative test folder such as tests/e2e/workflows.');
  return folder;
}
/** A reviewed plan for `<out>/<id>.workflow.spec.ts`; an existing file shows as an update before anything is written. */
export async function testWorkflowExportPlan(root: string, definition: TestWorkflowDefinition, context: Record<string, unknown>, out: string): Promise<Prepared> {
  const path = `${testWorkflowExportFolder(out)}/${definition.id}.workflow.spec.ts`;
  const plan = await createFilePlan(root, [{ path, content: testWorkflowSpec(definition, context) }]);
  return prepared(plan, { workflow: definition.id, path }, { kind: 'workflow-export', workflow: definition.id, path });
}
