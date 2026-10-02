/** Shared source templates for JSON compilation and native authoring makers. */
const nativeLiteral = value => JSON.stringify(value,null,2).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
export const nativeSymbol = id => 'native' + id.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
export function nativeFileSource(spec, contractImport) {
  return `import type { NativeFileType } from ${nativeLiteral(contractImport)};\n/** Developer-owned file contract. Add domain validation through validate(text). */\nexport const ${nativeSymbol(spec.id)}: NativeFileType = ${nativeLiteral(spec)};\n`;
}
export function nativeActionSource(spec, contractImport, handlerImport) {
  return `import type { NativeFileAction } from ${nativeLiteral(contractImport)};\nimport { inspectNativeFile } from ${nativeLiteral(handlerImport)};\n/** Replace run with your application use case. The default action is read-only. */\nexport const ${nativeSymbol(spec.id)}: NativeFileAction = {\n...${nativeLiteral(spec)},\nrun: inspectNativeFile,\n};\n`;
}
export function nativeContractTest(spec, moduleImport, contractImport, kind) {
  const symbol = nativeSymbol(spec.id);
  if (kind === 'file-type') return `import { it, expect } from 'vitest';\nimport { nativeTextIssue } from ${nativeLiteral(contractImport)};\nimport { ${symbol} } from ${nativeLiteral(moduleImport)};\nit('custom file ${spec.id} has valid initial bytes and a distinct extension', () => {\nexpect(${symbol}.extension).toBe(${nativeLiteral(spec.extension)});\nexpect(nativeTextIssue(${symbol}.defaultContent,${symbol})).toBeNull();\n});\n`;
  return `import { it, expect, vi } from 'vitest';\nimport { ${symbol} } from ${nativeLiteral(moduleImport)};\nit('file action ${spec.id} executes its read-only use case', async () => {\nconst read = vi.fn(async () => 'hello');\nexpect(await ${symbol}.run({ name:'example', extension:${nativeLiteral(spec.extensions[0])}, read })).toEqual({title:'File summary',message:'1 lines · 5 characters · 5 UTF-8 bytes'});\nexpect(read).toHaveBeenCalledOnce();\n});\n`;
}
