import { object, keys, text, list } from './data.ts';
import { requireSketch } from './errors.ts';
import { readSettings, type UserSettings } from './user-settings.ts';
export const setupCheckpointPath = 'configs/project-setup-draft.json';
export interface SetupDraft {
  schemaVersion: 1; settings?: UserSettings;
  project?: { name: string; description: string; product: string };
  prds?: Record<string, unknown>; prototypeInterview?: Record<string, unknown> | null;
  operations: Record<string, unknown>[]; boilerplate?: boolean;
}
/** A checkpoint contains answers, never write/execution approval or a cached file plan. */
export function readSetupDraft(input: unknown, baseline?: UserSettings): SetupDraft {
  const raw = object(input);
  keys(raw, ['schemaVersion', 'settings', 'project', 'prds', 'prototypeInterview', 'operations', 'boilerplate']);
  requireSketch(raw.schemaVersion === 1, 'CHECKPOINT_VERSION', 'Expected setup checkpoint request schemaVersion 1.');
  const draft: SetupDraft = { schemaVersion: 1, operations: list(raw.operations ?? [], 'operations', 500).map(item => structuredClone(object(item))) };
  if (raw.settings !== undefined) draft.settings = readSettings(raw.settings, baseline);
  if (raw.project !== undefined) {
    const project = object(raw.project); keys(project, ['name', 'description', 'product']);
    draft.project = { name: text(project.name, 'name', 80), description: text(project.description, 'description', 400), product: text(project.product, 'product', 1000) };
  }
  if (raw.prds !== undefined) draft.prds = structuredClone(object(raw.prds));
  if (raw.boilerplate !== undefined) {
    requireSketch(typeof raw.boilerplate === 'boolean', 'CHECKPOINT_CHOICE', 'boilerplate must be boolean.');
    draft.boilerplate = raw.boilerplate;
  }
  if (raw.prototypeInterview !== undefined) draft.prototypeInterview = interview(raw.prototypeInterview);
  return draft;
}
function interview(input: unknown): Record<string, unknown> | null {
  if (input === null) return null;
  const raw = object(input); keys(raw, ['schemaVersion', 'guideId', 'guideVersion', 'answers']);
  requireSketch(raw.schemaVersion === 1 && Number.isSafeInteger(raw.guideVersion) && Number(raw.guideVersion) > 0, 'CHECKPOINT_GUIDE', 'Invalid checkpoint guide version.');
  return { schemaVersion: 1, guideId: text(raw.guideId, 'guideId'), guideVersion: raw.guideVersion,
    answers: { ...structuredClone(object(raw.answers)), approved: false } };
}
