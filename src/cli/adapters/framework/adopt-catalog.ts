import type { Command } from './catalog.ts';

const values = (...keys: string[]): Record<string, 'value'> => Object.fromEntries(keys.map(key => [key, 'value']));
/** Adoption of an existing project. These commands work on any folder and never require a configured shell project. */
export const adoptCommands: readonly Command[] = [
  { id: 'adopt analyze', summary: 'Analyze an existing project read-only (bounded, no code executed) and report its stack, tooling and Workbench compatibility findings.', options: { ...values('target', 'out'), replace: 'flag' }, maxArgs: 0, effect: 'read' },
  { id: 'adopt plan', summary: 'Render the analysis as a Markdown integration plan; previews with its SHA-256 and writes one file only after --yes or --apply.', options: { ...values('target', 'report', 'out'), replace: 'flag' }, maxArgs: 0, effect: 'plan' },
  { id: 'adopt skill', summary: 'Install the adopt-existing-project agent skill (Claude and Codex copies) into the target; never overwrites a different file.', options: values('target'), maxArgs: 0, effect: 'plan' },
];
