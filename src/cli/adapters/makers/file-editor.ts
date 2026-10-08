import { localName, locales, generatedTest } from './primitives.ts';
import { registeredFileType } from './native-registrations.ts';
import { title } from './arguments.ts';
import type { RecipeContext } from './contracts.ts';

/** A custom Vue editor for one registered file type, mounted by its dedicated file view. */
export interface FileEditorRequest { readonly owner: string; readonly name: string; readonly fileType: string }
const registry = 'src/bootstrap/native-integrations.ts';
const pascal = (value: string): string => value.replace(/^./, letter => letter.toUpperCase());

function jsonComposable(composable: string): string {
  return `import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNativeFile } from '../context/native-file-context';

/** A JSON object document, or null while the text is not an object (the raw source stays editable). */
export type EditorDocument = Record<string, unknown>;
function isDocument(value: unknown): value is EditorDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseDocument(text: string): EditorDocument | null {
  try {
    const value: unknown = JSON.parse(text);
    return isDocument(value) ? value : null;
  } catch {
    return null;
  }
}
const inputValue = (event: Event): string | null =>
  event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ? event.target.value : null;

/**
 * Developer-owned editor model. Grow the document model here; every write goes through
 * file.update, and the host view saves it. Text is rewritten only when the user edits.
 */
export function ${composable}() {
  const { t } = useI18n();
  const inputId = useId();
  const file = useNativeFile();
  const source = computed(() => file.state.value.content);
  const document = computed(() => parseDocument(source.value));
  const heading = computed(() => file.state.value.file?.basename ?? file.definition.name);
  const title = computed(() => (typeof document.value?.title === 'string' ? document.value.title : ''));
  const editable = computed(() => file.state.value.editable);
  const validation = computed(() => file.state.value.validation);
  function setTitle(value: string): void {
    const current = document.value;
    if (!current || !editable.value) return;
    file.update(JSON.stringify({ ...current, title: value }, null, 2) + '\\n');
  }
  function onTitleInput(event: Event): void {
    const value = inputValue(event);
    if (value !== null) setTitle(value);
  }
  function onSourceInput(event: Event): void {
    const value = inputValue(event);
    if (value !== null && editable.value) file.update(value);
  }
  return { t, inputId, heading, source, document, title, editable, validation, setTitle, onTitleInput, onSourceInput };
}
`;
}
function textComposable(composable: string): string {
  return `import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNativeFile } from '../context/native-file-context';

const inputValue = (event: Event): string | null => (event.target instanceof HTMLTextAreaElement ? event.target.value : null);

/** Developer-owned editor model. Every write goes through file.update; the host view saves it. */
export function ${composable}() {
  const { t } = useI18n();
  const inputId = useId();
  const file = useNativeFile();
  const source = computed(() => file.state.value.content);
  const heading = computed(() => file.state.value.file?.basename ?? file.definition.name);
  const lines = computed(() => (source.value ? source.value.split('\\n').length : 0));
  const editable = computed(() => file.state.value.editable);
  const validation = computed(() => file.state.value.validation);
  function onSourceInput(event: Event): void {
    const value = inputValue(event);
    if (value !== null && editable.value) file.update(value);
  }
  return { t, inputId, heading, source, lines, editable, validation, onSourceInput };
}
`;
}
function component(owner: string, name: string, composable: string, prefix: string, json: boolean): string {
  const base = `${owner}-${name}-editor`;
  const fields = json
    ? `
    <template v-if="model.document.value">
      <label :for="model.inputId + '-title'">{{ model.t('${prefix}.field') }}</label>
      <input :id="model.inputId + '-title'" :value="model.title.value" :disabled="!model.editable.value" type="text" maxlength="200" @input="model.onTitleInput" />
    </template>
    <p v-else role="alert">{{ model.t('${prefix}.invalid') }}</p>`
    : `
    <p>{{ model.t('${prefix}.lines') }}: {{ model.lines.value }}</p>`;
  return `<script setup lang="ts">
import { ${composable} } from '../../composables/${base}';
const model = ${composable}();
</script>

<template>
  <section class="shell-authoring-${base}" :aria-labelledby="model.inputId + '-heading'">
    <h2 :id="model.inputId + '-heading'">{{ model.heading.value }}</h2>${fields}
    <label :for="model.inputId + '-source'">{{ model.t('${prefix}.source') }}</label>
    <textarea :id="model.inputId + '-source'" :value="model.source.value" :disabled="!model.editable.value" rows="12" spellcheck="false" @input="model.onSourceInput"></textarea>
    <p role="status">{{ model.validation.value ?? model.t('${prefix}.valid') }}</p>
  </section>
</template>

<style src="../../../styles/generated/${base}.css"></style>
`;
}
function editorTest(owner: string, name: string, fileType: string, prefix: string, json: boolean): string {
  const base = `${owner}-${name}-editor`;
  const namespace = prefix.slice('authoring.'.length);
  const initial = json ? '{\n  "title": "Plan",\n  "lanes": []\n}\n' : 'first\nsecond';
  const behavior = json
    ? `expect(wrapper.find('input').element.value).toBe('Plan');
    await wrapper.find('input').setValue('Renamed');
    expect(file.writes.at(-1)).toBe('{\\n  "title": "Renamed",\\n  "lanes": []\\n}\\n');
    await wrapper.find('textarea').setValue('{broken');
    expect(file.writes.at(-1)).toBe('{broken');
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').text()).toContain('Invalid JSON');`
    : `expect(wrapper.text()).toContain('2');
    await wrapper.find('textarea').setValue('only');
    expect(file.writes).toEqual(['only']);`;
  return `// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import { expect, it } from 'vitest';
import Editor from '../../../src/presentation/components/generated/${base}.vue';
import { createNativeFileModel, nativeFileKey } from '../../../src/presentation/context/native-file-context';
import { validateFileContent, type NativeFileDefinition } from '../../../src/domain/native-integrations';
import type { NativeFileEditorSession } from '../../../src/application/native-file-editor';
import { ${localName(owner, `${name}-editor`, 'messages')} as messages } from '../../../src/features/${owner}/${name}-editor.messages';

const definition: NativeFileDefinition = { id: '${fileType}', name: 'Example', extension: 'example', format: '${json ? 'json' : 'text'}', initialContent: '' };
/** The same session contract the dedicated file view provides, kept in memory. */
function session(initial: string) {
  let content = initial; let editable = true;
  const listeners = new Set<() => void>(); const writes: string[] = [];
  const value: NativeFileEditorSession = {
    definition,
    current: () => ({ content, file: { path: 'Boards/example.example', name: 'example.example', basename: 'example' }, validation: validateFileContent(definition, content), editable }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update(next) { if (!editable) return; content = next; writes.push(next); for (const listener of listeners) listener(); },
  };
  return { value, writes, stop() { editable = false; for (const listener of listeners) listener(); } };
}
it('edits ${fileType} files only through the file session and stops when the view stops', async () => {
  const file = session(${JSON.stringify(initial)});
  const { model, release } = createNativeFileModel(file.value);
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { authoring: { ${namespace}: messages.en.${namespace} } } } });
  const wrapper = mount(Editor, { global: { plugins: [i18n, { install: app => app.provide(nativeFileKey, model) }] } });
  try {
    expect(wrapper.find('h2').text()).toBe('example');
    expect(wrapper.find('label[for]').attributes('for')).toBeTruthy();
    ${behavior}
    file.stop(); await nextTick();
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
  } finally { wrapper.unmount(); release(); i18n.dispose(); }
});
`;
}
/** Composable, SFC, scoped style, messages, explicit registration and a real component test. */
export async function fileEditorRecipe(context: RecipeContext, { owner, name, fileType }: FileEditorRequest): Promise<void> {
  const { format } = await registeredFileType(context, fileType);
  const json = format === 'json';
  const base = `${owner}-${name}-editor`;
  const prefix = await locales(context, owner, `${name}-editor`, {
    title: `${title(name)} editor`, description: `Dedicated editor for ${title(name)} files.`,
    field: 'Title', source: 'Source', valid: 'Saved by Obsidian as you type.', lines: 'Lines',
    invalid: 'The source is not a JSON object. Fix it below; the fields return when it parses.',
  });
  const composable = `use${pascal(localName(owner, name, 'editor'))}`;
  await context.add(`src/presentation/composables/${base}.ts`, json ? jsonComposable(composable) : textComposable(composable));
  await context.add(`src/presentation/components/generated/${base}.vue`, component(owner, name, composable, prefix, json));
  await context.add(`src/styles/generated/${base}.css`, `.shell-authoring-${base} {\n  display: grid;\n  gap: var(--size-4-2);\n  padding: var(--size-4-4);\n  color: var(--text-normal);\n  background: var(--background-primary);\n}\n\n.shell-authoring-${base} textarea {\n  min-height: 12rem;\n  font-family: var(--font-monospace);\n}\n`);
  const local = localName(owner, name, 'file-editor');
  await context.editArray(registry, 'nativeFileEditors', `{ id: '${fileType}', component: ${local} }`, [
    { local, from: `../presentation/components/generated/${base}.vue`, defaultImport: true },
  ]);
  await generatedTest(context, owner, name, 'file-editor', editorTest(owner, name, fileType, prefix, json));
}
