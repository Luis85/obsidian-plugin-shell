import { hasPortableProjectSegments } from '../../../scripts/shared/project-path.ts';
import { requireSketch, hasControls } from './errors.ts';
/**
 * Learning Markdown is shown as plain terminal text, never rendered as HTML or evaluated. Content that only
 * makes sense as executable markup is rejected so a course cannot smuggle it into other renderers.
 */
const executable = /<\s*\/?\s*(?:script|iframe|object|embed|style|link|meta|svg)\b|\bjavascript:|\bvbscript:|\bdata:text\/html|<[^>]*\son[a-z]+\s*=/i;
const wikilink = /\[\[([^[\]|]+?)(?:\|([^[\]]+))?\]\]/g;
/** Documentation lives in docs/, CLI source guides in src/cli/, built guides in bin/, and root Markdown files. */
const docRoots = ['docs/', 'src/cli/', 'bin/'];
export interface LearningDocLink { target: string; file: string; heading?: string }
export function readLearningMarkdown(value: unknown, name: string, max: number): string {
  requireSketch(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'LEARNING_MARKDOWN', `${name} needs Markdown text (1–${max} characters).`);
  requireSketch(!hasControls(value, true), 'LEARNING_MARKDOWN', `${name} contains control characters.`);
  requireSketch(!executable.test(value), 'LEARNING_MARKDOWN', `${name} contains executable markup; learning content is plain Markdown.`);
  for (const match of value.matchAll(wikilink)) readLearningDocTarget(match[1], `${name} link [[${match[1]}]]`);
  return value;
}
/** `docs/development/WIZARDS-AND-FORMS`, optionally with `#Heading`; the `.md` extension is implied. */
export function readLearningDocTarget(value: unknown, name: string): string {
  requireSketch(typeof value === 'string' && value.length > 0 && value.length <= 200 && !hasControls(value), 'LEARNING_DOC', `${name} needs a documentation link.`);
  const link = learningDocLink(value);
  const parts = link.file.split('/');
  requireSketch(hasPortableProjectSegments(link.file) && (parts.length === 1 || docRoots.some(root => link.file.startsWith(root))), 'LEARNING_DOC',
    `${name} must link a Markdown page under docs/, src/cli/, bin/ or the repository root.`);
  requireSketch(link.heading === undefined || (link.heading.trim().length > 0 && !link.heading.includes('#')), 'LEARNING_DOC', `${name} has an empty or nested heading.`);
  return value;
}
export function learningDocLink(target: string): LearningDocLink {
  const [page = '', ...rest] = target.split('#');
  const file = page.endsWith('.md') ? page : page + '.md';
  return rest.length ? { target, file, heading: rest.join('#') } : { target, file };
}
/** A Markdown file below configs/learning/content/. */
export function readLearningContentFile(value: unknown, name: string): string {
  requireSketch(typeof value === 'string' && value.length <= 200 && hasPortableProjectSegments(value) && value.endsWith('.md'), 'LEARNING_CONTENT',
    `${name} must be a .md file below configs/learning/content/.`);
  return value;
}
/** Every documentation link of a step: wikilinks in its Markdown and its explicit docs list. */
export function learningDocTargets(markdown: string | undefined, docs: readonly string[] = []): string[] {
  const linked = markdown ? [...markdown.matchAll(wikilink)].map(match => match[1]!) : [];
  return [...new Set([...linked, ...docs])];
}
/** Terminal text: wikilinks become `label (docs/page.md#Heading)`; everything else stays literal. */
export function renderLearningMarkdown(markdown: string): string {
  return markdown.replace(wikilink, (_match, target: string, label?: string) => {
    const link = learningDocLink(target), location = link.file + (link.heading ? '#' + link.heading : '');
    return label ? `${label} (${location})` : location;
  });
}
/** Markdown headings of a page, for anchor checks: `## Forms` provides `Forms`. */
export function learningHeadings(markdown: string): Set<string> {
  return new Set([...markdown.matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)].map(match => match[1]!.trim().toLowerCase()));
}
