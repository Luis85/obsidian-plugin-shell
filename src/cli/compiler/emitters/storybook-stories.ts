import type { ComponentDefinition, EmitDefinition, PageDefinition, PropDefinition } from '#shared/companion/visual/visual-ir.mjs';
import type { Artifact } from '../domain/contracts.ts';
import { visualDefinitions, visualComponentPath, visualPagePath } from './visual-model.ts';
import { literal, type Model } from './model.ts';
import { componentFile, relativeImport } from './file-code.ts';
interface StorySubject {
  id: string; title: string; path: string; source: string; pointer: string; surface?: string;
  definition?: ComponentDefinition | PageDefinition;
}
export interface StoryInventory { path: string; source: string; entityId: string; stories: string[]; syntheticProps: string[] }
function defaults(props: PropDefinition[]): Record<string, unknown> {
  return Object.fromEntries(props.filter(p => p.required || Object.hasOwn(p, 'default')).map(p => [p.name,
    Object.hasOwn(p, 'default') ? p.default : p.type === 'boolean' ? false : p.type === 'number' ? 0 : `Example ${p.name}`]));
}
/** Export identifiers are derived from exact UTF-8 IDs, not display labels or enumeration positions. */
function exportId(prefix: string, id: string): string {
  return prefix + Array.from(new TextEncoder().encode(id), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Storybook statically indexes identifier keys; JSON-quoted CSF metadata is not equivalent to CSF source. */
function csfFields(value: Record<string, unknown>): string {
  return Object.entries(value).filter(([, value]) => value !== undefined).map(([key, value]) =>
    `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : literal(key)}: ${literal(value)}`).join(',\n  ');
}
function csfStory(value: Record<string, unknown>): string { return `{\n  ${csfFields(value)}\n}`; }
interface Story { name: string; content: string }
/** Design states first, then authored variants and scenarios; export names derive from exact IDs. */
function storyEntries(definition: StorySubject['definition'], component: ComponentDefinition | undefined, states: string[]): Story[] {
  const stories: Story[] = states.map(state => ({ name: state[0]!.toUpperCase() + state.slice(1), content: csfStory(definition ? { args: { designState: state } } : {}) }));
  for (const variant of component?.variants ?? []) stories.push({ name: exportId('Variant', variant.id),
    content: csfStory({ name: variant.name, args: { ...variant.values, designState: 'default', designScenario: undefined } }) });
  for (const scenario of definition?.scenarios ?? []) stories.push({ name: exportId('Scenario', scenario.id),
    // No explicit designState: the authored scenario controls its state and fixtures.
    content: csfStory({ name: scenario.name, args: { designScenario: scenario.id }, parameters: { shell: { width: scenario.width } } }) });
  return stories;
}
function storyArgTypes(props: PropDefinition[], definition: StorySubject['definition'], states: string[]): Record<string, unknown> {
  const argTypes: Record<string, unknown> = Object.fromEntries(props.map(p => [p.name, { control: p.type === 'string' ? 'text' : p.type,
    description: p.description ?? '', table: { type: { summary: p.type } } }]));
  if (definition) {
    argTypes.designState = { control: 'select', options: states };
    argTypes.designScenario = { control: 'select', options: ['', ...definition.scenarios.map(s => s.id)] };
  }
  return argTypes;
}
/** An authored definition with template nodes renders its design; anything else is an implementation placeholder. */
function storyImplementation(definition: StorySubject['definition']): string {
  const nodes = definition ? ('template' in definition ? definition.template : definition.root) : [];
  return nodes.length ? 'authored-visual-definition' : 'implementation-placeholder';
}
function storyMeta(subject: StorySubject, projectId: string, argTypes: Record<string, unknown>, syntheticProps: string[]): Record<string, unknown> {
  const definition = subject.definition;
  return { title: subject.title, id: 'generated-' + subject.id, tags: ['autodocs'], argTypes,
    parameters: { shell: { projectId, entityId: definition?.id ?? subject.id, source: subject.source, jsonPointer: subject.pointer,
      surface: subject.surface, implementation: storyImplementation(definition), syntheticProps, businessAcceptance: 'not-inferred' } } };
}
/** Slot examples need a render function; declared events become Storybook actions. */
function storyBindings(component: ComponentDefinition | undefined): { slotRender: string; events: EmitDefinition[]; eventArgs: string[] } {
  const slotRender = component?.slots.length ? `\n  render: args => ({ setup: () => () => h(Subject, args, {${component.slots.map(slot =>
    `${literal(slot.name)}: () => ${literal('Example ' + slot.name + ' slot')}`).join(', ')} }) }),` : '';
  const events = component?.emits ?? [];
  return { slotRender, events, eventArgs: events.map(event => `${literal('on' + event.name[0]!.toUpperCase() + event.name.slice(1))}: action(${literal(event.name)})`) };
}
function storySource(subject: StorySubject, metadata: Record<string, unknown>, args: Record<string, unknown>, bindings: ReturnType<typeof storyBindings>, stories: Story[]): string {
  const { slotRender, events, eventArgs } = bindings;
  return `// Generated from project JSON. Put custom stories in storybook/custom, not this managed file.
import type { Meta, StoryObj } from '@storybook/vue3-vite';
${slotRender ? "import { h } from 'vue';\n" : ''}${events.length ? "import { action } from 'storybook/actions';\n" : ''}import Subject from ${literal(relativeImport(subject.path, subject.source))};
import { withProject } from '../with-project.ts';
const meta = {
  ${csfFields(metadata)},
  component: Subject,
  decorators: [withProject],
  args: { ...${literal(args)}${eventArgs.length ? ', ' + eventArgs.join(', ') : ''} },${slotRender}
} satisfies Meta<typeof Subject>;
export default meta;
type Story = StoryObj<typeof meta>;
${stories.map(story => `export const ${story.name}: Story = ${story.content};\n`).join('')}`;
}
function storyFile(subject: StorySubject, projectId: string): { file: Artifact; inventory: StoryInventory } {
  const definition = subject.definition;
  const component = definition && 'props' in definition ? definition : undefined;
  const props = component?.props ?? [];
  const states = definition ? ['default', 'loading', 'empty', 'error', 'disabled'] : ['default'];
  const stories = storyEntries(definition, component, states);
  const args = defaults(props);
  const syntheticProps = props.filter(p => p.required && !Object.hasOwn(p, 'default')).map(p => p.name);
  const metadata = storyMeta(subject, projectId, storyArgTypes(props, definition, states), syntheticProps);
  const content = storySource(subject, metadata, args, storyBindings(component), stories);
  const entityId = definition?.id ?? subject.id;
  return { file: { path: subject.path, content, ownership: 'managed', producer: 'storybook',
    origins: [{ file: 'project.json', jsonPointer: subject.pointer, entityId, document: 'normalized' }] },
    inventory: { path: subject.path, source: subject.source, entityId, stories: stories.map(s => s.name), syntheticProps } };
}
/** The generator consumes the existing validated model; it does not parse prose into code or invent behavior. */
export function storybookStories(model: Model): { files: Artifact[]; inventory: StoryInventory[] } {
  const store = visualDefinitions(model), subjects: StorySubject[] = [];
  for (const [index, entry] of model.components.entries()) {
    const id = String(entry.id), definition = store.components.find(c => c.libraryId === id);
    subjects.push({ id: 'component-' + id, title: `Components/${String(entry.name)} (${id})`,
      path: `storybook/generated/components/${componentFile(id, 'component')}.stories.ts`,
      source: definition ? visualComponentPath(model, definition) : `${model.sourceRoot}/presentation/components/library/${componentFile(id, 'component')}.vue`,
      pointer: definition ? `/design/visualDesigns/components/${store.components.indexOf(definition)}` : `/design/library/${index}`, definition });
  }
  for (const [index, screen] of model.screens.entries()) {
    if (['group', 'action'].includes(screen.kind)) continue;
    const definition = store.pages.find(p => p.ownerId === screen.id);
    subjects.push({ id: 'page-' + screen.slug, title: `Pages/${screen.label} (${screen.slug})`, surface: screen.id,
      path: `storybook/generated/pages/${componentFile(screen.slug, 'screen')}.stories.ts`,
      source: definition ? visualPagePath(model, definition) : `${model.sourceRoot}/presentation/components/screens/${componentFile(screen.slug, 'screen')}.vue`,
      pointer: definition ? `/design/visualDesigns/pages/${store.pages.indexOf(definition)}` : `/design/nodes/${index}`, definition });
  }
  const rendered = subjects.map(subject => storyFile(subject, String(model.project.id)));
  return { files: rendered.map(item => item.file), inventory: rendered.map(item => item.inventory) };
}
