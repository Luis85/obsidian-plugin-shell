/**
 * Wikilinks to hosted blob links and back. `[[docs/x|Label]]` becomes `[Label](<web>/blob/<head>/docs/x.md)` on
 * GitHub and `[Label](<web>?path=/docs/x.md&version=GB<head>)` on Azure Repos; parsing is the exact inverse and only
 * touches links that start with this pull request's blob prefix. Fenced and inline code is never rewritten.
 * A heading is kept URI-encoded (`#Some%20heading`, Azure `&anchor=`), so the round trip is exact even though the
 * platform's own anchor slugs differ. An alias equal to the default label (basename, plus ` > heading`) is dropped,
 * which is the canonical form both sides are compared in.
 */
import type { LinkResolver, LinkTarget } from './remote-model.ts';

const wikilinkPattern = /\[\[([^[\]|#\n]+?)(?:#([^[\]|\n]+?))?(?:\|([^[\]\n]+?))?\]\]/g;
const markdownLinkPattern = /(?<!!)\[((?:\\.|[^\\[\]\n])*)\]\(([^\s()]+)\)/g;
const codePattern = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;

const encode = (value: string): string => encodeURIComponent(value).replace(/[()!'*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
const encodePath = (path: string): string => path.split('/').map(encode).join('/');
function decode(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}
function decodePath(value: string): string | null {
  const segments = value.split('/').map(decode);
  if (segments.some(segment => segment === null || segment === '' || segment === '.' || segment === '..' || segment.includes('/'))) return null;
  return segments.join('/');
}
/** Applies `rewrite` to the text outside fenced and inline code. */
function outsideCode(text: string, rewrite: (part: string) => string): string {
  return text.split(codePattern).map((part, index) => index % 2 ? part : rewrite(part)).join('');
}
const basename = (target: string): string => target.slice(target.lastIndexOf('/') + 1);
const defaultLabel = (target: string, heading: string | undefined): string => basename(target) + (heading ? ` > ${heading}` : '');
const toTarget = (path: string): string => path.endsWith('.md') ? path.slice(0, -3) : path;
function fallbackPath(target: string): string {
  const clean = target.replace(/^\/+/, '');
  return /\.[A-Za-z0-9]{1,8}$/.test(clean) && !clean.endsWith('.md') ? clean : `${toTarget(clean)}.md`;
}

/** Web URL of one repository file at the target ref, optionally at a heading. */
export function blobUrl(target: LinkTarget, path: string, heading?: string): string {
  if (target.platform === 'github') return `${target.web}/blob/${encodePath(target.ref)}/${encodePath(path)}${heading ? '#' + encode(heading) : ''}`;
  return `${target.web}?path=/${encodePath(path)}&version=GB${encode(target.ref)}${heading ? '&anchor=' + encode(heading) : ''}`;
}
/** The repository path (and heading) of a blob URL of exactly this target, or null for any other URL. */
function parseBlobUrl(target: LinkTarget, url: string): { path: string; heading?: string } | null {
  if (target.platform === 'github') {
    const prefix = `${target.web}/blob/${encodePath(target.ref)}/`;
    if (!url.startsWith(prefix)) return null;
    const [pathPart = '', headingPart, extra] = url.slice(prefix.length).split('#');
    return blobParts(pathPart, headingPart, extra);
  }
  const prefix = `${target.web}?path=/`, version = `&version=GB${encode(target.ref)}`;
  if (!url.startsWith(prefix)) return null;
  const match = /^([^&#?]+)(&version=[^&#]+)(?:&anchor=([^&#]+))?$/.exec(url.slice(prefix.length));
  if (!match || match[2] !== version) return null;
  return blobParts(match[1]!, match[3], undefined);
}
function blobParts(pathPart: string, headingPart: string | undefined, extra: string | undefined): { path: string; heading?: string } | null {
  if (extra !== undefined || !pathPart) return null;
  const path = decodePath(pathPart);
  const heading = headingPart === undefined ? undefined : decode(headingPart);
  if (path === null || heading === null || heading === '') return null;
  return heading === undefined ? { path } : { path, heading };
}

/** Rewrites resolvable wikilinks as blob links; unresolved ones stay literal (publish refuses them earlier). */
export function wikilinksToRemote(markdown: string, target: LinkTarget, resolve?: LinkResolver): string {
  return outsideCode(markdown, part => part.replace(wikilinkPattern, (whole, linkTarget: string, heading: string | undefined, alias: string | undefined) => {
    const name = linkTarget.trim();
    const path = resolve ? resolve(name) : fallbackPath(name);
    if (path === null) return whole;
    const label = (alias ?? defaultLabel(toTarget(path), heading)).replace(/[\\[\]]/g, '\\$&');
    return `[${label}](${blobUrl(target, path, heading)})`;
  }));
}
/** Rewrites this target's blob links back into wikilinks; every other Markdown link is left as it is. */
export function remoteToWikilinks(markdown: string, target: LinkTarget): string {
  return outsideCode(markdown, part => part.replace(markdownLinkPattern, (whole, escaped: string, url: string) => {
    const parsed = parseBlobUrl(target, url);
    const label = escaped.replace(/\\(.)/g, '$1');
    if (!parsed || /[[\]|\n]/.test(label)) return whole;
    const linkTarget = toTarget(parsed.path), heading = parsed.heading;
    if (/[#|]/.test(linkTarget) || (heading !== undefined && /[|#]/.test(heading))) return whole;
    const alias = label === defaultLabel(linkTarget, heading) ? '' : `|${label}`;
    return `[[${linkTarget}${heading ? '#' + heading : ''}${alias}]]`;
  }));
}
const canonicalTarget: LinkTarget = { platform: 'github', web: 'https://workbench.invalid/canonical', ref: 'canonical' };
/** The form a wikilink has after one publish round trip: resolved path, no `.md`, no alias equal to the default label. */
export function canonicalWikilinks(markdown: string, resolve?: LinkResolver): string {
  return remoteToWikilinks(wikilinksToRemote(markdown, canonicalTarget, resolve), canonicalTarget);
}
