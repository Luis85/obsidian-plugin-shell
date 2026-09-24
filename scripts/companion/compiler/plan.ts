import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCompanionProject } from '../read-project.mjs';
import { createFilePlan, applyFilePlan } from '../../shared/file-plan.mjs';
import { digest, json, projectModel, row, rows, text, requireValue } from './model.ts';
import { projectFiles } from './project-files.ts';
export interface GenerateOptions { input: string; target: string; vault?: string; templateRoot?: string }
const generationVersion = 1;
/** Plans are rebuilt from local data and trusted templates, not deserialized executable plans. */
export async function planProject(options: GenerateOptions) {
  const input = await readCompanionProject(options); const model = projectModel(input.document);
  const templateRoot = resolve(options.templateRoot ?? fileURLToPath(new URL('../../../',import.meta.url)));
  const within = relative(templateRoot,input.target);
  requireValue(within.startsWith('..') || isAbsolute(within), 'Use a target outside this framework checkout; do not recursively copy or overwrite the template.');
  const prefix = options.target === '.' ? '' : options.target+'/';
  const receiptPath = prefix+'.companion/generation.json';
  const inspected = await createFilePlan(input.vault,[{path:receiptPath,content:null}]); const receiptBefore = inspected.changes[0]!.beforeHash;
  let previous = new Map<string,{hash:string;ownership:string}>();
  if (receiptBefore) {
    const raw = await readFile(resolve(input.vault,receiptPath),'utf8'); requireValue(digest(raw) === receiptBefore,'Receipt changed while reading.');
    const receipt = row(JSON.parse(raw)); requireValue(receipt.version === generationVersion && receipt.projectId === model.project.id,'Receipt belongs to another project/version.');
    const records = rows(receipt.files,5000);
    for (const f of records) requireValue(/^[a-f0-9]{64}$/.test(text(f.hash)) && ['managed','extension','framework'].includes(text(f.ownership)), 'Invalid ownership receipt.');
    requireValue(new Set(records.map(f=>text(f.path).toLowerCase())).size === records.length,'Duplicate receipt paths.');
    previous = new Map(records.map(f => [text(f.path),{hash:text(f.hash),ownership:text(f.ownership)}]));
  }
  const output = await projectFiles(templateRoot,model);
  const candidates = await createFilePlan(input.vault,output.map(e => ({path:prefix+e.path,content:e.content,...(e.encoding ? {encoding:e.encoding} : {})})));
  const preserved: string[] = []; const conflicts: string[] = []; const entries: Array<{path:string;content:string;encoding?:'base64'}> = [];
  const ownership: Array<{path:string;hash:string;ownership:string}> = [];
  for (let i = 0; i < output.length; i++) {
    const file = output[i]!; const change = candidates.changes[i]!; const old = previous.get(file.path);
    let content = file.content; let ownedHash = change.afterHash!;
    if (old && change.beforeHash === null) conflicts.push(file.path+': previously generated file was removed');
    else if (change.beforeHash !== null && !old) conflicts.push(file.path+': existing unowned file');
    else if (old && change.beforeHash !== null && change.beforeHash !== old.hash) {
      if (file.ownership === 'managed' || change.afterHash !== old.hash) conflicts.push(file.path+': customized file conflicts with generated change');
      else { const bytes = await readFile(resolve(input.vault,prefix+file.path)); content = bytes.toString(file.encoding ? 'base64' : 'utf8'); requireValue(digest(bytes) === change.beforeHash,'Extension changed while reading.'); preserved.push(file.path); ownedHash = old.hash; }
    }
    entries.push({path:prefix+file.path,content,...(file.encoding ? {encoding:file.encoding} : {})}); ownership.push({path:file.path,hash:ownedHash,ownership:file.ownership});
  }
  // Retired files remain tracked, but are never implicitly removed.
  for (const [path,value] of previous) if (!ownership.some(e => e.path === path)) ownership.push({path,hash:value.hash,ownership:value.ownership});
  const receipt = {version:generationVersion,projectId:model.project.id,inputHash:digest(input.content.toString('utf8')),files:ownership};
  entries.push({path:receiptPath,content:json(receipt)});
  const plan = await createFilePlan(input.vault,entries);
  requireValue(plan.changes.at(-1)!.beforeHash === receiptBefore,'Receipt changed during planning.');
  for (let i=0;i<candidates.changes.length;i++) requireValue(candidates.changes[i]!.beforeHash === plan.changes[i]!.beforeHash,'Target changed during planning.');
  const hash = digest(json({version:generationVersion,root:plan.root,inputHash:receipt.inputHash,changes:plan.changes.map(({path,beforeHash,afterHash})=>({path,beforeHash,afterHash}))}));
  return {hash,plan,conflicts,preserved,summary:{project:model.project.id,target:input.target,files:output.length,entities:model.entities.length,sources:model.sources.length,operations:model.sources.reduce((n,s)=>n+s.operations.length,0),screens:model.screens.length,components:model.components.length,acceptanceTodos:model.requirements.length,warnings:model.warnings}};
}
export async function applyProject(result: Awaited<ReturnType<typeof planProject>>, expectedHash: string) {
  requireValue(result.hash === expectedHash,'Reviewed plan hash is stale; inspect a fresh plan.');
  requireValue(result.conflicts.length === 0,'Generation conflicts: '+result.conflicts.join('; '));
  return applyFilePlan(result.plan);
}
export function reviewProject(result: Awaited<ReturnType<typeof planProject>>) {
  return {mode:'plan',planHash:result.hash,...result.summary,conflicts:result.conflicts,preserved:result.preserved,changes:result.plan.changes.map(({path,status,beforeHash,afterHash})=>({path,status,beforeHash,afterHash}))};
}
