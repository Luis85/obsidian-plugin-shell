import { validateNativeIntegrations, type NativeProjectIntegrations } from '../../../../scripts/companion/native-contract.mjs';

type FileType = NativeProjectIntegrations['fileTypes'][number];
type ContextMenu = NativeProjectIntegrations['contextMenus'][number];
export type NativeKind = 'file-extension' | 'context-menu';
export type NativeDeclaration = FileType | ContextMenu;
type Declared = { kind: 'file-extension'; definition: FileType } | { kind: 'context-menu'; definition: ContextMenu };

const codeLiteral = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
/** Object members written directly (no spread of a literal); keys that are not identifiers stay quoted. */
function objectMembers(value: object): string {
  return Object.entries(value).map(([key, member]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : codeLiteral(key)}: ${codeLiteral(member)}`).join(', ');
}
/** The shared native contract decides the declaration's shape; an unknown kind declares nothing and is refused. */
function declared(kind: NativeKind, definition: NativeDeclaration): Declared {
  const integrations = validateNativeIntegrations({
    schemaVersion: 1,
    fileTypes: kind === 'file-extension' ? [definition] : [],
    contextMenus: kind === 'context-menu' ? [definition] : [],
  });
  const [fileType] = integrations.fileTypes, [menu] = integrations.contextMenus;
  if (fileType) return { kind: 'file-extension', definition: fileType };
  if (menu) return { kind: 'context-menu', definition: menu };
  throw new Error('NATIVE_RECIPE_UNKNOWN');
}
/** Shared by project compilation and the reviewed maker. No second template format. */
export function nativeDeclarationSource(kind: NativeKind, definition: NativeDeclaration, contractImport: string): string {
  const value = declared(kind, definition);
  if (value.kind === 'file-extension')
    return `import type { NativeFileDefinition } from ${codeLiteral(contractImport)};
/** Developer-owned file contract. Add domain validation without rewriting raw input. */
export const definition: NativeFileDefinition = ${codeLiteral(value.definition)};
`;
  return `import type { NativeMenuDefinition, NativeFileContext, NativeFileOperations, NativeMenuOutcome } from ${codeLiteral(contractImport)};
/**
 * Developer-owned action. \`file\` is a plain snapshot, never a host object; \`files\` reads,
 * creates (never overwrites) and opens vault files. Return null to show nothing.
 */
export async function inspectFile(file: NativeFileContext, files: NativeFileOperations): Promise<NativeMenuOutcome> {
  const text = await files.read(file.path);
  return { title: ${codeLiteral(value.definition.name)}, message: 'File: ' + file.name + '\\nExtension: .' + file.extension + '\\nVault path: ' + file.path + '\\nCharacters: ' + text.length };
}
export const definition: NativeMenuDefinition = { ${objectMembers(value.definition)}, run: inspectFile };
`;
}
function declarationExpectations(value: Declared): string {
  if (value.kind === 'file-extension')
    return `expect(definition.extension).toBe(${codeLiteral(value.definition.extension)});
  expect(definition.initialContent).toBe(${codeLiteral(value.definition.initialContent)});`;
  return `expect(definition.extensions).toEqual(${codeLiteral(value.definition.extensions)});
  const files = { read: async () => '# Example', create: async () => 'created' as const, open: async () => undefined };
  expect(await definition.run({ path: 'Notes/Example.md', name: 'Example.md', extension: 'md' }, files)).toEqual({ title: ${codeLiteral(value.definition.name)}, message: 'File: Example.md\\nExtension: .md\\nVault path: Notes/Example.md\\nCharacters: 9' });`;
}
export function nativeDeclarationTest(kind: NativeKind, definition: NativeDeclaration, sourceImport: string): string {
  const value = declared(kind, definition);
  return `import { expect, it } from 'vitest';
import { definition } from ${codeLiteral(sourceImport)};
it(${codeLiteral('declares ' + value.definition.id + ' without host objects or side effects')}, async () => {
  expect(definition.id).toBe(${codeLiteral(value.definition.id)});
  ${declarationExpectations(value)}
});
`;
}
