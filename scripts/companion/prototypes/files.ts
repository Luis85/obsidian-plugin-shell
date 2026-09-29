/** Portable directory codec, shared by browser export and the shell. No filesystem access. */
import { PROTOTYPE_REGISTRY, PROTOTYPE_MAX_BYTES, prototypeFolder, snapshotPath, type PrototypeWorkspace, type ValidateDocument } from './model.ts';
import { validateWorkspace, validateSelection } from './validate.ts';
import { prototypeJson, object, slug, text, collection, ensure } from './safety.ts';
export interface PrototypeFile { path: string; content: string }
export type Digest = (text: string) => string | Promise<string>;
export const prototypeJsonText = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';
export async function workspaceFiles(workspace: PrototypeWorkspace, validate: ValidateDocument, digest: Digest): Promise<PrototypeFile[]> {
  validateWorkspace(workspace, validate);
  const files: PrototypeFile[] = [];
  for (const p of workspace.prototypes) {
    const versions = [];
    for (const v of p.versions) {
      const variants = [];
      for (const item of v.variants) {
        const path = snapshotPath({ prototypeId: p.id, versionId: v.id, variantId: item.id });
        const content = prototypeJsonText(item.document), sha256 = await digest(content);
        ensure(/^[a-f0-9]{64}$/.test(sha256), 'PROTOTYPE_HASH', 'Expected a SHA-256 digest.');
        files.push({ path, content });
        variants.push({ ...item, document: { path, sha256 } });
      }
      versions.push({ ...v, variants });
    }
    files.push({ path: prototypeFolder(p.id) + '/prototype.json', content: prototypeJsonText({ kind: 'workbench-prototype', schemaVersion: 1,
      projectId: workspace.projectId, item: { ...p, versions } }) });
  }
  files.push({ path: PROTOTYPE_REGISTRY, content: prototypeJsonText({ ...workspace, prototypes: workspace.prototypes.map(p => p.id) }) });
  const sizes = files.map(file => new TextEncoder().encode(file.content).length);
  ensure(sizes.every(size => size <= 4_000_000) && sizes.reduce((sum, size) => sum + size, 0) <= PROTOTYPE_MAX_BYTES,
    'PROTOTYPE_LIMIT', 'Serialized prototype files exceed the supported per-file or workspace budget.');
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function parse(textValue: string): unknown { let value: unknown; try { value = JSON.parse(textValue); } catch { throw Error('PROTOTYPE_JSON: Expected JSON.'); } prototypeJson(value); return value; }
/** Every path is derived from validated slugs, never followed from an imported path string. */
export async function readWorkspaceFiles(read: (path: string) => Promise<string>, validate: ValidateDocument, digest: Digest): Promise<PrototypeWorkspace> {
  const registry = parse(await read(PROTOTYPE_REGISTRY));
  object(registry, ['kind', 'schemaVersion', 'projectId', 'revision', 'active', 'prototypes']);
  ensure(registry.kind === 'workbench-prototype-workspace' && registry.schemaVersion === 1, 'PROTOTYPE_VERSION', 'Unsupported prototype registry.');
  text(registry.projectId); if (registry.active !== null) validateSelection(registry.active);
  collection(registry.prototypes, 40); const items = []; let snapshots = 0;
  for (const id of registry.prototypes) {
    slug(id);
    const manifest = parse(await read(prototypeFolder(id) + '/prototype.json'));
    object(manifest, ['kind', 'schemaVersion', 'projectId', 'item']);
    ensure(manifest.kind === 'workbench-prototype' && manifest.schemaVersion === 1 && manifest.projectId === registry.projectId,
      'PROTOTYPE_VERSION', 'Incompatible prototype manifest.');
    const p = manifest.item; object(p, ['id', 'name', 'description', 'archived', 'versions']);
    ensure(p.id === id, 'PROTOTYPE_IDENTITY', 'Prototype manifest identity does not match its directory.'); collection(p.versions, 40);
    for (const v of p.versions) {
      object(v, ['id', 'label', 'sealed', 'variants']); slug(v.id); collection(v.variants, 40);
      for (const item of v.variants) {
        ensure(++snapshots <= 200, 'PROTOTYPE_LIMIT', 'Workspace supports at most 200 saved variants.');
        object(item, ['id', 'name', 'hypothesis', 'status', 'revision', 'document']); slug(item.id);
        object(item.document, ['path', 'sha256']);
        const path = snapshotPath({ prototypeId: id, versionId: v.id, variantId: item.id });
        ensure(item.document.path === path, 'PROTOTYPE_PATH', 'Snapshot path differs from its derived location.');
        const source = await read(path);
        ensure(item.document.sha256 === await digest(source), 'PROTOTYPE_SNAPSHOT_CHANGED', 'Snapshot bytes differ from the saved manifest. Import an edited project as a draft rather than altering a pinned snapshot.');
        item.document = parse(source);
      }
    }
    items.push(p);
  }
  return validateWorkspace({ ...registry, prototypes: items }, validate);
}
