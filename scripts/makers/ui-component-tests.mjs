import { generatedTest, localName } from './primitives.mjs';

export async function notePanelComponentTests(context, { owner, name, repository }) {
  const { key, entity } = repository;
  await generatedTest(context, owner, name, 'pending-view', `// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia, disposePinia } from 'pinia';
import { expect, it, vi } from 'vitest';
import Panel from '../../../src/presentation/components/generated/${owner}-${name}.vue';
import { ${localName(owner, `${name}-panel`, 'messages')} as messages } from '../../../src/features/${owner}/${name}-panel.messages';
import { ${key}Feature } from '../../../src/features/${owner}/${entity}.definition';
import { createNoteFeatures } from '../../../src/application/note-feature';
import { markdownCodec } from '../../../src/infrastructure/markdown';
import { failure, success, type Result } from '../../../src/domain/outcome';
import { entityFixture } from '../entity-fixture';

it('preserves the owned draft during held/uncertain writes and exposes validation and exact destination', async () => {
  const f = entityFixture(); let sequence = 0; let folder = ${key}Feature.defaultFolder;
  const runtime = createNoteFeatures({ storage: f.storage, codec: markdownCodec, events: f.events, errors: f.errors,
    newId: () => 'view-' + ++sequence, now: () => '2026-09-23T00:00:00.000Z' }, register => ({ item: register(${key}Feature, () => folder) }));
  const pinia = createPinia(); const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { authoring: messages.en,
    error: { filename: 'Invalid filename', folder: 'Invalid folder', uncertain: 'Unknown write outcome' } } } });
  const wrapper = mount(Panel, { props: { repository: runtime.repositories.item }, global: { plugins: [pinia, i18n] } });
  try {
    const input = wrapper.get('input'); const reset = wrapper.get('button');
    const create = wrapper.findAll('button').at(-1); if (!create) throw new Error('Create action missing');
    folder = '../invalid'; await input.setValue('Valid Title'); await create.trigger('click'); await flushPromises();
    expect(input.attributes('aria-invalid')).toBe('false'); expect(wrapper.text()).toContain('Invalid folder');
    folder = ${key}Feature.defaultFolder; await input.setValue('Invalid/Title'); await create.trigger('click'); await flushPromises();
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(input.attributes('aria-describedby')).toBe(wrapper.get('[role="alert"]').attributes('id'));
    expect(wrapper.text()).toContain('Invalid filename'); expect(f.create).not.toHaveBeenCalled();
    let finish!: (result: Result<void>) => void;
    const held = new Promise<Result<void>>(resolve => { finish = resolve; });
    f.create.mockImplementationOnce(async (path, bytes) => { const result = await held; if (result.ok) f.files.set(path, bytes); return result; });
    await input.setValue('Original Draft'); await create.trigger('click');
    await vi.waitFor(() => expect(f.create).toHaveBeenCalledOnce());
    expect(input.element.disabled).toBe(true); expect(reset.element.disabled).toBe(true); expect(create.element.disabled).toBe(true);
    await reset.trigger('click'); expect(input.element.value).toBe('Original Draft');
    expect(wrapper.get('code').text()).toBe(folder + '/Original Draft.md');
    finish(success(undefined)); await flushPromises();
    expect(input.element.value).toBe(''); expect(input.element.disabled).toBe(false); expect(reset.element.disabled).toBe(false);
    f.create.mockResolvedValueOnce(failure('uncertain', 'error.uncertain'));
    await input.setValue('Uncertain Draft'); await create.trigger('click'); await flushPromises();
    expect(input.element.disabled).toBe(true); expect(reset.element.disabled).toBe(true); expect(create.element.disabled).toBe(true);
    expect(wrapper.get('code').text()).toBe(folder + '/Uncertain Draft.md');
    expect(wrapper.get('[role="status"]').attributes('aria-describedby')).toBe(wrapper.get('code').attributes('id'));
    await reset.trigger('click'); await create.trigger('click');
    expect(input.element.value).toBe('Uncertain Draft'); expect(f.create).toHaveBeenCalledTimes(2);
    expect(wrapper.get('code').text()).toBe(folder + '/Uncertain Draft.md');
  } finally { wrapper.unmount(); disposePinia(pinia); i18n.dispose(); runtime.dispose(); }
});
`);
}
