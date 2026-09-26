/**
 * `check submission`: a read-only local mirror of documented Obsidian community review rules.
 * Every rule cites its source. The Community directory scan also runs policy, vulnerability and
 * malware checks that are not reproduced here, so a pass is not a review outcome.
 */
import { join } from 'node:path';
import { exists, readBounded } from './files.ts';
import { runNode } from './process.ts';
import { OperationError, result, type Context, type Result } from './contracts.ts';
export type RuleStatus = 'pass' | 'fail' | 'warn';
export interface RuleResult { id: string; category: 'manifest' | 'repository' | 'lint' | 'build'; status: RuleStatus; message: string; remediation?: string; source: string }
/** Official sources, fetched 2026-09-26. */
const sources = {
  // "The ID must contain only lowercase letters and hyphens, can't end with `plugin`, and can't contain `obsidian`."
  manifest: 'https://docs.obsidian.md/Reference/Manifest',
  // Required README.md, LICENSE and manifest.json; release assets main.js, manifest.json, optional styles.css.
  submit: 'https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin',
  // Rule used by the automated review: required/allowed keys, forbidden words, description format, fundingUrl.
  validateManifest: 'https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/validate-manifest.md',
  // The Community directory scans each release with eslint-plugin-obsidianmd.
  eslint: 'https://github.com/obsidianmd/eslint-plugin',
  // "Update your versions.json file with "new-plugin-version": "minimum-obsidian-version"".
  versions: 'https://github.com/obsidianmd/obsidian-sample-plugin#releasing-new-releases',
} as const;
const required: Record<string, string> = { id: 'string', name: 'string', version: 'string', minAppVersion: 'string', description: 'string', author: 'string', isDesktopOnly: 'boolean' };
const optional = ['authorUrl', 'fundingUrl'];
const semver = /^\d+\.\d+\.\d+$/;
const forbidden = (value: unknown) => typeof value === 'string' ? ['obsidian', 'plugin'].filter(word => value.toLowerCase().includes(word)) : [];
const rule = (id: string, category: RuleResult['category'], source: string, failure: string | null, pass: string, remediation: string, warning?: string | null): RuleResult =>
  failure ? { id, category, status: 'fail', message: failure, remediation, source } : warning ? { id, category, status: 'warn', message: warning, remediation, source } : { id, category, status: 'pass', message: pass, source };
function descriptionProblem(value: unknown): string | null {
  if (typeof value !== 'string') return 'description is missing.';
  const problems = [value.length < 10 || value.length > 250 ? `has ${value.length} characters (10-250 allowed)` : '', /^[A-Z]/.test(value) ? '' : 'must start with a capital letter',
    value.endsWith('.') ? '' : 'must end with a period', /^[A-Za-z0-9\s.,!?'"-]+$/.test(value) ? '' : 'contains characters outside letters, digits, spaces and .,!?\'"-',
    forbidden(value).length ? `must not contain "${forbidden(value).join('" or "')}"` : ''].filter(Boolean);
  return problems.length ? `description ${problems.join('; ')}.` : null;
}
function fundingProblem(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value === 'string') return value ? null : 'fundingUrl must not be empty.';
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.values(value);
    return entries.length && entries.every(item => typeof item === 'string' && item) ? null : 'fundingUrl object must contain only non-empty strings.';
  }
  return 'fundingUrl must be a string or an object of strings.';
}
/** Pure manifest rules; `text` is the raw manifest.json content (null when absent). */
export function manifestRules(text: string | null): RuleResult[] {
  let manifest: Record<string, unknown> | null = null;
  try { const parsed: unknown = text === null ? null : JSON.parse(text); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) manifest = parsed as Record<string, unknown>; } catch { manifest = null; }
  const present = rule('manifest-json', 'manifest', sources.submit, manifest ? null : text === null ? 'manifest.json is missing from the project root.' : 'manifest.json is not a single JSON object.', 'manifest.json is a JSON object.', 'Add a root manifest.json object describing the plugin.');
  if (!manifest) return [present];
  const m = manifest;
  // The Manifest reference marks these fields required; an empty string supplies no value.
  const missing = Object.entries(required).filter(([key, type]) => typeof m[key] !== type || m[key] === '').map(([key, type]) => `${key} (${type === 'string' ? 'non-empty string' : type})`);
  const extra = Object.keys(m).filter(key => !Object.hasOwn(required, key) && !optional.includes(key));
  const id = typeof m.id === 'string' ? m.id : '';
  const idFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? null : `id "${id}" must use lowercase letters and single hyphens.`;
  return [present,
    rule('manifest-required-fields', 'manifest', sources.manifest, missing.length ? `Missing or mistyped: ${missing.join(', ')}.` : null, 'All required fields are present with the right types.', 'Add id, name, version, minAppVersion, description, author (strings) and isDesktopOnly (boolean).'),
    rule('manifest-allowed-fields', 'manifest', sources.validateManifest, extra.length ? `Fields not allowed by the review rule: ${extra.join(', ')}.` : null, 'Only documented manifest fields are used.', 'Remove fields other than the required ones, authorUrl and fundingUrl.'),
    rule('id-format', 'manifest', sources.manifest, idFormat, 'id uses lowercase letters and hyphens.', 'Use an id of lowercase letters and single hyphens, e.g. "quick-capture".', /\d/.test(id) ? `id "${id}" contains digits; the Manifest reference lists only lowercase letters and hyphens.` : null),
    rule('id-forbidden-words', 'manifest', sources.manifest, id.includes('obsidian') ? 'id must not contain "obsidian".' : id.endsWith('plugin') ? 'id must not end with "plugin".' : forbidden(id).length ? `id must not contain "${forbidden(id).join('" or "')}" (validate-manifest).` : null, 'id avoids "obsidian" and "plugin".', 'Choose an id without "obsidian" or "plugin"; it must also be unique across published plugins.'),
    rule('name-forbidden-words', 'manifest', sources.validateManifest, forbidden(m.name).length ? `name must not contain "${forbidden(m.name).join('" or "')}".` : null, 'name avoids "obsidian" and "plugin".', 'Rename the plugin without the words "Obsidian" or "Plugin".'),
    rule('version-semver', 'manifest', sources.manifest, typeof m.version === 'string' && semver.test(m.version) ? null : `version "${String(m.version ?? '')}" is not x.y.z.`, 'version uses x.y.z.', 'Use Semantic Versioning in the format x.y.z, e.g. 1.0.0.'),
    rule('min-app-version', 'manifest', sources.manifest, typeof m.minAppVersion === 'string' && m.minAppVersion ? null : 'minAppVersion is missing.', 'minAppVersion is set.', 'Set minAppVersion to the lowest Obsidian version you test against, e.g. 1.5.0.', typeof m.minAppVersion === 'string' && m.minAppVersion && !semver.test(m.minAppVersion) ? `minAppVersion "${m.minAppVersion}" is not x.y.z.` : null),
    rule('description-format', 'manifest', sources.validateManifest, descriptionProblem(m.description), 'description is 10-250 plain characters, capitalized and ends with a period.', 'Write one plain sentence of 10-250 characters that starts with a capital letter, ends with a period and omits "Obsidian"/"plugin".'),
    rule('funding-url', 'manifest', sources.validateManifest, fundingProblem(m.fundingUrl), m.fundingUrl === undefined ? 'fundingUrl is not used.' : 'fundingUrl is well formed.', 'Remove fundingUrl or give it non-empty URL strings.'),
  ];
}
/** versions.json must map the current version to its minAppVersion. */
export function versionsRule(manifestText: string | null, versionsText: string | null): RuleResult {
  let problem: string | null = null;
  try {
    const manifest = JSON.parse(manifestText ?? 'null') as { version?: unknown; minAppVersion?: unknown } | null, versions: unknown = versionsText === null ? null : JSON.parse(versionsText);
    if (versions === null) problem = 'versions.json is missing.';
    else if (typeof versions !== 'object' || Array.isArray(versions) || !Object.values(versions).every(value => typeof value === 'string')) problem = 'versions.json must map versions to minimum app versions (strings).';
    else if (!manifest || (versions as Record<string, string>)[String(manifest.version)] !== manifest.minAppVersion) problem = `versions.json does not map ${String(manifest?.version)} to ${String(manifest?.minAppVersion)}.`;
  } catch { problem = 'versions.json or manifest.json is not valid JSON.'; }
  return rule('versions-json', 'repository', sources.versions, problem, 'versions.json maps the current version to its minAppVersion.', 'Add "<version>": "<minAppVersion>" for the current manifest version to versions.json.');
}
async function text(path: string): Promise<string | null> {
  return await exists(path) ? (await readBounded(path)).toString('utf8') : null;
}
interface LintFile { filePath: string; messages: Array<{ ruleId: string | null; severity: number; line?: number }> }
/** Reuses the project's ESLint configuration (eslint-plugin-obsidianmd recommended + type-checked). */
export function lintRule(report: LintFile[] | null, root: string, problem?: string): RuleResult {
  const remediation = 'Run eslint src and fix each reported rule; see the eslint-plugin-obsidianmd rule docs.';
  if (!report) return rule('eslint-obsidianmd', 'lint', sources.eslint, problem ?? 'ESLint did not produce a report.', '', problem?.includes('not installed') ? 'Install dependencies: node shell.mjs install --yes' : remediation);
  const counts = new Map<string, { count: number; first: string }>();
  for (const file of report) for (const message of file.messages) {
    const id = message.ruleId ?? 'parse-error', entry = counts.get(id) ?? { count: 0, first: `${file.filePath.startsWith(root) ? file.filePath.slice(root.length + 1) : file.filePath}:${message.line ?? 0}` };
    entry.count++; counts.set(id, entry);
  }
  const top = [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([id, entry]) => `${id} x${entry.count} (first ${entry.first})`);
  const obsidian = [...counts.entries()].filter(([id]) => id.startsWith('obsidianmd/')).reduce((sum, [, entry]) => sum + entry.count, 0);
  const total = [...counts.values()].reduce((sum, entry) => sum + entry.count, 0);
  return rule('eslint-obsidianmd', 'lint', sources.eslint, total ? `${total} ESLint problems (${obsidian} from obsidianmd rules): ${top.join('; ')}.` : null, `ESLint (with eslint-plugin-obsidianmd) reports no problems in ${report.length} files.`, remediation);
}
async function lint(context: Context): Promise<RuleResult> {
  const args = ['src', '--format', 'json', '--max-warnings', '0'];
  let stdout: string;
  try { stdout = (await runNode({ ...context, progress: undefined }, 'node_modules/eslint/bin/eslint.js', args)).stdout; }
  catch (error) {
    if (!(error instanceof OperationError)) throw error;
    if (error.code === 'TOOL_MISSING') return lintRule(null, context.root, 'ESLint is not installed.');
    const execution = (error.details as { execution?: { stdout?: string; truncated?: boolean } } | undefined)?.execution;
    if (error.code !== 'PROCESS_FAILED' || !execution?.stdout || execution.truncated) return lintRule(null, context.root, `ESLint could not complete (${error.code}).`);
    stdout = execution.stdout;
  }
  try { return lintRule(JSON.parse(stdout) as LintFile[], context.root); } catch { return lintRule(null, context.root, 'ESLint output was not a JSON report.'); }
}
async function buildRule(root: string, manifestText: string | null): Promise<RuleResult[]> {
  const missing = [];
  for (const name of ['main.js', 'manifest.json']) if (!(await text(join(root, 'dist', name)))) missing.push(`dist/${name}`);
  let identity: string | null = null;
  if (!missing.length) {
    try {
      const built = JSON.parse((await text(join(root, 'dist/manifest.json')))!) as Record<string, unknown>, source = JSON.parse(manifestText ?? 'null') as Record<string, unknown> | null;
      if (!source || built.id !== source.id || built.version !== source.version) identity = 'dist/manifest.json id/version differ from manifest.json.';
    } catch { identity = 'dist/manifest.json is not valid JSON.'; }
  }
  const styles = await exists(join(root, 'dist/styles.css'));
  return [rule('build-artifacts', 'build', sources.submit, missing.length ? `Missing release assets: ${missing.join(', ')}.` : identity, 'dist/main.js and dist/manifest.json exist and match manifest.json.', 'Build the release assets: node shell.mjs build'),
    rule('build-styles', 'build', sources.submit, null, styles ? 'dist/styles.css exists.' : '', 'Build again if the plugin ships styles: node shell.mjs build', styles ? null : 'dist/styles.css is absent (optional unless the plugin has styles).')];
}
export async function submissionCheck(context: Context): Promise<Result> {
  const root = context.root, manifestText = await text(join(root, 'manifest.json'));
  const rules = [...manifestRules(manifestText), versionsRule(manifestText, await text(join(root, 'versions.json'))),
    rule('license', 'repository', sources.submit, (await Promise.all(['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map(name => exists(join(root, name))))).some(Boolean) ? null : 'No LICENSE file in the project root.', 'LICENSE is present.', 'Add a LICENSE file (see https://choosealicense.com/).'),
    rule('readme', 'repository', sources.submit, await exists(join(root, 'README.md')) ? null : 'No README.md in the project root.', 'README.md is present.', 'Add a README.md that describes the plugin and how to use it.'),
    await lint(context), ...await buildRule(root, manifestText)];
  const failed = rules.filter(item => item.status === 'fail');
  const outcome = result('check submission', { scope: 'local mirror of documented review rules; the Community directory also runs policy, vulnerability and malware scans not reproduced here', readOnly: true,
    rules, summary: { pass: rules.filter(item => item.status === 'pass').length, warn: rules.filter(item => item.status === 'warn').length, fail: failed.length } }, failed.length ? 'blocked' : 'ok');
  if (failed.length) outcome.diagnostics.push({ code: 'SUBMISSION_RULES_FAILED', message: `${failed.length} submission rule${failed.length === 1 ? '' : 's'} failed: ${failed.map(item => item.id).join(', ')}.`, next: failed[0]!.remediation! });
  return outcome;
}
