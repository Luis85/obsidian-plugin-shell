/**
 * Obsidian wikilinks (`[[path]]`, `[[path|alias]]`, `[[Name#heading]]`) as the Definition of Ready reads them:
 * found in authored prose only, resolved by repository path (with or without `.md`) or by a case-insensitive
 * basename. DoR accepts any basename match; here several matches are reported as ambiguous.
 */
import { prose } from './sections.ts';

export interface Wikilink { target: string; path: string; heading: string | null; alias: string | null; line: number }
/** The parts of one `[[…]]` target; the path keeps its written form, without a leading `./`. */
export function parseWikilink(target: string): Omit<Wikilink, 'line'> {
  const [left = '', ...aliases] = target.split('|'), [path = '', ...headings] = left.split('#');
  const alias = aliases.join('|').trim(), anchor = headings.join('#').trim();
  return { target: target.trim(), path: path.trim().replace(/^\.\//, ''), heading: anchor || null, alias: alias || null };
}
/** Wikilinks in authored prose (outside comments, fences and inline code), in order, with 1-based lines. */
export function extractWikilinks(text: string): Wikilink[] {
  return prose(text.replace(/\r\n?/g, '\n')).split('\n').flatMap((line, index) =>
    [...line.matchAll(/\[\[([^[\]\n]+)\]\]/g)].map(match => ({ ...parseWikilink(match[1]!), line: index + 1 })));
}

export type WikilinkResolution =
  | { status: 'resolved'; path: string }
  | { status: 'missing' }
  | { status: 'ambiguous'; candidates: string[] };
/** Resolves against repository-relative file paths (the `git ls-files` view the DoR uses). */
export function resolveWikilink(files: readonly string[], target: string): WikilinkResolution {
  const { path } = parseWikilink(target);
  if (!path) return { status: 'missing' };
  if (path.includes('/')) {
    const found = [path, `${path}.md`].find(candidate => files.includes(candidate));
    return found ? { status: 'resolved', path: found } : { status: 'missing' };
  }
  const wanted = path.replace(/\.md$/i, '').toLowerCase();
  const candidates = files.filter(file => file.endsWith('.md') && file.split('/').at(-1)!.slice(0, -3).toLowerCase() === wanted);
  if (candidates.length === 1) return { status: 'resolved', path: candidates[0]! };
  return candidates.length ? { status: 'ambiguous', candidates: [...candidates].sort() } : { status: 'missing' };
}
/** `[[path-without-.md|alias]]`, the form docs export writes; the alias is dropped when it adds nothing. */
export function formatWikilink(path: string, alias?: string): string {
  const target = path.replace(/\.md$/i, ''), label = alias?.replace(/[[\]|\r\n]/g, ' ').trim();
  return label && label !== target ? `[[${target}|${label}]]` : `[[${target}]]`;
}
export interface LinkProblem { code: 'WIKILINK_UNRESOLVED' | 'WIKILINK_AMBIGUOUS'; message: string; line: number; target: string }
/** Every unresolved or ambiguous wikilink in the text; line numbers are relative to `text`. */
export function linkProblems(text: string, files: readonly string[], lineOffset = 0): LinkProblem[] {
  return extractWikilinks(text).flatMap((link): LinkProblem[] => {
    const resolved = resolveWikilink(files, link.target), line = link.line + lineOffset;
    if (resolved.status === 'missing') return [{ code: 'WIKILINK_UNRESOLVED', message: `[[${link.target}]] does not resolve to a Markdown file.`, line, target: link.target }];
    if (resolved.status === 'ambiguous') return [{ code: 'WIKILINK_AMBIGUOUS', message: `[[${link.target}]] matches ${resolved.candidates.join(', ')}; link by path.`, line, target: link.target }];
    return [];
  });
}
