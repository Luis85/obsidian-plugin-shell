import { join } from 'node:path';
import { exists } from '../../scripts/framework/files.ts';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { CompilationFailure } from '../../scripts/compiler/domain/diagnostics.ts';
import { documentText, type SketchDocument } from '../domain/document.ts';
import { outputBoundary, packagePlan } from './package-plan.ts';
/** Same dedicated compiler and template snapshot as shell generate; no second Vue/JSON generator. */
export async function compile(document: SketchDocument, root: string, kind: 'clickdummy' | 'obsidian-plugin', signal?: AbortSignal) {
  const templateRoot = await exists(join(root, '.framework/template/package.json')) ? join(root, '.framework/template') : root;
  const template = await loadTemplateSnapshot(templateRoot, signal);
  const compilation = await compileProject({ source: documentText(document), sourceName: 'companion.project.json', outputKind: kind, template }, { signal });
  if (compilation.status !== 'ok' || !compilation.model) throw new CompilationFailure(compilation.diagnostics);
  return { compilation, template };
}
export async function boilerplatePlan(root: string, frameworkRoot: string, out: string, document: SketchDocument, kind: 'clickdummy' | 'obsidian-plugin', signal?: AbortSignal) {
  outputBoundary(root, frameworkRoot, out);
  const { compilation } = await compile(document, frameworkRoot, kind, signal);
  return packagePlan(root, out, [...compilation.artifacts], { outputKind: kind, compilerFingerprint: compilation.fingerprint, readiness: compilation.readiness });
}
