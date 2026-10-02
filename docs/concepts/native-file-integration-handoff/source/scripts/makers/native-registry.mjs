import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createFilePlan } from '../shared/file-plan.mjs';
import { validateNativeIntegrations } from '../companion/native-contract.mjs';
import { nativeSymbol } from '../companion/native-code.mjs';
/** Read declarative descriptors as syntax, never execute developer source. */
export async function guardNativeRegistry(context, spec, output) {
  const roots = new Set(['src']);
  try {
    const source = await context.read('design/project.json');
    if (source.length > 4_000_000) throw new Error('NATIVE_PROJECT_TOO_LARGE');
    const project = JSON.parse(source);
    validateNativeIntegrations(project.design?.nativeIntegrations);
    const folder = project.settings?.codebaseFolder;
    if (typeof folder !== 'string' || !folder) throw new Error('NATIVE_PROJECT_SOURCE_REQUIRED');
    roots.add(folder + '/generated');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const ts = await import('typescript');
  for (const root of roots) for (const kind of ['domain/file-types','application/file-actions']) {
    const base = root+'/'+kind;
    // Validate every ancestor before even listing it. No traversal or symlink reads.
    await createFilePlan(context.root,[{path:base+'/native-guard.ts',content:null}]);
    let names;
    try { names = await readdir(join(context.root,base)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const candidate of names.filter(name => name.endsWith('.ts')).sort()) {
      const path = base+'/'+candidate; if (path === output) continue;
      const source = await context.read(path), ast = ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
      if (ast.parseDiagnostics.length) throw new Error('NATIVE_REGISTRY_INVALID: '+path);
      const definitions = ast.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations)
        .filter(d => d.initializer && ts.isObjectLiteralExpression(d.initializer));
      if (definitions.length !== 1) throw new Error('NATIVE_REGISTRY_REVIEW_REQUIRED: '+path);
      const properties = flatten(definitions[0].initializer,ts,path);
      const id = stringProperty(properties,'id',ts,path);
      if (id === spec.id || nativeSymbol(id) === nativeSymbol(spec.id)) throw new Error('NATIVE_ID_CONFLICT: '+id+' in '+path);
      if ('extension' in spec && kind === 'domain/file-types' && stringProperty(properties,'extension',ts,path) === spec.extension)
        throw new Error('NATIVE_EXTENSION_CONFLICT: .'+spec.extension+' in '+path);
    }
  }
}
function flatten(object,ts,path) {
  return object.properties.flatMap(property => {
    if (!ts.isSpreadAssignment(property)) return [property];
    if (!ts.isObjectLiteralExpression(property.expression)) throw new Error('NATIVE_REGISTRY_REVIEW_REQUIRED: '+path);
    return flatten(property.expression,ts,path);
  });
}
function stringProperty(properties,key,ts,path) {
  const found = properties.filter(p => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === key);
  if (found.length !== 1 || !ts.isStringLiteral(found[0].initializer)) throw new Error('NATIVE_REGISTRY_REVIEW_REQUIRED: '+path);
  return found[0].initializer.text;
}
