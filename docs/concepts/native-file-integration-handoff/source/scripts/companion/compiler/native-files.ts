import { validateNativeIntegrations } from '../native-contract.mjs';
import { nativeFileSource, nativeActionSource, nativeContractTest, nativeSymbol } from '../native-code.mjs';
import { literal, type Model, type Row } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
/** One portable contract drives starters and ordinary project JSON alike. */
export function nativeFiles(model: Model, add: Add): void {
  const native = validateNativeIntegrations((model.document.design as Row).nativeIntegrations);
  const registry = `${model.sourceRoot}/bootstrap/native-bindings.ts`, imports: string[] = [];
  for (const kind of ['file-type','context-menu'] as const) {
    for (const spec of kind === 'file-type' ? native.fileTypes : native.contextMenus) {
      const path = `${model.sourceRoot}/${kind === 'file-type' ? 'domain/file-types' : 'application/file-actions'}/${spec.id}.ts`;
      const contract = relativeImport(path,'src/domain/native-file.ts');
      if ('extension' in spec) add(path,nativeFileSource(spec,contract));
      else add(path,nativeActionSource(spec,contract,relativeImport(path,'src/application/inspect-native-file.ts')));
      imports.push(`import { ${nativeSymbol(spec.id)} } from ${literal(relativeImport(registry,path))};`);
      const test = `${model.testRoot}/native/${kind}-${spec.id}.test.ts`;
      add(test,nativeContractTest(spec,relativeImport(test,path),relativeImport(test,'src/domain/native-file.ts'),kind));
    }
  }
  add(registry,`${imports.join('\n')}\nexport const generatedNativeFileTypes = [${native.fileTypes.map(s => nativeSymbol(s.id)).join(',')}];\nexport const generatedNativeFileActions = [${native.contextMenus.map(s => nativeSymbol(s.id)).join(',')}];\n`,'managed');
  add('NATIVE-INTEGRATIONS.md',`# Native file integrations\n\n${native.fileTypes.map(s => `- File type: **${s.name}** (\`.${s.extension}\`). Command: \`Create ${s.name} file\`. Right-click a matching file to open its editor. Source: \`${model.sourceRoot}/domain/file-types/${s.id}.ts\`.`).join('\n')}\n${native.contextMenus.map(s => `- File action: **${s.name}** for ${s.extensions.map(e => '\`.'+e+'\`').join(', ')}. Also available from the command palette on a matching active file. Source: \`${model.sourceRoot}/application/file-actions/${s.id}.ts\`.`).join('\n')}\n\n## Extend this project\n\nUse \`node shell.mjs make file-type drawing --extension mydrawing --format json\` or \`node shell.mjs make context-menu summarize --extensions md\` to preview a reviewed plan; add \`--yes\` to apply. Makers extend \`src/bootstrap/native-integrations.ts\`. JSON-generated registrations live separately in \`${registry}\`.\n\nEach open custom file has its own draft. Opening or parsing never rewrites the file. Save validates the text; corrupt JSON stays recoverable. Copy unsaved draft text before closing or discarding. An external update while drafting blocks saving until the incoming version is selected. A failed save requires reopening and verifying the file before retrying. No cross-process transaction or conflict-free merge is claimed.\n\nNative host calls are not executed by the browser concept. Build and enable the plugin only in a disposable vault for native acceptance. Unload removes host-owned registrations without detaching leaves. Read-only actions receive a fresh bounded read capability; provide explicit application ports when adding writes. No OS file association, remote service, binary decoder or domain-specific JSON schema is installed.\n\nSee \`docs/framework/development/NATIVE-FILE-INTEGRATIONS.md\` in generated projects (\`docs/development/NATIVE-FILE-INTEGRATIONS.md\` in the framework checkout).\n`,'managed');
}
