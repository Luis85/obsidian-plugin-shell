import type { Command } from './catalog.ts';

const values = (...keys: string[]): Record<string, 'value'> => Object.fromEntries(keys.map(key => [key, 'value']));
/** Source projects under src/ declared in workbench.sources.json. Writing operations preview a reviewed plan first. */
export const sourceCommands: readonly Command[] = [
  { id: 'source list', summary: 'List the source projects of workbench.sources.json (or the implicit legacy plugin project) with kind, path, references, alias and dependents.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'source graph', summary: 'Show the source project dependency graph: build order, references and reverse dependents.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'source check', summary: 'Validate the manifest, graph, project folders and tsconfigs, #aliases, cross-project imports and gate scopes; exits 1 on findings. --fix reviews a plan regenerating the derived files.', options: { fix: 'flag' }, maxArgs: 0, effect: 'plan' },
  { id: 'source add', summary: 'Review scaffolding src/<name> from the kind template (code, one passing test, both tsconfigs) with its manifest entry, solution reference, alias and suite.', options: values('kind', 'platform', 'references'), maxArgs: 1, effect: 'plan' },
  { id: 'source link', summary: 'Review adding a reference <from> -> <to> and the derived tsconfigs; refuses a cycle.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'source unlink', summary: 'Review removing a reference <from> -> <to>; refuses while <from> still imports <to>.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'source rename', summary: 'Review renaming a project: moves its folder, rewrites the manifest, references, alias, tsconfigs and every import of the old alias or path.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'source remove', summary: 'Review removing an unreferenced project: deletes only files that still match their scaffold hash and keeps and lists edited ones.', options: {}, maxArgs: 1, effect: 'plan' },
];
