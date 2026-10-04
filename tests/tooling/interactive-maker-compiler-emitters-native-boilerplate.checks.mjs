const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { nativeDeclarationSource, nativeDeclarationTest } from '../../bin/compiler/emitters/native-boilerplate.ts';

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

test('a context-menu declaration gets a side-effect-free inspect action and a matching test', () => {
  assert.equal(nativeDeclarationSource('context-menu', menu, '../../domain/native-integrations'),
    `import type { NativeMenuDefinition, NativeFileContext, NativeMenuResult } from "../../domain/native-integrations";
/** Developer-owned action. Receive a file snapshot, not mutable host objects. No IO by default. */
export function inspectFile(file: NativeFileContext): NativeMenuResult {
  return { title: "Inspect file", message: 'File: ' + file.name + '\\nExtension: .' + file.extension + '\\nVault path: ' + file.path };
}
export const definition: NativeMenuDefinition = { id: "inspect-file", name: "Inspect file", extensions: ["md","board"], run: inspectFile };
`);
  assert.equal(nativeDeclarationTest('context-menu', menu, './inspect-file.context-menu'), `import { expect, it } from 'vitest';
import { definition } from "./inspect-file.context-menu";
it("declares inspect-file without host objects or side effects", async () => {
  expect(definition.id).toBe("inspect-file");
  expect(definition.extensions).toEqual(["md","board"]);
  expect(await definition.run({ path: 'Notes/Example.md', name: 'Example.md', extension: 'md' })).toEqual({ title: "Inspect file", message: 'File: Example.md\\nExtension: .md\\nVault path: Notes/Example.md' });
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
