/** Typed shared facade used by the browser adapter; the shell calls the same pure services. */
import { validateAuthoringDocument } from '../authoring-contract.ts';
import { validateWorkspace } from './validate.ts';
import { changeWorkspace, emptyWorkspace, selectedVariant, activeVariant, workspaceSummary } from './commands.ts';
import { workspaceFiles, prototypeJsonText, type Digest } from './files.ts';
import { workspaceKey } from './safety.ts';
import { snapshotPath, selectionKey, type PrototypeWorkspace, type PrototypeAction } from './model.ts';
import { validateWorkspaceReplacement } from './replacement.ts';
import { comparePrototypeDocuments } from './compare.ts';
export const prototypeApi = {
  validate: (value: unknown) => validateWorkspace(value, validateAuthoringDocument),
  change: (source: PrototypeWorkspace, action: PrototypeAction) => changeWorkspace(source, action, validateAuthoringDocument),
  files: (source: PrototypeWorkspace, digest: Digest) => workspaceFiles(source, validateAuthoringDocument, digest),
  empty: emptyWorkspace, selected: selectedVariant, active: activeVariant, summary: workspaceSummary, compare: comparePrototypeDocuments,
  key: workspaceKey, snapshotPath, selectionKey, json: prototypeJsonText, replacement: validateWorkspaceReplacement,
};
