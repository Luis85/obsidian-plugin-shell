import { createFilePlan } from '../../scripts/shared/file-plan.mjs';
import { hash } from '../../scripts/framework/files.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.mjs';
import { object, keys } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { readSetupDraft, setupCheckpointPath, type SetupDraft } from '../domain/setup-checkpoint.ts';
import { setupStatePath } from '../domain/user-settings.ts';
import { intakePrds } from './prd-intake.ts';
import { loadSettings, guardedText, jsonText } from './user-settings.ts';
import { prepared } from './storage.ts';
interface Checkpoint { schemaVersion: 1; producer: 'shell-setup-checkpoint'; rootHash: string; settingsHash: string | null; sourceHash: string | null; request: SetupDraft }
async function sourceHash(root: string, draft: SetupDraft): Promise<string | null> {
  if (!draft.prds) return null;
  const settings = draft.settings ?? (await loadSettings(root)).settings;
  const intake = await intakePrds(root, settings, draft.prds);
  return hash(jsonText(intake));
}
function readCheckpoint(content: string): Checkpoint {
  const raw = object(parseJsonData(content));
  keys(raw, ['schemaVersion', 'producer', 'rootHash', 'settingsHash', 'sourceHash', 'request']);
  requireSketch(raw.schemaVersion === 1 && raw.producer === 'shell-setup-checkpoint', 'CHECKPOINT_FORMAT', 'Unknown checkpoint file; original bytes are preserved.');
  const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  requireSketch(digest(raw.rootHash) && (raw.settingsHash === null || digest(raw.settingsHash)) && (raw.sourceHash === null || digest(raw.sourceHash)), 'CHECKPOINT_FORMAT', 'Invalid checkpoint fingerprints.');
  const request = readSetupDraft(raw.request);
  // Foreign/mutated documents cannot smuggle persisted design agreement into resume.
  requireSketch(jsonText(request) === jsonText(raw.request), 'CHECKPOINT_APPROVAL', 'Checkpoint answers contain invalid fields or retained approval.');
  return { schemaVersion: 1, producer: 'shell-setup-checkpoint', rootHash: String(raw.rootHash),
    settingsHash: raw.settingsHash === null ? null : String(raw.settingsHash), sourceHash: raw.sourceHash === null ? null : String(raw.sourceHash), request };
}
export async function loadSetupCheckpoint(root: string) {
  const snapshot = await guardedText(root, setupCheckpointPath);
  return { ...snapshot, checkpoint: snapshot.content === null ? null : readCheckpoint(snapshot.content) };
}
export async function resumeSetupCheckpoint(root: string): Promise<SetupDraft> {
  const { checkpoint } = await loadSetupCheckpoint(root);
  requireSketch(checkpoint, 'CHECKPOINT_MISSING', 'No saved setup checkpoint.');
  const canonical = await createFilePlan(root, []), settings = await loadSettings(root);
  requireSketch(checkpoint.rootHash === hash(canonical.root), 'CHECKPOINT_ROOT', 'Checkpoint belongs to a different project directory.');
  requireSketch((await guardedText(root, setupStatePath)).content === null, 'CHECKPOINT_COMPLETED', 'This project is already initialized. Continue with sketch, not setup resume.');
  requireSketch(settings.beforeHash === checkpoint.settingsHash, 'CHECKPOINT_STALE', 'Settings changed since the checkpoint. Review and save a new checkpoint.');
  requireSketch(await sourceHash(root, checkpoint.request) === checkpoint.sourceHash, 'CHECKPOINT_STALE', 'PRD inventory or contents changed since the checkpoint. Review and save a new checkpoint.');
  return structuredClone(checkpoint.request);
}
export async function setupCheckpointPlan(root: string, input: unknown) {
  const loaded = await loadSettings(root), current = await loadSetupCheckpoint(root);
  const state = await guardedText(root, setupStatePath);
  requireSketch(state.content === null, 'CHECKPOINT_COMPLETED', 'Continue an initialized project using sketch.');
  const request = readSetupDraft(input, loaded.settings);
  const canonical = await createFilePlan(root, []);
  const fingerprint = await sourceHash(root, request);
  const checkpoint: Checkpoint = { schemaVersion: 1, producer: 'shell-setup-checkpoint', rootHash: hash(canonical.root),
    settingsHash: loaded.beforeHash, sourceHash: fingerprint, request };
  const plan = await createFilePlan(root, [{ path: setupCheckpointPath, content: jsonText(checkpoint) }]);
  requireSketch(plan.changes[0]!.beforeHash === current.beforeHash, 'MAKER_STALE', 'Checkpoint changed during planning.');
  return { ...prepared(plan, { checkpointPath: setupCheckpointPath, request, next: 'project-setup resume', approved: false }), validate: async () => {
    requireSketch((await loadSettings(root)).beforeHash === loaded.beforeHash, 'CHECKPOINT_STALE', 'Settings changed after checkpoint review.');
    requireSketch((await guardedText(root, setupStatePath)).beforeHash === state.beforeHash, 'CHECKPOINT_STALE', 'Project setup changed after checkpoint review.');
    requireSketch(await sourceHash(root, request) === fingerprint, 'CHECKPOINT_STALE', 'PRDs changed after checkpoint review.');
  } };
}
export async function discardSetupCheckpointPlan(root: string) {
  const snapshot = await loadSetupCheckpoint(root);
  requireSketch(snapshot.checkpoint, 'CHECKPOINT_MISSING', 'No saved setup checkpoint.');
  const plan = await createFilePlan(root, [{ path: setupCheckpointPath, content: null }]);
  requireSketch(plan.changes[0]!.beforeHash === snapshot.beforeHash, 'MAKER_STALE', 'Checkpoint changed during planning.');
  return prepared(plan, { checkpointPath: setupCheckpointPath, sourceFilesDeleted: false });
}
