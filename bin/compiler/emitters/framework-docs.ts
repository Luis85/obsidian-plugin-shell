/** A generated project is a product, not the framework: the maintainers' root documents and CI move
 * under docs/framework/ (kept as inert reference) and every copied Markdown link to them is rebased,
 * so the product README/AGENTS.md/CI own the root without breaking the framework docs' local links. */
import { posix } from 'node:path';
import type { Entry } from './file-code.ts';
import { frameworkOnlyPath, referenceDocPath, rewriteDocReferences, withBanner } from './framework-scope.ts';
import { json, requireValue, row } from './model.ts';
import { deliveryPipelineFiles, deliveryPipelineFolder } from '../domain/template-inputs.ts';

const frameworkDocuments: ReadonlyMap<string, string> = new Map(
  ['README.md', 'AGENTS.md', 'TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md'].map(name => [name, `docs/framework/${name}`]));
const maintainerWorkflows = '.github/workflows/';
/** Where a copied framework file lives in a generated project. Maintainer workflows never run there. */
export function relocatedPath(path: string): string {
  return frameworkDocuments.get(path) ?? referenceDocPath(path) ?? (path.startsWith(maintainerWorkflows) ? 'docs/framework/workflows/' + path.slice(maintainerWorkflows.length) : path);
}
/** The maintainer runner script, the policy test for maintainer CI triggers, the project handoff qualification (it generates
 * projects from the framework's starters), the framework's delivery pipeline, the framework docs index, the standalone design
 * prototypes (their own apps and retained evidence) and the framework checkout's DEVELOPER_GUIDE.md are not copied. Neither are
 * the runtime tests of the shell's own src/main.ts entry (and the example-removal template of one): a generated project replaces
 * src/main.ts with its generated entry, whose registrations those tests cannot see, while every other shipped framework test
 * still runs there under test:framework. */
const maintainerFiles: ReadonlySet<string> = new Set(['DEVELOPER_GUIDE.md', '.github/workflows/starter-distribution.yml', ...deliveryPipelineFiles,
  'tests/tooling/qualification-trigger.checks.mjs', 'tests/tooling/project-generator-native-starters.checks.mjs', 'tests/tooling/jev-concept-distribution.checks.mjs',
  'scripts/testing/qualify-project-handoff.mjs', 'tests/tooling/agent-project-handoff.checks.mjs', 'docs/README.md',
  'tests/runtime/shell-entry-lifecycle.test.ts', 'templates/examples/tests__runtime__shell-entry-lifecycle.test.ts.txt', 'tests/runtime/obsidian-test-kit-shell-entry.test.ts']);
const maintainerPrefixes = ['configs/starters/', '.github/scripts/', deliveryPipelineFolder,
  'docs/concepts/sitemap-editor/', 'docs/concepts/jev-prompt-editor/', 'scripts/testing/handoff-'];
export function maintainerOnly(path: string): boolean {
  return frameworkOnlyPath(path) || maintainerFiles.has(path) || maintainerPrefixes.some(prefix => path.startsWith(prefix));
}
const external = /^(?:[a-z][a-z\d+.-]*:|#|\/\/|\/)/i;
function relink(value: string, from: string, to: string): string {
  if (external.test(value)) return value;
  const cut = value.search(/[?#]/); const path = cut < 0 ? value : value.slice(0, cut); const suffix = cut < 0 ? '' : value.slice(cut);
  if (!path) return value;
  let decoded: string; try { decoded = decodeURIComponent(path); } catch { return value; }
  const resolved = posix.normalize(posix.join(posix.dirname(from), decoded));
  const target = relocatedPath(resolved);
  if (target === resolved && posix.dirname(from) === posix.dirname(to)) return value;
  return encodeURI(posix.relative(posix.dirname(to), target) || posix.basename(target)) + suffix;
}
/** Rewrites inline links outside fenced code blocks; everything else is byte-identical. A link to an `omitted`
 * framework input (maintainer-only, or not shipped for the project's hosting platform) becomes plain text. */
export function rebaseMarkdown(text: string, from: string, to: string, omitted: (path: string) => boolean = maintainerOnly): string {
  let fence: string | null = null;
  return text.split('\n').map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker && !fence) { fence = marker; return line; }
    if (marker && fence && marker[0] === fence[0] && marker.length >= fence.length) { fence = null; return line; }
    if (fence) return line;
    return line.replace(/(!?\[[^\]\n]*\]\()(<[^>]+>|[^\s)]+)(\))/g, (whole, open: string, raw: string, close: string) => {
      const angled = raw.startsWith('<');
      const value = angled ? raw.slice(1, -1) : raw;
      if (!external.test(value)) {
        let resolved: string;
        try { resolved = posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(value.split(/[?#]/, 1)[0]!))); }
        catch { return whole; }
        if (omitted(resolved)) return open.replace(/^!?\[/, '').slice(0, -2) + ' (maintainer-only asset, not included)';
      }
      const next = relink(value, from, to);
      return open + (angled ? `<${next}>` : next) + close;
    });
  }).join('\n');
}
/** Every Markdown file under docs/framework/ is reference material: it names the real instructions and mentions
 * other kept framework docs by their relocated path. */
function referenceBanner(text: string, to: string): string {
  return to.startsWith('docs/framework/') ? withBanner(rewriteDocReferences(text)) : text;
}
/** Move the root framework documents and maintainer workflows; rebase links in copied Markdown. */
export function relocateFrameworkDocuments(entries: Map<string, Entry>, omitted: (path: string) => boolean = maintainerOnly): void {
  // Iterate a snapshot: relocated entries are re-inserted under their new paths.
  for (const [path, entry] of Array.from(entries)) {
    if (entry.ownership !== 'framework') continue;
    const to = relocatedPath(path);
    const content = !entry.encoding && path.endsWith('.md') ? referenceBanner(rebaseMarkdown(entry.content, path, to, omitted), to) : entry.content;
    if (to === path && content === entry.content) continue;
    if (to !== path) {
      // Never let a relocated root document silently replace another file at its new home.
      requireValue(!entries.has(to), 'Relocated framework file collides with an existing template file: ' + to);
      entries.delete(path);
    }
    entries.set(to, { ...entry, path: to, content });
  }
}
const exampleOwnership = 'scripts/examples/ownership.json';
/** Example removal plans every file its ownership manifest lists, and a listed file that is absent is an edit conflict.
 * A generated project's manifest therefore lists only the example files the project received. */
export function scopeExampleOwnership(entries: Map<string, Entry>): void {
  const entry = entries.get(exampleOwnership);
  if (!entry) return;
  const manifest = row(JSON.parse(entry.content));
  requireValue(Array.isArray(manifest.files), 'Invalid example-removal ownership manifest: ' + exampleOwnership);
  const files = manifest.files.filter((file: unknown) => { const path = row(file).path; return typeof path !== 'string' || !maintainerOnly(path); });
  if (files.length !== manifest.files.length) entries.set(exampleOwnership, { ...entry, content: json({ ...manifest, files }) });
}
