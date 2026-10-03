import type { GenerationSelection } from '../domain/selection.ts';
import type { Model } from '../../../scripts/companion/compiler/model.ts';
import type { Entry } from '../../../scripts/companion/compiler/file-code.ts';
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { createFilePlan, applyFilePlan } from '../../../scripts/shared/file-plan.ts';
import { digest, json, row, rows, text, requireValue } from '../../../scripts/companion/compiler/model.ts';
import { visualDefinitions } from '../../../scripts/companion/compiler/visual-model.ts';
import { visualVerification, visualAcceptanceTodo } from '../../../scripts/companion/compiler/visual-files.ts';
import { visualNodes, visualRoot } from '../../../scripts/companion/visual/visual-ir.mjs';
export interface WorkspaceOptions { target:string;templateRoot:string;bootstrap?:ReadonlyArray<{path:string;hash:string}>;selection?:GenerationSelection }
interface InputSnapshot { content:Buffer;vault:string;target:string;migration?:{interactionIds?:Record<string,string>} | null }

const generationVersion = 1;
/** Shared receipt contract for compiler output, including prototype preparation packages. */
export function generationReceipt(projectId: string, source: string, files: ReadonlyArray<{path:string;hash:string;ownership:string}>) {
  return { version: generationVersion, projectId, inputHash: digest(source), files };
}
type Owned = {hash:string;ownership:string};
type Ownership = Owned & {path:string};
type PlannedEntry = {path:string;content:string;encoding?:'base64'};
type Change = Awaited<ReturnType<typeof createFilePlan>>['changes'][number];
/** Accumulated per-file planning outcome; entries and ownership stay index-aligned with the emitter output. */
interface Planned { readonly preserved:string[];readonly conflicts:string[];readonly entries:PlannedEntry[];readonly ownership:Ownership[] }
interface FileContext { readonly vault:string;readonly prefix:string;readonly retained:ReadonlySet<string>;readonly planned:Planned }
const bootstrapPaths = ['bin/app','package.json','README.md','LICENSE','design/project.json'];
const sha256Hex = /^[a-f0-9]{64}$/;
const selectionField = (options: WorkspaceOptions) => options.selection ? {selection:options.selection} : {};
const encodingField = (file: Entry) => file.encoding ? {encoding:file.encoding} : {};

const targetPrefix = (target: string): string => target === '.' ? '' : target+'/';
function requireOutsideTemplate(options: WorkspaceOptions, input: InputSnapshot): void {
  const within = relative(resolve(options.templateRoot),input.target);
  requireValue(within === '..' || within.startsWith('..' + sep) || isAbsolute(within), 'Use a target outside this framework checkout; do not recursively copy or overwrite the template.');
}
async function previousOwnership(options: WorkspaceOptions, input: InputSnapshot, model: Model, receiptPath: string, receiptBefore: string | null) {
  for (const file of options.bootstrap ?? []) requireValue(bootstrapPaths.includes(file.path) && sha256Hex.test(file.hash), 'Invalid bootstrap ownership.');
  if (!receiptBefore) return new Map<string,Owned>((options.bootstrap ?? []).map(file => [file.path,{hash:file.hash,ownership:'framework'}]));
  const raw = await readFile(resolve(input.vault,receiptPath),'utf8'); requireValue(digest(raw) === receiptBefore,'Receipt changed while reading.');
  const receipt = row(JSON.parse(raw)); requireValue(receipt.version === generationVersion && receipt.projectId === model.project.id,'Receipt belongs to another project/version.');
  const records = rows(receipt.files,5000);
  for (const f of records) requireValue(sha256Hex.test(text(f.hash)) && ['managed','extension','framework'].includes(text(f.ownership)), 'Invalid ownership receipt.');
  requireValue(new Set(records.map(f=>text(f.path).toLowerCase())).size === records.length,'Duplicate receipt paths.');
  return new Map(records.map(f => [text(f.path),{hash:text(f.hash),ownership:text(f.ownership)}]));
}
/** Keeps excluded developer bytes as an unchanged precondition; an excluded artifact that needs generation is a conflict and is planned normally. */
async function planRetained(context: FileContext, file: Entry, change: Change, old: Owned | undefined): Promise<void> {
  const { planned, prefix } = context;
  if (!old || change.beforeHash === null || change.afterHash !== old.hash) {
    planned.conflicts.push(file.path + ': excluded artifact needs generation; use a wider feature or --scope all');
    return planGenerated(context, file, change, old);
  }
  // Keep excluded developer bytes as an unchanged precondition. Do not normalize UTF-8 or update their ownership hash.
  const bytes = await readFile(resolve(context.vault, prefix + file.path));
  requireValue(digest(bytes) === change.beforeHash, 'Excluded artifact changed while reading.');
  planned.entries.push({ path: prefix + file.path, content: bytes.toString('base64'), encoding: 'base64' });
  planned.ownership.push({ path: file.path, hash: old.hash, ownership: old.ownership });
}
/** A customized extension survives only when the generator itself did not change it. */
async function planCustomized(context: FileContext, file: Entry, change: Change, old: Owned): Promise<{content:string;hash:string} | null> {
  if (file.ownership === 'managed' || change.afterHash !== old.hash) { context.planned.conflicts.push(file.path+': customized file conflicts with generated change'); return null; }
  const bytes = await readFile(resolve(context.vault,context.prefix+file.path)); requireValue(digest(bytes) === change.beforeHash,'Extension changed while reading.');
  const kept = preservedText(bytes, file.encoding);
  if (kept === null) { context.planned.conflicts.push(file.path+': customized file is not UTF-8 text and cannot be preserved byte-for-byte'); return null; }
  context.planned.preserved.push(file.path);
  return { content: kept, hash: old.hash };
}
function ownershipConflict(change: Change, old: Owned | undefined): string | null {
  if (old && change.beforeHash === null) return ': previously generated file was removed';
  if (change.beforeHash !== null && !old) return ': existing unowned file';
  return null;
}
const customized = (change: Change, old: Owned | undefined): old is Owned => old !== undefined && change.beforeHash !== null && change.beforeHash !== old.hash;
async function planGenerated(context: FileContext, file: Entry, change: Change, old: Owned | undefined): Promise<void> {
  const { planned, prefix } = context;
  const conflict = ownershipConflict(change, old);
  if (conflict) planned.conflicts.push(file.path+conflict);
  const kept = customized(change, old) ? await planCustomized(context, file, change, old) : null;
  const { content, hash } = kept ?? { content: file.content, hash: change.afterHash! };
  planned.entries.push({path:prefix+file.path,content,...encodingField(file)});
  planned.ownership.push({path:file.path,hash,ownership:file.ownership});
}
async function planFiles(context: FileContext, output: Entry[], changes: readonly Change[], previous: ReadonlyMap<string,Owned>): Promise<void> {
  for (let i = 0; i < output.length; i++) {
    const file = output[i]!; const change = changes[i]!; const old = previous.get(file.path);
    await (context.retained.has(file.path) ? planRetained : planGenerated)(context, file, change, old);
  }
  // Retired files remain tracked, but are never implicitly removed.
  const { ownership } = context.planned;
  for (const [path,value] of previous) if (!ownership.some(e => e.path === path)) ownership.push({path,hash:value.hash,ownership:value.ownership});
}
function visualInventory(model: Model) {
  // Validation gate: invalid visual designs stop planning before any file is rendered.
  const visual = visualDefinitions(model);
  const interactions = [...visual.pages, ...visual.components].flatMap(d => visualNodes(visualRoot(d)).flatMap(n => 'events' in n ? n.events : []));
  return { visual, interactions };
}
function planSummary(options: WorkspaceOptions, input: InputSnapshot, model: Model, output: Entry[], { visual, interactions }: ReturnType<typeof visualInventory>) {
  return {...selectionField(options),project:model.project.id,target:input.target,files:output.length,entities:model.entities.length,sources:model.sources.length,operations:model.sources.reduce((n,s)=>n+s.operations.length,0),screens:model.screens.length,components:model.components.length,acceptanceTodos:model.requirements.length + interactions.filter(visualAcceptanceTodo).length,definitions:visual.pages.length+visual.components.length,pages:visual.pages.length,componentDefinitions:visual.components.length,publishedRevisions:visual.revisions.length,visualInteractions:interactions.length,businessTodos:interactions.filter(i=>visualVerification(i)==='business-todo').length,warnings:model.warnings};
}
/** The receipt's inputHash names the accepted design bytes the project carries (design/project.json), the file
 * `doctor` re-hashes. The generator rewrites that file in normalized form, so hashing the raw source input
 * (a starter or an export) made a fresh project look changed since generation. Without a written design file
 * (for example a click-dummy target) the source input remains the recorded input. */
function acceptedDesign(entries: readonly PlannedEntry[], prefix: string, input: InputSnapshot): string {
  const design = entries.find(entry => entry.path === prefix + 'design/project.json' && !entry.encoding);
  return design?.content ?? input.content.toString('utf8');
}
/** Plans are rebuilt from local data and trusted templates, not deserialized executable plans. */
export async function planArtifacts(options: WorkspaceOptions, input: InputSnapshot, model: Model, output: Entry[]) {
  requireOutsideTemplate(options, input);
  const prefix = targetPrefix(options.target);
  const receiptPath = prefix+'.companion/generation.json';
  const inspected = await createFilePlan(input.vault,[{path:receiptPath,content:null}]); const receiptBefore = inspected.changes[0]!.beforeHash;
  const previous = await previousOwnership(options, input, model, receiptPath, receiptBefore);
  const inventory = visualInventory(model);
  requireValue(output.length <= 5000, 'Generated project exceeds the supported ownership inventory.');
  const candidates = await createFilePlan(input.vault,output.map(e => ({path:prefix+e.path,content:e.content,...encodingField(e)})));
  const planned: Planned = { preserved: [], conflicts: [], entries: [], ownership: [] };
  const context: FileContext = { vault: input.vault, prefix, retained: new Set(options.selection?.retainedPaths ?? []), planned };
  await planFiles(context, output, candidates.changes, previous);
  const { ownership, entries } = planned;
  const receipt = {...generationReceipt(text(model.project.id), acceptedDesign(entries, prefix, input), ownership),...selectionField(options)};
  entries.push({path:receiptPath,content:json(receipt)});
  const plan = await createFilePlan(input.vault,entries);
  requireValue(plan.changes.at(-1)!.beforeHash === receiptBefore,'Receipt changed during planning.');
  for (let i=0;i<candidates.changes.length;i++) requireValue(candidates.changes[i]!.beforeHash === plan.changes[i]!.beforeHash,'Target changed during planning.');
  const hash = digest(json({version:generationVersion,root:plan.root,inputHash:receipt.inputHash,...selectionField(options),changes:plan.changes.map(({path,beforeHash,afterHash})=>({path,beforeHash,afterHash}))}));
  // A legacy input names the interaction IDs that replaced its edge IDs (hooks were generated per edge before).
  const interactionIds: Record<string,string> = input.migration?.interactionIds ?? {};
  return {hash,plan,conflicts:planned.conflicts,preserved:planned.preserved,interactionIds,summary:planSummary(options, input, model, output, inventory)};
}
/** Lossy decoding would silently rewrite a developer's bytes; only exact UTF-8 (BOM retained) or base64 survives. */
function preservedText(bytes: Buffer, encoding?: 'base64'): string | null {
  if (encoding) return bytes.toString('base64');
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return null; }
}
export async function applyProject(result: Awaited<ReturnType<typeof planArtifacts>>, expectedHash: string) {
  requireValue(result.hash === expectedHash,'Reviewed plan hash is stale; inspect a fresh plan.');
  requireValue(result.conflicts.length === 0,'Generation conflicts: '+result.conflicts.join('; '));
  return applyFilePlan(result.plan);
}
export function reviewProject(result: Awaited<ReturnType<typeof planArtifacts>>) {
  const legacy = Object.keys(result.interactionIds).length ? {legacyInteractionIds:result.interactionIds} : {};
  return {mode:'plan',planHash:result.hash,...result.summary,...legacy,conflicts:result.conflicts,preserved:result.preserved,changes:result.plan.changes.map(({path,status,beforeHash,afterHash})=>({path,status,beforeHash,afterHash}))};
}
