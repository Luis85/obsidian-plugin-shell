import { checkNativeRegistration } from './native-registrations.mjs';
import { posix } from 'node:path';
import { makerSymbol as symbol, title } from './arguments.mjs';
import { nativeDeclarationSource, nativeDeclarationTest } from '../companion/native-boilerplate.mjs';
import { validateNativeIntegrations } from '../companion/native-contract.mjs';
const relative = (from, to) => {
  const value = posix.relative(posix.dirname(from), to);
  return value.startsWith('.') ? value : './' + value;
};
/** Use the shared guarded file plan and the explicit bootstrap registries. No filesystem discovery. */
export async function nativeRecipe(context, { maker, name, owner, options }) {
  const id = owner + '-' + name;
  const definition =
    maker === 'file-extension'
      ? {
          id,
          name: title(name),
          extension: options['--extension'],
          format: options['--format'] ?? 'json',
          initialContent: options['--format'] === 'text' ? '' : '{"schemaVersion":1,"title":"Untitled"}\n',
        }
      : { id, name: title(name), extensions: (options['--extensions'] ?? 'md').split(',') };
  validateNativeIntegrations({
    schemaVersion: 1,
    fileTypes: maker === 'file-extension' ? [definition] : [],
    contextMenus: maker === 'context-menu' ? [definition] : [],
  });
  const source = `src/features/${owner}/${name}.${maker}.ts`;
  await checkNativeRegistration(context, definition, source);
  const registry = 'src/bootstrap/native-integrations.ts';
  const local = symbol(owner + '-' + name + '-' + maker);
  await context.add(
    source,
    nativeDeclarationSource(maker, definition, '../api') + `\nexport { definition as ${local} };\n`,
  );
  await context.editArray(registry, maker === 'file-extension' ? 'nativeFileTypes' : 'nativeContextMenus', local, [
    { local, from: relative(registry, source).replace(/\.ts$/, '') },
  ]);
  const test = `tests/runtime/generated/${owner}-${name}-${maker}.test.ts`;
  await context.add(test, nativeDeclarationTest(maker, definition, relative(test, source).replace(/\.ts$/, '')));
  context.tests.add(test);
}
