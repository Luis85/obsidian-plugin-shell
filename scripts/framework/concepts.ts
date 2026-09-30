import { join } from 'node:path';
import { createFilePlan, type FilePlanEntry } from '../shared/file-plan.ts';
import { serializeJson } from '../contracts/serialization.ts';
import { applyConcept } from '../companion/concepts/apply.ts';
import { conceptRequire } from '../companion/concepts/contract.ts';
import { parseAuthoringDocument } from '../companion/authoring-contract.ts';
import { projectModel } from '../companion/compiler/model.ts';
import { record } from '../companion/sitemap/safety.ts';
import { configurationPlan } from './changes.ts';
import { designFile } from './configuration.ts';
import { hash, exists, readBounded } from './files.ts';
import { readConceptInput } from './concept-input.ts';
import { stringOption, type Context, type Request } from './contracts.ts';

async function currentProject(context: Context) {
  if (!await exists(join(context.root, designFile))) return undefined;
  const bytes = await readBounded(join(context.root, designFile), 4_000_000);
  const document = parseAuthoringDocument(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  return { bytes, document, sha256: hash(bytes) };
}
function candidateSummary(document: ReturnType<typeof parseAuthoringDocument>) {
  // Inspect the complete compiler model, not just the concept's transport shape.
  const model = projectModel({ ...document });
  return { project: document.project, schemaVersion: document.schemaVersion, surfaces: model.screens.length,
    components: model.components.length, requirements: model.requirements.length, warnings: model.warnings };
}
async function readReceipt(context: Context, path: string, sourceSha256: string) {
  if (!await exists(join(context.root, path))) return null;
  let receipt: unknown;
  try { receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(context.root, path), 8192))); }
  catch { throw Error('CONCEPT_RECEIPT: Preserve the malformed concept receipt before reconciling.'); }
  const keys = ['kind', 'schemaVersion', 'source', 'sourceSha256', 'payloadSha256', 'mode', 'conceptId', 'projectId', 'baseSha256', 'resultSha256'];
  conceptRequire(record(receipt) && Object.keys(receipt).length === keys.length && keys.every(key => Object.hasOwn(receipt, key)) &&
    receipt.kind === 'concept-intake-receipt' && receipt.schemaVersion === 1 && receipt.sourceSha256 === sourceSha256 &&
    typeof receipt.resultSha256 === 'string' && /^[a-f0-9]{64}$/.test(receipt.resultSha256),
  'CONCEPT_RECEIPT', 'The concept receipt is malformed; no prior authority or ownership is inferred.');
  return receipt;
}
async function prepare(context: Context, input: string) {
  const source = await readConceptInput(context, input), current = await currentProject(context);
  if (source.decoded.status === 'reference-only') return { source, current, referenceOnly: true as const };
  const { concept } = source.decoded;
  const receiptPath = `.framework/concepts/${source.sha256}.json`, receipt = await readReceipt(context, receiptPath, source.sha256);
  if (receipt) {
    conceptRequire(current && current.sha256 === receipt.resultSha256 && current.document.project.id === receipt.projectId,
      'CONCEPT_REPLAY_CHANGED', 'This concept was already imported, but the project has changed. Create a new reviewed improvement instead of replaying an old snapshot.');
    return { source, current, referenceOnly: false as const, receiptPath, receipt, candidate: current.document,
      changes: [], migration: null, replay: true, concept };
  }
  const applied = applyConcept(concept, current);
  candidateSummary(applied.document);
  return { source, current, referenceOnly: false as const, receiptPath, receipt: null, candidate: applied.document,
    changes: applied.changes, migration: applied.migration, replay: false, concept };
}

/** No compiler/build processes or storage writes are performed by discovery and inspection. */
export async function inspectConcept(request: Request, context: Context) {
  const input = stringOption(request.options, 'input');
  if (!input) {
    const current = await currentProject(context);
    conceptRequire(current, 'CONCEPT_BASE_REQUIRED', 'Import or set up a project before inspecting its concept base.');
    return { baseSha256: current.sha256, ...candidateSummary(current.document), source: designFile,
      next: 'Create a data-only concept under docs/concepts, then concept inspect --input <file>.', execution: 'not-run' };
  }
  const prepared = await prepare(context, input);
  const provenance = { source: prepared.source.path, sourceSha256: prepared.source.sha256, execution: 'not-run' };
  if (prepared.referenceOnly) return { ...provenance, disposition: 'reference-only',
    reason: prepared.source.decoded.status === 'reference-only' ? prepared.source.decoded.reason : '' };
  return { ...provenance, disposition: 'data-compatible', mode: prepared.concept.mode,
    baseSha256: prepared.current?.sha256 ?? null, replay: prepared.replay, migration: prepared.migration, changes: prepared.changes,
    replacement: prepared.concept.mode === 'project' && !!prepared.current && !prepared.replay,
    candidateSha256: hash(serializeJson(prepared.candidate)), ...candidateSummary(prepared.candidate),
    acceptance: 'not-inferred', next: 'concept import with the same input to review filesystem changes; generation remains separate.' };
}

/** Reuses project-import configuration, compiler validation and file ownership; it is not another writer. */
export async function conceptImportPlan(request: Request, context: Context) {
  const input = stringOption(request.options, 'input');
  conceptRequire(input, 'INPUT_REQUIRED', 'Supply --input <docs/concepts/...json|html>.');
  const prepared = await prepare(context, input);
  conceptRequire(!prepared.referenceOnly, 'CONCEPT_REFERENCE_ONLY', 'This HTML has no recognized inert project data. Export a canonical project JSON or compatible concept manifest first.');
  const { source, current, candidate, concept, receiptPath } = prepared;
  const policy = stringOption(request.options, 'resolve');
  conceptRequire(concept.mode === 'project' || policy === undefined, 'CONCEPT_RESOLUTION', 'Scoped changes preserve current identity and paths; resolution flags only apply to project replacement.');
  // A no-op source entry checks exact input bytes under the same apply lock; it never rewrites the concept.
  const sourceEntry: FilePlanEntry = { path: source.path, encoding: 'base64', content: source.bytes.toString('base64') };
  if (prepared.replay) {
    conceptRequire(current, 'CONCEPT_BASE_REQUIRED', 'Missing replay target.');
    const plan = await createFilePlan(context.root, [sourceEntry, { path: designFile, content: current.bytes.toString('base64'), encoding: 'base64' },
      { path: receiptPath, content: (await readBounded(join(context.root, receiptPath), 8192)).toString('base64'), encoding: 'base64' }]);
    return { plan, hash: hash(serializeJson({ input: source.sha256, base: current.sha256 })), conflicts: [] as string[],
      summary: { mode: concept.mode, replay: true, source: source.path, changes: [], next: 'generate', execution: 'not-run' } };
  }
  const imported = await configurationPlan({ command: 'project import', args: [], options: { input: '-', ...(policy ? { resolve: policy } : {}) } },
    { ...context, inputText: serializeJson(candidate) });
  const saved = imported.plan.changes.find(change => change.path === designFile);
  conceptRequire(saved && saved.content !== null && saved.beforeHash === (current?.sha256 ?? null), 'CONCEPT_BASE_STALE', 'The canonical project changed while preparing intake. Inspect a new base.');
  const actual = parseAuthoringDocument(saved.content);
  const receipt = { kind: 'concept-intake-receipt', schemaVersion: 1, source: source.path, sourceSha256: source.sha256,
    payloadSha256: source.decoded.status === 'data' ? source.decoded.payloadSha256 : '', mode: concept.mode, conceptId: concept.id,
    projectId: actual.project.id, baseSha256: current?.sha256 ?? null, resultSha256: saved.afterHash };
  const plan = await createFilePlan(context.root, [...imported.plan.changes.map(change => ({ path: change.path, content: change.content })),
    { path: receiptPath, content: serializeJson(receipt) }, sourceEntry]);
  for (const before of imported.plan.changes) conceptRequire(plan.changes.find(change => change.path === before.path)?.beforeHash === before.beforeHash,
    'CONCEPT_BASE_STALE', 'Intake destinations changed while preparing the reviewed plan.');
  conceptRequire(plan.changes.find(change => change.path === source.path)?.beforeHash === source.sha256 &&
    plan.changes.find(change => change.path === receiptPath)?.beforeHash === null, 'CONCEPT_BASE_STALE', 'Concept input or receipt changed during preparation.');
  return { plan, hash: hash(serializeJson({ input: source.sha256, base: current?.sha256 ?? null })), conflicts: [] as string[],
    summary: { ...imported.summary, mode: concept.mode, source: source.path, sourceSha256: source.sha256,
      changes: prepared.changes, migration: prepared.migration, replacement: concept.mode === 'project' && !!current,
      replay: false, preservation: 'Original concept and implementation files unchanged.', execution: 'not-run' } };
}
