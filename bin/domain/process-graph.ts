import { bindingOf, type FormField } from './form.ts';
import { rulePaths } from './process-rules.ts';
import type { ProcessDefinition, ProcessStep } from './process.ts';
/** One finding of `process check`; `step` or `rule` locates it inside the definition. */
export interface ProcessIssue { code: string; message: string; step?: string; rule?: string }
function walk(start: string[], edges: ReadonlyMap<string, string[]>): Set<string> {
  const seen = new Set(start), queue = [...start];
  while (queue.length) for (const next of edges.get(queue.shift()!) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  return seen;
}
function edges(steps: readonly ProcessStep[], reverse: boolean): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const step of steps) for (const transition of step.next ?? []) {
    const [from, to] = reverse ? [transition.to, step.id] : [step.id, transition.to];
    result.set(from, [...result.get(from) ?? [], to]);
  }
  return result;
}
/**
 * Graph health: the first step starts every instance, every step must be reachable from it and every step must
 * have a path to a terminal step. Cycles (rework loops) are allowed when they can still finish.
 */
export function processGraphIssues(definition: ProcessDefinition): ProcessIssue[] {
  const steps = definition.steps, reachable = walk([steps[0]!.id], edges(steps, false));
  const finishing = walk(steps.filter(step => step.terminal).map(step => step.id), edges(steps, true));
  const issues: ProcessIssue[] = [];
  if (!steps.some(step => step.terminal)) issues.push({ code: 'PROCESS_NO_TERMINAL', message: 'The process has no terminal step.' });
  for (const step of steps) {
    if (!reachable.has(step.id)) issues.push({ code: 'PROCESS_UNREACHABLE', step: step.id, message: `Step ${step.id} cannot be reached from the start step ${steps[0]!.id}.` });
    if (!finishing.has(step.id)) issues.push({ code: 'PROCESS_DEAD_END', step: step.id, message: `Step ${step.id} has no path to a terminal step.` });
  }
  return issues;
}
const join = (prefix: string | undefined, path: string) => prefix ? `${prefix}.${path}` : path;
function fieldPaths(fields: readonly FormField[], prefix: string | undefined, lookup: (id: string) => readonly FormField[] | undefined): string[] {
  return fields.filter(field => !field.transient && field.kind !== 'confirm').flatMap(field => {
    if (field.kind !== 'section') return [join(prefix, bindingOf(field))];
    const nested = field.form ? lookup(field.form) ?? [] : field.fields ?? [];
    return fieldPaths(nested, field.bind ? join(prefix, field.bind) : prefix, lookup);
  });
}
/** Data paths a step collects (its form or inline fields under `bind`) or declares as outputs. */
function processStepPaths(step: ProcessStep, lookup: (id: string) => readonly FormField[] | undefined): string[] {
  const fields = step.form ? lookup(step.form) ?? [] : step.fields ?? [];
  return [...fieldPaths(fields, step.bind, lookup), ...step.outputs ?? []];
}
const related = (left: string, right: string) => left === right || left.startsWith(right + '.') || right.startsWith(left + '.');
/** Every rule and transition condition must read data that some step collects or declares; anything else can never be decided. */
export function processDataIssues(definition: ProcessDefinition, lookup: (id: string) => readonly FormField[] | undefined): ProcessIssue[] {
  const provided = definition.steps.flatMap(step => processStepPaths(step, lookup));
  const unknown = (paths: string[]) => [...new Set(paths.filter(path => !provided.some(item => related(item, path))))];
  const issues: ProcessIssue[] = [];
  for (const rule of definition.rules) for (const path of unknown([...rulePaths(rule.require), ...rule.when ? rulePaths(rule.when) : []]))
    issues.push({ code: 'PROCESS_DATA_UNKNOWN', rule: rule.id, message: `Rule ${rule.id} reads ${path}, which no step collects or declares as an output.` });
  for (const step of definition.steps) for (const transition of step.next ?? []) for (const path of unknown(transition.when ? rulePaths(transition.when) : []))
    issues.push({ code: 'PROCESS_DATA_UNKNOWN', step: step.id, message: `Transition ${step.id} → ${transition.to} reads ${path}, which no step collects or declares as an output.` });
  return issues;
}
