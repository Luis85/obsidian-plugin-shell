import { localName, locales, generatedTest, registryPath } from './primitives.mjs';
import { notePanelTests } from './ui-tests.mjs';
import { notePanelComponentTests } from './ui-component-tests.mjs';

async function store(context, owner, name) {
  const local = `use${localName(owner, name, 'store').replace(/^./, letter => letter.toUpperCase())}`;
  await context.add(`src/presentation/stores/${owner}-${name}.ts`, `import { defineStore } from 'pinia';\n\n/** Draft state belongs to each mounted view's Pinia; never canonical storage. */\nexport const ${local} = defineStore('${owner}-${name}', {\n  state: () => ({ draft: '' }),\n  getters: { length: state => state.draft.length },\n  actions: { reset() { this.draft = ''; } },\n});\n`);
  await generatedTest(context, owner, name, 'store', `import { createPinia, disposePinia } from 'pinia';\nimport { expect, it } from 'vitest';\nimport { ${local} } from '../../../src/presentation/stores/${owner}-${name}';\n\nit('keeps ${owner}-${name} drafts per view and resets only its owner', () => {\n  const first = createPinia(); const second = createPinia();\n  try {\n    const a = ${local}(first); const b = ${local}(second);\n    a.draft = 'Edited'; expect(a.length).toBe(6); expect(b.draft).toBe('');\n    b.draft = 'Other'; a.reset(); expect(a.length).toBe(0); expect(b.draft).toBe('Other');\n  } finally { disposePinia(first); disposePinia(second); }\n});\n`);
  return local;
}
export async function component(context, { owner, name, editable = false, repository }) {
  const local = localName(owner, name, 'panel'); const prefix = await locales(context, owner, `${name}-panel`);
  const composable = `use${local.replace(/^./, letter => letter.toUpperCase())}`;
  const componentPath = `src/presentation/components/generated/${owner}-${name}.vue`;
  const imports = [`import { useI18n } from 'vue-i18n';`, `import { useId } from 'vue';`];
  let body = 'return { t, inputId };'; let binding = `${composable}()`; let props = ''; let repositoryProp = '{}';
  if (editable) {
    const useStore = await store(context, owner, name);
    imports.push(`import { ${useStore} } from '../stores/${owner}-${name}';`);
    body = `const model = ${useStore}();\n  return { t, inputId, model };`;
  }
  if (repository) {
    const { key, entity, label } = repository;
    imports.push(`import { ref, onScopeDispose } from 'vue';`, `import type { NoteRepository } from '../../application/note-repository';`, `import { ${key}Entity } from '../../features/${owner}/${entity}.entity';`);
    const alias = `export type Repository = NoteRepository<Parameters<typeof ${key}Entity.parse>[0], Extract<ReturnType<typeof ${key}Entity.parse>, { ok: true }>['value']>;`;
    imports.push(alias);
    body = `const model = ${await store(context, owner, name)}();
  const busy = ref(false); const blocked = ref(false); const feedback = ref('');
  const invalid = ref(false); const destination = ref('');
  let sequence = 0; let active = true;
  onScopeDispose(() => { active = false; });
  async function create() {
    if (!active || busy.value || blocked.value) return;
    busy.value = true; feedback.value = ''; invalid.value = false; destination.value = '';
    try {
      const prepared = repository.prepare({ ${label}: model.draft }, inputId + '-' + ++sequence);
      if (!prepared.ok) {
        invalid.value = prepared.error.key === 'error.filename' || prepared.error.field === '${label}';
        feedback.value = t(prepared.error.key); return;
      }
      destination.value = prepared.value.path;
      const result = await repository.commit(prepared.value);
      if (!active) return;
      if (!result.ok && result.error.effect === 'uncertain') blocked.value = true;
      feedback.value = t(result.ok ? '${prefix}.created' : result.error.key);
      if (result.ok) model.reset();
    } finally { if (active) busy.value = false; }
  }
  return { t, inputId, model, busy, blocked, feedback, invalid, destination, create };`;
    binding = `${composable}(props.repository)`;
    props = `const props = defineProps<{ repository: Repository }>();\n`;
    repositoryProp = `{ repository: services.repositories.${key} }`;
  }
  const signature = repository ? 'repository: Repository' : '';
  if (repository) await notePanelTests(context, { owner, name, repository, composable });
  if (repository) await notePanelComponentTests(context, { owner, name, repository });
  await context.add(`src/presentation/composables/${owner}-${name}.ts`, `${imports.join('\n')}\n\nexport function ${composable}(${signature}) {\n  const { t } = useI18n(); const inputId = useId();\n  ${body}\n}\n`);
  const locked = repository ? ' :disabled="model.busy.value || model.blocked.value"' : '';
  const validation = repository ? ' :aria-invalid="model.invalid.value" :aria-describedby="model.inputId + \'-feedback\'"' : '';
  const editor = editable ? `\n    <label :for="model.inputId">{{ model.t('${prefix}.input') }}</label>\n    <input :id="model.inputId" v-model="model.model.draft" maxlength="120" type="text"${locked}${validation} />\n    <p>{{ model.t('${prefix}.count') }}: {{ model.model.length }}</p>\n    <button type="button"${locked} @click="model.model.reset">{{ model.t('${prefix}.reset') }}</button>` : '';
  const action = repository ? `\n    <button type="button" :disabled="model.busy.value || model.blocked.value || !model.model.draft.trim()" @click="model.create">{{ model.t('${prefix}.create') }}</button>\n    <code v-if="model.destination.value" :id="model.inputId + '-destination'" :aria-label="model.t('${prefix}.destination')">{{ model.destination.value }}</code>\n    <p :id="model.inputId + '-feedback'" :role="model.invalid.value ? 'alert' : 'status'" :aria-describedby="model.destination.value ? model.inputId + '-destination' : undefined">{{ model.feedback.value }}</p>` : '';
  const typeImport = repository ? ', type Repository' : '';
  await context.add(componentPath, `<script setup lang="ts">\nimport { ${composable}${typeImport} } from '../../composables/${owner}-${name}';\n${props}const model = ${binding};\n</script>\n\n<template>\n  <section class="shell-authoring-${owner}-${name}" :aria-labelledby="model.inputId + '-heading'">\n    <h2 :id="model.inputId + '-heading'">{{ model.t('${prefix}.title') }}</h2>\n    <p>{{ model.t('${prefix}.description') }}</p>${editor}${action}\n  </section>\n</template>\n\n<style src="../../../styles/generated/${owner}-${name}.css"></style>\n`);
  const destinationStyle = repository ? `\n.shell-authoring-${owner}-${name} code {\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n` : '';
  await context.add(`src/styles/generated/${owner}-${name}.css`, `.shell-authoring-${owner}-${name} {\n  display: grid;\n  gap: var(--size-4-2);\n  padding: var(--size-4-4);\n  color: var(--text-normal);\n  background: var(--background-primary);\n}\n${destinationStyle}`);
  await context.editArray(registryPath, 'authoringPanels', `{ id: '${owner}-${name}', titleKey: '${prefix}.title', component: ${local}, props: ${repository ? 'services' : '()'} => (${repositoryProp}) }`, [{ local, from: `../presentation/components/generated/${owner}-${name}.vue`, defaultImport: true }]);
  await generatedTest(context, owner, name, 'component', `// @vitest-environment happy-dom\nimport { mount } from '@vue/test-utils';\nimport { createI18n } from 'vue-i18n';\nimport { createPinia, disposePinia } from 'pinia';\nimport { expect, it } from 'vitest';\nimport Panel from '../../../src/presentation/components/generated/${owner}-${name}.vue';\nimport { ${localName(owner, `${name}-panel`, 'messages')} as messages } from '../../../src/features/${owner}/${name}-panel.messages';\n${repository ? `import { createNoteFeatures } from '../../../src/application/note-feature';\nimport { ${repository.key}Feature } from '../../../src/features/${owner}/${repository.entity}.definition';\nimport { markdownCodec } from '../../../src/infrastructure/markdown';\nimport { entityFixture } from '../entity-fixture';\n` : ''}\nit('renders the ${owner}-${name} owned accessible panel${editable ? ' and edits its draft' : ''}', async () => {\n  const pinia = createPinia(); const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { authoring: messages.en } } });\n  ${repository ? `const f = entityFixture(); const runtime = createNoteFeatures({ storage: f.storage, codec: markdownCodec, events: f.events, errors: f.errors, newId: () => 'panel-fixture', now: () => '2026-09-23T00:00:00.000Z' }, register => ({ item: register(${repository.key}Feature) }));` : ''}\n  const wrapper = mount(Panel, { ${repository ? 'props: { repository: runtime.repositories.item }, ' : ''}global: { plugins: [pinia, i18n] } });\n  try {\n    expect(wrapper.find('section').attributes('aria-labelledby')).toBe(wrapper.find('h2').attributes('id'));\n    ${editable ? `expect(wrapper.find('label').attributes('for')).toBe(wrapper.find('input').attributes('id'));\n    await wrapper.find('input').setValue('Draft'); expect(wrapper.text()).toContain('5');\n    await wrapper.find('button').trigger('click'); expect(wrapper.find('input').element.value).toBe('');` : "expect(wrapper.find('h2').text()).not.toBe('');"}\n  } finally { wrapper.unmount(); disposePinia(pinia); i18n.dispose(); ${repository ? 'runtime.dispose();' : ''} }\n});\n`);
}
