// Fails when live docs, skills, templates or source refer to a retired CLI launcher.
// `node bin/app` is the only entry. Historical records are listed, with a reason,
// in scripts/quality/docs-launchers-allowlist.json; stale entries fail too.
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES = Object.freeze({
  'retired-launcher': /(?<![\w-])(?:shell|app)\.mjs(?![\w-])/,
  'kit-layout-path': /tools\/shell-cli\/bin\/app/,
});
const SCANNED = /\.(?:md|json|ya?ml|[cm]?[jt]s|vue|sh)$/;
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'reports', '.dev-vault', 'dist', 'coverage', '.vite', '.fallow']);
// Nested agent worktrees are separate checkouts of this repository, not its content.
const SKIPPED_PATHS = new Set(['.claude/worktrees']);
const ALLOWLIST_PATH = 'scripts/quality/docs-launchers-allowlist.json';

export function findReferences(text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [rule, pattern] of Object.entries(RULES)) if (pattern.test(line)) hits.push({ rule, line: index + 1 });
  });
  return hits;
}
export function globToRegExp(glob) {
  const source = glob.split('**').map(part => part.split('*').map(piece => piece.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*');
  return new RegExp(`^${source}$`);
}
export function parseAllowlist(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.entries)) throw new Error('ALLOWLIST_SHAPE_INVALID');
  return data.entries.map(entry => {
    const valid = entry && typeof entry.glob === 'string' && entry.glob
      && typeof entry.reason === 'string' && entry.reason.trim()
      && Array.isArray(entry.rules) && entry.rules.length && entry.rules.every(rule => Object.hasOwn(RULES, rule));
    if (!valid) throw new Error(`ALLOWLIST_ENTRY_INVALID: ${JSON.stringify(entry?.glob ?? entry)}`);
    return { ...entry, matcher: globToRegExp(entry.glob), used: false };
  });
}
async function collect(root, folder = '') {
  const files = [];
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { if (!SKIPPED_DIRS.has(entry.name) && !SKIPPED_PATHS.has(path)) files.push(...await collect(root, path)); }
    else if (entry.isFile() && SCANNED.test(entry.name)) files.push(path);
  }
  return files;
}
export async function checkDocsLaunchers(root = process.cwd(), allowlistText) {
  root = resolve(root);
  const entries = parseAllowlist(allowlistText ?? await readFile(join(root, ALLOWLIST_PATH), 'utf8'));
  const failures = []; let scanned = 0; let allowed = 0;
  for (const file of (await collect(root)).sort()) {
    scanned++;
    for (const { rule, line } of findReferences(await readFile(join(root, ...file.split('/')), 'utf8'))) {
      const entry = entries.find(item => item.rules.includes(rule) && item.matcher.test(file));
      if (entry) { entry.used = true; allowed++; } else failures.push(`${file}:${line}: ${rule}`);
    }
  }
  const stale = entries.filter(entry => !entry.used).map(entry => `${entry.glob}: stale allowlist entry (no matching reference)`);
  if (failures.length || stale.length) {
    throw new Error(['DOCS_LAUNCHER_REFERENCES: use `node bin/app <command>` or add a reasoned historical entry to ' + ALLOWLIST_PATH, ...failures, ...stale].join('\n'));
  }
  return { status: 'passed', scanned, allowedHistorical: allowed, allowlistEntries: entries.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('NO_ARGUMENTS_SUPPORTED');
    console.log(JSON.stringify(await checkDocsLaunchers()));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
