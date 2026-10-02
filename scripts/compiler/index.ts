import { renderStarterProject } from '../../bin/compiler/adapters/project/emitter.ts';
import { validateProjectSelection, type ProjectSelection } from '../../bin/compiler/domain/project-starter.ts';
import { CompilerError, diagnostic } from '../../bin/compiler/domain/diagnostics.ts';
/** Dedicated compiler API. Loading a template, compiling, planning and applying are distinct operations. */
import { createHash } from 'node:crypto';
import { withStorybookOptions } from '../companion/tooling-contract.ts';
import { lowerTarget } from '../../bin/compiler/adapters/target-lowering.ts';
import { runCompiler } from '../../bin/compiler/application/pipeline.ts';
import type { CompileRequest } from '../../bin/compiler/application/ports.ts';
import type { Control, Artifact, TemplateSnapshot } from '../../bin/compiler/domain/contracts.ts';
import { companionFrontend, contractCall } from '../../bin/compiler/adapters/frontend.ts';
import { renderProjectFiles } from './adapters/plugin-emitter.ts';
import { clickdummyFiles } from '../../bin/compiler/adapters/clickdummy-emitter.ts';
import { dependencyReadiness } from '../../bin/compiler/adapters/dependencies.ts';
import { artifactOrigins } from '../../bin/compiler/adapters/origins.ts';
import { json, type Model } from '../companion/compiler/model.ts';
import { requireFrameworkAdapter } from '../../bin/compiler/adapters/project/framework-registry.ts';
import type { FrameworkAdapter } from '../../bin/compiler/adapters/project/framework-adapter.ts';
export { loadTemplateSnapshot } from '../../bin/compiler/adapters/template-snapshot.ts';
export { compilerVersion, compilerPhases } from '../../bin/compiler/application/pipeline.ts';
export { diagnosticCatalog, CompilerError } from '../../bin/compiler/domain/diagnostics.ts';
export type { Compilation, CompilerDiagnostic, TemplateSnapshot, OutputKind, StorybookOptions } from '../../bin/compiler/domain/contracts.ts';
export interface CompilerExtensions { readonly frameworkAdapters?: readonly FrameworkAdapter[] }

async function emit(model:Model,template:TemplateSnapshot,kind:CompileRequest['outputKind'],sourceName:string,selection?:ProjectSelection,extensions:CompilerExtensions={}):Promise<Artifact[]> {
  let files:Artifact[];
  try {
    const adapter = kind === 'project' ? requireFrameworkAdapter(selection!.framework, extensions.frameworkAdapters) : undefined;
    files=kind==='project' ? renderStarterProject(model,template,selection!,adapter) : await renderProjectFiles(template,model);
  }
  catch(error) { return contractCall('emit',sourceName,()=>{throw error;}); }
  if(kind==='clickdummy')files=clickdummyFiles(model,template,files);
  const dependencies=dependencyReadiness(files);
  const readiness={schemaVersion:1,generation:'completed',dependencies:dependencies.ready?'locked':'resolution-required',
    bundle:'not-run',typecheck:'not-run',tests:'not-run',productAcceptance:'not-inferred',diagnostics:dependencies.diagnostics};
  files.push({path:'design/compiler-readiness.json',content:json(readiness),ownership:'managed',producer:'compiler'});
  files.push({path:'design/compiler-origins.json',content:json({schemaVersion:1,artifacts:artifactOrigins(model,files,sourceName)}),ownership:'managed',producer:'compiler'});
  return files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export async function compileProject(request:CompileRequest,control:Control={},extensions:CompilerExtensions={}) {
  const sourceName=request.sourceName ?? 'project.json';
  const frontend = companionFrontend(sourceName);
  return runCompiler(request,{
    ...frontend,
    migrate: value => contractCall('migrate', sourceName, () => frontend.migrate(withStorybookOptions(value, request.storybook))),
    lower: (model,template,kind) => {
      if (kind !== 'project') {
        if (request.projectSelection) throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'lower', 'A project selection requires outputKind project.'));
        return lowerTarget(model,template,kind,sourceName);
      }
      if (model.sourceRoot !== 'src/generated' || model.testRoot !== 'tests/project') throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'lower', 'Project starters currently require src/ and tests/ roots.'));
      const selection = validateProjectSelection(request.projectSelection);
      try { requireFrameworkAdapter(selection.framework, extensions.frameworkAdapters); }
      catch { throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'lower', 'Project starter needs an installed framework adapter for ' + selection.framework + '.')); }
      return [diagnostic('COMPILER_ADAPTER_REQUIRED', 'lower', 'Project starter output is a navigable starting scaffold. Visual component bodies and business actions require prototype implementation.')];
    },
    emit:(model,template,kind)=>emit(model,template,kind,sourceName,request.projectSelection,extensions),
    dependencies:dependencyReadiness,
    hash:(value,encoding)=>createHash('sha256').update(encoding?Buffer.from(value,encoding):value).digest('hex'),
  },control);
}
export function analyzeProject(source:string,sourceName='project.json',control:Control={}) {
  return compileProject({source,sourceName},control);
}
