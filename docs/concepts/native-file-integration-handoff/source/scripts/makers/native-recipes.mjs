import { guardNativeRegistry } from './native-registry.mjs';
import { title } from './arguments.mjs';
import { validateNativeIntegrations } from '../companion/native-contract.mjs';
import { nativeFileSource, nativeActionSource, nativeContractTest, nativeSymbol } from '../companion/native-code.mjs';
/** No feature prerequisite: file integrations are host entry points, not note repositories. */
export async function nativeRecipe(context, { maker, name, options }) {
  const file = maker === 'file-type';
  const spec = file ? {
    id:name,name:options['--title'] ?? title(name),extension:options['--extension'],icon:'file-code',format:options['--format'] ?? 'json',
    defaultContent:options['--format'] === 'text' ? '' : JSON.stringify({schemaVersion:1,title:title(name),content:''},null,2)+'\n',
  } : { id:name,name:options['--title'] ?? `Inspect ${title(name)}`,extensions:(options['--extensions'] ?? '').split(','),icon:'file-search' };
  validateNativeIntegrations({fileTypes:file ? [spec] : [],contextMenus:file ? [] : [spec]});
  const path = `src/${file ? 'domain/file-types' : 'application/file-actions'}/${name}.ts`;
  // Validate claimed suffixes against every existing descriptor, including JSON-generated ones.
  await guardNativeRegistry(context,spec,path);
  await context.add(path,file ? nativeFileSource(spec,'../native-file') : nativeActionSource(spec,'../../domain/native-file','../inspect-native-file'));
  const symbol = nativeSymbol(name);
  await context.editArray('src/bootstrap/native-integrations.ts',file ? 'nativeFileTypes' : 'nativeFileActions',symbol,[{local:symbol,from:`../${file ? 'domain/file-types' : 'application/file-actions'}/${name}`}]);
  const test = `tests/runtime/generated/native-${maker}-${name}.test.ts`;
  await context.add(test,nativeContractTest(spec,'../../../'+path.slice(0,-3),'../../../src/domain/native-file',maker));
  context.tests.add(test);
}
