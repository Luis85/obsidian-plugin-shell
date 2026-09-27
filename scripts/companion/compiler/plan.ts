/** Compatibility facade. Compile in memory first; compare/apply use the original guarded writer. */
import { fileURLToPath } from 'node:url';
import { resolve, basename } from 'node:path';
import { readCompanionInput } from '../read-project.mjs';
import { compileProject, loadTemplateSnapshot } from '../../compiler/index.ts';
import { CompilationFailure } from '../../compiler/domain/diagnostics.ts';
import { planArtifacts } from '../../compiler/adapters/workspace-plan.ts';
import type { Entry } from './file-code.ts';
import type { OutputKind } from '../../compiler/domain/contracts.ts';
export { applyProject, reviewProject } from '../../compiler/adapters/workspace-plan.ts';
export interface GenerateOptions {
  input:string;target:string;vault?:string;templateRoot?:string;
  bootstrap?:ReadonlyArray<{path:string;hash:string}>;output?:Entry[];outputKind?:OutputKind;signal?:AbortSignal;
}
export async function planProject(options:GenerateOptions) {
  const input=await readCompanionInput(options);
  const templateRoot=resolve(options.templateRoot ?? fileURLToPath(new URL('../../../',import.meta.url)));
  const template=await loadTemplateSnapshot(templateRoot, options.signal);
  const compiled=await compileProject({source:new TextDecoder('utf-8',{fatal:true}).decode(input.content),
    sourceName:basename(options.input),template,outputKind:options.outputKind},{signal:options.signal});
  if(compiled.status!=='ok' || !compiled.model)throw new CompilationFailure(compiled.diagnostics);
  const output=options.output ?? compiled.artifacts;
  const migration=compiled.migration as {interactionIds?:Record<string,string>} | null;
  const planned=await planArtifacts({...options,templateRoot},{...input,migration},compiled.model,output);
  return {...planned,summary:{...planned.summary,compiler:{version:compiled.compilerVersion,outputKind:compiled.outputKind,
    fingerprint:compiled.fingerprint,readiness:compiled.readiness,diagnostics:compiled.diagnostics}}};
}
