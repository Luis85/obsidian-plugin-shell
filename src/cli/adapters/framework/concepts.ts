import { join } from 'node:path';
import { createFilePlan, type FilePlanEntry } from '../../../../scripts/shared/file-plan.ts';
import { serializeJson } from '../../../../scripts/contracts/serialization.ts';
import { applyConcept } from '../../../../scripts/companion/concepts/apply.ts';
import { conceptRequire } from '../../../../scripts/companion/concepts/contract.ts';
import { parseAuthoringDocument } from '../../../../scripts/companion/authoring-contract.ts';
import { projectModel } from '../../compiler/emitters/model.ts';
import { record } from '../../../../scripts/companion/sitemap/safety.ts';
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
      changes: [], replay: true, concept };
  }
  const applied = applyConcept(concept, current);
  candidateSummary(applied.document);
  return { source, current, referenceOnly: false as const, receiptPath, receipt: null, candidate: applied.document,
    changes: applied.changes, replay: false, concept };
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
    baseSha256: prepared.current?.sha256 ?? null, replay: prepared.replay, changes: prepared.changes,
    replacement: prepared.concept.mode === 'project' && !!prepared.current && !prepared.replay,
    candidateSha256: hash(serializeJson(prepared.candidate)), ...candidateSummary(prepared.candidate),
    acceptance: 'not-inferred', next: 'concept import with the same input to review filesystem changes; generation remains separate.' };
}

/** Reuses project-import configuration, compiler validation and file ownership; it is not another writer. */
type Prepared = Extract<Awaited<ReturnType<typeof prepare>>, { referenceOnly: false }>;
/** A replay re-checks the exact input, design and receipt bytes; it plans no content change. */
async function replayPlan(context: Context, prepared: Prepared, sourceEntry: FilePlanEntry) {
  const { source, current, concept, receiptPath } = prepared;
  conceptRequire(current, 'CONCEPT_BASE_REQUIRED', 'Missing replay target.');
  const plan = await createFilePlan(context.root, [sourceEntry, { path: designFile, content: current.bytes.toString('base64'), encoding: 'base64' },
    { path: receiptPath, content: (await readBounded(join(context.root, receiptPath), 8192)).toString('base64'), encoding: 'base64' }]);
  return { plan, hash: hash(serializeJson({ input: source.sha256, base: current.sha256 })), conflicts: [] as string[],
    summary: { mode: concept.mode, replay: true, source: source.path, changes: [], next: 'generate', execution: 'not-run' } };
}
function intakeReceipt(prepared: Prepared, saved: { content: string | null; afterHash: string | null }) {
  const { source, current, concept } = prepared;
  const actual = parseAuthoringDocument(saved.content!);
  return { kind: 'concept-intake-receipt', schemaVersion: 1, source: source.path, sourceSha256: source.sha256,
    payloadSha256: source.decoded.status === 'data' ? source.decoded.payloadSha256 : '', mode: concept.mode, conceptId: concept.id,
    projectId: actual.project.id, baseSha256: current?.sha256 ?? null, resultSha256: saved.afterHash };
}
type Plan = Awaited<ReturnType<typeof createFilePlan>>;
/** Every destination, the concept input and the absent receipt must still match what intake prepared against. */
function checkUnchanged(plan: Plan, imported: Plan, prepared: Prepared): void {
  for (const before of imported.changes) conceptRequire(plan.changes.find(change => change.path === before.path)?.beforeHash === before.beforeHash,
    'CONCEPT_BASE_STALE', 'Intake destinations changed while preparing the reviewed plan.');
  conceptRequire(plan.changes.find(change => change.path === prepared.source.path)?.beforeHash === prepared.source.sha256 &&
    plan.changes.find(change => change.path === prepared.receiptPath)?.beforeHash === null, 'CONCEPT_BASE_STALE', 'Concept input or receipt changed during preparation.');
}
const baseHash = (current: Prepared['current']) => current?.sha256 ?? null;
async function importable(context: Context, input: string): Promise<Prepared> {
  const prepared = await prepare(context, input);
  conceptRequire(!prepared.referenceOnly, 'CONCEPT_REFERENCE_ONLY', 'This HTML has no recognized inert project data. Export a canonical project JSON or compatible concept manifest first.');
  return prepared;
}
export async function conceptImportPlan(request: Request, context: Context) {
  const input = stringOption(request.options, 'input');
  conceptRequire(input, 'INPUT_REQUIRED', 'Supply --input <docs/concepts/...json|html>.');
  const prepared = await importable(context, input);
  const { source, current, candidate, concept, receiptPath } = prepared;
  const policy = stringOption(request.options, 'resolve');
  conceptRequire(concept.mode === 'project' || policy === undefined, 'CONCEPT_RESOLUTION', 'Scoped changes preserve current identity and paths; resolution flags only apply to project replacement.');
  // A no-op source entry checks exact input bytes under the same apply lock; it never rewrites the concept.
  const sourceEntry: FilePlanEntry = { path: source.path, encoding: 'base64', content: source.bytes.toString('base64') };
  if (prepared.replay) return replayPlan(context, prepared, sourceEntry);
  const imported = await configurationPlan({ command: 'project import', args: [], options: { input: '-', ...(policy ? { resolve: policy } : {}) } },
    { ...context, inputText: serializeJson(candidate) });
  const saved = imported.plan.changes.find(change => change.path === designFile);
  conceptRequire(saved && saved.content !== null && saved.beforeHash === baseHash(current), 'CONCEPT_BASE_STALE', 'The canonical project changed while preparing intake. Inspect a new base.');
  const plan = await createFilePlan(context.root, [...imported.plan.changes.map(change => ({ path: change.path, content: change.content })),
    { path: receiptPath, content: serializeJson(intakeReceipt(prepared, saved)) }, sourceEntry]);
  checkUnchanged(plan, imported.plan, prepared);
  return { plan, hash: hash(serializeJson({ input: source.sha256, base: baseHash(current) })), conflicts: [] as string[], summary: importSummary(prepared, imported.summary) };
}
function importSummary(prepared: Prepared, imported: object) {
  const { source, current, concept } = prepared;
  return { ...imported, mode: concept.mode, source: source.path, sourceSha256: source.sha256,
    changes: prepared.changes, replacement: concept.mode === 'project' && !!current,
    replay: false, preservation: 'Original concept and implementation files unchanged.', execution: 'not-run' };
}
