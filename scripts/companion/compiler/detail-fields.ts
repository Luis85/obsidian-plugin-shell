import type { DetailElement } from '../runtime/detail-runtime.ts';
export function controlElement(node: DetailElement, index: number, attrs: string, disabled: string): string {
  const ref = `spec.nodes[${index}]!`; const kind = node.control?.kind ?? 'text';
  const shared = `:id="model.prefix + '-${node.id}'" :aria-describedby="model.prefix + '-${node.id}-hint'" :aria-invalid="!!model.errors['${node.id}']" :required="${ref}.control?.required" ${disabled} v-on="model.inputListeners(${index})"`;
  let input: string;
  if (['textarea', 'json-editor', 'markdown-editor'].includes(kind)) input = `<textarea ${shared} :value="model.display(${index})" :placeholder="${ref}.text" rows="8" spellcheck="false" />`;
  else if (kind === 'select') input = `<select ${shared} :value="model.display(${index})"><option value="" disabled>Select an option</option><option v-for="option in ${ref}.control?.options" :key="option.value" :value="option.value">{{ option.label }}</option></select>`;
  else if (kind === 'checkbox') input = `<input ${shared} type="checkbox" :checked="model.checked(${index})" />`;
  else if (kind === 'json-file') input = `<input ${shared} type="file" accept=".json,application/json" />`;
  else input = `<input ${shared} type="${kind}" ${kind === 'number' ? 'step="any"' : ''} :value="model.display(${index})" :placeholder="${ref}.text" />`;
  return `<div ${attrs} class="generated-field" data-control-kind="${kind}"><label :for="model.prefix + '-${node.id}'">{{ ${ref}.label }}</label>
${input}
<small :id="model.prefix + '-${node.id}-hint'">{{ model.errors['${node.id}'] || ${ref}.a11y }}</small></div>`;
}
