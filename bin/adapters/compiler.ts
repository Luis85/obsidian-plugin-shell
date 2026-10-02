import type { ProjectSelection } from '../compiler/domain/project-starter.ts';
import { join } from 'node:path';
import { exists, hash } from './framework/files.ts';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { pluginFrameworkAdapters } from '../../plugins/runtime.ts';
import { generationReceipt } from '../../scripts/compiler/adapters/workspace-plan.ts';
import { CompilationFailure } from '../compiler/domain/diagnostics.ts';
import { documentText, type SketchDocument } from '../domain/document.ts';
import { outputBoundary, packagePlan } from './package-plan.ts';
/** Same dedicated compiler and template snapshot as shell generate; no second Vue/JSON generator. */
export async function compile(document: SketchDocument, root: string, kind: 'clickdummy' | 'obsidian-plugin' | 'project', signal?: AbortSignal, projectSelection?: ProjectSelection) {
  const templateRoot = await exists(join(root, 'bin/template/package.json')) ? join(root, 'bin/template') : root;
  const template = await loadTemplateSnapshot(templateRoot, signal);
  const source = documentText(document);
  const compilation = await compileProject({ source, sourceName: 'companion.project.json', outputKind: kind, template, projectSelection }, { signal },
    { frameworkAdapters: pluginFrameworkAdapters() });
  if (compilation.status !== 'ok' || !compilation.model) throw new CompilationFailure(compilation.diagnostics);
  const receipt = generationReceipt(document.project.id, source, compilation.artifacts.map(artifact => ({
    path: artifact.path, hash: hash(Buffer.from(artifact.content, artifact.encoding ?? 'utf8')), ownership: artifact.ownership,
  })));
  const artifacts = [...compilation.artifacts, { path: '.companion/generation.json', content: JSON.stringify(receipt, null, 2) + '\n' }];
  return { compilation, template, artifacts };
}
export async function boilerplatePlan(root: string, frameworkRoot: string, out: string, document: SketchDocument, kind: 'clickdummy' | 'obsidian-plugin' | 'project', signal?: AbortSignal, projectSelection?: ProjectSelection) {
  outputBoundary(root, frameworkRoot, out);
  const { compilation, artifacts } = await compile(document, frameworkRoot, kind, signal, projectSelection);
  return packagePlan(root, out, artifacts, { outputKind: kind, compilerFingerprint: compilation.fingerprint, readiness: compilation.readiness });
}
