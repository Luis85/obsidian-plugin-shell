/** Dedicated compiler API. Loading a template, compiling, planning and applying are distinct operations. */
import { createHash } from 'node:crypto';
import { lowerTarget } from './adapters/target-lowering.ts';
import { runCompiler } from './application/pipeline.ts';
import type { CompileRequest } from './application/ports.ts';
import type { Control, Artifact, TemplateSnapshot } from './domain/contracts.ts';
import { companionFrontend, contractCall } from './adapters/frontend.ts';
import { renderProjectFiles } from './adapters/plugin-emitter.ts';
import { clickdummyFiles } from './adapters/clickdummy-emitter.ts';
import { dependencyReadiness } from './adapters/dependencies.ts';
import { artifactOrigins } from './adapters/origins.ts';
import { json, type Model } from '../companion/compiler/model.ts';
export { loadTemplateSnapshot } from './adapters/template-snapshot.ts';
export { compilerVersion, compilerPhases } from './application/pipeline.ts';
export { diagnosticCatalog, CompilerError } from './domain/diagnostics.ts';
export type { Compilation, CompilerDiagnostic, TemplateSnapshot, OutputKind } from './domain/contracts.ts';

async function emit(model:Model,template:TemplateSnapshot,kind:CompileRequest['outputKind'],sourceName:string):Promise<Artifact[]> {
  let files:Artifact[];
  try { files=await renderProjectFiles(template,model); }
  catch(error) { return contractCall('emit',sourceName,()=>{throw error;}); }
  if(kind==='clickdummy')files=clickdummyFiles(model,template,files);
  const dependencies=dependencyReadiness(files);
  const readiness={schemaVersion:1,generation:'completed',dependencies:dependencies.ready?'locked':'resolution-required',
    bundle:'not-run',typecheck:'not-run',tests:'not-run',productAcceptance:'not-inferred',diagnostics:dependencies.diagnostics};
  files.push({path:'design/compiler-readiness.json',content:json(readiness),ownership:'managed',producer:'compiler'});
  files.push({path:'design/compiler-origins.json',content:json({schemaVersion:1,artifacts:artifactOrigins(model,files,sourceName)}),ownership:'managed',producer:'compiler'});
  return files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export async function compileProject(request:CompileRequest,control:Control={}) {
  const sourceName=request.sourceName ?? 'project.json';
  return runCompiler(request,{
    ...companionFrontend(sourceName),
    lower: (model,template,kind) => lowerTarget(model,template,kind,sourceName),
    emit:(model,template,kind)=>emit(model,template,kind,sourceName),
    dependencies:dependencyReadiness,
    hash:(value,encoding)=>createHash('sha256').update(encoding?Buffer.from(value,encoding):value).digest('hex'),
  },control);
}
export function analyzeProject(source:string,sourceName='project.json',control:Control={}) {
  return compileProject({source,sourceName},control);
}
