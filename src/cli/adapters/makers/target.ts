import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { implicitSourceManifest, parseSourceManifest, resolveSourceProject, topologicalOrder, unknownReferences, type SourceKind } from '../../domain/source-projects.ts';
import { createMakerContext } from './engine.ts';
import type { MakerContext } from './contracts.ts';

export interface MakerTarget { readonly name: string; readonly path: string; readonly depthToRoot: string; readonly tooling: string; readonly sdk: string }
/** Repository machinery keeps its legacy location until its owning folder has moved. */
export function makerLayout(root: string): MakerTarget {
  return { name: 'plugin', path: 'src', depthToRoot: '..', tooling: existsSync(resolve(root, 'tooling')) ? 'tooling' : 'scripts',
    sdk: existsSync(resolve(root, 'plugins/api.ts')) ? 'plugins' : existsSync(resolve(root, 'src/cli/sdk')) ? 'src/cli/sdk' : 'plugins' };
}
/** Resolve once before planning; corrupt manifests never fall back to an implicit project. */
export async function makerTarget(root: string, kind: SourceKind = 'plugin', name?: string): Promise<MakerTarget> {
  let manifest;
  try { manifest = parseSourceManifest(JSON.parse(await readFile(resolve(root, 'workbench.sources.json'), 'utf8'))); }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    manifest = implicitSourceManifest(existsSync(resolve(root, 'src/plugin')), true);
  }
  const unknown = unknownReferences(manifest);
  if (unknown.length) throw new Error(`SOURCE_UNKNOWN_REFERENCE: ${unknown.map(item => `${item.project} -> ${item.reference}`).join(', ')}`);
  topologicalOrder(manifest);
  const project = resolveSourceProject(manifest, kind, name);
  return { ...makerLayout(root), name: project.name, path: project.path, depthToRoot: project.path.split('/').map(() => '..').join('/') };
}

const sourceTestFolders = [
  ['tests/runtime/', 'unit'], ['tests/tooling/', 'tooling'], ['tests/fixtures/', 'fixtures'],
] as const;
/** Source-owned tests follow their source; project-wide tooling checks follow the tooling folder. */
function makerTestPath(target: MakerTarget, path: string): string | undefined {
  if (target.path === 'src') {
    if (target.tooling === 'tooling' && path.startsWith('tests/tooling/'))
      return `tooling/tests/${path.slice('tests/tooling/'.length)}`;
    return undefined;
  }
  for (const [prefix, folder] of sourceTestFolders) {
    if (path.startsWith(prefix)) return `${target.path}/tests/${folder}/${path.slice(prefix.length)}`;
  }
  return undefined;
}
/** Recipes describe the legacy logical layout. This boundary relocates their outputs and relative imports together. */
export function makerPath(target: MakerTarget, path: string): string {
  if (/^src\/(?:application|bootstrap|domain|features|infrastructure|locales|presentation|styles)(?:\/|$)/.test(path))
    return target.path + path.slice(3);
  const testPath = makerTestPath(target, path);
  if (testPath) return testPath;
  if (path.startsWith('plugins/')) return target.sdk + path.slice(7);
  if (path.startsWith('scripts/')) return target.tooling + path.slice(7);
  return path;
}
function relocateContent(target: MakerTarget, path: string, content: string): string {
  const destination = makerPath(target, path);
  // Restrict rewriting to quoted path literals; identifiers, prose and user-owned existing files are untouched.
  return content.replace(/(['"])((?:\.\.\/|\.\/|tests\/fixtures\/)[^'"\n]+)\1/g, (match, quote: string, specifier: string) => {
    if (specifier.startsWith('tests/fixtures/')) return quote + makerPath(target, specifier) + quote;
    const original = posix.normalize(posix.join(posix.dirname(path), specifier));
    const mapped = makerPath(target, original);
    if (destination === path && mapped === original) return match;
    const relative = posix.relative(posix.dirname(destination), mapped);
    return quote + (relative.startsWith('.') ? relative : './' + relative) + quote;
  });
}
export function targetedMakerContext(root: string, target: MakerTarget, context: MakerContext = createMakerContext(root)): MakerContext {
  return { ...context,
    readRepository: path => (context.readRepository ?? context.read)(path),
    read: path => context.read(makerPath(target, path)),
    add: (path, content) => context.add(makerPath(target, path), relocateContent(target, path, content)),
    edit: (path, transform) => context.edit(makerPath(target, path), transform),
    editArray: (path, name, expression, imports) => context.editArray(makerPath(target, path), name, expression, imports),
  };
}
