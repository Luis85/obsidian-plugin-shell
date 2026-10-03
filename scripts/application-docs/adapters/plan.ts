import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { createFilePlan } from '../../shared/file-plan.ts';
import type { AuthoringDocument } from '../../companion/authoring-contract.ts';
import { documentationProjectIntake } from './project-intake.ts';
import { keyOf, equal, stable, insist, type DocsIndex, type Entity, type Conflict } from '../domain/contracts.ts';
import { reconcile } from '../application/reconcile.ts';
import { projectEntities, applyEntities, coverage } from './model.ts';
import { renderMarkdown, generatedSource, parseMarkdown, type MarkdownDocument } from './markdown.ts';
import { readBytes, portable, localPath, documentationDigest as digest, decode } from './filesystem.ts';
import { folders, SETTINGS_FILE, PROTECTED_ROOTS } from './settings.ts';
import { readWorkspace, type Workspace, type InputDocument } from './workspace.ts';
// Content is null only when a reviewed intake change deletes a file; the file-plan engine owns that case.
interface Entry { path: string; content: string | null; encoding?: 'base64' }
const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');
function filename(entity: Entity): string {
  const title = entity.title.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '').slice(0, 60) || 'document';
  const id = entity.id.replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 60);
  return `${title}--${id}-${digest(keyOf(entity)).slice(0, 8)}.md`;
}
function destination(workspace: Workspace, entity: Entity, source?: InputDocument): string {
  const existing = source ? localPath(workspace.root, source.source.path) : null;
  if (existing) return portable(existing);
  const bound = workspace.index.entries[keyOf(entity)]; if (bound) return bound.path;
  if (source) return portable(workspace.settings.root + '/' + source.source.relative);
  if (entity.type === 'project') return workspace.settings.root + '/project.md';
  return (workspace.settings.paths[folders[entity.type]] ?? workspace.settings.root + '/' + folders[entity.type]) + '/' + filename(entity);
}
function safeOutput(workspace: Workspace, path: string): void {
  portable(path);
  insist(!path.split('/').some(part => part.startsWith('.')), 'DOCS_OUTPUT_PROTECTED', 'Documentation paths must remain outside hidden directories: ' + path);
  const configured = workspace.config ? [workspace.config.paths.codebaseFolder, workspace.config.paths.testsFolder, workspace.config.paths.testVaultFolder] : [];
  const blocked = [...PROTECTED_ROOTS, ...workspace.protectedPaths, ...configured], lower = path.toLowerCase();
  insist(!path.split('/').some(part => part.startsWith('.') && blocked.includes(part.toLowerCase())) &&
    !blocked.some(folder => lower === folder.toLowerCase() || lower.startsWith(folder.toLowerCase() + '/')), 'DOCS_OUTPUT_PROTECTED', 'Refusing documentation in a protected path: ' + path);
}
async function adapterFingerprint(): Promise<string> {
  const root = fileURLToPath(new URL('../', import.meta.url)), records: string[] = [];
  async function visit(path: string): Promise<void> {
    for (const child of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(path, child.name);
      if (child.isDirectory()) await visit(full);
      else if (/\.(?:ts|js|mjs|json)$/.test(child.name)) { const bytes = await readBytes(full); insist(bytes, 'DOCS_ADAPTER', 'Missing adapter file.'); records.push((localPath(root, full) ?? child.name) + ':' + digest(bytes)); }
    }
  }
  await visit(root); return digest(records.join('\n'));
}
function navigation(workspace: Workspace, index: DocsIndex): string {
  const from = workspace.settings.root + '/generated/index.md';
  const links = Object.entries(index.entries).sort(([a], [b]) => a < b ? -1 : 1).map(([, entry]) => {
    const relative = posix.relative(posix.dirname(from), entry.path), label = entry.baseline.title.replace(/[\[\]|]/g, '');
    return workspace.settings.linkFormat === 'wikilink' ? `- [[${entry.path.replace(/\.md$/i, '')}|${label}]]` : `- [${label}](${encodePath(relative)}) — ${entry.baseline.type}`;
  });
  return '<!-- shell:application-docs:index:v1 -->\n# Application documentation\n\nGenerated navigation; edit the linked typed documents.\n\n' + links.join('\n') + '\n';
}
type Preimage = { path: string; beforeHash: string | null };
interface Planning { root: string; workspace: Workspace; index: DocsIndex; entries: Entry[]; conflicts: Conflict[]; documentByKey: Map<string, InputDocument> }
type Binding = DocsIndex['entries'][string];
const optionalDigest = (bytes: Buffer | null): string | null => bytes ? digest(bytes) : null;
function generatedHash(document: MarkdownDocument): string | null {
  const source = generatedSource(document); return source === null ? null : digest(source);
}
const refuse = (plan: Planning, entity: string, reason: string, field = '/'): void => { plan.conflicts.push({ entity, field, reason }); };
async function movedFrom(plan: Planning, bound: Binding | undefined, input: InputDocument | undefined, path: string): Promise<string | null> {
  if (!bound || !input || bound.path === path) return null;
  return await readBytes(join(plan.root, bound.path)) ? bound.path : null;
}
/** Include/exclude rules limit discovery, not overwrite authority: an unscanned destination passes the same baseline-aware review. */
function existingOriginal(plan: Planning, entity: Entity, key: string, path: string, priorBytes: Buffer): MarkdownDocument | null {
  const original = parseMarkdown(decode(priorBytes), path);
  if (!original || keyOf(original.entity) !== key || original.entity.project !== entity.project) { refuse(plan, key, 'Destination is an unrelated file: ' + path); return null; }
  const destinationReview = reconcile([entity], [original.entity], plan.workspace.index, 'export');
  if (destinationReview.conflicts.length) { plan.conflicts.push(...destinationReview.conflicts); return null; }
  return original;
}
function externalCollision(plan: Planning, input: InputDocument | undefined, bound: Binding | undefined, priorBytes: Buffer | null): boolean {
  if (!input || !priorBytes || localPath(plan.root, input.source.path) !== null) return false;
  return !bound || !priorBytes.equals(input.source.bytes);
}
function bindingConflict(plan: Planning, input: InputDocument | undefined, bound: Binding | undefined, priorBytes: Buffer | null, original: MarkdownDocument | undefined, path: string) {
  if (externalCollision(plan, input, bound, priorBytes)) return { field: '/', reason: 'External input collides with an existing project document: ' + path };
  if (!input && bound && !priorBytes) return { field: '/', reason: 'Bound document is missing. Move it within the configured scan roots or restore it: ' + path };
  if (original && bound && bound.generatedHash !== generatedHash(original)) return { field: '/generated', reason: 'The generated region was edited; preserve it and resolve ownership manually.' };
  return null;
}
function originalOf(plan: Planning, entity: Entity, input: InputDocument | undefined, priorBytes: Buffer | null, path: string): MarkdownDocument | null | undefined {
  if (input) return input.document;
  return priorBytes ? existingOriginal(plan, entity, keyOf(entity), path, priorBytes) : undefined;
}
async function planEntity(plan: Planning, entity: Entity): Promise<void> {
  const { root, workspace } = plan, key = keyOf(entity), input = plan.documentByKey.get(key), path = destination(workspace, entity, input); safeOutput(workspace, path);
  const bound = workspace.index.entries[key];
  const previous = await movedFrom(plan, bound, input, path);
  if (previous) return refuse(plan, key, 'The previous bound document still exists. Move it rather than copying its identity: ' + previous);
  const priorBytes = await readBytes(join(root, path)), original = originalOf(plan, entity, input, priorBytes, path);
  if (original === null) return;
  const conflict = bindingConflict(plan, input, bound, priorBytes, original, path);
  if (conflict) return refuse(plan, key, conflict.reason, conflict.field);
  const content = renderMarkdown(entity, original);
  plan.entries.push({ path, content });
  const written = parseMarkdown(content, path);
  insist(written && equal(written.entity, entity), 'DOCS_RENDER_COVERAGE', 'Rendered Markdown would lose managed fields: ' + path);
  plan.index.entries[key] = { path, baseline: entity, generatedHash: generatedHash(written) };
}
// Copy selected external notes/assets without following links or fetching remote references.
async function copyExternalSources(plan: Planning): Promise<void> {
  const { root, workspace } = plan;
  for (const source of workspace.sources) {
    if (localPath(root, source.path) !== null || workspace.documents.some(input => input.source.path === source.path)) continue;
    const path = portable(workspace.settings.root + '/' + source.relative); safeOutput(workspace, path);
    const existing = await readBytes(join(root, path), 8_000_000);
    if (existing && !existing.equals(source.bytes)) refuse(plan, path, 'External note/asset collides with an existing file.');
    else plan.entries.push({ path, content: source.bytes.toString('base64'), encoding: 'base64' });
  }
}
async function planNavigation(plan: Planning): Promise<void> {
  const { workspace, index } = plan, path = workspace.settings.root + '/generated/index.md', content = navigation(workspace, index);
  const existing = await readBytes(join(plan.root, path));
  if (existing && digest(existing) !== index.navigation?.[path]) return refuse(plan, path, 'Unowned or edited navigation file already exists; original contents are preserved.');
  plan.entries.push({ path, content }); index.navigation ??= {}; index.navigation[path] = digest(content);
}
async function planIntake(plan: Planning, proposed: AuthoringDocument): Promise<readonly Preimage[]> {
  const { workspace } = plan;
  insist(workspace.config || workspace.makerSetupBytes, 'DOCS_SETUP_REQUIRED', 'Import into an initialized shell or maker project; run setup first.');
  if (equal(proposed, workspace.project)) { plan.entries.push({ path: workspace.projectPath, content: decode(workspace.projectBytes) }); return []; }
  // The same intake boundary used by the CLI editors also updates generation ownership.
  const intake = await documentationProjectIntake(workspace, proposed);
  insist(intake.plan.changes.find(change => change.path === workspace.projectPath)?.beforeHash === digest(workspace.projectBytes),
    'DOCS_INPUT_CHANGED', 'The project changed while preparing reviewed intake.');
  for (const change of intake.plan.changes) plan.entries.push({ path: change.path, content: change.content });
  return intake.plan.changes;
}
async function fingerprints(workspace: Workspace) {
  return { makerSetup: optionalDigest(workspace.makerSetupBytes), adapter: await adapterFingerprint(), project: digest(workspace.projectBytes), settings: optionalDigest(workspace.bytes),
    index: optionalDigest(workspace.indexBytes), config: optionalDigest(workspace.configBytes), resolutions: optionalDigest(workspace.resolutionBytes),
    sources: workspace.sources.map(source => [source.path, digest(source.bytes)]) };
}
function indexContent(plan: Planning): string {
  const { workspace, index } = plan;
  return equal(index, workspace.index) && workspace.indexBytes ? decode(workspace.indexBytes) : JSON.stringify(index, null, 2) + '\n';
}
/** Builds entries only; all writes are delegated to the existing reviewed file-plan engine. */
export async function documentationPlan(root: string, args: string[], direction: 'import' | 'export', options: { out?: string; resolutions?: string } = {}) {
  const workspace = await readWorkspace(root, args, options.out, options.resolutions), projected = projectEntities(workspace.project);
  // Prove coverage from the actual validated input, not an optimistic collection count.
  insist(equal(applyEntities(workspace.project, projected), workspace.project), 'DOCS_COVERAGE', 'The project cannot be losslessly projected. No complete export is claimed.');
  const changes = reconcile(projected, workspace.documents.map(input => input.document.entity), workspace.index, direction, workspace.resolutions);
  const importing = direction === 'import';
  if (importing) insist(workspace.documents.length, 'DOCS_EMPTY', 'No typed Markdown documents were selected. No files were changed.');
  const proposed = importing && !changes.conflicts.length ? applyEntities(workspace.project, changes.entities) : workspace.project;
  insist(equal(proposed.settings, workspace.project.settings), 'DOCS_SETTINGS_AUTHORITY', 'Change source/test paths through project configuration, not Markdown.');
  const final = projectEntities(proposed), selected = importing ? final.filter(entity => changes.selected.includes(keyOf(entity))) : final;
  const plan: Planning = { root, workspace, index: structuredClone(workspace.index), entries: [], conflicts: [...changes.conflicts],
    documentByKey: new Map(workspace.documents.map(input => [keyOf(input.document.entity), input])) };
  for (const entity of selected) await planEntity(plan, entity);
  let intakePreimages: readonly Preimage[] = [];
  if (importing) { await copyExternalSources(plan); intakePreimages = await planIntake(plan, proposed); }
  else await planNavigation(plan);
  if (workspace.create) plan.entries.push({ path: SETTINGS_FILE, content: workspace.create });
  // Last write: a failed or interrupted batch must not be recorded as synchronized first.
  plan.entries.push({ path: workspace.settings.indexFile, content: indexContent(plan) });
  const hash = digest(stable(await fingerprints(workspace)));
  const filePlan = await createFilePlan(root, plan.entries);
  insist(intakePreimages.every(before => filePlan.changes.find(change => change.path === before.path)?.beforeHash === before.beforeHash), 'DOCS_INPUT_CHANGED', 'Intake ownership changed while preparing documentation.');
  const { conflicts } = plan;
  return { plan: filePlan, hash, conflicts: conflicts.map(item => `${item.entity}#${item.field}: ${item.reason}`),
    summary: { documentation: { direction, coverage: coverage(final), selected: selected.length, states: changes.states, skipped: workspace.skipped,
      conflicts, documentationRoot: workspace.settings.root, projectChanged: !equal(proposed, workspace.project), implicitDeletion: false } } };
}
export async function documentationStatus(root: string, args: string[], validate: boolean) {
  const workspace = await readWorkspace(root, args), entities = projectEntities(workspace.project);
  const review = reconcile(entities, workspace.documents.map(input => input.document.entity), workspace.index, 'import');
  if (validate && !review.conflicts.length) applyEntities(workspace.project, review.entities);
  insist(equal(applyEntities(workspace.project, entities), workspace.project), 'DOCS_COVERAGE', 'The project cannot be losslessly projected.');
  const keys = new Set(workspace.documents.map(input => keyOf(input.document.entity)));
  const missing = Object.entries(workspace.index.entries).filter(([key]) => !keys.has(key)).map(([entity, binding]) => ({ entity, path: binding.path }));
  return { coverage: coverage(entities), states: review.states, conflicts: review.conflicts, missing: args.length ? [] : missing, skipped: workspace.skipped };
}
