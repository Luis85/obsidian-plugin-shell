/** Fail on raw colour literals in handwritten Vue style blocks and CSS. Plugin styles consume Obsidian tokens; they do not carry a palette. */
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanStyleSource } from './style-literals.mjs';
import { suggestTokens } from './style-literal-suggestions.mjs';
const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
const scanned = ['src'];
// Same scope as before the src project split: these subtrees were docs/concepts/companion and harness/, outside src.
// The companion concept keeps its own assembly and browser verification; the harness carries the simulated host palette.
const preSplitOutside = new Set(['src/companion', 'src/plugin/harness']);
async function listFiles(root, folder) {
  const found = [];
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    const path = folder + '/' + entry.name;
    if (entry.isDirectory()) { if (!preSplitOutside.has(path)) found.push(...await listFiles(root, path)); }
    else if (/\.(?:vue|css)$/.test(entry.name)) found.push(path);
  }
  return found.sort();
}
/** Exact-file allowlist entries with a reason; no glob, directory, absolute or parent path can suppress a scan. */
export function validateAllowlist(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.entries)) throw new Error('STYLE_ALLOWLIST_SHAPE');
  const seen = new Set();
  for (const entry of data.entries) {
    const path = entry?.path;
    if (typeof path !== 'string' || !/^src\/[\w./-]+\.(?:vue|css)$/.test(path) || path.includes('..') || seen.has(path)) throw new Error('STYLE_ALLOWLIST_PATH: ' + path);
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 10) throw new Error('STYLE_ALLOWLIST_REASON: ' + path);
    seen.add(path);
  }
  return data.entries;
}
/** Shared by the repository check and generated-project tests: scan in-memory files and apply the exact-file allowlist. */
export function evaluateStyleFiles(files, allowlist, catalog) {
  const allowed = new Set(allowlist.map((entry) => entry.path)), findings = [], used = new Set();
  for (const { path, content } of files) {
    const hits = scanStyleSource(path, content);
    if (hits.length && allowed.has(path)) used.add(path);
    else findings.push(...hits.map((hit) => ({ ...hit, suggestions: suggestTokens(hit, catalog) })));
  }
  const stale = allowlist.filter((entry) => !used.has(entry.path)).map((entry) => entry.path);
  return { status: findings.length || stale.length ? 'failed' : 'passed', files: files.length, findings, staleAllowlist: stale, allowlisted: [...used] };
}
export async function checkStyleLiterals(root = defaultRoot, options = {}) {
  const allowlist = validateAllowlist(options.allowlist ?? JSON.parse(await readFile(resolve(root, 'tooling/styles/style-literal-allowlist.json'), 'utf8')));
  const catalog = JSON.parse(await readFile(resolve(root, 'docs/design/obsidian-tokens.json'), 'utf8'));
  const paths = (await Promise.all(scanned.map((folder) => listFiles(root, folder)))).flat();
  const files = await Promise.all(paths.map(async (path) => ({ path, content: await readFile(resolve(root, path), 'utf8') })));
  return evaluateStyleFiles(files, allowlist, catalog);
}
export function formatFindings(findings) {
  return findings.map((hit) => `${hit.file}:${hit.line}:${hit.column} ${hit.literal} (${hit.kind}${hit.property ? ', ' + hit.property : ''}) use ${hit.suggestions.join(' or ')}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const json = process.argv.includes('--json');
    if (process.argv.slice(2).some((arg) => arg !== '--json')) throw new Error('UNKNOWN_ARGUMENT');
    const result = await checkStyleLiterals();
    if (json) console.log(JSON.stringify(result));
    else if (result.status === 'passed') console.log(`check:style-literals passed: ${result.files} CSS/Vue files under ${scanned.join(', ')} use no raw colour literals.`);
    else {
      for (const line of formatFindings(result.findings)) console.error(line);
      for (const path of result.staleAllowlist) console.error(`${path}: allowlist entry is stale (missing or already clean); remove it`);
      console.error('Raw colours break Obsidian light/dark themes. Use host tokens (docs/design/OBSIDIAN-TOKENS.md, docs/design/obsidian-tokens.json), color-mix() over tokens, transparent or currentColor.');
    }
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ status: 'failed', reason: error.message })); process.exitCode = 1; }
}
