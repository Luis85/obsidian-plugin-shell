import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { createFilePlan } from '../../shared/file-plan.ts';
import { documentationProjectIntake } from './project-intake.ts';
import { keyOf, equal, stable, insist, type DocsIndex, type Entity, type Conflict } from '../domain/contracts.ts';
import { reconcile } from '../application/reconcile.ts';
import { projectEntities, applyEntities, coverage } from './model.ts';
import { renderMarkdown, generatedSource, parseMarkdown, type MarkdownDocument } from './markdown.ts';
import { readBytes, portable, localPath, documentationDigest as digest, decode } from './filesystem.ts';
import { folders, SETTINGS_FILE } from './settings.ts';
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
  const blocked = ['.git', '.obsidian', '.framework', '.companion', '.codex-authoring.lock', 'node_modules', 'scripts', 'bin', 'src', 'tests', 'dist', 'configs', 'design',
    ...workspace.protectedPaths, ...(workspace.config ? [workspace.config.paths.codebaseFolder, workspace.config.paths.testsFolder, workspace.config.paths.testVaultFolder] : [])];
  insist(!path.split('/').some(part => part.startsWith('.') && blocked.includes(part.toLowerCase())) &&
    !blocked.some(folder => path.toLowerCase() === folder.toLowerCase() || path.toLowerCase().startsWith(folder.toLowerCase() + '/')), 'DOCS_OUTPUT_PROTECTED', 'Refusing documentation in a protected path: ' + path);
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
/** Builds entries only; all writes are delegated to the existing reviewed file-plan engine. */
export async function documentationPlan(root: string, args: string[], direction: 'import' | 'export', options: { out?: string; resolutions?: string } = {}) {
  const workspace = await readWorkspace(root, args, options.out, options.resolutions), projected = projectEntities(workspace.project);
  // Prove coverage from the actual validated input, not an optimistic collection count.
  insist(equal(applyEntities(workspace.project, projected), workspace.project), 'DOCS_COVERAGE', 'The project cannot be losslessly projected. No complete export is claimed.');
  const changes = reconcile(projected, workspace.documents.map(input => input.document.entity), workspace.index, direction, workspace.resolutions);
  if (direction === 'import') insist(workspace.documents.length, 'DOCS_EMPTY', 'No typed Markdown documents were selected. No files were changed.');
  const conflicts: Conflict[] = [...changes.conflicts];
  const proposed = direction === 'import' && !conflicts.length ? applyEntities(workspace.project, changes.entities) : workspace.project;
  insist(equal(proposed.settings, workspace.project.settings), 'DOCS_SETTINGS_AUTHORITY', 'Change source/test paths through project configuration, not Markdown.');
  const final = projectEntities(proposed), selected = direction === 'export' ? final : final.filter(entity => changes.selected.includes(keyOf(entity)));
  const index: DocsIndex = structuredClone(workspace.index), entries: Entry[] = [];
  const documentByKey = new Map(workspace.documents.map(input => [keyOf(input.document.entity), input]));
  for (const entity of selected) {
    const key = keyOf(entity), input = documentByKey.get(key), path = destination(workspace, entity, input); safeOutput(workspace, path);
    const bound = workspace.index.entries[key];
    if (bound && input && bound.path !== path && await readBytes(join(root, bound.path))) {
      conflicts.push({ entity: key, field: '/', reason: 'The previous bound document still exists. Move it rather than copying its identity: ' + bound.path }); continue;
    }
    const priorBytes = await readBytes(join(root, path));
    let original: MarkdownDocument | undefined = input?.document;
    if (!original && priorBytes) {
      original = parseMarkdown(decode(priorBytes), path) ?? undefined;
      if (!original || keyOf(original.entity) !== key || original.entity.project !== entity.project) { conflicts.push({ entity: key, field: '/', reason: 'Destination is an unrelated file: ' + path }); continue; }
      // Include/exclude rules limit discovery, not overwrite authority. A destination
      // that was not scanned must pass the same baseline-aware conflict review.
      const destinationReview = reconcile([entity], [original.entity], workspace.index, 'export');
      if (destinationReview.conflicts.length) { conflicts.push(...destinationReview.conflicts); continue; }
    }
    if (input && localPath(root, input.source.path) === null && priorBytes && (!bound || !priorBytes.equals(input.source.bytes))) {
      conflicts.push({ entity: key, field: '/', reason: 'External input collides with an existing project document: ' + path }); continue;
    }
    if (!input && bound && !priorBytes) { conflicts.push({ entity: key, field: '/', reason: 'Bound document is missing. Move it within the configured scan roots or restore it: ' + path }); continue; }
    if (original && bound && bound.generatedHash !== (generatedSource(original) === null ? null : digest(generatedSource(original)!))) {
      conflicts.push({ entity: key, field: '/generated', reason: 'The generated region was edited; preserve it and resolve ownership manually.' }); continue;
    }
    const content = renderMarkdown(entity, original);
    entries.push({ path, content });
    const written = parseMarkdown(content, path)!;
    insist(equal(written.entity, entity), 'DOCS_RENDER_COVERAGE', 'Rendered Markdown would lose managed fields: ' + path);
    index.entries[key] = { path, baseline: entity, generatedHash: generatedSource(written) === null ? null : digest(generatedSource(written)!) };
  }
  // Copy selected external notes/assets without following links or fetching remote references.
  if (direction === 'import') for (const source of workspace.sources) {
    if (localPath(root, source.path) !== null || workspace.documents.some(input => input.source.path === source.path)) continue;
    const path = portable(workspace.settings.root + '/' + source.relative); safeOutput(workspace, path);
    const existing = await readBytes(join(root, path), 8_000_000);
    if (existing && !existing.equals(source.bytes)) conflicts.push({ entity: path, field: '/', reason: 'External note/asset collides with an existing file.' });
    else entries.push({ path, content: source.bytes.toString('base64'), encoding: 'base64' });
  }
  if (direction === 'export') {
    const path = workspace.settings.root + '/generated/index.md', content = navigation(workspace, index);
    const existing = await readBytes(join(root, path));
    if (existing && digest(existing) !== index.navigation?.[path]) conflicts.push({ entity: path, field: '/', reason: 'Unowned or edited navigation file already exists; original contents are preserved.' });
    else { entries.push({ path, content }); index.navigation ??= {}; index.navigation[path] = digest(content); }
  }
  const intakePreimages: Array<{ path: string; beforeHash: string | null }> = [];
  if (direction === 'import') {
    insist(workspace.config || workspace.makerSetupBytes, 'DOCS_SETUP_REQUIRED', 'Import into an initialized shell or maker project; run setup first.');
    if (!equal(proposed, workspace.project)) {
      // The same intake boundary used by the CLI editors also updates generation ownership.
      const intake = await documentationProjectIntake(workspace, proposed);
      insist(intake.plan.changes.find(change => change.path === workspace.projectPath)?.beforeHash === digest(workspace.projectBytes),
        'DOCS_INPUT_CHANGED', 'The project changed while preparing reviewed intake.');
      for (const change of intake.plan.changes) { entries.push({ path: change.path, content: change.content }); intakePreimages.push(change); }
    } else entries.push({ path: workspace.projectPath, content: decode(workspace.projectBytes) });
  }
  if (workspace.create) entries.push({ path: SETTINGS_FILE, content: workspace.create });
  // Last write: a failed or interrupted batch must not be recorded as synchronized first.
  entries.push({ path: workspace.settings.indexFile, content: equal(index, workspace.index) && workspace.indexBytes ? decode(workspace.indexBytes) : JSON.stringify(index, null, 2) + '\n' });
  const fingerprints = { makerSetup: workspace.makerSetupBytes ? digest(workspace.makerSetupBytes) : null, adapter: await adapterFingerprint(), project: digest(workspace.projectBytes), settings: workspace.bytes ? digest(workspace.bytes) : null,
    index: workspace.indexBytes ? digest(workspace.indexBytes) : null, config: workspace.configBytes ? digest(workspace.configBytes) : null,
    resolutions: workspace.resolutionBytes ? digest(workspace.resolutionBytes) : null,
    sources: workspace.sources.map(source => [source.path, digest(source.bytes)]) };
  const plan = await createFilePlan(root, entries);
  insist(intakePreimages.every(before => plan.changes.find(change => change.path === before.path)?.beforeHash === before.beforeHash), 'DOCS_INPUT_CHANGED', 'Intake ownership changed while preparing documentation.');
  return { plan, hash: digest(stable(fingerprints)), conflicts: conflicts.map(item => `${item.entity}#${item.field}: ${item.reason}`),
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
