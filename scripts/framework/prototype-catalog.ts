import type { Command } from './catalog.ts';
const values = (...keys: string[]): Record<string, 'value'> => Object.fromEntries(keys.map(key => [key, 'value']));
const selected = ['version', 'variant'];
export const prototypeCommands: readonly Command[] = [
  { id: 'prototypes list', summary: 'Read prototypes, versions, variants and the single pinned generator selection.', maxArgs: 0, options: {}, effect: 'read' },
  { id: 'prototypes compare', summary: 'Read complete snapshot differences without changing saved content or activation.', maxArgs: 1, options: values(...selected,'with-prototype','with-version','with-variant'), effect: 'read' },
  ...([
    ['prototype-details', 1, ['name','description'], 'Edit prototype display details without changing folder slugs or saved designs.'],
    ['version-details', 1, ['version','label'], 'Edit the label of an unsealed version without changing saved designs.'],
    ['restore-snapshot', 1, [...selected,'from-prototype','from-version','from-variant','recovery-version'], 'Restore a saved reference into an editable draft, retaining its previous content in a sealed recovery version.'],
    ['create', 1, ['input','name','description'], 'Capture a complete project as docs/concepts/<slug>/, version v1, draft variant main.'],
    ['version', 1, ['version','from'], 'Copy a saved version into a new editable version; all copied variants start as drafts.'],
    ['fork', 1, [...selected,'as','name','hypothesis'], 'Fork the selected saved variant; edits never change the original.'],
    ['save', 1, [...selected,'input'], 'Save complete project JSON to a draft in an unsealed version.'],
    ['details', 1, [...selected,'name','hypothesis'], 'Maintain a draft variant name and hypothesis without changing its path.'],
    ['status', 1, [...selected,'status'], 'Set draft, review, approved or archived status; activation is a separate operation.'],
    ['activate', 1, selected, 'Pin an approved variant for generation and demote any previous active variant.'],
    ['deactivate', 0, [], 'Clear the generator selection without deleting snapshots.'],
    ['seal', 1, ['version'], 'Seal snapshot content in a version; create a new version for further edits.'],
    ['archive', 1, [], 'Archive an inactive prototype without deleting any of its files.'],
    ['restore', 1, [], 'Restore an archived prototype without activating it.'],
    ['import', 0, ['input'], 'Import a validated workspace bundle using reviewed, conflict-checked file writes.'],
    ['export', 0, ['out'], 'Export the complete workspace to inert JSON outside docs/concepts; never overwrite different files.'],
    ['adopt', 0, ['resolve'], 'Import the pinned active project through the existing configuration conflict workflow.'],
    ['generate', 0, ['target','output-kind','scope','storybook','storybook-stories'], 'Generate strictly from the saved active variant; no implicit selection or process execution.'],
  ] satisfies Array<[string, number, string[], string]>).map(([name, maxArgs, options, summary]) => ({ id: 'prototypes ' + name, maxArgs: Number(maxArgs),
    options: values(...options), summary: String(summary), effect: 'plan' as const })),
];
