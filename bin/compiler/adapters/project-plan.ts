/** Compatibility facade. Compile in memory first; compare/apply use the original guarded writer. */
import { fileURLToPath } from 'node:url';
import { resolve, basename } from 'node:path';
import { readCompanionInput } from '../../../scripts/companion/read-project.mjs';
import { compileProject, loadTemplateSnapshot } from '../index.ts';
import { CompilationFailure } from '../domain/diagnostics.ts';
import { generationSelection } from './selection.ts';
import { parseSelection } from '../domain/selection.ts';
import { planArtifacts } from './workspace-plan.ts';
import type { Entry } from '../emitters/file-code.ts';
import type { OutputKind, StorybookOptions } from '../domain/contracts.ts';
export { applyProject, reviewProject } from './workspace-plan.ts';
export interface GenerateOptions {
  input:string;target:string;vault?:string;templateRoot?:string;
  bootstrap?:ReadonlyArray<{path:string;hash:string}>;output?:Entry[];outputKind?:OutputKind;scope?:string;storybook?:StorybookOptions;signal?:AbortSignal;
  /** A folder the target already owns, such as an installed kit's bin/ runtime: framework template files under it are not generated. */
  reservedRoot?:string;
}
const unreserved=(root:string|undefined)=>(file:Entry)=>!(root && file.ownership==='framework' && file.path.startsWith(root+'/'));
export async function planProject(options:GenerateOptions) {
  parseSelection(options.scope);
  if (options.scope && options.scope !== 'all' && options.output) throw new Error('GENERATION_SCOPE_OVERRIDE: A scoped plan cannot supply replacement artifacts.');
  const input=await readCompanionInput(options);
  const templateRoot=resolve(options.templateRoot ?? fileURLToPath(new URL('../../../',import.meta.url)));
  const template=await loadTemplateSnapshot(templateRoot, options.signal);
  const compiled=await compileProject({source:new TextDecoder('utf-8',{fatal:true}).decode(input.content),
    sourceName:basename(options.input),template,outputKind:options.outputKind,storybook:options.storybook},{signal:options.signal});
  if(compiled.status!=='ok' || !compiled.model)throw new CompilationFailure(compiled.diagnostics);
  const output=(options.output ?? compiled.artifacts).filter(unreserved(options.reservedRoot));
  const selection=generationSelection(compiled.model,output,options.scope);
  const migration=compiled.migration as {interactionIds?:Record<string,string>} | null;
  const planned=await planArtifacts({...options,templateRoot,selection},{...input,migration},compiled.model,output);
  return {...planned,summary:{...planned.summary,compiler:{version:compiled.compilerVersion,outputKind:compiled.outputKind,
    fingerprint:compiled.fingerprint,readiness:compiled.readiness,diagnostics:compiled.diagnostics}}};
}
