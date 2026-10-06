/** Diff-based self-review guard: `npm run check:self-review -- [--base <ref>] [--json] [--warn-only]`. */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectChanges, resolveBase } from '../../src/cli/tooling/quality/self-review-diff.mjs';
import { overLimitFiles, unclassifiedTests } from './self-review-files.mjs';
import { lineViolations } from './self-review-rules.mjs';
import { ALLOWLIST_PATH, parseAllowlist } from './check-docs-launchers.mjs';
import { pendingStubAllowance } from '../delivery/acceptance-guard.mjs';
import { APPROVALS_PATH, approvedFindings, readApprovals } from './self-review-approvals.mjs';

const usage = 'usage: check:self-review [--base <ref>] [--json] [--warn-only]';

export function parseArguments(argv) {
  const options = { base: undefined, json: false, warnOnly: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--warn-only') options.warnOnly = true;
    else if (argument === '--base') {
      options.base = argv[++index];
      if (!options.base || options.base.startsWith('--')) throw new Error(`SELF_REVIEW_USAGE: --base needs a ref. ${usage}`);
    } else throw new Error(`SELF_REVIEW_USAGE: unknown argument ${argument}. ${usage}`);
  }
  return options;
}

const byLocation = (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule);

/** Every violation for a set of parsed changes, sorted by file and line. Owner-approved findings move to `approved`. */
export async function reviewChanges(root, files, approved = []) {
  const found = [...lineViolations(files), ...await unclassifiedTests(root, files), ...await overLimitFiles(root, files)];
  const historical = await historicalLauncherFiles(root);
  const pending = await pendingStubs(root, files, found);
  const owners = approvedFindings(found, files, await readApprovals(root));
  for (const [item, approvedBy] of owners) approved.push({ ...item, approvedBy });
  approved.sort(byLocation);
  return found.filter(item => item.rule !== 'SR-RETIRED-LAUNCHER' || !historical.some(entry => entry.matcher.test(item.file)))
    .filter(item => !pending.has(item) && !owners.has(item)).sort(byLocation);
}

/** SR-FOCUSED-TEST findings that are the pending marker of a generated acceptance stub of an unfinished Increment (tooling/delivery/acceptance-guard.mjs). */
async function pendingStubs(root, files, found) {
  const candidates = found.filter(item => item.rule === 'SR-FOCUSED-TEST');
  if (!candidates.length) return new Set();
  const allowed = await pendingStubAllowance(root);
  const kept = new Set();
  for (const item of candidates) {
    const line = files.find(file => file.path === item.file)?.added.find(entry => entry.line === item.line)?.text;
    if (await allowed(item.file, line)) kept.add(item);
  }
  return kept;
}

/** Files the reviewed docs-launchers allowlist keeps as historical records; one list serves both guards. */
async function historicalLauncherFiles(root) {
  let text;
  try { text = await readFile(join(root, ALLOWLIST_PATH), 'utf8'); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return parseAllowlist(text).filter(entry => entry.rules.includes('retired-launcher'));
}

export function formatReport(report, warnOnly) {
  const label = warnOnly ? 'warning' : 'error';
  const lines = report.violations.map(item => `${label} [${item.rule}] ${item.file}:${item.line} ${item.message}`);
  for (const item of report.approved ?? []) lines.push(`approved [${item.rule}] ${item.file}:${item.line} by ${item.approvedBy} in ${APPROVALS_PATH}`);
  const scope = `${report.files} changed file(s) against ${report.base.ref} (${report.base.sha.slice(0, 12)})`;
  lines.push(report.violations.length
    ? `self-review: ${report.violations.length} finding(s) in ${scope}.${warnOnly ? ' --warn-only: not failing.' : ''}`
    : `self-review: no findings in ${scope}. This guard is a diff heuristic, not a substitute for the full gates or human review.`);
  return lines.join('\n');
}

export async function runSelfReview(argv, root = process.cwd()) {
  const options = parseArguments(argv);
  const base = resolveBase(root, options.base);
  const files = collectChanges(root, base.sha);
  const approved = [];
  const violations = await reviewChanges(root, files, approved);
  const report = { status: violations.length ? 'findings' : 'clean', base, files: files.length, violations, approved };
  return { report, options, failed: violations.length > 0 && !options.warnOnly };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { report, options, failed } = await runSelfReview(process.argv.slice(2));
    console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report, options.warnOnly));
    process.exitCode = failed ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
