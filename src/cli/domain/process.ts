import { object, keys, text, list } from './data.ts';
import { requireSketch, hasControls } from '#shared/contracts/sketch-errors.ts';
import { readForm, type FormField } from './form.ts';
import { definitionId, readPath } from './form-model.ts';
import { readRuleExpression, type RuleExpression } from './process-rules.ts';
/** A business process is data: steps with roles, inputs and conditional transitions, plain-language rules and docs. */
export type ProcessStatus = 'draft' | 'active' | 'retired';
export type ProcessSeverity = 'block' | 'warn' | 'info';
export interface ProcessDoc { text?: string; file?: string }
export interface ProcessRole { id: string; title: string; description?: string }
export interface ProcessTransition { to: string; when?: RuleExpression; label?: string }
export interface ProcessStep {
  id: string; title: string; actor: string; description?: string; form?: string; fields?: FormField[]; bind?: string;
  outputs?: string[]; next?: ProcessTransition[]; terminal?: boolean; outcome?: string; doc?: ProcessDoc;
}
export interface ProcessRule {
  id: string; statement: string; rationale?: string; severity: ProcessSeverity; steps?: string[];
  when?: RuleExpression; require: RuleExpression; doc?: ProcessDoc;
}
export interface ProcessReferences { entities?: string[]; journeys?: string[]; pages?: string[] }
export interface ProcessDefinition {
  schemaVersion: 1; id: string; version: number; title: string; purpose: string; status: ProcessStatus; owner: string;
  roles: ProcessRole[]; references?: ProcessReferences; steps: ProcessStep[]; rules: ProcessRule[]; doc?: ProcessDoc;
}
const processStatuses: readonly ProcessStatus[] = ['draft', 'active', 'retired'];
export const processSeverities: readonly ProcessSeverity[] = ['block', 'warn', 'info'];
/** Doc files live below configs/processes/docs as lowercase kebab-case Markdown paths. */
const processDocFile = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\.md$/;
const limits = { roles: 30, steps: 60, rules: 80, transitions: 12, outputs: 30, references: 60, doc: 20000 };
const optional = <T>(value: unknown, read: (value: unknown) => T): T | undefined => value === undefined ? undefined : read(value);
const present = <K extends string, T>(key: K, value: T | undefined): Partial<Record<K, T>> => value === undefined ? {} : { [key]: value } as Record<K, T>;
function identifier(value: unknown, name: string, known?: Set<string>): string {
  const id = text(value, name, 80);
  requireSketch(definitionId.test(id), 'PROCESS_ID', `${name} must be a lowercase kebab-case id.`);
  requireSketch(!known?.has(id), 'PROCESS_DUPLICATE', `${name} duplicates id ${id}.`);
  known?.add(id);
  return id;
}
function choice<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  const found = allowed.find(item => item === value);
  requireSketch(found, 'PROCESS_FIELD', `${name} must be one of ${allowed.join(', ')}.`);
  return found;
}
function line(value: unknown, name: string, max = 300): string {
  const result = text(value, name, max);
  requireSketch(!hasControls(result), 'PROCESS_FIELD', `${name} must be single-line text.`);
  return result;
}
function readDoc(value: unknown, name: string): ProcessDoc {
  const item = object(value); keys(item, ['text', 'file']);
  requireSketch(item.text !== undefined || item.file !== undefined, 'PROCESS_DOC', `${name} needs text or file.`);
  const file = optional(item.file, raw => line(raw, name + '.file', 200));
  requireSketch(file === undefined || processDocFile.test(file), 'PROCESS_DOC', `${name}.file must be a kebab-case .md path below configs/processes/docs.`);
  return { ...present('text', optional(item.text, raw => text(raw, name + '.text', limits.doc))), ...present('file', file) };
}
function ids(value: unknown, name: string, max: number): string[] {
  const seen = new Set<string>();
  return list(value, name, max).map((item, index) => identifier(item, `${name}[${index}]`, seen));
}
function readRole(value: unknown, index: number, known: Set<string>): ProcessRole {
  const item = object(value), name = `roles[${index}]`; keys(item, ['id', 'title', 'description']);
  return { id: identifier(item.id, name + '.id', known), title: line(item.title, name + '.title', 120),
    ...present('description', optional(item.description, raw => text(raw, name + '.description', 2000))) };
}
function readReferences(value: unknown): ProcessReferences {
  const item = object(value); keys(item, ['entities', 'journeys', 'pages']);
  const reference = (raw: unknown, name: string) => list(raw, name, limits.references).map((entry, index) => line(entry, `${name}[${index}]`, 120));
  return { ...present('entities', optional(item.entities, raw => reference(raw, 'references.entities'))),
    ...present('journeys', optional(item.journeys, raw => reference(raw, 'references.journeys'))),
    ...present('pages', optional(item.pages, raw => reference(raw, 'references.pages'))) };
}
function readTransition(value: unknown, name: string): ProcessTransition {
  const item = object(value); keys(item, ['to', 'when', 'label']);
  return { to: identifier(item.to, name + '.to'), ...present('when', optional(item.when, raw => readRuleExpression(raw, name + '.when'))),
    ...present('label', optional(item.label, raw => line(raw, name + '.label', 120))) };
}
/** First matching transition wins, so only the last one may be unconditional. */
function readTransitions(value: unknown, name: string): ProcessTransition[] {
  const result = list(value, name, limits.transitions).map((item, index) => readTransition(item, `${name}[${index}]`));
  requireSketch(result.length > 0, 'PROCESS_TRANSITION', `${name} needs at least one transition, or mark the step terminal.`);
  requireSketch(result.every((item, index) => item.when !== undefined || index === result.length - 1), 'PROCESS_TRANSITION',
    `${name}: only the last transition may omit when; later transitions could never be taken.`);
  return result;
}
function stepInputs(item: Record<string, unknown>, name: string): Pick<ProcessStep, 'form' | 'fields' | 'bind'> {
  requireSketch(item.form === undefined || item.fields === undefined, 'PROCESS_STEP', `${name} uses either form or fields.`);
  const form = optional(item.form, raw => identifier(raw, name + '.form'));
  const fields = optional(item.fields, raw => readForm({ schemaVersion: 1, id: 'inline', version: 1, title: name, fields: raw }).fields);
  return { ...present('form', form), ...present('fields', fields), ...present('bind', optional(item.bind, raw => readPath(raw, name + '.bind'))) };
}
function stepFlow(item: Record<string, unknown>, name: string): Pick<ProcessStep, 'next' | 'terminal' | 'outcome'> {
  requireSketch(item.terminal === undefined || item.terminal === true, 'PROCESS_STEP', `${name}.terminal must be true when present.`);
  const terminal = item.terminal === true;
  requireSketch(terminal ? item.next === undefined : item.outcome === undefined, 'PROCESS_STEP',
    terminal ? `${name} is terminal and cannot have next transitions.` : `${name}.outcome belongs to terminal steps.`);
  if (terminal) return { terminal, ...present('outcome', optional(item.outcome, raw => line(raw, name + '.outcome', 120))) };
  return { next: readTransitions(item.next, name + '.next') };
}
function readStep(value: unknown, index: number, known: Set<string>, roles: ReadonlySet<string>): ProcessStep {
  const item = object(value), name = `steps[${index}]`;
  keys(item, ['id', 'title', 'actor', 'description', 'form', 'fields', 'bind', 'outputs', 'next', 'terminal', 'outcome', 'doc']);
  const id = identifier(item.id, name + '.id', known), actor = identifier(item.actor, name + '.actor');
  requireSketch(roles.has(actor), 'PROCESS_ROLE', `${name}.actor ${actor} is not a declared role.`);
  const outputs = optional(item.outputs, raw => list(raw, name + '.outputs', limits.outputs).map((entry, position) => readPath(entry, `${name}.outputs[${position}]`)));
  return { id, title: line(item.title, name + '.title', 120), actor,
    ...present('description', optional(item.description, raw => text(raw, name + '.description', 4000))),
    ...stepInputs(item, name), ...present('outputs', outputs), ...stepFlow(item, name),
    ...present('doc', optional(item.doc, raw => readDoc(raw, name + '.doc'))) };
}
function readRule(value: unknown, index: number, known: Set<string>, steps: ReadonlySet<string>): ProcessRule {
  const item = object(value), name = `rules[${index}]`;
  keys(item, ['id', 'statement', 'rationale', 'severity', 'steps', 'when', 'require', 'doc']);
  const scope = optional(item.steps, raw => ids(raw, name + '.steps', limits.steps));
  requireSketch(scope === undefined || scope.length > 0, 'PROCESS_RULE', `${name}.steps lists at least one step; omit it for the whole process.`);
  for (const step of scope ?? []) requireSketch(steps.has(step), 'PROCESS_RULE', `${name}.steps names unknown step ${step}.`);
  return { id: identifier(item.id, name + '.id', known), statement: text(item.statement, name + '.statement', 1000),
    ...present('rationale', optional(item.rationale, raw => text(raw, name + '.rationale', 2000))),
    severity: choice(item.severity, processSeverities, name + '.severity'), ...present('steps', scope),
    ...present('when', optional(item.when, raw => readRuleExpression(raw, name + '.when'))),
    require: readRuleExpression(item.require, name + '.require'), ...present('doc', optional(item.doc, raw => readDoc(raw, name + '.doc'))) };
}
function readSteps(value: unknown, roles: ReadonlySet<string>): ProcessStep[] {
  const known = new Set<string>();
  const steps = list(value, 'steps', limits.steps).map((item, index) => readStep(item, index, known, roles));
  requireSketch(steps.length > 0, 'PROCESS_STEPS', 'A process needs at least one step.');
  for (const step of steps) for (const transition of step.next ?? [])
    requireSketch(known.has(transition.to), 'PROCESS_TRANSITION', `${step.id} transitions to unknown step ${transition.to}.`);
  return steps;
}
/**
 * Structural and referential validation that fails closed: unknown keys, unsafe paths, control characters, duplicate
 * ids, unknown roles, unknown transition targets and rules scoped to unknown steps. Graph health is checked separately.
 */
export function readProcess(value: unknown): ProcessDefinition {
  const item = object(value);
  keys(item, ['$schema', 'schemaVersion', 'id', 'version', 'title', 'purpose', 'status', 'owner', 'roles', 'references', 'steps', 'rules', 'doc']);
  requireSketch(item.schemaVersion === 1 && Number.isSafeInteger(item.version) && Number(item.version) > 0, 'PROCESS_VERSION', 'Unsupported process version.');
  const roleIds = new Set<string>();
  const roles = list(item.roles, 'roles', limits.roles).map((role, index) => readRole(role, index, roleIds));
  const owner = identifier(item.owner, 'owner');
  requireSketch(roleIds.has(owner), 'PROCESS_ROLE', `owner ${owner} is not a declared role.`);
  const steps = readSteps(item.steps, roleIds), stepIds = new Set(steps.map(step => step.id)), ruleIds = new Set<string>();
  return { schemaVersion: 1, id: identifier(item.id, 'id'), version: Number(item.version), title: line(item.title, 'title', 120),
    purpose: text(item.purpose, 'purpose', 4000), status: choice(item.status, processStatuses, 'status'), owner, roles,
    ...present('references', optional(item.references, readReferences)), steps,
    rules: list(item.rules ?? [], 'rules', limits.rules).map((rule, index) => readRule(rule, index, ruleIds, stepIds)),
    ...present('doc', optional(item.doc, raw => readDoc(raw, 'doc'))) };
}
/** Canonical file text, keeping the editor schema hint. */
export function processText(definition: ProcessDefinition): string {
  return JSON.stringify({ $schema: '../schemas/business-process.schema.json', ...definition }, null, 2) + '\n';
}
