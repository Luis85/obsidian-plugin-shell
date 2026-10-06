/** Versioned result, Markdown summary and report files for `npm run verify`. */
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { resultEnvelope } from '../contracts/result-runtime.mjs';

const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;?]*[ -/]*[@-~]', 'g');
/** ANSI-stripped last `lines` lines, bounded to `chars` characters. */
export function outputTail(text, lines = 60, chars = 6000) {
  const tail = text.replace(ansi, '').replace(/\r\n?/g, '\n').trimEnd().split('\n').slice(-lines).join('\n');
  return tail.length > chars ? tail.slice(-chars) : tail;
}
const statuses = ['passed', 'failed', 'skipped', 'not-run'];
const count = (outcomes, status) => outcomes.filter(step => step.status === status).length;

function summarize(outcomes, durationMs) {
  return { total: outcomes.length, passed: count(outcomes, 'passed'), failed: count(outcomes, 'failed'), skipped: count(outcomes, 'skipped'), notRun: count(outcomes, 'not-run'), durationMs: Math.round(durationMs) };
}
function failureDiagnostics(failed, keepGoing) {
  if (!failed.length) return [];
  const ids = failed.map(step => step.id);
  return [{ code: 'VERIFY_FAILED', severity: 'error', message: `${ids.length} verify step${ids.length > 1 ? 's' : ''} failed: ${ids.join(', ')}.`,
    next: `Fix the failures, then rerun: npm run verify -- --only ${ids.join(',')}${keepGoing ? ' --keep-going' : ''} (a full npm run verify is still required for a complete verdict)` }];
}
/** `complete` means the selection covered every step (no --only/--skip), so a green partial run is never a full verdict. */
export function buildResult({ outcomes, keepGoing, durationMs, complete, selection, cancelled = false }) {
  const failed = outcomes.filter(step => step.status === 'failed');
  const diagnostics = failureDiagnostics(failed, keepGoing);
  if (cancelled) diagnostics.push({ code: 'CANCELLED', severity: 'error', message: 'Verify was cancelled; remaining steps were not run and the completed steps are not a verdict.' });
  else if (!complete) diagnostics.push({ code: 'PARTIAL_RUN', severity: 'info', message: 'The selection omitted steps (--only/--skip); this is not a complete verify verdict.' });
  const status = cancelled ? 'cancelled' : failed.length ? 'failed' : 'ok';
  return resultEnvelope('verify', { gate: 'verify', mode: keepGoing ? 'keep-going' : 'fail-fast', complete, ...(selection ? { selection } : {}), steps: outcomes, summary: summarize(outcomes, durationMs) }, status, diagnostics);
}
function duration(ms) {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.floor(seconds / 60)} min ${String(Math.round(seconds % 60)).padStart(2, '0')} s`;
}
const failureLine = /\b(?:error|fail(?:ed|ure|ing)?|not ok|assert\w*)\b|[✖✗×]/i;
/** The first failing lines of a step's output tail, or its last lines when nothing looks like a failure. */
function failingLines(tail = '', limit = 3) {
  const lines = tail.split('\n').map(line => line.trim()).filter(Boolean);
  const matched = lines.filter(line => failureLine.test(line));
  return (matched.length ? matched : lines.slice(-limit)).slice(0, limit);
}
const cell = text => text.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, ' ').slice(0, 160);
function detail(step) {
  if (step.status === 'failed') return failingLines(step.outputTail).map(cell).join('<br>') || cell(step.reason ?? '');
  return cell(step.reason ?? '');
}
function failureBlocks(steps) {
  return steps.filter(step => step.status === 'failed' && step.outputTail).map(step =>
    `<details><summary>${cell(step.id)}: last output</summary>\n\n\`\`\`text\n${step.outputTail.replace(/```/g, "'''")}\n\`\`\`\n\n</details>`);
}
export function renderMarkdown(result) {
  const { steps, summary, mode, complete } = result.data;
  const verdict = result.status === 'ok' ? (complete ? 'PASSED' : 'PASSED (partial run)') : result.status.toUpperCase();
  const counts = statuses.map(status => `${summary[status === 'not-run' ? 'notRun' : status]} ${status}`).join(', ');
  const rows = steps.map(step => `| \`${step.id}\` | ${step.status} | ${duration(step.durationMs)} | ${detail(step)} |`);
  const next = result.diagnostics.map(item => `- **${item.code}:** ${cell(item.message)}${item.next ? ` Next: ${cell(item.next)}` : ''}`);
  return ['## npm run verify: ' + verdict, '', `${counts}; ${mode}; ${duration(summary.durationMs)}.`, '',
    '| Step | Status | Duration | Detail |', '| --- | --- | --- | --- |', ...rows, '', ...next, ...(next.length ? [''] : []), ...failureBlocks(steps), ''].join('\n');
}
/** Always writes summary.json and summary.md; appends the Markdown to GITHUB_STEP_SUMMARY when set. Returns warnings. */
export async function writeReports({ result, root, reportDir, env }) {
  const markdown = renderMarkdown(result), warnings = [], directory = resolve(root, reportDir);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
    await writeFile(join(directory, 'summary.md'), markdown);
  } catch (error) { warnings.push(`Could not write ${reportDir}: ${error.message}`); }
  if (env.GITHUB_STEP_SUMMARY) {
    try { await appendFile(env.GITHUB_STEP_SUMMARY, markdown + '\n'); }
    catch (error) { warnings.push(`Could not append to GITHUB_STEP_SUMMARY: ${error.message}`); }
  }
  return warnings;
}
