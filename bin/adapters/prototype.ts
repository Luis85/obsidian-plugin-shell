import { spawnSync } from 'node:child_process';
import { hash } from '../../scripts/framework/files.ts';
import { artifactOrigins } from '../../scripts/compiler/adapters/origins.ts';
import { prototypeSkillRoot } from '../../scripts/companion/prototype-skill.mjs';
import { newDocument, documentText, type SketchDocument } from '../domain/document.ts';
import { readGuide, resolveAnswers, guideBrief, renderTemplate, type Guide, type Answers } from '../domain/guide.ts';
import { requireSketch, slug } from '../domain/errors.ts';
import { object, keys } from '../domain/data.ts';
import { runOperations } from '../application/operations.ts';
import { compile } from './compiler.ts';
import { readData } from './storage.ts';
import { outputBoundary, packagePlan } from './package-plan.ts';
export async function loadGuide(path: string | URL = new URL('../guides/prototype.json', import.meta.url)): Promise<Guide> {
  const selected = path instanceof URL ? (await import('node:url')).fileURLToPath(path) : path;
  return readGuide(await readData(selected));
}
export function guideInput(guide: Guide, input: unknown) {
  const data = object(input); keys(data, ['schemaVersion', 'guideId', 'guideVersion', 'answers']);
  requireSketch(data.schemaVersion === 1 && data.guideId === guide.id && data.guideVersion === guide.version, 'GUIDE_INPUT_VERSION', 'Use the current guideId/guideVersion from prototype guide. Old answer files must be reviewed explicitly.');
  return resolveAnswers(guide, data.answers);
}
function titles(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function prototypeDocument(answers: Answers, baseline: SketchDocument | null): SketchDocument {
  requireSketch(typeof answers.title === 'string', 'GUIDE_TITLE', 'A prototype needs a title.');
  if (answers.mode !== 'new-plugin') requireSketch(baseline, 'PROTOTYPE_BASELINE', 'Feature/improvement mode needs --project with a complete baseline export.');
  let document = baseline ?? newDocument(answers.title);
  for (const title of titles(answers.pages)) {
    if (!document.design.nodes.some(page => page.label === title)) document = runOperations(document, [{ op: 'page.add', title }]).document;
  }
  const page = document.design.nodes.find(item => !['group', 'action'].includes(item.kind));
  requireSketch(page, 'PROTOTYPE_PAGE', 'Sketch at least one page before generating the prototype.');
  const components = titles(answers.components).filter(title => !document.design.library.some(item => item.name === title)).map(title => ({ title }));
  if (components.length) document = runOperations(document, [{ op: 'page.attach', page: page.id, components }]).document;
  return document;
}
function revision(root: string): string {
  const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 3000, windowsHide: true });
  const sha = result.stdout?.trim();
  return result.status === 0 && sha && /^[a-f0-9]{40}$/.test(sha) ? sha : 'unavailable; use the exact framework snapshot fingerprint';
}
export async function prototypePlan(options: { root: string; frameworkRoot: string; out: string; guide: Guide; input: unknown; baseline: SketchDocument | null; signal?: AbortSignal }) {
  const { root, frameworkRoot, out, guide, baseline, signal } = options;
  outputBoundary(root, frameworkRoot, out);
  const { answers, pending } = guideInput(guide, options.input);
  requireSketch(pending.length === 0, 'PROTOTYPE_AGREEMENT', pending.join(' '));
  const document = prototypeDocument(answers, baseline);
  const { compilation, template } = await compile(document, frameworkRoot, 'clickdummy', signal);
  const projectJson = documentText(document), guideHash = hash(JSON.stringify(guide));
  const brief = guideBrief(guide, answers), pkg = object(JSON.parse(template.text('package.json')));
  const context = { repository: 'Luis85/obsidian-plugin-shell', commit: revision(frameworkRoot), frameworkFingerprint: template.fingerprint,
    compilerFingerprint: compilation.fingerprint, guideId: guide.id, guideVersion: guide.version, guideHash,
    dependencyPins: { ...object(pkg.dependencies), ...object(pkg.devDependencies) }, baselineSha256: baseline ? hash(documentText(baseline)) : null,
    projectSha256: hash(projectJson), stage: 'prepared-not-implemented', checks: 'not-run' };
  const answersJson = JSON.stringify({ schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers }, null, 2) + '\n';
  const integration = { kind: 'prototype-integration-map', schemaVersion: 1, entries: artifactOrigins(compilation.model!, compilation.artifacts, 'companion.project.json').filter(item => item.origins.length).map(item => ({ designId: item.origins[0]!.entityId, sourceFiles: ['source/' + item.path], origins: item.origins, ownership: 'generated', testIds: [], nativeRemaining: ['Not qualified by preparation'] })) };
  const manifest = { kind: 'obsidian-prototype-package', schemaVersion: 1, slug: slug(String(answers.title), 'prototype'), mode: answers.mode, repository: { name: context.repository, commit: context.commit }, project: { path: 'companion.project.json', sha256: hash(projectJson) }, artifact: { path: 'prototype.html', sha256: null }, source: { path: 'source', packageManager: pkg.packageManager }, status: 'incomplete' };
  const values: Record<string, string> = { title: String(answers.title), slug: slug(String(answers.title), 'prototype'), brief, projectJson,
    contextJson: JSON.stringify(context, null, 2), answersJson, skillPath: prototypeSkillRoot + '/SKILL.md',
    integrationJson: JSON.stringify(integration, null, 2), manifestJson: JSON.stringify(manifest, null, 2) };
  for (const [key, value] of Object.entries(answers)) if (!(key in values)) values[key] = Array.isArray(value) ? value.join('\n') : String(value);
  const entries = guide.artifacts.map(item => ({ path: renderTemplate(item.path, values), content: renderTemplate(item.template, values) }));
  entries.push({ path: 'prototype-guide.json', content: JSON.stringify(guide, null, 2) + '\n' });
  entries.push(...compilation.artifacts.map(entry => ({ ...entry, path: 'source/' + entry.path })));
  if (baseline) entries.push({ path: 'baseline.project.json', content: documentText(baseline) });
  return packagePlan(root, out, entries, { ...context, prompt: entries.find(item => item.path === 'execution-prompt.md')?.content,
    start: 'Read execution-prompt.md; source/ contains the independently buildable clickdummy scaffold.', readiness: compilation.readiness });
}
