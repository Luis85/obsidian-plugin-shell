import type { FilePlanEntry } from '../../scripts/shared/file-plan.ts';
import type { LoadedComponentTemplate } from '../adapters/component-template-repository.ts';

const folders: Record<string, string> = {
  atom: 'atoms',
  molecule: 'molecules',
  organism: 'organisms',
  template: 'layouts',
  page: 'pages',
};
const tick = String.fromCharCode(96);
const code = (value: string): string => tick + value + tick;

function bullets(values: readonly string[]): string {
  return values.length ? values.map(value => '- ' + value).join('\n') : '- None';
}

function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return '_None._';
  return [
    '| ' + headers.join(' | ') + ' |',
    '| ' + headers.map(() => '---').join(' | ') + ' |',
    ...rows.map(row => '| ' + row.map(value => value.replace(/\|/g, '\\|')).join(' | ') + ' |'),
  ].join('\n');
}

function sourceNote(entry: LoadedComponentTemplate): string {
  return '> Generated from ' + code(entry.file) + ' (' + entry.origin
    + '). Do not edit this Markdown directly; edit the JSON template and regenerate.';
}

function renderComponentTemplateMarkdown(entry: LoadedComponentTemplate): string {
  const template = entry.template;
  const composition = template.children.length
    ? template.children.map(child => '- ' + code(child.template)
      + (child.slot ? ' → **' + child.slot + '**' : '')
      + (child.optional ? ' _(optional)_' : '')).join('\n')
    : '_No child template references._';
  const tags = template.tags.map(code).join(' ');

  return '# ' + template.name + '\n\n'
    + sourceNote(entry) + '\n\n'
    + '**ID:** ' + code(template.id) + '  \n'
    + '**Version:** ' + code(template.version) + '  \n'
    + '**Type:** ' + template.templateType + '  \n'
    + '**Atomic level:** ' + template.atomicLevel + '  \n'
    + '**Category:** ' + template.category + '\n\n'
    + '## Purpose\n\n' + template.description + '\n\n'
    + '## Use when\n\n' + bullets(template.useWhen) + '\n\n'
    + '## Avoid when\n\n' + bullets(template.avoidWhen) + '\n\n'
    + '## Capabilities\n\n' + bullets(template.capabilities) + '\n\n'
    + '## Recommended for\n\n' + bullets(template.recommendedFor) + '\n\n'
    + '## States\n\n' + bullets(template.states) + '\n\n'
    + '## Composition\n\n' + composition + '\n\n'
    + '## Slots / bricks\n\n'
    + table(['Slot', 'Role', 'Accepts'], template.slots.map(slot => [slot.id, slot.role, slot.accepts.join(', ')])) + '\n\n'
    + '## Properties\n\n'
    + table(['Property', 'Type', 'Required', 'Default', 'Description'], template.props.map(prop => [
      prop.name,
      prop.type,
      String(prop.required),
      prop.default === undefined ? '' : String(prop.default),
      prop.description ?? '',
    ])) + '\n\n'
    + '## Events\n\n'
    + table(['Event', 'Payload', 'Description'], template.events.map(event => [
      event.name,
      event.payloadType,
      event.description ?? '',
    ])) + '\n\n'
    + '## Accessibility\n\n' + template.accessibility.notes + '\n\n'
    + '### Keyboard\n\n' + bullets(template.accessibility.keyboard) + '\n\n'
    + '### ARIA / semantics\n\n' + bullets(template.accessibility.aria) + '\n\n'
    + '## Design primitive\n\n' + code(template.design.kind) + '\n\n'
    + '## Tags\n\n' + tags + '\n';
}

function index(entries: readonly LoadedComponentTemplate[]): string {
  const rows = [...entries]
    .sort((a, b) => a.template.atomicLevel.localeCompare(b.template.atomicLevel)
      || a.template.name.localeCompare(b.template.name))
    .map(entry => {
      const template = entry.template;
      const path = folders[template.atomicLevel] + '/' + template.id.replace(/\./g, '-') + '.md';
      return [
        '[' + template.name + '](./' + path + ')',
        template.atomicLevel,
        template.templateType,
        template.category,
        template.description,
      ];
    });

  return '# Component Template Library\n\n'
    + '> Generated from ' + code('configs/templates/**/*.json') + '. JSON is the source of truth.\n\n'
    + 'This catalog is the shared baseline used by CLI, TUI, plugins and the visual authoring workflow.\n\n'
    + table(['Template', 'Atomic level', 'Type', 'Category', 'Purpose'], rows)
    + '\n';
}

export function componentTemplateDocumentation(
  entries: readonly LoadedComponentTemplate[],
  output: string,
): FilePlanEntry[] {
  const root = output.replace(/\/+$/, '');
  return [
    { path: root + '/README.md', content: index(entries) },
    ...entries.map(entry => ({
      path: root + '/' + folders[entry.template.atomicLevel] + '/' + entry.template.id.replace(/\./g, '-') + '.md',
      content: renderComponentTemplateMarkdown(entry),
    })),
  ];
}
