/** Tiered human help: golden path first, grouped commands on --all, full detail per command. */
import type { CommandHelp, OptionHelp } from './help-text.ts';
import { bold, type Style } from './terminal-style.ts';
interface HelpCommand extends CommandHelp { id: string; summary: string; effect: string; options: Record<string, 'value' | 'flag'> }
export interface HelpData {
  scope: 'golden-path' | 'all' | 'command'; commands: HelpCommand[];
  goldenPath: Array<{ command: string; example: string; purpose: string }>;
  groups: Array<{ id: string; title: string; commands: string[] }>;
}
const effects: Record<string, string> = {
  read: 'read-only.', plan: 'previews a file plan; writes only with --yes or --apply <planHash>.', process: 'runs trusted project tools; --dry-run shows what would run.',
  fixtures: 'test-vault fixtures; applying needs the approval hash.', release: 'guarded release adapter; --yes is never publication authority.',
};
function optionLine(name: string, kind: 'value' | 'flag' | undefined, doc: OptionHelp): string {
  const flag = `--${name}${kind === 'value' ? ` <${doc.values ? doc.values.join('|') : 'value'}>` : ''}`;
  const extra = doc.default ? ` (default: ${doc.default})` : '';
  return `  ${flag.padEnd(34)} ${doc.description}${extra}\n`;
}
function commandPage(style: Style, entry: HelpCommand): string {
  const own = Object.keys(entry.optionHelp).filter(name => Object.hasOwn(entry.options, name) && !['json', 'root', 'no-interaction', 'help', 'dry-run', 'yes', 'apply', 'plan-out', 'timeout'].includes(name));
  const shared = Object.keys(entry.optionHelp).filter(name => !own.includes(name));
  let text = `${bold(style, entry.id)}: ${entry.summary}\n\n${bold(style, 'Usage')}\n  ${entry.usage}\n`;
  if (own.length) text += `\n${bold(style, 'Options')}\n` + own.map(name => optionLine(name, entry.options[name], entry.optionHelp[name]!)).join('');
  text += `\n${bold(style, 'Common options')}\n` + shared.map(name => optionLine(name, entry.options[name], entry.optionHelp[name]!)).join('');
  if (entry.examples.length) text += `\n${bold(style, 'Examples')}\n` + entry.examples.map(example => `  ${example}\n`).join('');
  return text + `\nEffect: ${entry.effect}, ${effects[entry.effect] ?? ''}\n`;
}
function goldenPath(style: Style, data: HelpData): string {
  const width = Math.max(...data.goldenPath.map(item => item.command.length));
  let text = `Plugin Shell CLI: create, develop and check Obsidian plugins. Changes preview until --yes.\n\n${bold(style, 'Golden path')}\n`;
  data.goldenPath.forEach((item, index) => { text += `  ${index + 1}. ${item.command.padEnd(width)}  ${item.purpose}\n     ${' '.repeat(width)}  $ ${item.example}\n`; });
  text += `\n${bold(style, 'More commands')}\n`;
  const titleWidth = Math.max(...data.groups.map(group => group.title.length));
  for (const group of data.groups) text += `  ${group.title.padEnd(titleWidth)}  ${group.commands.join(', ')}\n`;
  return text + '\nDetails: node shell.mjs help <command>   Everything: node shell.mjs help --all   Machines: add --json\n';
}
function everything(style: Style, data: HelpData): string {
  const width = Math.max(...data.commands.map(entry => entry.id.length));
  let text = '';
  for (const group of data.groups) {
    text += `${bold(style, group.title)}\n`;
    for (const id of group.commands) { const entry = data.commands.find(item => item.id === id); if (entry) text += `  ${entry.id.padEnd(width)}  ${entry.summary}\n`; }
    text += '\n';
  }
  return text + 'Details: node shell.mjs help <command>. Add --json for one machine-readable result; changes preview until --yes.\n';
}
export function helpText(style: Style, data: HelpData): string {
  if (data.scope === 'command' && data.commands.length === 1) return commandPage(style, data.commands[0]!);
  return data.scope === 'golden-path' ? goldenPath(style, data) : everything(style, data);
}
