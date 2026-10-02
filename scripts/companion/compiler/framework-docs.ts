/** A generated project is a product, not the framework: the maintainers' root documents and CI move
 * under docs/framework/ (kept as inert reference) and every copied Markdown link to them is rebased,
 * so the product README/AGENTS.md/CI own the root without breaking the framework docs' local links. */
import { posix } from 'node:path';
import type { Entry } from './file-code.ts';

const frameworkDocuments: ReadonlyMap<string, string> = new Map(
  ['README.md', 'AGENTS.md', 'TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md'].map(name => [name, `docs/framework/${name}`]));
const maintainerWorkflows = '.github/workflows/';
/** Where a copied framework file lives in a generated project. Maintainer workflows never run there. */
export function relocatedPath(path: string): string {
  return frameworkDocuments.get(path) ?? (path.startsWith(maintainerWorkflows) ? 'docs/framework/workflows/' + path.slice(maintainerWorkflows.length) : path);
}
/** The maintainer runner script, the policy test for maintainer CI triggers and the standalone
 * standalone design prototypes (their own apps and retained evidence) are not copied. */
export function maintainerOnly(path: string): boolean {
  return path === 'docs/concepts/companion/companion-project.json' || path.startsWith('docs/concepts/companion/seeds/')
    || path.startsWith('configs/starters/') || path.startsWith('docs/concepts/companion/starters/') || path === '.github/workflows/starter-distribution.yml'
    || path.startsWith('.github/scripts/') || path === 'tests/tooling/qualification-trigger.checks.mjs'
    || path.startsWith('docs/concepts/sitemap-editor/')
    || path === 'docs/concepts/native-file-integration-handoff' || path === '.github/workflows/native-source-handoff.yml'
    || path.startsWith('docs/concepts/native-file-integration-handoff/') || path === 'tests/tooling/project-generator-native-handoff.checks.mjs'
    || path.startsWith('docs/concepts/jev-prompt-editor/') || path === 'tests/tooling/jev-concept-distribution.checks.mjs';
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
/** Rewrites inline links outside fenced code blocks; everything else is byte-identical. */
export function rebaseMarkdown(text: string, from: string, to: string): string {
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
        if (maintainerOnly(resolved)) return open.replace(/^!?\[/, '').slice(0, -2) + ' (maintainer-only asset, not included)';
      }
      const next = relink(value, from, to);
      return open + (angled ? `<${next}>` : next) + close;
    });
  }).join('\n');
}
/** Move the root framework documents and maintainer workflows; rebase links in copied Markdown. */
export function relocateFrameworkDocuments(entries: Map<string, Entry>): void {
  for (const [path, entry] of [...entries]) {
    if (entry.ownership !== 'framework') continue;
    const to = relocatedPath(path);
    const content = !entry.encoding && path.endsWith('.md') ? rebaseMarkdown(entry.content, path, to) : entry.content;
    if (to === path && content === entry.content) continue;
    if (to !== path) entries.delete(path);
    entries.set(to, { ...entry, path: to, content });
  }
}
