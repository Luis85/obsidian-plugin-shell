import type { AgentFacts, WorkbenchFacts } from './contracts.ts';
import { isRecord, recordField, type InventoryView } from './source.ts';

const agentFilePatterns = [
  /^AGENTS\.md$/, /^CLAUDE\.md$/, /^GEMINI\.md$/, /^\.claude\/settings(?:\.local)?\.json$/, /^\.claude\/commands\/[^/]+\.md$/, /^\.mcp\.json$/,
  /^\.cursorrules$/, /^\.cursor\/rules\/[^/]+$/, /^\.windsurfrules$/, /^\.github\/copilot-instructions\.md$/, /^\.github\/instructions\/[^/]+\.md$/,
];
const skillFile = /^\.(?:claude|agents)\/skills\/([^/]+)\/SKILL\.md$/;
export function readAgents(view: InventoryView): AgentFacts {
  const settings = view.json('.claude/settings.json');
  const files = view.paths.filter(path => agentFilePatterns.some(pattern => pattern.test(path))).slice(0, 40);
  const skills = new Set<string>();
  for (const path of view.paths) {
    const name = skillFile.exec(path)?.[1];
    if (name) skills.add(name);
  }
  return {
    files: [...files, ...view.paths.filter(path => skillFile.test(path))].sort().slice(0, 60),
    skills: [...skills].sort(),
    claudeSettings: {
      present: view.has('.claude/settings.json'),
      hooks: isRecord(settings) && Object.keys(recordField(settings, 'hooks')).length > 0,
      permissions: isRecord(settings) && Object.keys(recordField(settings, 'permissions')).length > 0,
    },
  };
}
const markers: ReadonlyArray<[RegExp, string]> = [
  [/(^|\/)bin\/kit\.json$/, 'CLI kit'], [/^shell\.config\.json$/, 'shell configuration'], [/^configs\/user-settings\.json$/, 'Workbench settings'],
  [/^design\/project\.json$/, 'design project'], [/^docs\/workbench\//, 'Workbench documentation'], [/^\.companion\//, 'companion state'], [/^\.workbench\//, 'Workbench state'],
];
/** An extracted CLI kit is recognised by its `bin/kit.json` (the scan skips its contents). The kit alone is not prior adoption: `present` needs another marker. */
export function readWorkbench(view: InventoryView): WorkbenchFacts {
  const evidence: string[] = [];
  for (const [pattern, label] of markers) {
    const path = view.paths.find(item => pattern.test(item));
    if (path) evidence.push(`${path} (${label})`);
  }
  const kit = view.paths.find(path => /(^|\/)bin\/kit\.json$/.test(path));
  const kitPath = kit ? kit.replace(/\/?bin\/kit\.json$/, '') || '.' : null;
  return { present: evidence.some(item => !item.endsWith('(CLI kit)')), kitPath, evidence };
}
