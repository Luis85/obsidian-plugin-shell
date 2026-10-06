import { stripVTControlCharacters } from 'node:util';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { applyFilePlan, createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { chromiumLaunchOptions, resolveBrowserExecutable, type BrowserResolution } from '../../../scripts/testing/browser-executable.mjs';
import { testWorkflowJson, type TestWorkflowDefinition, type TestWorkflowStep } from '../domain/test-workflow.ts';
import { resolveTestWorkflowText } from '../domain/test-workflow-data.ts';
import { describeTestWorkflowStep } from '../domain/test-workflow-docs.ts';
import { describeTestWorkflowLocator } from '../domain/test-workflow-locator.ts';
import { describeTestWorkflowTarget, type TestWorkflowTarget } from '../domain/test-workflow-target.ts';
import { hash } from './framework/files.ts';
import { serveTestWorkflowAssets, testWorkflowServable, type TestWorkflowServer } from './test-workflow-serve.ts';
import { runTestWorkflowStep } from './test-workflow-steps.ts';
/** One headless Chromium run of a workflow with per-step timings, the failing locator, screenshots and an evidence label. */
export interface TestWorkflowStepResult {
  index: number; id?: string; kind: string; description: string; status: 'passed' | 'failed' | 'not-run'; durationMs: number; locator?: string; error?: string; screenshot?: string;
}
/** A screenshot is evidence for human review only: it is stored and listed, never compared with anything. */
export interface TestWorkflowScreenshot { step: number; name: string; path: string; bytes: number; sha256: string; caption?: string; browser: string }
export interface TestWorkflowRunBrowser { status: string; executablePath?: string; expectedRevision?: string; version?: string; label: string }
export interface TestWorkflowRunReport {
  schemaVersion: 1; workflow: string; runId: string; definitionSha256: string; status: 'passed' | 'failed' | 'not-run'; reason?: string; startedAt: string; finishedAt: string; durationMs: number;
  target: { description: string; source: string; url?: string }; browser: TestWorkflowRunBrowser;
  steps: TestWorkflowStepResult[]; screenshots: TestWorkflowScreenshot[]; blockedRequests: string[]; pageErrors: string[]; evidence: string;
}
/** The report and the PNG bytes it lists, written together by writeTestWorkflowReport. */
export interface TestWorkflowRun { report: TestWorkflowRunReport; images: ReadonlyMap<string, Buffer> }
export interface TestWorkflowRunOptions { root: string; frameworkRoot: string; target?: TestWorkflowTarget; env?: Readonly<Record<string, string | undefined>> }
interface Session { page: Page; base: URL; blocked: string[]; errors: string[] }
interface Captured { steps: TestWorkflowStepResult[]; screenshots: TestWorkflowScreenshot[]; images: Map<string, Buffer> }
const reportFolder = (id: string) => `reports/workflows/${id}`;
const imageLimit = 20_000_000;
const clean = (error: unknown) => stripVTControlCharacters(error instanceof Error ? error.message : String(error)).split('\n').slice(0, 12).join('\n').slice(0, 1500);
function browserLabel(resolution: BrowserResolution, pinned: BrowserResolution): string {
  if (resolution.status === 'pinned') return `pinned Playwright Chromium revision ${resolution.expectedRevision ?? 'unknown'}`;
  if (resolution.status === 'override') return `non-pinned Chromium (SHELL_CHROMIUM override); Playwright ${pinned.playwrightVersion ?? 'unknown'} expects revision ${pinned.expectedRevision ?? 'unknown'}`;
  return `no usable browser (${resolution.reason ?? resolution.status})`;
}
/** The shared resolver decides; an override is labelled non-pinned with the revision Playwright expects. */
function browserIdentity(options: TestWorkflowRunOptions): { browser: TestWorkflowRunBrowser; usable: boolean; hint: string } {
  const env = options.env ?? process.env, resolution = resolveBrowserExecutable({ root: options.frameworkRoot, env });
  const pinned = resolution.status === 'override' ? resolveBrowserExecutable({ root: options.frameworkRoot, env: { ...env, SHELL_CHROMIUM: undefined } }) : resolution;
  const browser = { status: resolution.status, ...resolution.executablePath ? { executablePath: resolution.executablePath } : {},
    ...pinned.expectedRevision ? { expectedRevision: pinned.expectedRevision } : {}, label: browserLabel(resolution, pinned) };
  return { browser, usable: ['pinned', 'override'].includes(resolution.status), hint: resolution.hint };
}
const stepBase = (step: TestWorkflowStep, index: number) => ({ index: index + 1, ...step.id ? { id: step.id } : {}, kind: step.kind, description: describeTestWorkflowStep(step),
  ...step.target ? { locator: describeTestWorkflowLocator(step.target) } : {} });
const notRun = (steps: readonly TestWorkflowStep[], from = 0): TestWorkflowStepResult[] => steps.slice(from).map((step, offset) =>
  ({ ...stepBase(step, from + offset), status: 'not-run', durationMs: 0 }));
/** Keeps a captured PNG for the report folder and returns the step's screenshot field. */
function keep(captured: Captured, step: TestWorkflowStep, index: number, image: Buffer | undefined, run: { folder: string; browser: string }): { screenshot?: string } {
  if (!image || !step.name) return {};
  if (image.length > imageLimit) throw new Error(`Screenshot ${step.name} is larger than ${imageLimit} bytes.`);
  const path = `${run.folder}/screenshots/${step.name}.png`;
  captured.images.set(path, image);
  captured.screenshots.push({ step: index + 1, name: step.name, path, bytes: image.length, sha256: hash(image), ...step.caption ? { caption: step.caption } : {}, browser: run.browser });
  return { screenshot: path };
}
async function runSteps(definition: TestWorkflowDefinition, context: Record<string, unknown>, session: Session, run: { folder: string; browser: string }): Promise<Captured> {
  const { expect } = await import('@playwright/test'), captured: Captured = { steps: [], screenshots: [], images: new Map() };
  const resolve = (text: string) => resolveTestWorkflowText(text, context);
  for (const [index, step] of definition.steps.entries()) {
    const started = performance.now(), base = stepBase(step, index), elapsed = () => Math.round(performance.now() - started);
    try {
      const image = await runTestWorkflowStep(step, { page: session.page, expect, resolve, timeout: step.timeoutMs ?? definition.timeoutMs, base: session.base });
      captured.steps.push({ ...base, status: 'passed', durationMs: elapsed(), ...keep(captured, step, index, image, run) });
    } catch (error) {
      captured.steps.push({ ...base, status: 'failed', durationMs: elapsed(), error: clean(error) }, ...notRun(definition.steps, index + 1));
      return captured;
    }
  }
  return captured;
}
/** Every request outside the target origin is aborted and listed; the run never reaches the network. */
async function openSession(browser: Browser, definition: TestWorkflowDefinition, url: string): Promise<{ context: BrowserContext; session: Session }> {
  const base = new URL(url), blocked: string[] = [], errors: string[] = [];
  const context = await browser.newContext({ viewport: definition.viewport, serviceWorkers: 'block', acceptDownloads: false, locale: 'en-US', reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    const target = route.request().url();
    if (new URL(target).origin === base.origin) return route.continue();
    blocked.push(target.slice(0, 300));
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('pageerror', error => { if (errors.length < 20) errors.push(clean(error)); });
  return { context, session: { page, base, blocked, errors } };
}
interface Prepared { url?: string; server?: TestWorkflowServer; source: string; reason?: string }
async function prepare(options: TestWorkflowRunOptions, target: TestWorkflowTarget): Promise<Prepared> {
  const servable = await testWorkflowServable(options.root, target);
  if (servable.kind === 'unavailable') return { source: servable.source, reason: `target-unavailable: ${servable.reason}` };
  if (servable.kind === 'url') return { url: servable.url, source: servable.source };
  const server = await serveTestWorkflowAssets(servable.assets);
  return { url: new URL(servable.entry, server.url).href, server, source: servable.source };
}
type Executed = Captured & Pick<TestWorkflowRunReport, 'blockedRequests' | 'pageErrors'> & { version: string };
async function execute(options: TestWorkflowRunOptions, definition: TestWorkflowDefinition, context: Record<string, unknown>, run: { url: string; folder: string; label: string }): Promise<Executed> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions({ root: options.frameworkRoot, env: options.env ?? process.env }) });
  try {
    const opened = await openSession(browser, definition, run.url), label = `${run.label}, version ${browser.version()}`;
    const captured = await runSteps(definition, context, opened.session, { folder: run.folder, browser: label });
    await opened.context.close();
    return { ...captured, blockedRequests: opened.session.blocked, pageErrors: opened.session.errors, version: browser.version() };
  } finally { await browser.close(); }
}
/** Runs a healthy workflow; a missing browser or unbuilt target is reported as not-run, never as a pass. */
export async function runTestWorkflow(options: TestWorkflowRunOptions, definition: TestWorkflowDefinition, context: Record<string, unknown>): Promise<TestWorkflowRun> {
  const startedAt = new Date(), target = options.target ?? definition.target, identity = browserIdentity(options);
  const prepared: Prepared = identity.usable ? await prepare(options, target) : { source: describeTestWorkflowTarget(target), reason: `browser-unavailable: ${identity.hint}` };
  const runId = `run-${startedAt.toISOString().replace(/[:.]/g, '-')}`, folder = `${reportFolder(definition.id)}/${runId}`;
  const base = { schemaVersion: 1 as const, workflow: definition.id, runId, definitionSha256: hash(testWorkflowJson(definition)), startedAt: startedAt.toISOString(),
    target: { description: describeTestWorkflowTarget(target), source: prepared.source, ...prepared.url ? { url: prepared.url } : {} } };
  const finish = (rest: Omit<TestWorkflowRunReport, keyof typeof base | 'finishedAt' | 'durationMs'>): TestWorkflowRunReport =>
    ({ ...base, ...rest, finishedAt: new Date().toISOString(), durationMs: Date.now() - startedAt.getTime() });
  if (!prepared.url) return { report: finish({ status: 'not-run', reason: prepared.reason!, browser: identity.browser, steps: notRun(definition.steps), screenshots: [], blockedRequests: [], pageErrors: [], evidence: 'not-run: no browser evidence' }), images: new Map() };
  try {
    const run = await execute(options, definition, context, { url: prepared.url, folder, label: identity.browser.label });
    const status = run.steps.every(step => step.status === 'passed') ? 'passed' : 'failed';
    return { images: run.images, report: finish({ status, browser: { ...identity.browser, version: run.version }, steps: run.steps, screenshots: run.screenshots,
      blockedRequests: run.blockedRequests, pageErrors: run.pageErrors,
      evidence: `headless ${identity.browser.label}, version ${run.version}; served ${base.target.description} on loopback; scope: this workflow's steps only; screenshots are for human review, never compared` }) };
  } finally { await prepared.server?.close(); }
}
/** Run reports and screenshots are local evidence under reports/ (not committed), written through the contained file writer. */
export async function writeTestWorkflowReport(root: string, run: TestWorkflowRun): Promise<string[]> {
  const { report } = run, content = JSON.stringify(report, null, 2) + '\n';
  const paths = [`${reportFolder(report.workflow)}/${report.runId}/report.json`, `${reportFolder(report.workflow)}/latest.json`];
  const images = [...run.images].map(([path, bytes]) => ({ path, content: bytes.toString('base64'), encoding: 'base64' as const }));
  await applyFilePlan(await createFilePlan(root, [...paths.map(path => ({ path, content })), ...images]));
  return [...paths, ...images.map(image => image.path)];
}
