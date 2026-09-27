import { validateNativeIntegrations } from './native-contract.mjs';
const codeLiteral = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
/** Shared by project compilation and the reviewed maker. No second template format. */
export function nativeDeclarationSource(kind, definition, contractImport) {
  validateNativeIntegrations({
    schemaVersion: 1,
    fileTypes: kind === 'file-extension' ? [definition] : [],
    contextMenus: kind === 'context-menu' ? [definition] : [],
  });
  if (kind === 'file-extension')
    return `import type { NativeFileDefinition } from ${codeLiteral(contractImport)};
/** Developer-owned file contract. Add domain validation without rewriting raw input. */
export const definition: NativeFileDefinition = ${codeLiteral(definition)};
`;
  if (kind === 'context-menu')
    return `import type { NativeMenuDefinition, NativeFileContext, NativeMenuResult } from ${codeLiteral(contractImport)};
/** Developer-owned action. Receive a file snapshot, not mutable host objects. No IO by default. */
export function inspectFile(file: NativeFileContext): NativeMenuResult {
  return { title: ${codeLiteral(definition.name)}, message: 'File: ' + file.name + '\\nExtension: .' + file.extension + '\\nVault path: ' + file.path };
}
export const definition: NativeMenuDefinition = { ...${codeLiteral(definition)}, run: inspectFile };
`;
  throw new Error('NATIVE_RECIPE_UNKNOWN');
}
export function nativeDeclarationTest(kind, definition, sourceImport) {
  return `import { expect, it } from 'vitest';
import { definition } from ${codeLiteral(sourceImport)};
it(${codeLiteral('declares ' + definition.id + ' without host objects or side effects')}, async () => {
  expect(definition.id).toBe(${codeLiteral(definition.id)});
  ${
    kind === 'file-extension'
      ? `expect(definition.extension).toBe(${codeLiteral(definition.extension)});
  expect(definition.initialContent).toBe(${codeLiteral(definition.initialContent)});`
      : `expect(definition.extensions).toEqual(${codeLiteral(definition.extensions)});
  expect(await definition.run({ path: 'Notes/Example.md', name: 'Example.md', extension: 'md' })).toEqual({ title: ${codeLiteral(definition.name)}, message: 'File: Example.md\\nExtension: .md\\nVault path: Notes/Example.md' });`
  }
});
`;
}
