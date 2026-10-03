import { createHash } from 'node:crypto';
import { literal, type Model } from './model.ts';
import type { Add } from './file-code.ts';
import { editorBindings } from '../sitemap/editor-bindings.ts';
import type { SitemapDesign, SitemapJourney } from '../sitemap/model.ts';

/** Browser specs for the journeys authored in design.sitemap.journeys. Steps the generated preview can perform
 * (open a screen by address, follow a navigation control, see a dialog) become real assertions. Steps that need
 * business behavior stay as visible `test.fixme` entries carrying the step and interaction identity. */
const journeySpecRoot = 'tests/e2e/journeys';
const supportFile = `${journeySpecRoot}/journey-support.ts`;

interface Screen { id: string; label: string; kind: string }
interface Edge { id: string; from: string; to: string; kind: string; label: string }
interface Context { screens: Map<string, Screen>; edges: Edge[]; editors: Set<string> }
type Step = SitemapJourney['steps'][number];
type StepPlan =
  | { kind: 'open'; surface: Screen }
  | { kind: 'follow' | 'dialog'; edge: Edge; from: Screen; to: Screen; nth: number }
  | { kind: 'todo'; reason: string; surface?: Screen; interaction?: string; edge?: Edge };

const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();
const isPage = (screen: Screen): boolean => !['group', 'action', 'modal'].includes(screen.kind);
const address = (id: string): string => '/#surface=' + encodeURIComponent(id);
const todo = (reason: string, surface?: Screen, edge?: Edge): StepPlan =>
  ({ kind: 'todo', reason, ...(surface ? { surface } : {}), ...(edge ? { edge, interaction: edge.id } : {}) });

function planOpen(surface: Screen): StepPlan {
  return surface.kind === 'modal' ? todo('a dialog cannot be opened by address; reach it from a screen', surface) : { kind: 'open', surface };
}
function planFollow(context: Context, journey: SitemapJourney, index: number, to: Screen): StepPlan {
  const step = journey.steps[index]!, from = context.screens.get(journey.steps[index - 1]!.surface);
  const edge = step.via === null ? undefined : context.edges.find(candidate => candidate.id === step.via);
  if (!edge) return todo('no declared transition leads into this step', to);
  if (!from || edge.from !== from.id || edge.to !== to.id) return todo('the transition does not connect the neighbouring steps', to, edge);
  if (!['navigate', 'open'].includes(edge.kind)) return todo(`transition kind ${oneLine(edge.kind)} requires business interaction behavior`, to, edge);
  if (context.editors.has(from.id)) return todo('the source screen hosts an editor instead of generated transition controls', to, edge);
  if (!isPage(from)) return todo('controls inside a dialog are not driven by generated specs', to, edge);
  if (oneLine(edge.label) === '') return todo('the transition control has no accessible label', to, edge);
  const nth = context.edges.filter(other => other.from === edge.from && other.label === edge.label).indexOf(edge);
  return { kind: to.kind === 'modal' ? 'dialog' : 'follow', edge, from, to, nth };
}
/** Decides, per step, what the generated preview can really perform. */
function planStep(context: Context, journey: SitemapJourney, index: number): StepPlan {
  const step: Step = journey.steps[index]!, surface = context.screens.get(step.surface);
  if (step.unresolved) return todo('the step is an unresolved planning reference', surface);
  if (!surface) return todo('the surface no longer exists');
  if (['action', 'group'].includes(surface.kind)) return todo('an action or group surface has no preview of its own', surface);
  return index === 0 ? planOpen(surface) : planFollow(context, journey, index, surface);
}

const quoted = (screen: Screen): string => `"${oneLine(screen.label)}"`;
function stepText(plan: StepPlan, step: Step): string {
  if (plan.kind === 'open') return `Open ${quoted(plan.surface)}`;
  if (plan.kind === 'todo') {
    const target = plan.surface ? `Reach ${quoted(plan.surface)}` : `Reach surface ${oneLine(step.surface)}`;
    return `${target} (TODO ${plan.reason}${plan.interaction ? `; interaction ${oneLine(plan.interaction)}` : ''})`;
  }
  return `Follow "${oneLine(plan.edge.label)}" from ${quoted(plan.from)} to ${plan.kind === 'dialog' ? 'dialog ' : ''}${quoted(plan.to)}`;
}
function stepBody(plan: StepPlan, previous: StepPlan | undefined, journey: SitemapJourney, index: number): string[] {
  if (plan.kind === 'open') return [`await openSurface(page, ${literal(address(plan.surface.id))}, ${literal(oneLine(plan.surface.label))});`];
  if (plan.kind === 'todo') return [`// TODO ${literal(stepText(plan, journey.steps[index]!))}`];
  const resync = previous?.kind === 'todo'
    ? [`await openSurface(page, ${literal(address(plan.from.id))}, ${literal(oneLine(plan.from.label))});`] : [];
  const control = `${literal(oneLine(plan.edge.label))}, ${plan.nth}`;
  if (plan.kind === 'dialog') return [...resync, `await followToDialog(page, ${control}, ${literal(oneLine(plan.to.label))});`];
  return [...resync, `await followControl(page, ${control}, ${literal(address(plan.to.id))}, ${literal(oneLine(plan.to.label))});`];
}
function stepTest(plans: StepPlan[], journey: SitemapJourney, index: number): string {
  const plan = plans[index]!, step = journey.steps[index]!;
  const title = literal(`[${journey.id}/${step.id}] ${stepText(plan, step)}`);
  const body = stepBody(plan, plans[index - 1], journey, index).map(line => `    ${line}`).join('\n');
  if (plan.kind !== 'todo') return `  test(${title}, async () => {\n${body}\n  });`;
  const notes = [{ type: 'journey-step', description: `${journey.id}/${step.id}` }, { type: 'reason', description: plan.reason },
    ...(plan.interaction ? [{ type: 'interaction', description: plan.interaction }] : [])];
  return `  test.fixme(${title}, { annotation: ${literal(notes)} }, async () => {\n${body}\n  });`;
}
function journeySpec(context: Context, journey: SitemapJourney): string {
  const plans = journey.steps.map((_, index) => planStep(context, journey, index));
  const tests = journey.steps.map((_, index) => stepTest(plans, journey, index));
  const used = ['openSurface', 'followControl', 'followToDialog'].filter(helper => tests.some(test => test.includes(`${helper}(`)));
  const helpers = used.length ? `import { ${used.join(', ')} } from './journey-support';\n` : '';
  return `// Generated from design.sitemap.journeys[${literal(journey.id)}]. Regenerating replaces this file; edit the journey in design/project.json.
import { test, type Page } from '@playwright/test';
${helpers}
test.describe(${literal(`[${journey.id}] ${oneLine(journey.name)}`)}, () => {
  // Steps are one connected walk through the preview: a failed step skips the rest.
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(async () => { await page.close(); });
${tests.join('\n')}
});
`;
}

const supportSource = `// Generated helpers for the journey specs. They use only the preview's own addresses and visible controls.
import { expect, type Page } from '@playwright/test';

const screenHeading = '.generated-screen > h2';
/** Opens a surface by its preview address (hash) and checks that the surface heading is shown. */
export async function openSurface(page: Page, path: string, label: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await expect(page.locator(screenHeading)).toHaveText(label);
}
async function clickControl(page: Page, name: string, nth: number): Promise<void> {
  await page.locator('.generated-screen').getByRole('button', { name, exact: true }).nth(nth).click();
}
/** Clicks a navigation control of the current screen; the target heading and address must follow. */
export async function followControl(page: Page, name: string, nth: number, path: string, label: string): Promise<void> {
  await clickControl(page, name, nth);
  await expect(page.locator(screenHeading)).toHaveText(label);
  await expect(page).toHaveURL(url => url.hash === path.slice(1));
}
/** Clicks a control that opens a dialog; the labelled dialog must be shown. */
export async function followToDialog(page: Page, name: string, nth: number, label: string): Promise<void> {
  await clickControl(page, name, nth);
  await expect(page.getByRole('dialog', { name: label, exact: true })).toBeVisible();
}
`;

function uniqueFileNames(journeys: SitemapJourney[]): Map<string, string> {
  const names = new Map<string, string>(), taken = new Set<string>();
  for (const journey of journeys) {
    const hash = createHash('sha256').update(journey.id).digest('hex').slice(0, 8);
    const plain = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(journey.id) ? journey.id : undefined;
    const sanitized = journey.id.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'journey';
    const name = plain && !taken.has(plain.toLowerCase()) ? plain : `${sanitized}-${hash}`;
    taken.add(name.toLowerCase()); names.set(journey.id, name);
  }
  return names;
}

function journeyContext(m: Model, design: SitemapDesign): Context {
  return {
    editors: new Set(editorBindings(design).map(binding => binding.surface)),
    screens: new Map(m.screens.map(screen => [screen.id, screen])),
    edges: m.links.map(link => ({ id: String(link.id), from: String(link.from), to: String(link.to), kind: String(link.kind), label: String(link.label ?? '') })),
  };
}

/** Emits one spec per authored journey that has steps, plus shared helpers. A project without journeys gets nothing. */
export function authoredJourneyCode(m: Model, add: Add): void {
  const design = m.document.design as SitemapDesign;
  const journeys = (design.sitemap?.journeys ?? []).filter(journey => journey.steps.length > 0);
  if (journeys.length === 0) return;
  const context = journeyContext(m, design), names = uniqueFileNames(journeys);
  add(supportFile, supportSource, 'managed');
  for (const journey of journeys) add(`${journeySpecRoot}/${names.get(journey.id)!}.spec.ts`, journeySpec(context, journey), 'managed');
}
