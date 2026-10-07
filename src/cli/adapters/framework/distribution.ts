import { serializeJson as json } from '#shared/contracts/serialization.ts';
import { posix } from 'node:path';
import { object } from './configuration.ts';
import { hash } from './files.ts';
import { requireThat } from './contracts.ts';
import { deliveryPipelineFiles, deliveryPipelineFolder } from '../../compiler/domain/template-inputs.ts';
/** Prototype implementation and its assembly checks are maintainer-only, not consumer dependencies; so are the projects/<name>
 * tooling and the workflows it syncs from those standalone projects. */
const excludedRoots = [deliveryPipelineFolder, '.github/workflows/projects--', 'tooling/projects/', 'configs/starters/', 'src/companion/app/', 'docs/concepts/companion/vendor/', 'docs/concepts/sitemap-editor/', 'docs/concepts/jev-prompt-editor/', 'docs/concepts/agents-prototype-0.15/', 'tooling/concepts/', 'src/companion/tests/concepts/', 'tests/fixtures/sites/'];
const excludedFiles = new Set(['docs/concepts/companion/index.html', '.github/workflows/companion-concept-verification.yml', '.github/workflows/projects-boundary.yml', '.github/workflows/projects-required-checks.yml', 'tooling/tests/projects-boundary.checks.mjs', 'tooling/tests/companion-boundaries.checks.mjs', 'tooling/tests/concept-metrics.checks.mjs', 'src/cli/tests/jev-concept-distribution.checks.mjs', 'src/cli/tests/project-generator-native-starters.checks.mjs',
  // The developer guide describes working in the framework checkout, not an extracted kit.
  'DEVELOPER_GUIDE.md',
  // The isolated manual renderer's own npm package (tooling/documentation) was never a template root.
  ...['.gitignore', 'package.json', 'package-lock.json'].map(name => `tooling/documentation/${name}`),
  // Site template qualification builds the framework's own templates/sites; kits carry the templates, not this tooling.
  '.github/workflows/site-templates.yml', 'tooling/testing/qualify-site-templates.mjs', 'tooling/tests/site-templates-qualification.checks.mjs',
  // Starter-pack qualification reads canonical definitions and concept builders that only the maintainer checkout carries.
  '.github/workflows/starter-distribution.yml', ...deliveryPipelineFiles, 'tooling/tests/starter-golden.checks.mjs', 'src/cli/tests/starter-definitions.checks.mjs', 'src/cli/tests/starter-lifecycle.checks.mjs',
  'src/shared/tests/starter-classic-assembly.checks.mjs', 'tooling/tests/starter-distribution.checks.mjs']);
/** These reviewed runtime libraries are compiler dependencies, not starter content. */
const runtimeAssets = new Set(['vue-flow-core.iife.js', 'vue-flow.scoped.css', 'packages.json', 'vue-flow-core-LICENSE.txt', 'd3-NOTICE.txt', 'vueuse-NOTICE.txt'].map(name => 'docs/concepts/companion/vendor/' + name));
export function included(path: string): boolean {
  if (runtimeAssets.has(path)) return true;
  return !excludedFiles.has(path) && !excludedRoots.some(prefix => path.startsWith(prefix));
}
const external = (target: string): boolean => /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target);
function availableLink(path: string, target: string): boolean {
  if (external(target)) return true;
  return included(posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(target.split(/[?#]/, 1)[0]!))));
}
type LinkMapper = (original: string, label: string, target: string) => string;
/** Rewrites Markdown links outside fenced code blocks; fenced examples stay byte-exact. */
function mapLinks(source: string, mapper: LinkMapper): string {
  let fence: string | null = null;
  return source.split('\n').map(line => {
    const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (match) { if (!fence) fence = match[1]!; else if (fence[0] === match[1]![0] && match[1]!.length >= fence.length) fence = null; return line; }
    if (fence) return line;
    return line.replace(/!?\[([^\]\n]*)\]\(([^\s)]+)\)/g, mapper);
  }).join('\n');
}
/** Keep the reference prose, but do not leave local links to deliberately unshipped prototype files. */
function documentation(path: string, source: string): string {
  return mapLinks(source, (original, label, target) => availableLink(path, target) ? original : `${label} (maintainer asset, not included in this kit)`);
}
/**
 * The kit root README sits beside bin/, while the documents it links ship under bin/template/.
 * Every relative link is rebased onto that shipped copy so it resolves in an extracted kit.
 */
export function kitRootReadme(bytes: Buffer): Buffer {
  const rebased = mapLinks(bytes.toString('utf8'), (original, _label, target) => external(target)
    ? original : original.replace(`](${target})`, `](${posix.join('bin/template', target)})`));
  return Buffer.from(rebased);
}
export function standaloneSource(path: string, bytes: Buffer): Buffer {
  // Normalize only distributed UTF-8 text; never rewrite checkout files or binary fixtures.
  if (!path.endsWith('.gz')) bytes = Buffer.from(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n'));
  if (path.endsWith('.md') || path.endsWith('.md.txt')) {
    const intro = path === 'README.md' ? '# Framework developer kit\n\nStart in this extracted folder with `node bin/app setup` or `npm run setup`. The compiled CLI runs before dependency installation. Choose a project JSON or an explicit blank design, review generation, then approve dependency installation separately. Starters are a separate download: extract workbench-starters-<version>.zip into the same package root to populate configs/starters, then run node bin/app starters list. The CLI itself is self-contained under bin/; no starter definitions are bundled in the shell archive.\n\nFor automation use `node bin/app help --json` and `node bin/app schema --json`. Run `node bin/app build`, `test`, and `verify --profile project` after generation and installation. Actual native qualification and public-release approval remain separate.\n\nSee [CLI workflow](docs/development/FRAMEWORK-CLI.md) for invocation, safe plan/apply, fixtures, maintenance and release boundaries.\n\n## Retained framework reference\n\n' : '';
    return Buffer.from(intro + documentation(path, bytes.toString('utf8')));
  }
  if (path === 'configs/quality/fallow.json') {
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
