import { literal, row, type Model } from './model.ts';
import { componentFile, relativeImport, type Add } from './file-code.ts';
import { visualDefinitions, visualComponentPath, visualPagePath } from './visual-model.ts';
import { VISUAL_STATES, type ComponentDefinition, type Scenario } from '../visual/visual-ir.mjs';

interface Subject {
  id: string; name: string; kind: 'pages' | 'components'; path: string; pointer: string;
  initial?: string; definition?: ComponentDefinition; scenarios?: Scenario[]; visual: boolean;
}
function subjects(m: Model): Subject[] {
  const store = visualDefinitions(m);
  const pages: Subject[] = store.pages.map((page, index) => ({ id: page.id, name: page.name, kind: 'pages',
    initial: page.ownerId, path: visualPagePath(m, page), pointer: '/design/visualDesigns/pages/' + index,
    scenarios: page.scenarios, visual: true }));
  const components: Subject[] = store.components.map((component, index) => ({ id: component.libraryId, name: component.exportName,
    kind: 'components', definition: component, scenarios: component.scenarios, visual: true,
    path: visualComponentPath(m, component), pointer: '/design/visualDesigns/components/' + index }));
  for (const [index, screen] of m.screens.entries()) if (!['group', 'action'].includes(screen.kind) && !store.pages.some(page => page.ownerId === screen.id)) {
    pages.push({ id: screen.slug, name: screen.label, kind: 'pages', initial: screen.id, visual: false,
      path: `${m.sourceRoot}/presentation/components/screens/${componentFile(screen.slug, 'screen')}.vue`, pointer: '/design/nodes/' + index });
  }
  for (const [index, component] of m.components.entries()) if (!store.components.some(c => c.libraryId === component.id)) {
    components.push({ id: String(component.id), name: String(component.name), kind: 'components', visual: false,
      path: `${m.sourceRoot}/presentation/components/library/${componentFile(String(component.id), 'component')}.vue`, pointer: '/design/library/' + index });
  }
  return [...pages, ...components].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
/** Prefix + encoded source ID makes names stable even when labels collide or contain code. */
function exportId(prefix: string, id: string): string {
  return prefix + '_' + Array.from(id, c => c.codePointAt(0)!.toString(16)).join('_');
}
function defaultArgs(subject: Subject): { args: Record<string, unknown>; synthetic: string[] } {
  const args: Record<string, unknown> = {}, synthetic: string[] = [];
  for (const prop of subject.definition?.props ?? []) {
    if (prop.default !== undefined) args[prop.name] = prop.default;
    else if (prop.required) {
      args[prop.name] = prop.type === 'boolean' ? false : prop.type === 'number' ? 0 : '';
      synthetic.push(prop.name);
    }
  }
  return { args, synthetic };
}
function argTypes(subject: Subject): Record<string, unknown> {
  const controls: Record<string, unknown> = {};
  for (const prop of subject.definition?.props ?? []) controls[prop.name] = {
    control: prop.type === 'string' ? 'text' : prop.type, description: prop.description ?? '',
    type: { name: prop.type, required: prop.required },
  };
  if (subject.visual) {
    controls.designState = { control: 'select', options: [...VISUAL_STATES] };
    controls.designScenario = { control: 'select', options: ['', ...(subject.scenarios ?? []).map(s => s.id)] };
  }
  return controls;
}
export function storybookStories(m: Model, add: Add): void {
  const entries = [];
  for (const subject of subjects(m)) {
    const path = `.storybook/generated/${subject.kind}/${subject.visual ? 'visual-' : 'scaffold-'}${subject.id}.stories.ts`;
    const defaults = defaultArgs(subject);
    const options = { ...(subject.initial ? { initial: subject.initial } : {}),
      slots: (subject.definition?.slots ?? []).filter(s => s.required).map(s => s.name),
      events: [...(subject.visual ? ['interaction'] : []), ...(subject.definition?.emits ?? []).map(e => e.name)],
      scenarioWidths: Object.fromEntries((subject.scenarios ?? []).map(s => [s.id, s.width])) };
    const description = [subject.definition?.description ?? '',
      'Generated design preview using synthetic reads. Writes remain implementation stubs; this is not acceptance evidence.',
      ...defaults.synthetic.map(name => 'Required prop ' + name + ' uses a synthetic type default; replace it with a reviewed example.')].filter(Boolean).join('\n\n');
    const stories: string[] = [];
    const append = (name: string, label: string, args: Record<string, unknown>) => stories.push(`export const ${name}: Story = { name: ${literal(label)}, args: ${literal(args)} };`);
    append('Default', 'Default', subject.visual ? { designState: 'default' } : {});
    if (subject.visual) for (const state of VISUAL_STATES.filter(state => state !== 'default')) append(
      state.charAt(0).toUpperCase() + state.slice(1), state.charAt(0).toUpperCase() + state.slice(1), { designState: state });
    for (const variant of subject.definition?.variants ?? []) append(exportId('Variant', variant.id), variant.name, { ...variant.values, designState: 'default' });
    // A scenario controls its own state, values, bindings and width through the generated runtime.
    for (const scenario of subject.scenarios ?? []) append(exportId('Scenario', scenario.id), scenario.name, { designScenario: scenario.id });
    const meta = { id: `generated-${subject.kind}-${subject.visual ? 'visual' : 'scaffold'}-${subject.id}`,
      title: `${subject.kind === 'pages' ? 'Pages' : 'Components'}/${subject.name}`,
      tags: ['autodocs'], parameters: { layout: 'padded', docs: { description: { component: description } },
        generated: { source: subject.pointer, status: subject.visual ? 'design-preview' : 'scaffold', syntheticProps: defaults.synthetic } },
      args: defaults.args, argTypes: argTypes(subject) };
    const fields = Object.entries(meta).map(([key, value]) => `  ${key}: ${literal(value)},`).join('\n');
    add(path, `// Generated from project JSON. Regeneration protects edits; keep custom stories outside generated/.
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Subject from ${literal(relativeImport(path, subject.path))};
import { projectPreview } from '../project-preview.ts';
const meta = {
${fields}
  component: Subject,
  render: args => projectPreview(Subject, args, ${literal(options)}),
} satisfies Meta<typeof Subject>;
export default meta;
type Story = StoryObj<typeof meta>;
${stories.join('\n')}
`, 'managed');
    entries.push({ file: path, component: subject.path, source: subject.pointer, storyCount: stories.length,
      status: subject.visual ? 'design-preview' : 'scaffold', syntheticProps: defaults.synthetic });
  }
  add('.storybook/generated/manifest.json', JSON.stringify({ schemaVersion: 1, projectId: m.project.id,
    status: 'generated-not-accepted', entries, declaredOptions: row(m.document.design).storybook }, null, 2) + '\n', 'managed');
}
