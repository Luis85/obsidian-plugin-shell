/**
 * Data sources behind `check --plan` and the suite selection of `check --fast`: the test-suite manifest
 * (through its own loader), the gate rules file, the workflows' `paths:` filters and the measured suite
 * durations. Everything is read-only and optional: a kit without the shell tooling simply reports less.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { OperationError } from './contracts.ts';

export interface SuiteDef {
  name: string; include: string[]; exclude?: string[]; workflows?: string[]; npmScript?: string; verify: string;
  runner: { type: string }; prerequisites?: string[]; optional?: boolean;
  /** The verify step that runs a Vitest suite's files (the maker suite runs in maker-coverage-run). */
  verifyStepId?: string;
  /** Test-pyramid level and per-level file-pattern overrides (tooling/testing/test-levels.mjs validates them). */
  level?: string; levels?: Record<string, string[]>;
}
export interface SuiteManifest { suites: SuiteDef[]; prerequisites?: Record<string, { hint?: string }> }
export interface GateDef { label: string; command: string[]; kind: 'check' | 'script' | 'verify'; requiresScript?: string; prerequisites: string[]; workflows: string[] }
export interface Rule { id: string; label: string; paths: string[]; gates: string[]; suites: string[]; notes: string[]; flags: Array<{ code: string; message: string }> }
export interface GateRules {
  docsGlobs: string[]; suiteSources: Record<string, string[]>; gates: Record<string, GateDef>; rules: Rule[];
  docsOnly: { gates: string[]; note: string }; final: string[];
}
type PathMatcher = (path: string) => boolean;
/** Glob helpers and the manifest loader come from src/cli/tooling/testing; absent in distributed kits. */
export interface Toolkit { glob: (patterns: string[]) => PathMatcher; matchSuite: (suite: SuiteDef) => PathMatcher; manifest: () => Promise<SuiteManifest> }

export async function loadToolkit(root: string): Promise<Toolkit | null> {
  try {
    const module = await import('../../tooling/testing/suite-manifest.mjs');
    const compile = (patterns: string[]) => patterns.map(pattern => module.globToRegExp(pattern));
    return {
      glob: patterns => { const compiled = compile(patterns); return path => compiled.some(pattern => pattern.test(path)); },
      matchSuite: suite => module.matcher(suite),
      manifest: () => module.loadManifest(root),
    };
  } catch { return null; }
}
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
function strings(value: unknown, label: string): string[] {
  if (!isStrings(value)) throw new OperationError('GATE_RULES_INVALID', `gate-rules.json: ${label} must be a string array.`);
  return value;
}
const kinds = ['check', 'script', 'verify'] as const;
const isKind = (value: unknown): value is GateDef['kind'] => kinds.some(kind => kind === value);
function field(source: Record<string, unknown>, name: string, label: string): Record<string, unknown> {
  const value = source[name];
  if (!isRecord(value)) throw new OperationError('GATE_RULES_INVALID', `gate-rules.json: ${label} must be an object.`);
  return value;
}
function gateDef(id: string, value: unknown): GateDef {
  if (!isRecord(value) || typeof value.label !== 'string' || !isKind(value.kind)) throw new OperationError('GATE_RULES_INVALID', `gate-rules.json: gate ${id} needs label and kind.`);
  const requires = typeof value.requiresScript === 'string' ? { requiresScript: value.requiresScript } : {};
  return { label: value.label, command: strings(value.command, `gates.${id}.command`), kind: value.kind, prerequisites: strings(value.prerequisites ?? [], `gates.${id}.prerequisites`), workflows: strings(value.workflows ?? [], `gates.${id}.workflows`), ...requires };
}
function flagList(value: unknown, id: string): Rule['flags'] {
  const list = value ?? [], flags: Rule['flags'] = [];
  if (!Array.isArray(list)) throw new OperationError('GATE_RULES_INVALID', `gate-rules.json: rule ${id} flags must be a list.`);
  for (const item of list) {
    if (!isRecord(item) || typeof item.code !== 'string' || typeof item.message !== 'string') throw new OperationError('GATE_RULES_INVALID', `gate-rules.json: rule ${id} flags are invalid.`);
    flags.push({ code: item.code, message: item.message });
  }
  return flags;
}
function ruleDef(value: unknown, gates: Record<string, GateDef>): Rule {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string') throw new OperationError('GATE_RULES_INVALID', 'gate-rules.json: every rule needs id and label.');
  const rule: Rule = { id: value.id, label: value.label, paths: strings(value.paths, `rules.${value.id}.paths`), gates: strings(value.gates ?? [], `rules.${value.id}.gates`),
    suites: strings(value.suites ?? [], `rules.${value.id}.suites`), notes: strings(value.notes ?? [], `rules.${value.id}.notes`), flags: flagList(value.flags, value.id) };
  for (const gate of rule.gates) if (!gates[gate]) throw new OperationError('GATE_RULES_INVALID', `gate-rules.json: rule ${rule.id} names unknown gate ${gate}.`);
  return rule;
}
export function parseGateRules(value: unknown): GateRules {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new OperationError('GATE_RULES_INVALID', 'gate-rules.json: schemaVersion must be 1.');
  const gates = Object.fromEntries(Object.entries(field(value, 'gates', 'gates')).map(([id, gate]) => [id, gateDef(id, gate)]));
  const sources = Object.entries(field(value, 'suiteSources', 'suiteSources')).map(([name, globs]) => [name, strings(globs, `suiteSources.${name}`)] as const);
  const docs = field(value, 'docsOnly', 'docsOnly');
  const parsed: GateRules = { docsGlobs: strings(value.docsGlobs, 'docsGlobs'), suiteSources: Object.fromEntries(sources), gates,
    rules: (Array.isArray(value.rules) ? value.rules : []).map(rule => ruleDef(rule, gates)),
    docsOnly: { gates: strings(docs.gates, 'docsOnly.gates'), note: typeof docs.note === 'string' ? docs.note : '' }, final: strings(value.final, 'final') };
  for (const id of [...parsed.docsOnly.gates, ...parsed.final]) if (!gates[id]) throw new OperationError('GATE_RULES_INVALID', `gate-rules.json: unknown gate ${id}.`);
  return parsed;
}
export async function loadGateRules(root: string): Promise<GateRules | null> {
  let text: string;
  try { text = await readFile(join(root, 'configs/quality/gate-rules.json'), 'utf8'); } catch { return null; }
  try { return parseGateRules(JSON.parse(text)); }
  catch (error) { throw error instanceof OperationError ? error : new OperationError('GATE_RULES_INVALID', 'configs/quality/gate-rules.json is not valid JSON.'); }
}
interface EventFilter { paths?: string[]; pathsIgnore?: string[]; branches?: string[] }
export interface Workflow { stem: string; name: string; events: Record<string, EventFilter | null> }
function eventFilter(value: unknown): EventFilter | null {
  if (!isRecord(value)) return null;
  const list = (item: unknown) => Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === 'string') : undefined;
  const paths = list(value.paths), pathsIgnore = list(value['paths-ignore']), branches = list(value.branches);
  return { ...(paths ? { paths } : {}), ...(pathsIgnore ? { pathsIgnore } : {}), ...(branches ? { branches } : {}) };
}
/** Parses one workflow with the pinned YAML library (inert core schema; anchors such as `&inputs` resolve). */
export async function parseWorkflow(stem: string, text: string): Promise<Workflow | null> {
  const { parseDocument } = await import('yaml');
  const document = parseDocument(text, { version: '1.2', schema: 'core', uniqueKeys: true });
  if (document.errors.length) return null;
  const data: unknown = document.toJS({ maxAliasCount: 100 });
  if (!isRecord(data)) return null;
  const on = data.on;
  const events: Workflow['events'] = {};
  if (typeof on === 'string') events[on] = null;
  else if (Array.isArray(on)) for (const name of on) events[String(name)] = null;
  else if (isRecord(on)) for (const [name, value] of Object.entries(on)) events[name] = eventFilter(value);
  return { stem, name: typeof data.name === 'string' ? data.name : stem, events };
}
export async function loadWorkflows(root: string): Promise<Workflow[]> {
  const directory = join(root, '.github/workflows');
  let names: string[];
  try { names = (await readdir(directory)).filter(name => /\.ya?ml$/.test(name)).sort(); } catch { return []; }
  const workflows: Workflow[] = [];
  for (const name of names) {
    const parsed = await parseWorkflow(name.replace(/\.ya?ml$/, ''), await readFile(join(directory, name), 'utf8'));
    if (parsed) workflows.push(parsed);
  }
  return workflows;
}
export interface TriggerResult { runs: boolean; event: string; via: 'always' | 'paths' | 'paths-ignore' | 'manual-only' | 'no-match'; path?: string; pattern?: string }
/** GitHub semantics: patterns are evaluated in order, a later `!pattern` re-excludes, the last match wins. */
function winningPattern(toolkit: Toolkit, patterns: string[], path: string): string | null {
  let winner: string | null = null;
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!');
    if (toolkit.glob([negated ? pattern.slice(1) : pattern])(path)) winner = negated ? null : pattern;
  }
  return winner;
}
function pathsMatch(toolkit: Toolkit, patterns: string[], paths: string[]): { path: string; pattern: string } | null {
  for (const path of paths) {
    const pattern = winningPattern(toolkit, patterns, path);
    if (pattern) return { path, pattern };
  }
  return null;
}
function filterResult(toolkit: Toolkit, event: string, filter: EventFilter | null, paths: string[]): TriggerResult {
  if (filter?.paths) {
    const hit = pathsMatch(toolkit, filter.paths, paths);
    // A catch-all `**` filter (minus exclusions) is a run-on-everything trigger, not a path-specific one.
    if (hit && filter.paths.includes('**')) return { runs: true, event, via: 'always', ...hit };
    return hit ? { runs: true, event, via: 'paths', ...hit } : { runs: false, event, via: 'no-match' };
  }
  if (filter?.pathsIgnore) {
    const kept = paths.find(path => !toolkit.glob(filter.pathsIgnore ?? [])(path));
    return kept ? { runs: true, event, via: 'paths-ignore', path: kept } : { runs: false, event, via: 'no-match' };
  }
  return { runs: true, event, via: 'always' };
}
/** Whether a workflow runs for a diff: pull_request first, else push to main; schedule, dispatch and other-branch pushes are manual. */
export function workflowTrigger(toolkit: Toolkit, workflow: Workflow, paths: string[]): TriggerResult {
  const event = ['pull_request', 'push'].find(name => name in workflow.events);
  if (!event) return { runs: false, event: Object.keys(workflow.events)[0] ?? 'none', via: 'manual-only' };
  const filter = workflow.events[event] ?? null;
  // A push limited to other branches (release.yml's release/**) never runs for a change headed to main.
  if (event === 'push' && filter?.branches && !toolkit.glob(filter.branches)('main')) return { runs: false, event, via: 'manual-only' };
  return filterResult(toolkit, event, filter, paths);
}
/** `| \`suite\` | … | 91 s |` rows of the Measured column in docs/testing/TEST-SUITES.md. */
export function parseDurations(markdown: string): Record<string, number> {
  const durations: Record<string, number> = {};
  for (const line of markdown.split('\n')) {
    const match = /^\|\s*`([^`]+)`\s*\|.*\|\s*(\d+) s\s*\|\s*$/.exec(line);
    if (match) durations[match[1]!] = Number(match[2]);
  }
  return durations;
}
export async function loadDurations(root: string): Promise<Record<string, number>> {
  try { return parseDurations(await readFile(join(root, 'docs/testing/TEST-SUITES.md'), 'utf8')); } catch { return {}; }
}
