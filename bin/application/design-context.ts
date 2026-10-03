/** Markdown context a design agent reads: brief, screens, components, tokens and the shared implementation map. */
import type { SketchDocument } from '../domain/document.ts';
import { acceptanceSummary } from '../domain/design-folder.ts';
import { interactions } from '../domain/interactions.ts';
export interface Screen { id: string; title: string; kind: string; route: string }
export const cell = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').replaceAll('|', '\\|').trim() || '—';
const words = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
export function screens(document: SketchDocument): Screen[] {
  const routes = document.design.sitemap?.routes ?? [];
  return document.design.nodes.filter(node => !['group', 'action'].includes(node.kind)).map(node => ({
    id: node.id, title: node.label, kind: node.kind, route: routes.find(route => route.surface === node.id)?.path ?? '' }));
}
function libraryName(document: SketchDocument, id: string): string {
  return document.design.library.find(item => item.id === id)?.name ?? id;
}
function screenTitle(document: SketchDocument, id: unknown): string {
  return document.design.nodes.find(node => node.id === id)?.label ?? String(id);
}
/** Shift Markdown headings one level down outside fenced code, so an embedded brief nests under ours. */
function nested(markdown: string): string {
  let fence = false;
  return markdown.split('\n').map(line => {
    if (/^\s{0,3}(?:`{3,}|~{3,})/.test(line)) fence = !fence;
    return !fence && /^#{1,5} /.test(line) ? '#' + line : line;
  }).join('\n').trimEnd();
}
export function briefMarkdown(document: SketchDocument, title: string, platform: string, brief: string | null): string {
  const { project } = document, list = screens(document);
  const goal = words(document.design.goal), description = words(project.description);
  return [`# ${title}: brief`, '',
    `Project **${project.name}** (\`${project.id}\`, version ${project.version}). ${platform}`, '',
    ...(description ? [description, ''] : []), ...(goal ? [`Goal: ${goal}`, ''] : []),
    '## Scope', '',
    `${list.length} screens, ${document.design.library.length} components. The screens and components in`,
    '`screens.md` and `components.md` are the agreed scope; propose changes in `../notes/decisions.md`.', '',
    '## Prepared prototype brief', '',
    brief === null ? 'No prepared prototype brief was supplied. Record open questions about problem, audience and outcome in `../notes/decisions.md`.' : nested(brief),
    ''].join('\n');
}
function actionText(document: SketchDocument, action: Record<string, unknown>): string {
  if (action.kind === 'navigate') return `navigate to ${screenTitle(document, action.surfaceId)} (\`${String(action.surfaceId)}\`)`;
  return String(action.kind ?? 'unspecified');
}
function screenSection(document: SketchDocument, screen: Screen): string[] {
  const node = document.design.nodes.find(item => item.id === screen.id)!;
  const used = Array.isArray(node.components) ? node.components.flatMap(item => item && typeof item === 'object' && 'id' in item ? [String(item.id)] : []) : [];
  const actions = interactions(document, screen.id).map(({ interaction }) =>
    `  - ${interaction.label} (\`${interaction.id}\`): ${interaction.actions.length ? interaction.actions.map(action => actionText(document, action)).join('; ') : 'behaviour not decided yet'}`);
  const goal = words(node.goal), acceptance = acceptanceSummary(node.acceptance);
  return [`## ${screen.title} (\`${screen.id}\`)`, '',
    `- Route: ${screen.route ? '`' + screen.route + '`' : 'none'} · kind ${screen.kind}` +
      (typeof node.layout === 'string' ? ` · layout ${node.layout}` : '') + (typeof node.placement === 'string' ? ` · placement ${node.placement}` : ''),
    ...(goal ? [`- Goal: ${goal}`] : []),
    `- Components: ${used.length ? used.map(id => `${libraryName(document, id)} (\`${id}\`)`).join(', ') : 'none yet'}`,
    `- Interactions:${actions.length ? '' : ' none yet'}`, ...actions, ...(acceptance ? [`- Acceptance: ${acceptance}`] : []), ''];
}
export function screensMarkdown(document: SketchDocument, title: string): string {
  const list = screens(document), journeys = document.design.sitemap?.journeys ?? [];
  return [`# ${title}: screens`, '',
    'IDs come from the project model and stay stable across renames. Use them in prototype file names',
    'and in `data-design-id` attributes.', '',
    '| ID | Screen | Route | Kind |', '| --- | --- | --- | --- |',
    ...list.map(screen => `| \`${screen.id}\` | ${cell(screen.title)} | ${screen.route ? '`' + screen.route + '`' : '—'} | ${screen.kind} |`), '',
    ...list.flatMap(screen => screenSection(document, screen)),
    '## Journeys', '',
    ...(journeys.length ? journeys.map(journey => `- ${journey.name} (\`${journey.id}\`): ${journey.steps.map(step => screenTitle(document, step.surface)).join(' → ')}`) : ['None defined yet.']),
    ''].join('\n');
}
export function componentsMarkdown(document: SketchDocument, title: string): string {
  const usage = (id: string) => screens(document).filter(screen => {
    const node = document.design.nodes.find(item => item.id === screen.id)!;
    return Array.isArray(node.components) && node.components.some(item => item && typeof item === 'object' && 'id' in item && item.id === id);
  }).map(screen => screen.title);
  const details = (item: SketchDocument['design']['library'][number]) => ['description', 'props', 'events', 'slots', 'a11y']
    .flatMap(key => words(item[key]) ? [`  - ${key}: ${words(item[key])}`] : []);
  const library = document.design.library;
  return [`# ${title}: components`, '',
    'Reusable components of the project model. Design each once and reuse it on every screen listed.', '',
    '| ID | Component | Category | Variants | Status | Used on |', '| --- | --- | --- | --- | --- | --- |',
    ...library.map(item => `| \`${item.id}\` | ${cell(item.name)} | ${cell(item.category)} | ${cell(item.variants)} | ${cell(item.status)} | ${cell(usage(item.id).join(', '))} |`),
    '', ...(library.length ? library.flatMap(item => { const lines = details(item); return lines.length ? [`- ${item.name} (\`${item.id}\`)`, ...lines] : []; }) : ['No components yet.']),
    ''].join('\n');
}
interface TokenFile { groups: { id: string; names: string[] }[]; deprecated: string[] }
const names = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && /^--[a-z0-9-]+$/.test(item)) : [];
/** Reads only the reviewed name lists of a token inventory; anything else in the file is ignored. */
export function readTokens(text: string | null): TokenFile | null {
  if (text === null) return null;
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || !('groups' in value) || !Array.isArray(value.groups)) return null;
  const groups = value.groups.flatMap((group: unknown) => group && typeof group === 'object' && 'id' in group && typeof group.id === 'string' && 'names' in group
    ? [{ id: group.id, names: names(group.names) }] : []);
  const deprecated = 'deprecated' in value && value.deprecated && typeof value.deprecated === 'object' && 'names' in value.deprecated ? names(value.deprecated.names) : [];
  return { groups, deprecated };
}
/** Host tokens only when the target renders inside Obsidian; other targets declare their own variables. */
export function tokensMarkdown(title: string, tokens: TokenFile | null, obsidian: boolean): string {
  const head = [`# ${title}: design tokens`, ''];
  if (!obsidian) return [...head, 'This target has no host token set. Declare colours, spacing and type as CSS custom properties on the',
    'prototype root and list them in `../notes/decisions.md`, so Claude Code can map them to the project\'s styles.', ''].join('\n');
  const groups = tokens?.groups ?? [];
  return [...head, 'The screens render inside Obsidian. The installed app and the user\'s theme own these CSS variables;',
    'designs consume them and never define a second palette. Light and dark themes change their values, not their names.',
    `Reviewed names are in \`obsidian-tokens.json\`${tokens ? '' : ' (not available in this project; use the official Obsidian CSS variable reference)'}.`, '',
    ...groups.flatMap(group => [`## ${group.id}`, '', group.names.map(name => `\`${name}\``).join(', '), '']),
    ...(tokens?.deprecated.length ? ['## Deprecated, do not use', '', tokens.deprecated.map(name => `\`${name}\``).join(', '), ''] : []),
  ].join('\n');
}
export function implementationMap(document: SketchDocument, title: string): string {
  return [`# ${title}: implementation map`, '',
    'One row per screen. Status: `todo` → `designing` → `ready` (Claude Code may build it) → `implemented` → `verified` (human review).',
    'Add a `proposed` row for a screen the project model does not have yet. Designers and Claude Code both edit this file; sync never does.', '',
    '| Screen | ID | Status | Prototype files | Acceptance notes |', '| --- | --- | --- | --- | --- |',
    ...screens(document).map(screen => `| ${cell(screen.title)} | \`${screen.id}\` | todo | — | — |`), ''].join('\n');
}
