import { requireThat } from '../../contracts/errors.ts';
import { inputValue, portablePath, record } from './validation.ts';
import type { StarterDefinition, InputValue, Json, StarterProcess } from './types.ts';
export function resolveValues(definition: StarterDefinition, supplied: unknown): Record<string, InputValue> {
  const source = record(supplied), values: Record<string, InputValue> = {};
  requireThat(Object.keys(source).every(key => definition.inputs.some(input => input.id === key)), 'STARTER_INPUT', 'Unknown input name.');
  for (const input of definition.inputs) {
    const value = Object.hasOwn(source, input.id) ? source[input.id] : input.default;
    requireThat(value !== undefined || !input.required, 'STARTER_INPUT', `Supply the required input ${input.id}.`);
    if (value !== undefined) values[input.id] = inputValue(value, input);
  }
  return values;
}
export function interpolate(source: string, values: Record<string, InputValue>): string {
  return source.replace(/\{\{([a-z][a-zA-Z0-9]*)(?:\|(json|html))?\}\}/g, (_, name: string, filter: string | undefined) => {
    requireThat(Object.hasOwn(values, name), 'STARTER_VARIABLE', `No value for ${name}.`);
    const value = values[name]!;
    if (filter === 'json') return JSON.stringify(value);
    if (filter === 'html') return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
    return String(value);
  });
}
function renderJson(value: Json, values: Record<string, InputValue>): Json {
  if (typeof value === 'string') return interpolate(value, values);
  if (Array.isArray(value)) return value.map(item => renderJson(item, values));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, renderJson(child, values)]));
  return value;
}
export function renderFiles(definition: StarterDefinition, values: Record<string, InputValue>) {
  const seen = new Set<string>();
  return definition.files.map(file => {
    const path = interpolate(file.path, values);
    requireThat(portablePath(path) && !seen.has(path.toLowerCase()), 'STARTER_PATH', 'Unsafe or duplicate resolved file path.'); seen.add(path.toLowerCase());
    const content = file.content === undefined ? JSON.stringify(renderJson(file.json!, values), null, 2) + '\n' : interpolate(file.content, values);
    return { path, content };
  });
}
export function renderProcesses(definition: StarterDefinition, values: Record<string, InputValue>): StarterProcess[] {
  return definition.processes.map(process => ({ ...process, dependsOn: [...process.dependsOn], steps: process.steps.map(step => ({ ...step, args: step.args.map(arg => interpolate(arg, values)) })) }));
}
