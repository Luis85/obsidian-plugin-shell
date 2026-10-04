import { defaultVaultConfigDirectory } from '../../domain/host-paths.ts';
import { OperationError, requireThat } from '../framework/contracts.ts';
import { readProjectGenerator } from '../../compiler/domain/project-starter.ts';
import { assertDesignData } from '../../../scripts/contracts/json-data.ts';
import { validateAuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import type { InputValue, StarterDefinition, StarterInput, StarterProcess, StarterStep, StarterFile, Json } from './types.ts';
export function record(value: unknown): Record<string, unknown> {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'STARTER_INVALID', 'Expected an object.');
  return value as Record<string, unknown>;
}
export function fields(value: Record<string, unknown>, allowed: string[]): void {
  requireThat(Object.keys(value).every(key => allowed.includes(key)), 'STARTER_INVALID', 'Unknown definition field.');
}
/** C0 controls and DEL (U+0000–U+001F, U+007F); text and string inputs refuse them. */
function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
export function text(value: unknown, label: string, max = 400): string {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !hasControl(value), 'STARTER_INVALID', `Invalid ${label}.`);
  return value;
}
export function identifier(value: unknown): string {
  const id = text(value, 'ID', 60);
  requireThat(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id), 'STARTER_INVALID', 'Use lower-case hyphenated IDs.');
  return id;
}
export function array(value: unknown, label: string, max = 64): unknown[] {
  requireThat(Array.isArray(value) && value.length <= max, 'STARTER_INVALID', `Invalid ${label} array.`);
  return value;
}
function strings(value: unknown, label: string, max = 32): string[] {
  return array(value, label, max).map(item => text(item, label));
}
function unique(ids: string[]): void { requireThat(new Set(ids).size === ids.length, 'STARTER_INVALID', 'Duplicate IDs.'); }
export function portablePath(value: string, dot = false): boolean {
  if (dot && value === '.') return true;
  return value.length <= 240 && value.split('/').every(part => /^[a-zA-Z0-9_.-][a-zA-Z0-9_. -]*$/.test(part) &&
    !['.', '..', '.git', defaultVaultConfigDirectory, '.framework', '.companion', '.workbench', '.codex-authoring.lock'].includes(part.toLowerCase()) &&
    !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
export function inputValue(value: unknown, input: StarterInput): InputValue {
  const valid = input.type === 'string' ? typeof value === 'string' && value.length <= 4000 && !hasControl(value)
    : input.type === 'boolean' ? typeof value === 'boolean' : typeof value === 'number' && Number.isSafeInteger(value);
  requireThat(valid && (!input.required || value !== ''), 'STARTER_INPUT', `Invalid input ${input.id}.`);
  const typed = value as InputValue;
  requireThat(!input.choices || input.choices.includes(typed), 'STARTER_INPUT', `Choose an allowed value for ${input.id}.`);
  return typed;
}
function readInput(value: unknown): StarterInput {
  const row = record(value); fields(row, ['id', 'label', 'type', 'required', 'default', 'choices']);
  const id = text(row.id, 'input.id', 60);
  requireThat(/^[a-z][a-zA-Z0-9]*$/.test(id) && !['constructor', 'prototype'].includes(id), 'STARTER_INVALID', 'Use simple input names.');
  requireThat(['string', 'boolean', 'integer'].includes(String(row.type)) && typeof row.required === 'boolean', 'STARTER_INVALID', 'Invalid input type or required flag.');
  const input: StarterInput = { id, label: text(row.label, 'input.label'), type: row.type as StarterInput['type'], required: row.required };
  if (row.choices !== undefined) {
    input.choices = array(row.choices, 'choices').map(item => inputValue(item, input));
    requireThat(input.choices.length > 0 && new Set(input.choices).size === input.choices.length, 'STARTER_INVALID', 'Empty or duplicate input choices.');
  }
  if (row.default !== undefined) input.default = inputValue(row.default, input);
  return input;
}
/**
 * Explicit safe list for npm options. Anything else that npm could parse as an option is refused,
 * including short flags and clusters (-g, -C, -gC), long abbreviations npm expands (--pref), and `--`.
 */
const npmFlag = /^--(?:no-)?(?:fund|audit|save|save-exact|package-lock|progress|color|if-present|ignore-scripts|foreground-scripts|prefer-offline|prefer-online|offline|legacy-peer-deps|strict-peer-deps|dry-run)$/;
const npmSetting = /^--(?:(?:omit|include)=(?:dev|optional|peer|prod)|loglevel=(?:silent|error|warn|notice|http|info|verbose|silly))$/;
function npmArgument(arg: string): boolean { return !arg.startsWith('-') || npmFlag.test(arg) || npmSetting.test(arg); }
/** The rendering syntax from render.ts: `{{name}}`, `{{name|json}}` and `{{name|html}}`. */
const placeholder = /\{\{([a-z][a-zA-Z0-9]*)(?:\|(?:json|html))?\}\}/g;
function placeholders(value: unknown, names: Set<string>): void {
  if (typeof value === 'string') for (const match of value.matchAll(placeholder)) names.add(match[1]!);
  else if (Array.isArray(value)) value.forEach(item => placeholders(item, names));
  else if (value !== null && typeof value === 'object') Object.values(value).forEach(item => placeholders(item, names));
}
/** Every rendered variable must always have a value, so validation never admits a recipe that `new` cannot render. */
function requireResolvable(inputs: StarterInput[], rendered: unknown[]): void {
  const names = new Set<string>(); placeholders(rendered, names);
  for (const name of names) {
    const input = inputs.find(item => item.id === name);
    requireThat(input && (input.required || input.default !== undefined), 'STARTER_VARIABLE', `Template variable ${name} needs a declared input that is required or has a default.`);
  }
}
function readStep(value: unknown): StarterStep {
  const row = record(value); fields(row, ['runner', 'args', 'script', 'cwd', 'timeout']);
  requireThat(row.runner === 'npm' || row.runner === 'node', 'STARTER_INVALID', 'Only npm and project-local Node scripts are supported.');
  const args = array(row.args, 'args').map(arg => typeof arg === 'string' && arg === '' ? arg : text(arg, 'argument', 4000));
  const cwd = text(row.cwd, 'cwd', 240);
  requireThat(portablePath(cwd, true), 'STARTER_INVALID', 'Process cwd must stay inside the generated project.');
  requireThat(Number.isSafeInteger(row.timeout) && Number(row.timeout) > 0 && Number(row.timeout) <= 3_600_000, 'STARTER_INVALID', 'Timeout must be 1..3600000ms.');
  const step: StarterStep = { runner: row.runner, args, cwd, timeout: Number(row.timeout) };
  if (row.runner === 'node') {
    step.script = text(row.script, 'script', 240);
    requireThat(portablePath(step.script) && /\.(?:mjs|cjs|js)$/.test(step.script), 'STARTER_INVALID', 'Node needs a project-local JavaScript filename, not -e, a URL or a module loader.');
  } else {
    requireThat(row.script === undefined, 'STARTER_INVALID', 'npm does not accept a script path.');
    requireThat(['ci', 'install', 'run'].includes(args[0] ?? ''), 'STARTER_INVALID', 'npm supports local install/ci/run only.');
    requireThat(args.every(npmArgument), 'STARTER_INVALID', 'npm accepts only reviewed local options; global/path overrides such as -g, -C, --prefix and --workspace are not supported.');
    requireThat(args[0] !== 'run' || /^[a-zA-Z0-9][a-zA-Z0-9:_.-]*$/.test(args[1] ?? ''), 'STARTER_INVALID', 'npm run needs a literal script name.');
  }
  return step;
}
export function readProcesses(value: unknown): StarterProcess[] {
  const result = array(value, 'processes', 32).map(raw => {
    const row = record(raw); fields(row, ['id', 'label', 'description', 'dependsOn', 'steps']);
    const steps = array(row.steps, 'steps', 32).map(readStep);
    requireThat(steps.length > 0, 'STARTER_INVALID', 'Processes need at least one step.');
    return { id: identifier(row.id), label: text(row.label, 'process.label'), description: text(row.description, 'process.description'),
      dependsOn: array(row.dependsOn, 'dependsOn', 32).map(identifier), steps };
  });
  unique(result.map(item => item.id));
  const done = new Set<string>(), visiting = new Set<string>();
  function visit(id: string) {
    const process = result.find(item => item.id === id);
    requireThat(process && !visiting.has(id), 'STARTER_INVALID', 'Unknown or cyclic process dependency.');
    if (done.has(id)) return;
    unique(process.dependsOn); visiting.add(id); process.dependsOn.forEach(visit); visiting.delete(id); done.add(id);
  }
  result.forEach(item => visit(item.id)); return result;
}
function readGenerator(value: unknown): StarterDefinition['generator'] {
  const raw = record(value);
  if (raw.kind === 'project') {
    try { return readProjectGenerator(raw); } catch (error) { throw new OperationError('STARTER_INVALID', error instanceof Error ? error.message : 'Invalid project generator.'); }
  }
  fields(raw, raw.kind === 'companion' ? ['kind', 'document'] : ['kind']);
  if (raw.kind !== 'companion') { requireThat(raw.kind === 'files', 'STARTER_INVALID', 'Unknown generator primitive.'); return { kind: 'files' }; }
  const document = record(raw.document);
  requireThat(document.schemaVersion === 6, 'STARTER_VERSION', 'Companion starters require project schema 6; earlier project formats are no longer supported.');
  validateAuthoringDocument(document);
  return { kind: 'companion', document };
}
export function validateDefinition(value: unknown): StarterDefinition {
  assertDesignData(value);
  const row = record(value);
  fields(row, ['$schema', 'schemaVersion', 'id', 'name', 'version', 'category', 'level', 'summary', 'outcome', 'includes', 'implementation', 'tags', 'inputs', 'generator', 'files', 'processes', 'firstRun', 'nextSteps']);
  requireThat(row.schemaVersion === 1, 'STARTER_VERSION', 'Unsupported starter schemaVersion; expected 1.');
  const version = text(row.version, 'version');
  requireThat(/^\d+\.\d+\.\d+$/.test(version), 'STARTER_INVALID', 'Use major.minor.patch starter versions.');
  requireThat(['Foundation', 'Everyday', 'Advanced'].includes(String(row.level)), 'STARTER_INVALID', 'Unknown difficulty.');
  const inputs = array(row.inputs, 'inputs').map(readInput); unique(inputs.map(item => item.id));
  const generator = readGenerator(row.generator);
  if (generator.kind === 'project') {
    // Identity and design come from the prototype interview; the project compiler owns every emitted file.
    requireThat(['inputs', 'files', 'processes', 'firstRun'].every(key => array(row[key], key, 1000).length === 0), 'STARTER_INVALID',
      'A project starter declares no inputs, files, processes or firstRun; the prototype interview and project compiler supply them.');
  } else requireThat(['id', 'name'].every(id => inputs.some(item => item.id === id && item.type === 'string' && item.required)), 'STARTER_INVALID', 'Declare required string inputs id and name.');
  const files: StarterFile[] = array(row.files, 'files', 1000).map(raw => {
    const file = record(raw); fields(file, ['path', 'content', 'json']);
    requireThat(Object.hasOwn(file, 'content') !== Object.hasOwn(file, 'json'), 'STARTER_INVALID', 'Each file needs exactly one of content or json.');
    const path = text(file.path, 'file.path', 240);
    requireThat(portablePath(path.replace(/\{\{[a-z][a-zA-Z0-9]*\}\}/g, 'value')), 'STARTER_INVALID', 'Unsafe template output path.');
    if (Object.hasOwn(file, 'json')) return { path, json: file.json as Json };
    requireThat(typeof file.content === 'string' && file.content.length <= 500_000 && !file.content.includes('\0'), 'STARTER_INVALID', 'Invalid file content.');
    return { path, content: file.content };
  });
  requireThat(generator.kind !== 'files' || files.length > 0, 'STARTER_INVALID', 'A file starter must define its boilerplate.');
  unique(files.map(file => file.path.toLowerCase()));
  for (const key of ['includes', 'implementation', 'tags']) requireThat(array(row[key], key, 32).length > 0, 'STARTER_INVALID', 'Metadata lists must not be empty.');
  const processes = readProcesses(row.processes), firstRun = array(row.firstRun, 'firstRun', 32).map(identifier);
  unique(firstRun); requireThat(firstRun.every(id => processes.some(p => p.id === id)), 'STARTER_INVALID', 'Unknown firstRun process.');
  const nextSteps = strings(row.nextSteps, 'nextSteps');
  // Rendering interpolates file paths, content, JSON string values (not keys), process arguments and next steps.
  requireResolvable(inputs, [files, processes.map(process => process.steps.map(step => step.args)), nextSteps]);
  return { schemaVersion: 1, ...(row.$schema === undefined ? {} : { $schema: text(row.$schema, '$schema', 500) }), id: identifier(row.id), name: text(row.name, 'name'), version,
    category: text(row.category, 'category'), level: row.level as StarterDefinition['level'], summary: text(row.summary, 'summary'), outcome: text(row.outcome, 'outcome'),
    includes: strings(row.includes, 'includes'), implementation: strings(row.implementation, 'implementation'), tags: strings(row.tags, 'tags'), inputs, generator, files, processes, firstRun, nextSteps };
}
