/** Renders a design folder from a project model. Pure: templates, tokens and brief bytes are supplied by the adapter. */
import type { SketchDocument } from '../domain/document.ts';
import { documentText } from '../domain/document.ts';
import { renderTemplate } from '../domain/guide.ts';
import type { EngineeringFacts } from '../domain/design-facts.ts';
import { engineeringGuide } from './design-engineering.ts';
import { briefMarkdown, componentsMarkdown, implementationMap, readTokens, screensMarkdown, tokensMarkdown } from './design-context.ts';
export const designTemplateNames = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'HANDOFF.md', 'prototypes-README.md', 'assets-README.md', 'decisions.md'] as const;
export type DesignTemplates = (name: typeof designTemplateNames[number]) => string;
/** source names where the target came from: the saved project.config.json or the shell's own default. */
export interface DesignTarget { targets: string[]; framework: string; source: string }
export interface DesignFolderInput {
  name: string; title: string; folder: string; sourcePath: string; document: SketchDocument;
  brief: string | null; target: DesignTarget; tokens: string | null; templates: DesignTemplates; facts: EngineeringFacts;
}
export interface DesignEntry { path: string; content: string }
/** The shell itself is an Obsidian plugin with a Vue 3 + Nuxt UI frontend; a saved project starter overrides it. */
export const shellTarget: DesignTarget = { targets: ['plugin'], framework: 'nuxtui', source: 'built-in shell default; no project.config.json' };
const surfaces: Record<string, string> = {
  plugin: 'Obsidian plugin: screens render inside an Obsidian workspace leaf (a side pane or a tab) or a modal, next to the user\'s notes. Design for panes from about 280px wide up to a full tab, in the user\'s light or dark theme.',
  webapp: 'Web application: a responsive browser app. Design from 360px wide phones up to desktop widths.',
  website: 'Website: static, client-rendered pages in the browser. Design from 360px wide phones up to desktop widths.',
  cli: 'Terminal application: there are no screens. Design command journeys, prompts and structured output text instead of visual layouts.',
};
const frontends: Record<string, string> = {
  nuxtui: 'Frontend: Vue 3 with Nuxt UI components (buttons, inputs, cards, tables, modals, tabs, command palette). Prefer layouts these components can express; a bespoke widget needs a decision note.',
  angular: 'Frontend: Angular standalone components. Prefer simple, composable layouts and native form controls.',
  vanilla: 'Frontend: plain TypeScript and DOM APIs without a component framework. Prefer simple layouts and native controls.',
  none: 'Frontend: none. Output is text in a terminal; keep it readable without colour and in machine-readable JSON mode.',
};
const labels: Record<string, string> = { plugin: 'Obsidian plugin', webapp: 'Web application', website: 'Website', cli: 'Terminal application' };
function targetLabel(target: DesignTarget): string {
  return target.targets.map(item => labels[item] ?? item).join(' + ');
}
function platformText(target: DesignTarget): string {
  return target.targets.map(item => surfaces[item] ?? `Target ${item}.`).join('\n\n');
}
function frontendText(target: DesignTarget): string {
  return frontends[target.framework] ?? `Frontend: ${target.framework}. Follow its component conventions.`;
}
/** Generated files are owned by sync; seeded files are created once and then belong to the design work. */
export function renderDesignFolder(input: DesignFolderInput): { managed: DesignEntry[]; seeded: DesignEntry[] } {
  const { document, target, title } = input;
  const commands = `node bin/app design status --name ${input.name}`;
  const values = { title, name: input.name, folder: input.folder, projectName: document.project.name, projectId: document.project.id,
    sourcePath: input.sourcePath, platform: platformText(target), frontend: frontendText(target),
    syncCommand: `node bin/app design sync --name ${input.name}`, statusCommand: commands };
  const render = (name: typeof designTemplateNames[number]) => renderTemplate(input.templates(name), values);
  const obsidian = target.targets.includes('plugin');
  const managed: DesignEntry[] = [
    { path: 'README.md', content: render('README.md') }, { path: 'AGENTS.md', content: render('AGENTS.md') },
    { path: 'CLAUDE.md', content: render('CLAUDE.md') }, { path: 'handoff/HANDOFF.md', content: render('HANDOFF.md') },
    { path: 'ENGINEERING_HANDOFF_GUIDE.md', content: engineeringGuide({ name: input.name, title, document, facts: input.facts, target, targetLabel: targetLabel(target) }) },
    { path: 'context/brief.md', content: briefMarkdown(document, title, `Target: ${targetLabel(target)}.`, input.brief) },
    { path: 'context/screens.md', content: screensMarkdown(document, title) },
    { path: 'context/components.md', content: componentsMarkdown(document, title) },
    { path: 'context/design-tokens.md', content: tokensMarkdown(title, obsidian ? readTokens(input.tokens) : null, obsidian) },
    { path: 'context/project.json', content: documentText(document) },
    ...(obsidian && input.tokens ? [{ path: 'context/obsidian-tokens.json', content: input.tokens }] : []),
  ];
  const seeded: DesignEntry[] = [
    { path: 'prototypes/README.md', content: render('prototypes-README.md') }, { path: 'assets/README.md', content: render('assets-README.md') },
    { path: 'notes/decisions.md', content: render('decisions.md') }, { path: 'handoff/implementation-map.md', content: implementationMap(document, title) },
  ];
  return { managed, seeded };
}
