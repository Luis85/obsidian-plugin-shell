import { validateNativeIntegrations } from '../../../scripts/companion/native-contract.mjs';
import { nativeDeclarationSource, nativeDeclarationTest } from './native-boilerplate.ts';
import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';

/** Lower portable native declarations into the same adapters used by maker-authored features. */
export function nativeCode(model: Model, add: Add): void {
  const namespace = validateNativeIntegrations((model.document.design as Record<string, unknown>).nativeIntegrations);
  const registry = `${model.sourceRoot}/bootstrap/native-integrations.ts`;
  const imports: string[] = [];
  const files: string[] = [];
  const menus: string[] = [];
  for (const [kind, definitions, target] of [
    ['file-extension', namespace.fileTypes, files],
    ['context-menu', namespace.contextMenus, menus],
  ] as const) {
    for (const [index, definition] of definitions.entries()) {
      const source = `${model.sourceRoot}/domain/native/${definition.id}.${kind}.ts`;
      const local = (kind === 'file-extension' ? 'nativeFile' : 'nativeMenu') + index;
      add(
        source,
        nativeDeclarationSource(kind, definition, relativeImport(source, 'src/domain/native-integrations.ts')),
      );
      const test = `${model.testRoot}/native/${definition.id}.test.ts`;
      add(test, nativeDeclarationTest(kind, definition, relativeImport(test, source)));
      imports.push(`import { definition as ${local} } from ${literal(relativeImport(registry, source))};`);
      target.push(local);
    }
  }
  add(
    registry,
    `import type { NativeFileDefinition, NativeMenuDefinition } from ${literal(relativeImport(registry, 'src/domain/native-integrations.ts'))};
${imports.join('\n')}
export const projectFileTypes: readonly NativeFileDefinition[] = [${files.join(', ')}];
export const projectContextMenus: readonly NativeMenuDefinition[] = [${menus.join(', ')}];
`,
    'managed',
  );
  if (namespace.fileTypes.length || namespace.contextMenus.length)
    add(
      'NATIVE-INTEGRATIONS.md',
      `# Native file integration

This generated plugin registers real Obsidian file views and file-explorer context actions.
Portable declarations are in design/project.json under design.nativeIntegrations (namespace schema 1).
The registry in ${registry} is managed. Definitions and handlers in ${model.sourceRoot}/domain/native are developer-owned and regeneration preserves edits.

## File types
${namespace.fileTypes.map((file) => `- **.${file.extension}** — ${file.name}: command **Create ${file.name}**, folder menu **Create ${file.name}**, dedicated TextFileView and file menu **Open ${file.name}**.`).join('\n') || 'None declared.'}

## File context actions
${namespace.contextMenus.map((menu) => `- **${menu.name}** — extensions ${menu.extensions.map((extension) => '.' + extension).join(', ')}. Edit the domain handler to change its read-only inspection behavior.`).join('\n') || 'None declared.'}

## Safety and customization
The create dialog writes only on confirmation with vault.create; it never overwrites. Obsidian owns loading, renaming, saving and view restoration. Invalid JSON stays editable as raw text; validation never replaces it with defaults. Initial content must be valid JSON for JSON file types. Core-owned extensions are rejected. Other plugin association conflicts fail startup; the generator does not hijack their views.

The text editor is intentionally a safe baseline, not a bespoke visual document editor. Extend src/infrastructure/obsidian/custom-file-view.ts or supply a dedicated view adapter for your domain. Do not place host IO in the generated domain handler. No binary format, active-editor menu, custom syntax highlighter or remote integration is implied.

Before enabling in a personal vault, run the generated tests, typecheck and build; then use a disposable vault to check create, open, edit, invalid JSON, rename, duplicate names, plugin reload and context-menu filters. A browser clickdummy cannot register a native extension.
`,
      'managed',
    );
}
