import { join } from 'node:path';
import { exists, hash } from '../../scripts/framework/files.ts';
import { analyzeProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { CompilationFailure } from '../../scripts/compiler/domain/diagnostics.ts';
import { emitPresetProject } from '../../scripts/compiler/adapters/preset-emitter.ts';
import { object, keys } from '../domain/data.ts';
import { newDocument, documentText, type SketchDocument } from '../domain/document.ts';
import { requireSketch } from '../domain/errors.ts';
import { readPresetCatalog, resolveProjectSelection, type PresetCatalog, type ProjectSelection } from '../domain/project-presets.ts';
import { guideBrief, renderTemplate, type Guide } from '../domain/guide.ts';
import { runOperations } from '../application/operations.ts';
import { loadGuide, guideInput } from './prototype.ts';
import { readData } from './storage.ts';
import { outputBoundary, packagePlan } from './package-plan.ts';
export async function loadProjectCatalog(): Promise<PresetCatalog> {
  return readPresetCatalog(await readData((await import('node:url')).fileURLToPath(new URL('../guides/legacy-project-presets.json', import.meta.url))));
}
export function loadProjectGuide(): Promise<Guide> { return loadGuide(new URL('../guides/legacy-project-prototype.json', import.meta.url)); }
export function projectInput(catalog: PresetCatalog, guide: Guide, input: unknown) {
  const data = object(input); keys(data, ['schemaVersion', 'catalogVersion', 'preset', 'frontend', 'targets', 'prototypeRequest']);
  requireSketch(data.schemaVersion === 1 && data.catalogVersion === catalog.version, 'PRESET_INPUT_VERSION', 'Use the current schemaVersion/catalogVersion from new presets.');
  const selection = resolveProjectSelection(catalog, { preset: data.preset, frontend: data.frontend, ...(data.targets === undefined ? {} : { targets: data.targets }) });
  const result = guideInput(guide, data.prototypeRequest);
  return { selection, ...result, document: newProject(result.answers), ready: result.pending.length === 0 };
}
function newProject(answers: ReturnType<typeof guideInput>['answers']): SketchDocument {
  const document = newDocument(String(answers.title));
  requireSketch(Array.isArray(answers.pages) && answers.pages.length > 0, 'PRESET_EMPTY', 'Include at least one screen, page or CLI command.');
  const operations: Record<string, unknown>[] = answers.pages.map(title => ({ op: 'page.add', title }));
  const result = runOperations(document, operations).document;
  if (Array.isArray(answers.components) && answers.components.length) {
    return runOperations(result, [{ op: 'page.attach', page: result.design.nodes[0]!.id, components: answers.components.map(title => ({ title })) }]).document;
  }
  return result;
}
async function sources(frameworkRoot: string, document: SketchDocument, selection: ProjectSelection, catalogVersion: number, signal?: AbortSignal) {
  const templateRoot = await exists(join(frameworkRoot, '.framework/template/package.json')) ? join(frameworkRoot, '.framework/template') : frameworkRoot;
  const template = await loadTemplateSnapshot(templateRoot, signal);
  const compilation = await analyzeProject(documentText(document), 'companion.project.json', { signal });
  if (compilation.status !== 'ok' || !compilation.model) throw new CompilationFailure(compilation.diagnostics);
  requireSketch(!signal?.aborted, 'CANCELLED', 'Project generation cancelled.');
  const selected = { ...selection, id: document.project.id, name: document.project.name, catalogVersion };
  const artifacts = emitPresetProject(compilation.model, template, selected);
  const fingerprint = hash(JSON.stringify(artifacts.map(file => [file.path, hash(file.content)])));
  return { template, artifacts, selected, fingerprint, diagnostics: compilation.diagnostics };
}
export async function projectCreatePlan(options: { root: string; frameworkRoot: string; out: string; input: unknown; catalog: PresetCatalog; guide: Guide; signal?: AbortSignal }) {
  const { root, frameworkRoot, out, catalog, guide, signal } = options;
  outputBoundary(root, frameworkRoot, out);
  const { selection, answers, pending, document } = projectInput(catalog, guide, options.input);
  requireSketch(!pending.length, 'PROTOTYPE_AGREEMENT', pending.join(' '));
  const generated = await sources(frameworkRoot, document, selection, catalog.version, signal);
  const projectJson = documentText(document), answersFile = { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers };
  const replay = { schemaVersion: 1, catalogVersion: catalog.version, preset: selection.preset, frontend: selection.frontend,
    ...(selection.preset === 'hybrid' ? { targets: selection.targets } : {}), prototypeRequest: answersFile };
  const context = { stage: 'prepared-not-implemented', catalogVersion: catalog.version, guideId: guide.id, guideVersion: guide.version,
    catalogHash: hash(JSON.stringify(catalog)), guideHash: hash(JSON.stringify(guide)), frameworkFingerprint: generated.template.fingerprint,
    outputFingerprint: generated.fingerprint, selection, projectSha256: hash(projectJson),
    readiness: { generation: 'completed', dependencies: 'resolution-required', typecheck: 'not-run', bundle: 'not-run', tests: 'not-run', productAcceptance: 'not-inferred' } };
  const integration = { schemaVersion: 1, entries: document.design.nodes.map(page => ({ designId: page.id,
    sourceFiles: ['source/src/core/project-data.json'], targets: selection.targets, status: 'scaffold-only' })) };
  const manifest = { schemaVersion: 1, kind: 'project-prototype-package', status: 'incomplete', selection,
    artifacts: selection.targets.map(target => ({ target, directory: 'source/dist/' + target, sha256: null, verified: false })) };
  const values = { title: String(answers.title), brief: guideBrief(guide, answers), selectionJson: JSON.stringify(generated.selected, null, 2),
    contextJson: JSON.stringify(context, null, 2), answersJson: JSON.stringify(answersFile, null, 2), projectJson,
    integrationJson: JSON.stringify(integration, null, 2), manifestJson: JSON.stringify(manifest, null, 2) };
  const entries = guide.artifacts.map(item => ({ path: renderTemplate(item.path, values), content: renderTemplate(item.template, values) }));
  entries.push({ path: 'project-create.json', content: JSON.stringify(replay, null, 2) + '\n' },
    { path: 'prototype-guide.json', content: JSON.stringify(guide, null, 2) + '\n' },
    { path: 'project-presets.json', content: JSON.stringify(catalog, null, 2) + '\n' },
    ...generated.artifacts.map(file => ({ ...file, path: 'source/' + file.path })));
  return packagePlan(root, out, entries, { ...context, document, prompt: entries.find(item => item.path === 'execution-prompt.md')!.content, diagnostics: generated.diagnostics,
    start: `Read ${out}/execution-prompt.md; selected runtime sources are under ${out}/source/.` });
}
/** The sketch generator reuses the saved preset rather than silently reverting to Vue/Obsidian. */
export async function savedLegacyProjectSelection(root: string, catalog: PresetCatalog): Promise<ProjectSelection | null> {
  const path = join(root, 'shell.project.json');
  if (!await exists(path)) return null;
  const data = object(await readData(path));
  requireSketch(data.schemaVersion === 1 && data.catalogVersion === catalog.version, 'PRESET_INPUT_VERSION', 'Review the saved project preset version before regenerating.');
  keys(data, ['schemaVersion', 'catalogVersion', 'id', 'name', 'preset', 'frontend', 'framework', 'ui', 'targets', 'websiteEntries']);
  const selection = resolveProjectSelection(catalog, { preset: data.preset, frontend: data.frontend, ...(data.preset === 'hybrid' ? { targets: data.targets } : {}) });
  requireSketch(data.framework === selection.framework && data.ui === selection.ui && JSON.stringify(data.targets) === JSON.stringify(selection.targets),
    'PRESET_METADATA', 'Saved runtime metadata disagrees with the selected preset. Reconcile it before regenerating.');
  return selection;
}
export async function presetBoilerplatePlan(root: string, frameworkRoot: string, out: string, document: SketchDocument, selection: ProjectSelection, catalog: PresetCatalog, signal?: AbortSignal) {
  outputBoundary(root, frameworkRoot, out);
  const generated = await sources(frameworkRoot, document, selection, catalog.version, signal);
  return packagePlan(root, out, generated.artifacts, { outputKind: 'project-preset', selection, fingerprint: generated.fingerprint,
    readiness: { generation: 'completed', dependencies: 'resolution-required', typecheck: 'not-run', tests: 'not-run' } });
}
