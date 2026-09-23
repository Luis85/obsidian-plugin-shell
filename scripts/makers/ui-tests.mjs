import { generatedTest, localName } from './primitives.mjs';

export async function notePanelTests(context, { owner, name, repository, composable }) {
  const { key, entity } = repository;
  await generatedTest(context, owner, name, 'actions', `// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { expect, it, vi } from 'vitest';
import { ${composable} } from '../../../src/presentation/composables/${owner}-${name}';
import { ${localName(owner, `${name}-panel`, 'messages')} as messages } from '../../../src/features/${owner}/${name}-panel.messages';
import { ${key}Feature } from '../../../src/features/${owner}/${entity}.definition';
import { createNoteFeatures } from '../../../src/application/note-feature';
import { markdownCodec } from '../../../src/infrastructure/markdown';
import { failure, success } from '../../../src/domain/outcome';
import { entityFixture } from '../entity-fixture';

function fixture() {
  const f = entityFixture(); let id = 0;
  const runtime = createNoteFeatures({ storage: f.storage, codec: markdownCodec, events: f.events, errors: f.errors,
    newId: () => 'generated-' + ++id, now: () => '2026-09-23T00:00:00.000Z' }, register => ({ item: register(${key}Feature) }));
  const pinia = createPinia(); const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: { authoring: messages.en } } });
  let model!: ReturnType<typeof ${composable}>;
  const wrapper = mount(defineComponent({ setup() { model = ${composable}(runtime.repositories.item); return () => h('div'); } }), { global: { plugins: [pinia, i18n] } });
  return { ...f, model, wrapper, dispose() { wrapper.unmount(); disposePinia(pinia); i18n.dispose(); runtime.dispose(); } };
}
it('creates two distinct notes through the real action, validates, and never announces failed writes', async () => {
  const f = fixture();
  try {
    await f.model.create(); expect(f.create).not.toHaveBeenCalled();
    f.model.model.draft = 'First'; await f.model.create();
    f.model.model.draft = 'Second'; await f.model.create();
    expect(f.create).toHaveBeenCalledTimes(2); expect(f.files.size).toBe(2);
    expect([...f.files.values()].some(bytes => bytes.includes('# First'))).toBe(true);
    expect([...f.files.values()].some(bytes => bytes.includes('# Second'))).toBe(true);
    f.create.mockResolvedValueOnce(failure('storage', 'error.write'));
    f.model.model.draft = 'Retained'; await f.model.create();
    expect(f.model.model.draft).toBe('Retained'); expect(f.model.feedback.value).toBe('error.write');
    expect(f.model.busy.value).toBe(false); expect(f.model.blocked.value).toBe(false);
  } finally { f.dispose(); }
});
it('blocks uncertain writes until the view is deliberately reopened', async () => {
  const f = fixture();
  try {
    f.create.mockResolvedValueOnce(failure('uncertain', 'error.uncertain'));
    f.model.model.draft = 'Uncertain'; await f.model.create();
    expect(f.model.blocked.value).toBe(true); expect(f.model.feedback.value).toBe('error.uncertain');
    expect(f.model.destination.value).toBe(${key}Feature.defaultFolder + '/Uncertain.md');
    await f.model.create(); expect(f.create).toHaveBeenCalledOnce();
    expect(f.model.destination.value).toBe(${key}Feature.defaultFolder + '/Uncertain.md');
  } finally { f.dispose(); }
});
it('keeps in-flight writes owned and suppresses view updates after unmount', async () => {
  const f = fixture(); let release!: () => void;
  try {
    f.create.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(success(undefined)); }));
    f.model.model.draft = 'Deferred'; const pending = f.model.create();
    await vi.waitFor(() => expect(f.create).toHaveBeenCalledOnce());
    await f.model.create(); expect(f.create).toHaveBeenCalledOnce();
    f.wrapper.unmount(); release(); await pending;
    expect(f.model.model.draft).toBe('Deferred'); expect(f.model.feedback.value).toBe('');
    await f.model.create(); expect(f.create).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});
`);
}
