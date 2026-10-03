/**
 * Pure model of a GitHub Actions workflow, normalized from already-parsed YAML data.
 * Unsupported shapes fail loudly with a CiError; nothing here reads files or runs processes.
 */
export class CiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'CiError'; this.code = code; }
}
/** `setup` actions have no local equivalent that matters; `external` actions cannot be reproduced. */
export type StepKind = 'run' | 'setup' | 'external';
type Strings = Readonly<Record<string, string>>;
export interface CiStep {
  index: number; id?: string; name?: string; kind: StepKind; uses?: string; run?: string; shell?: string;
  workingDirectory?: string; env: Strings; condition?: string; inputs: Strings;
}
export interface CiJob {
  id: string; name?: string; runsOn: string; matrix: unknown; condition?: string; needs: string[]; env: Strings;
  shell?: string; workingDirectory?: string; steps: CiStep[]; blockers: string[];
}
export interface PathFilter { event: string; branches?: string[]; paths?: string[]; pathsIgnore?: string[] }
export interface CiWorkflow {
  file: string; stem: string; name: string; triggers: string[]; schedules: string[]; filters: PathFilter[]; env: Strings; jobs: CiJob[];
}
/** Setup-only actions that are satisfied by the local checkout and toolchain. */
export const setupActions: readonly string[] = ['actions/checkout', 'actions/setup-node', 'actions/cache', 'actions/upload-artifact'];
type Data = Record<string, unknown>;
const isData = (value: unknown): value is Data => typeof value === 'object' && value !== null && !Array.isArray(value);
function record(value: unknown, where: string): Data {
  if (value === undefined) return {};
  if (!isData(value)) throw new CiError('CI_UNSUPPORTED', `${where} must be a mapping.`);
  return value;
}
function text(value: unknown, where: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new CiError('CI_UNSUPPORTED', `${where} must be a string, number or boolean.`);
}
function optionalText(value: unknown, where: string): string | undefined {
  return value === undefined ? undefined : text(value, where);
}
function textMap(value: unknown, where: string): Strings {
  return Object.fromEntries(Object.entries(record(value, where)).map(([key, item]) => [key, text(item, `${where}.${key}`)]));
}
function textList(value: unknown, where: string): string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) throw new CiError('CI_UNSUPPORTED', `${where} must be a string or a list.`);
  return value.map((item, index) => text(item, `${where}[${index}]`));
}
function filterFor(event: string, config: unknown, where: string): PathFilter {
  const data = record(config ?? {}, where), filter: PathFilter = { event };
  for (const [key, field] of [['branches', 'branches'], ['paths', 'paths'], ['paths-ignore', 'pathsIgnore']] as const) {
    if (data[key] !== undefined) filter[field] = textList(data[key], `${where}.${key}`);
  }
  return filter;
}
interface Triggers { triggers: string[]; schedules: string[]; filters: PathFilter[] }
function parseTriggers(on: unknown, where: string): Triggers {
  if (typeof on === 'string' || Array.isArray(on)) return { triggers: textList(on, where), schedules: [], filters: [] };
  const events = record(on, where), schedules: string[] = [], filters: PathFilter[] = [];
  for (const [event, config] of Object.entries(events)) {
    if (event === 'schedule') schedules.push(...scheduleCrons(config, `${where}.schedule`));
    else if (isData(config) && ['branches', 'paths', 'paths-ignore'].some(key => key in config)) filters.push(filterFor(event, config, `${where}.${event}`));
  }
  return { triggers: Object.keys(events), schedules, filters };
}
function scheduleCrons(config: unknown, where: string): string[] {
  if (!Array.isArray(config)) throw new CiError('CI_UNSUPPORTED', `${where} must be a list of cron entries.`);
  return config.map((entry, index) => text(record(entry, `${where}[${index}]`).cron, `${where}[${index}].cron`));
}
function stepKind(uses: string | undefined): StepKind {
  if (uses === undefined) return 'run';
  return setupActions.includes(uses.split('@')[0]!) ? 'setup' : 'external';
}
function parseStep(raw: unknown, index: number, where: string): CiStep {
  const step = record(raw, where), uses = optionalText(step.uses, `${where}.uses`), run = optionalText(step.run, `${where}.run`);
  if ((uses === undefined) === (run === undefined)) throw new CiError('CI_UNSUPPORTED', `${where} needs exactly one of run or uses.`);
  const base: CiStep = { index, kind: stepKind(uses), env: textMap(step.env, `${where}.env`), inputs: textMap(step.with, `${where}.with`) };
  const optional: Partial<CiStep> = { id: optionalText(step.id, `${where}.id`), name: optionalText(step.name, `${where}.name`), uses, run,
    shell: optionalText(step.shell, `${where}.shell`), workingDirectory: optionalText(step['working-directory'], `${where}.working-directory`),
    condition: optionalText(step.if, `${where}.if`) };
  return { ...base, ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)) };
}
/** Job-level features that make a local run meaningless or unsafe. */
function jobBlockers(job: Data): string[] {
  const reasons: string[] = [];
  if (job.uses !== undefined) reasons.push('calls a reusable workflow');
  if (job.container !== undefined) reasons.push('runs in a container');
  if (job.services !== undefined) reasons.push('needs service containers');
  if (job.environment !== undefined) reasons.push('targets a deployment environment');
  return reasons;
}
function runsOn(value: unknown, where: string): string {
  if (value === undefined) return '';
  return Array.isArray(value) || isData(value) ? JSON.stringify(value) : text(value, where);
}
function parseJob(id: string, raw: unknown, where: string): CiJob {
  const job = record(raw, where), defaults = record(record(job.defaults, `${where}.defaults`).run, `${where}.defaults.run`);
  const steps = job.steps === undefined ? [] : job.steps;
  if (!Array.isArray(steps)) throw new CiError('CI_UNSUPPORTED', `${where}.steps must be a list.`);
  return {
    id, runsOn: runsOn(job['runs-on'], `${where}.runs-on`), matrix: record(job.strategy, `${where}.strategy`).matrix,
    needs: textList(job.needs, `${where}.needs`), env: textMap(job.env, `${where}.env`), blockers: jobBlockers(job),
    steps: steps.map((step, index) => parseStep(step, index + 1, `${where}.steps[${index + 1}]`)),
    ...Object.fromEntries(Object.entries({ name: optionalText(job.name, `${where}.name`), condition: optionalText(job.if, `${where}.if`),
      shell: optionalText(defaults.shell, `${where}.defaults.run.shell`), workingDirectory: optionalText(defaults['working-directory'], `${where}.defaults.run.working-directory`) })
      .filter(([, value]) => value !== undefined)),
  };
}
/** Normalizes parsed YAML data; `file` is the workflow file name and `stem` its name without extension. */
export function normalizeWorkflow(file: string, stem: string, data: unknown): CiWorkflow {
  const root = record(data, file);
  if (root.on === undefined) throw new CiError('CI_UNSUPPORTED', `${file}: missing the "on" trigger block.`);
  const jobs = record(root.jobs, `${file}: jobs`);
  return { file, stem, name: optionalText(root.name, `${file}: name`) ?? stem, ...parseTriggers(root.on, `${file}: on`),
    env: textMap(root.env, `${file}: env`), jobs: Object.entries(jobs).map(([id, job]) => parseJob(id, job, `${file}: jobs.${id}`)) };
}
