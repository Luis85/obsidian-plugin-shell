/**
 * Help metadata of the `source` commands: group, usage lines, examples and option documentation. Spread into
 * help-text.ts so the terminal help and the generated manual share it.
 */
import type { OptionHelp } from './help-text.ts';
import { sourceCommands } from './source-catalog.ts';

const app = 'node bin/app source';
const plan = '[--dry-run | --yes | --apply <sha256>] [--json]';
export const sourceGroup = { id: 'source', title: 'Source projects (workbench.sources.json)', commands: sourceCommands.map(command => command.id) };
export const sourceUsage: Record<string, string> = {
  'source list': `${app} list [--json]`,
  'source graph': `${app} graph [--json]`,
  'source check': `${app} check [--fix [--dry-run | --yes | --apply <sha256>]] [--json]`,
  'source add': `${app} add <name> --kind plugin|cli|companion|library [--platform node|browser] [--references a,b] ${plan}`,
  'source link': `${app} link <from> <to> ${plan}`,
  'source unlink': `${app} unlink <from> <to> ${plan}`,
  'source rename': `${app} rename <old> <new> ${plan}`,
  'source remove': `${app} remove <name> ${plan}`,
};
export const sourceExamples: Record<string, string[]> = {
  'source list': [`${app} list`, `${app} list --json`],
  'source graph': [`${app} graph`],
  'source check': [`${app} check`, `${app} check --json`, `${app} check --fix`, `${app} check --fix --yes`],
  'source add': [`${app} add util --kind library --references shared`, `${app} add mobile --kind plugin --references shared --yes`],
  'source link': [`${app} link plugin util`, `${app} link plugin util --yes`],
  'source unlink': [`${app} unlink plugin util --dry-run`],
  'source rename': [`${app} rename util helpers`, `${app} rename util helpers --apply <sha256>`],
  'source remove': [`${app} remove helpers`, `${app} remove helpers --yes`],
};
export const sourceOptionHelp: Record<string, OptionHelp> = {
  fix: { description: 'source check only: review a plan that regenerates the derived files (project and tests tsconfigs, root solution, package.json "imports") from the manifest, or writes the manifest of a legacy project without moving files.' },
  kind: { description: 'Kind template of the new source project (templates/sources/<kind>).', values: ['plugin', 'cli', 'companion', 'library'] },
  references: { description: 'Comma-separated projects the new project may import.', default: 'none' },
};
type OptionOverride = [(id: string, name: string) => boolean, (doc: OptionHelp) => void];
/** `--platform` also belongs to `pr publish`; on `source add` it selects the TypeScript base of a library. */
export const sourceOptionOverrides: OptionOverride[] = [
  [(id, name) => id === 'source add' && name === 'platform', doc => { doc.description = 'TypeScript base of a library project; plugin and companion are browser, cli is node.'; doc.values = ['node', 'browser']; doc.default = 'node'; }],
];
