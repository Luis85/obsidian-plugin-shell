import { serializeJson as json } from '../contracts/serialization.ts';
import { posix } from 'node:path';
import { object } from './configuration.ts';
import { hash } from './files.ts';
import { requireThat } from './contracts.ts';
/** Prototype implementation and its assembly checks are maintainer-only, not consumer dependencies. */
const excludedRoots = ['docs/concepts/companion/src/', 'docs/concepts/companion/vendor/', 'scripts/concepts/', 'tests/concepts/'];
const excludedFiles = new Set(['docs/concepts/companion/index.html', '.github/workflows/companion-concept-verification.yml', 'tests/tooling/companion-boundaries.checks.mjs', 'tests/tooling/concept-metrics.checks.mjs']);
export function included(path: string): boolean {
  return !excludedFiles.has(path) && !excludedRoots.some(prefix => path.startsWith(prefix));
}
function availableLink(path: string, target: string): boolean {
  if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) return true;
  return included(posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(target.split(/[?#]/, 1)[0]!))));
}
/** Keep the reference prose, but do not leave local links to deliberately unshipped prototype files. */
function documentation(path: string, source: string): string {
  let fence: string | null = null;
  return source.split('\n').map(line => {
    const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (match) { if (!fence) fence = match[1]!; else if (fence[0] === match[1]![0] && match[1]!.length >= fence.length) fence = null; return line; }
    if (fence) return line;
    return line.replace(/!?\[([^\]\n]*)\]\(([^\s)]+)\)/g, (original: string, label: string, target: string) => availableLink(path, target) ? original : `${label} (prototype asset not included in this kit)`);
  }).join('\n');
}
export function standaloneSource(path: string, bytes: Buffer): Buffer {
  // Normalize only distributed UTF-8 text; never rewrite checkout files or binary fixtures.
  if (!path.endsWith('.gz')) bytes = Buffer.from(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n'));
  if (path.endsWith('.md') || path.endsWith('.md.txt')) {
    const intro = path === 'README.md' ? '# Framework developer kit\n\nStart in this extracted folder with `node shell.mjs setup` or `npm run setup`. The compiled CLI runs before dependency installation. Choose a project JSON or an explicit blank design, review generation, then approve dependency installation separately.\n\nFor automation use `node shell.mjs help --json` and `node shell.mjs schema --json`. Run `node shell.mjs build`, `test`, and `verify --profile project` after generation and installation. Actual native qualification and public-release approval remain separate.\n\nSee [CLI workflow](docs/development/FRAMEWORK-CLI.md) for invocation, safe plan/apply, fixtures, maintenance and release boundaries.\n\n## Retained framework reference\n\n' : '';
    return Buffer.from(intro + documentation(path, bytes.toString('utf8')));
  }
  if (path === '.fallowrc.json') {
    const config = object(JSON.parse(bytes.toString('utf8')));
    requireThat(Array.isArray(config.entry), 'KIT_ANALYZER', 'Missing reviewed analyzer entries.');
    config.entry = config.entry.filter(value => typeof value === 'string' && included(value));
    return Buffer.from(json(config));
  }
  return bytes;
}
/** Every example-owned file the kit ships in adapted form gets its reviewed hash refreshed; unknown preimages are refused. */
export function updateOwnership(originals: Map<string, Buffer>, shipped: Map<string, Buffer>, metadata: Buffer): Buffer {
  const value = object(JSON.parse(metadata.toString('utf8')));
  requireThat(Array.isArray(value.files), 'KIT_OWNERSHIP', 'Invalid example-removal metadata.');
  const records = value.files.map(object);
  requireThat(records.some(file => file.path === 'README.md'), 'KIT_OWNERSHIP', 'The framework README is not an example-owned file.');
  for (const record of records) {
    const path = String(record.path); const original = originals.get(path); const adapted = shipped.get(path);
    if (typeof record.sha256 !== 'string' || !original || !adapted || adapted.equals(original)) continue;
    const reviewedText = new TextDecoder('utf-8', { fatal: true }).decode(original).replace(/\r\n/g, '\n');
    requireThat(record.sha256 === hash(original) || record.sha256 === hash(reviewedText), 'KIT_OWNERSHIP', path + ' is not the reviewed preimage; refuse silent ownership adoption.');
    record.sha256 = hash(adapted);
  }
  return Buffer.from(json(value));
}
