/** Resolves what a design folder is prepared from: a managed prototype's variant or the saved sketch project. */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotPath, type ManagedPrototype, type PrototypeSelection } from '#shared/companion/prototypes/model.ts';
import { loadPrototypeWorkspace } from './framework/prototype-workspace.ts';
import { exists, hash, readBounded } from './framework/files.ts';
import { savedProjectConfig } from './project-selection.ts';
import { readSnapshot } from './storage.ts';
import { guardedText } from './user-settings.ts';
import { openDocument, type SketchDocument } from '../domain/document.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { DesignManifest, DesignSource } from '../domain/design-folder.ts';
import { designTemplateNames, shellTarget, type DesignTarget, type DesignTemplates } from '../application/design-folder.ts';
export interface ResolvedDesignSource { document: SketchDocument; source: DesignSource; title: string }
export interface SourceRequest { root: string; frameworkRoot: string; name: string; project?: string; configuredProject: string; previous: DesignManifest | null; signal?: AbortSignal }
/** The active variant when it belongs to this prototype, otherwise the newest version's first unarchived variant. */
function selectedVariant(item: ManagedPrototype, active: PrototypeSelection | null): PrototypeSelection | null {
  if (active?.prototypeId === item.id) return active;
  for (const version of [...item.versions].reverse()) {
    const variant = version.variants.find(entry => entry.status !== 'archived');
    if (variant) return { prototypeId: item.id, versionId: version.id, variantId: variant.id };
  }
  return null;
}
async function prototypeSource(request: SourceRequest): Promise<ResolvedDesignSource | null> {
  const { workspace, files } = await loadPrototypeWorkspace({ root: request.root, frameworkRoot: request.frameworkRoot, signal: request.signal });
  const item = workspace?.prototypes.find(entry => entry.id === request.name);
  if (!workspace || !item) return null;
  const selection = selectedVariant(item, workspace.active);
  requireSketch(selection, 'DESIGN_SOURCE_MISSING', `Prototype ${item.id} has no unarchived variant to design from.`);
  const variant = item.versions.find(version => version.id === selection.versionId)!.variants.find(entry => entry.id === selection.variantId)!;
  const path = snapshotPath(selection), bytes = files.get(path);
  requireSketch(bytes !== undefined, 'DESIGN_SOURCE_MISSING', 'The selected prototype variant was not read.');
  return { document: openDocument(structuredClone(variant.document)), title: item.name,
    source: { kind: 'prototype-variant', path, sha256: hash(bytes), selection } };
}
async function projectSource(root: string, path: string): Promise<ResolvedDesignSource> {
  const snapshot = await readSnapshot(root, path);
  requireSketch(snapshot.document && snapshot.beforeHash, 'DESIGN_SOURCE_MISSING', `No project model at ${path}. Save a sketch or create a prototype first.`);
  return { document: snapshot.document, title: snapshot.document.project.name, source: { kind: 'project', path, sha256: snapshot.beforeHash } };
}
/** An explicit --project wins; a synced folder keeps its source kind; a new folder prefers a managed prototype of the same name. */
export async function resolveDesignSource(request: SourceRequest): Promise<ResolvedDesignSource> {
  if (request.project) return projectSource(request.root, request.project);
  if (request.previous?.source.kind === 'project') return projectSource(request.root, request.previous.source.path);
  const managed = await prototypeSource(request);
  requireSketch(managed || request.previous?.source.kind !== 'prototype-variant', 'DESIGN_SOURCE_MISSING',
    `The managed prototype ${request.name} no longer exists. Restore it, or sync with --project <project.json>.`);
  return managed ?? projectSource(request.root, request.configuredProject);
}
/** Only an absent source maps to null; cancellation, corrupt data and other I/O failures are reported, never relabelled. */
const absent = (error: unknown) => error instanceof Error && 'code' in error && ['DESIGN_SOURCE_MISSING', 'ENOENT', 'ENOTDIR'].includes(String(error.code));
/** A folder's current source, or null when it no longer exists. Read-only. */
export async function currentSource(request: SourceRequest): Promise<ResolvedDesignSource | null> {
  try { return await resolveDesignSource(request); } catch (error) {
    if (absent(error)) return null;
    throw error;
  }
}
export async function currentSourceHash(request: SourceRequest): Promise<{ path: string; sha256: string } | null> {
  const resolved = await currentSource(request);
  return resolved && { path: resolved.source.path, sha256: resolved.source.sha256 };
}
export async function readBrief(root: string, path: string | null): Promise<string | null> {
  if (path === null) return null;
  const read = await guardedText(root, path);
  return read.content;
}
/** A prepared brief outside the root: bounded, link-refusing and strict UTF-8, like every other input. */
export async function readBriefFile(path: string): Promise<string> {
  return new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(path, 4_000_000));
}
export async function designTarget(root: string, config?: string): Promise<DesignTarget> {
  const saved = await savedProjectConfig(root, config);
  return saved ? { targets: [...saved.selection.targets], framework: saved.selection.framework, source: saved.path } : shellTarget;
}
/** The reviewed Obsidian token names ship with the shell and with generated projects at the same path. */
export async function designTokens(root: string, frameworkRoot: string): Promise<string | null> {
  for (const base of [root, frameworkRoot]) {
    const path = join(base, 'docs/design/obsidian-tokens.json');
    if (await exists(path)) return new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(path, 1_000_000));
  }
  return null;
}
const templateFolder = new URL('../../../templates/design-folder/', import.meta.url);
export async function designTemplates(): Promise<DesignTemplates> {
  const texts = new Map(await Promise.all(designTemplateNames.map(async name =>
    [name, new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(fileURLToPath(new URL(name + '.tmpl', templateFolder)), 200_000))] as const)));
  return name => texts.get(name)!;
}
