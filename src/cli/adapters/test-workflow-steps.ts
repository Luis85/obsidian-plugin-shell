import type { Locator, Page } from '@playwright/test';
import type { TestWorkflowStep } from '../domain/test-workflow.ts';
import { escapeTestWorkflowRegExp, testWorkflowRoles, testWorkflowStrategy, type TestWorkflowLocator } from '../domain/test-workflow-locator.ts';
/**
 * Translates one validated step into Playwright calls. Every locator is a `getBy*` call and every check is a web-first
 * `expect` assertion with the step timeout; nothing is evaluated in the page and no selector string is built. Screenshots
 * are captured for human review and never compared with a baseline.
 */
type Role = Parameters<Page['getByRole']>[0];
type Expect = typeof import('@playwright/test').expect;
export interface TestWorkflowStepRuntime { page: Page; expect: Expect; resolve: (text: string) => string; timeout: number; base: URL }
const isRole = (value: string): value is Role => testWorkflowRoles.includes(value);
function own(scope: Page | Locator, locator: TestWorkflowLocator, resolve: (text: string) => string): Locator {
  const exact = locator.exact === undefined ? {} : { exact: locator.exact };
  const strategy = testWorkflowStrategy(locator);
  if (strategy === 'role') {
    const role = locator.role!;
    if (!isRole(role)) throw new Error(`Unsupported role ${role}.`);
    return scope.getByRole(role, { ...locator.name === undefined ? {} : { name: resolve(locator.name) }, ...exact });
  }
  if (strategy === 'label') return scope.getByLabel(resolve(locator.label!), exact);
  if (strategy === 'placeholder') return scope.getByPlaceholder(resolve(locator.placeholder!), exact);
  if (strategy === 'text') return scope.getByText(resolve(locator.text!), exact);
  return scope.getByTestId(resolve(locator.testId!));
}
/** Parents first: `within` scopes the search to the parent locator's subtree. */
function testWorkflowLocator(page: Page, locator: TestWorkflowLocator, resolve: (text: string) => string): Locator {
  const scope = locator.within ? testWorkflowLocator(page, locator.within, resolve) : page;
  const found = own(scope, locator, resolve);
  return locator.nth === undefined ? found : found.nth(locator.nth);
}
/** URLs compare as path + query + hash relative to the target origin; contains matches a substring. */
function urlMatcher(step: TestWorkflowStep, base: URL): (url: URL) => boolean {
  return url => {
    const relative = url.origin === base.origin ? url.pathname + url.search + url.hash : url.href;
    return step.match === 'contains' ? relative.includes(step.path!) : relative === step.path;
  };
}
type Run = (step: TestWorkflowStep, element: () => Locator, runtime: TestWorkflowStepRuntime) => Promise<unknown>;
const value = (step: TestWorkflowStep, runtime: TestWorkflowStepRuntime) => runtime.resolve(step.value ?? '');
const text = (step: TestWorkflowStep, runtime: TestWorkflowStepRuntime) => runtime.resolve(step.text ?? '');
const options = (runtime: TestWorkflowStepRuntime) => ({ timeout: runtime.timeout });
const runners: Readonly<Record<TestWorkflowStep['kind'], Run>> = {
  goto: (step, _element, runtime) => runtime.page.goto(new URL(step.path!, runtime.base).href, options(runtime)),
  click: (_step, element, runtime) => element().click(options(runtime)),
  fill: (step, element, runtime) => element().fill(value(step, runtime), options(runtime)),
  select: (step, element, runtime) => element().selectOption(value(step, runtime), options(runtime)),
  check: (_step, element, runtime) => element().check(options(runtime)),
  uncheck: (_step, element, runtime) => element().uncheck(options(runtime)),
  press: (step, element, runtime) => step.target ? element().press(step.key!, options(runtime)) : runtime.page.keyboard.press(step.key!),
  waitFor: (step, element, runtime) => element().waitFor({ state: step.state ?? 'visible', ...options(runtime) }),
  expectVisible: (_step, element, runtime) => runtime.expect(element()).toBeVisible(options(runtime)),
  expectHidden: (_step, element, runtime) => runtime.expect(element()).toBeHidden(options(runtime)),
  expectText: (step, element, runtime) => step.match === 'exact' ? runtime.expect(element()).toHaveText(text(step, runtime), options(runtime))
    : runtime.expect(element()).toContainText(text(step, runtime), options(runtime)),
  expectUrl: (step, _element, runtime) => runtime.expect(runtime.page).toHaveURL(urlMatcher(step, runtime.base), options(runtime)),
  expectTitle: (step, _element, runtime) => runtime.expect(runtime.page).toHaveTitle(step.match === 'contains' ? new RegExp(escapeTestWorkflowRegExp(text(step, runtime))) : text(step, runtime), options(runtime)),
  expectCount: (step, element, runtime) => runtime.expect(element()).toHaveCount(step.count!, options(runtime)),
  expectValue: (step, element, runtime) => runtime.expect(element()).toHaveValue(value(step, runtime), options(runtime)),
  screenshot: (step, element, runtime) => {
    const capture = { ...options(runtime), animations: 'disabled' as const, caret: 'hide' as const, mask: (step.mask ?? []).map(item => testWorkflowLocator(runtime.page, item, runtime.resolve)) };
    return step.target ? element().screenshot(capture) : runtime.page.screenshot({ ...capture, fullPage: step.fullPage === true });
  },
};
/** Runs one step; a screenshot step returns its PNG bytes (masked elements are painted over), every other step nothing. */
export async function runTestWorkflowStep(step: TestWorkflowStep, runtime: TestWorkflowStepRuntime): Promise<Buffer | undefined> {
  const result = await runners[step.kind](step, () => testWorkflowLocator(runtime.page, step.target!, runtime.resolve), runtime);
  return Buffer.isBuffer(result) ? result : undefined;
}
