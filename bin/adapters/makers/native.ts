import { posix } from 'node:path';
import { checkNativeRegistration } from './native-registrations.ts';
import { makerSymbol as symbol, title } from './arguments.ts';
import { nativeDeclarationSource, nativeDeclarationTest } from '../../../scripts/companion/native-boilerplate.mjs';
import { validateNativeIntegrations } from '../../../scripts/companion/native-contract.mjs';
import type { MakerContext, OwnedInput } from './contracts.ts';

const relative = (from: string, to: string): string => {
  const value = posix.relative(posix.dirname(from), to);
  return value.startsWith('.') ? value : './' + value;
};
function nativeDefinition({ maker, name, owner, options }: OwnedInput): Record<string, unknown> {
  const id = owner + '-' + name;
  if (maker !== 'file-extension') return { id, name: title(name), extensions: (options['--extensions'] ?? 'md').split(',') };
  return {
    id, name: title(name), extension: options['--extension'], format: options['--format'] ?? 'json',
    initialContent: options['--format'] === 'text' ? '' : '{"schemaVersion":1,"title":"Untitled"}\n',
  };
}
/** Use the shared guarded file plan and the explicit bootstrap registries. No filesystem discovery. */
export async function nativeRecipe(context: MakerContext, input: OwnedInput): Promise<void> {
  const { maker, name, owner } = input;
  const kind = maker === 'file-extension' ? 'file-extension' : 'context-menu';
  const definition = nativeDefinition(input);
  const integrations = validateNativeIntegrations({
    schemaVersion: 1, fileTypes: kind === 'file-extension' ? [definition] : [], contextMenus: kind === 'context-menu' ? [definition] : [],
  });
  const [declared] = [...integrations.fileTypes, ...integrations.contextMenus];
  if (!declared) throw new Error('NATIVE_RECIPE_UNKNOWN');
  const source = `src/features/${owner}/${name}.${kind}.ts`;
  await checkNativeRegistration(context, { id: declared.id, extension: 'extension' in declared ? declared.extension : undefined }, source);
  const registry = 'src/bootstrap/native-integrations.ts';
  const local = symbol(owner + '-' + name + '-' + kind);
  await context.add(source, nativeDeclarationSource(kind, declared, '../api') + `\nexport { definition as ${local} };\n`);
  await context.editArray(registry, kind === 'file-extension' ? 'nativeFileTypes' : 'nativeContextMenus', local, [
    { local, from: relative(registry, source).replace(/\.ts$/, '') },
  ]);
  const test = `tests/runtime/generated/${owner}-${name}-${kind}.test.ts`;
  await context.add(test, nativeDeclarationTest(kind, declared, relative(test, source).replace(/\.ts$/, '')));
  context.tests.add(test);
}
