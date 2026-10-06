import { list, object, text } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { testWorkflowJson, type TestWorkflowDefinition } from '../domain/test-workflow.ts';
import type { TestWorkflowRunRecord } from '../domain/test-workflow-docs.ts';
import { hash } from './framework/files.ts';
/** The fields of a saved run report that recording needs; the report file is local evidence and is re-validated here. */
export interface TestWorkflowSavedReport {
  workflow: string; definitionSha256: string; status: 'passed' | 'failed'; finishedAt: string; durationMs: number; passed: number; steps: number; browser: string; screenshots: string[];
}
const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
/** A short, path-free browser label for committed notes: the version and whether it was the pinned revision. */
function browserText(browser: Record<string, unknown>, version: string): string {
  return browser.status === 'pinned' ? `Chromium ${version} (pinned Playwright revision)` : `Chromium ${version} (non-pinned SHELL_CHROMIUM override)`;
}
/** Screenshot paths as the run wrote them: reports/workflows/<id>/<run-id>/screenshots/<name>.png. */
const screenshotPath = /^reports\/workflows\/[a-z0-9-]+\/run-[0-9TZ-]+\/screenshots\/[a-z0-9-]+\.png$/;
function screenshotPaths(value: unknown): string[] {
  return list(value ?? [], 'screenshots', 30).map(entry => {
    const path = object(entry).path;
    requireSketch(typeof path === 'string' && screenshotPath.test(path), 'WORKFLOW_REPORT', 'The run report lists a screenshot outside its report folder.');
    return path;
  });
}
export function readTestWorkflowReport(value: unknown): TestWorkflowSavedReport {
  const item = object(value), browser = object(item.browser), steps = list(item.steps, 'steps', 200).map(step => object(step));
  requireSketch(item.schemaVersion === 1 && (item.status === 'passed' || item.status === 'failed'), 'WORKFLOW_REPORT',
    'Only a finished run report (status passed or failed) can be recorded; a not-run report has no result.');
  const finishedAt = text(item.finishedAt, 'finishedAt', 40), version = text(browser.version, 'browser.version', 60);
  requireSketch(isoTime.test(finishedAt) && /^[0-9.]+$/.test(version) && Number.isSafeInteger(item.durationMs), 'WORKFLOW_REPORT', 'The run report is malformed.');
  return { workflow: text(item.workflow, 'workflow', 80), definitionSha256: text(item.definitionSha256, 'definitionSha256', 64), status: item.status === 'passed' ? 'passed' : 'failed', finishedAt,
    durationMs: Number(item.durationMs), passed: steps.filter(step => step.status === 'passed').length, steps: steps.length, browser: browserText(browser, version), screenshots: screenshotPaths(item.screenshots) };
}
/** A report records only against the exact definition it ran; an edited workflow needs a new run. */
export function testWorkflowRunRecord(report: TestWorkflowSavedReport, definition: TestWorkflowDefinition): TestWorkflowRunRecord {
  requireSketch(report.workflow === definition.id, 'WORKFLOW_REPORT', `The report belongs to workflow ${report.workflow}, not ${definition.id}.`);
  const current = hash(testWorkflowJson(definition));
  requireSketch(report.definitionSha256 === current, 'WORKFLOW_REPORT_STALE', `${definition.id} changed since this run; run it again before recording.`);
  return { result: report.status, at: report.finishedAt, summary: `${report.passed}/${report.steps} steps passed in ${report.durationMs} ms with ${report.browser}.`, definition: current,
    ...report.screenshots.length ? { screenshots: report.screenshots } : {} };
}
