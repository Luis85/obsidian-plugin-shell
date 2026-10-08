const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { nativeDeclarationSource, nativeDeclarationTest } from '../../src/cli/compiler/emitters/native-boilerplate.ts';

// Native declaration boilerplate (native-boilerplate.ts), shared by project compilation and the reviewed maker.
const file = { id: 'board', name: 'Board </script>', extension: 'board', format: 'json', initialContent: '{"a":"\u2028\u2029"}\n' };
const menu = { id: 'inspect-file', name: 'Inspect file', extensions: ['md', 'board'] };

test('a file-extension declaration and its test are emitted as escaped literals', () => {
  assert.equal(nativeDeclarationSource('file-extension', file, '../api'), `import type { NativeFileDefinition } from "../api";
/** Developer-owned file contract. Add domain validation without rewriting raw input. */
export const definition: NativeFileDefinition = {"id":"board","name":"Board \\u003c/script>","extension":"board","format":"json","initialContent":"{\\"a\\":\\"\\u2028\\u2029\\"}\\n"};
`);
  assert.equal(nativeDeclarationTest('file-extension', file, './board.file-extension'), `import { expect, it } from 'vitest';
import { definition } from "./board.file-extension";
it("declares board without host objects or side effects", async () => {
  expect(definition.id).toBe("board");
  expect(definition.extension).toBe("board");
  expect(definition.initialContent).toBe("{\\"a\\":\\"\\u2028\\u2029\\"}\\n");
});
`);
});

test('a context-menu declaration gets a read-only inspect action through the file operations port and a matching test', () => {
  assert.equal(nativeDeclarationSource('context-menu', menu, '../../domain/native-integrations'),
    `import type { NativeMenuDefinition, NativeFileContext, NativeFileOperations, NativeMenuOutcome } from "../../domain/native-integrations";
/**
 * Developer-owned action. \`file\` is a plain snapshot, never a host object; \`files\` reads,
 * creates (never overwrites) and opens vault files. Return null to show nothing.
 */
export async function inspectFile(file: NativeFileContext, files: NativeFileOperations): Promise<NativeMenuOutcome> {
  const text = await files.read(file.path);
  return { title: "Inspect file", message: 'File: ' + file.name + '\\nExtension: .' + file.extension + '\\nVault path: ' + file.path + '\\nCharacters: ' + text.length };
}
export const definition: NativeMenuDefinition = { id: "inspect-file", name: "Inspect file", extensions: ["md","board"], run: inspectFile };
`);
  assert.equal(nativeDeclarationTest('context-menu', menu, './inspect-file.context-menu'), `import { expect, it } from 'vitest';
import { definition } from "./inspect-file.context-menu";
it("declares inspect-file without host objects or side effects", async () => {
  expect(definition.id).toBe("inspect-file");
  expect(definition.extensions).toEqual(["md","board"]);
  const files = { read: async () => '# Example', create: async () => 'created' as const, open: async () => undefined };
  expect(await definition.run({ path: 'Notes/Example.md', name: 'Example.md', extension: 'md' }, files)).toEqual({ title: "Inspect file", message: 'File: Example.md\\nExtension: .md\\nVault path: Notes/Example.md\\nCharacters: 9' });
});
`);
});

test('declarations are validated by the shared native contract and unknown kinds are refused', () => {
  assert.throws(() => nativeDeclarationSource('file-extension', { ...file, extension: 'md' }, '../api'),
    { message: 'NATIVE_INTEGRATION_INVALID: board: extension must be unique, lowercase, dotless and not owned by Obsidian.' });
  assert.throws(() => nativeDeclarationTest('context-menu', { ...menu, run: 'x' }, './menu'),
    { message: 'NATIVE_INTEGRATION_INVALID: Unknown or missing menu declaration field.' });
  assert.throws(() => nativeDeclarationSource('ribbon', menu, '../api'), { message: 'NATIVE_RECIPE_UNKNOWN' });
});
