// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { expect, it } from 'vitest';
import AuthoringHost from '../../src/presentation/components/AuthoringHost.vue';
import { authoringContextKey, useAuthoring } from '../../src/presentation/context/authoring-context';
import { assembleAuthoringPanels } from '../../src/bootstrap/authoring';
import { mergeAuthoringMessages } from '../../src/bootstrap/authoring-locales';
import { authoringFixture } from './authoring-fixture';

it('assembles registered typed props, rejects duplicate IDs and mounts through owned injection', async () => {
  const f = await authoringFixture();
  const component = defineComponent({ props: { label: String }, setup(props) { return () => h('p', props.label); } });
  const definition = { id: 'example', component, props: (value: { label: string }) => ({ label: value.label }) };
  const panels = assembleAuthoringPanels([definition], { label: 'Feature content' });
  expect(() => assembleAuthoringPanels([definition, definition], { label: 'duplicate' })).toThrow('AUTHORING_DUPLICATE_PANEL');
  const wrapper = mount(AuthoringHost, { global: { provide: { [authoringContextKey as symbol]: { services: f.services, panels } } } });
  expect(wrapper.text()).toBe('Feature content'); wrapper.unmount(); f.dispose();
});
it('fails an unprovided authoring view explicitly', () => {
  const missing = defineComponent({ setup() { useAuthoring(); return () => h('div'); } });
  expect(() => mount(missing, { global: { config: { warnHandler() {} } } })).toThrow('AUTHORING_CONTEXT_MISSING');
});
it('merges complete dictionaries and rejects missing translations or collisions', () => {
  const module = { en: { sample: { title: 'Example' } }, de: { sample: { title: 'Beispiel' } } };
  expect(mergeAuthoringMessages([module])).toEqual(module);
  expect(() => mergeAuthoringMessages([module, module])).toThrow('AUTHORING_LOCALE_COLLISION');
  expect(() => mergeAuthoringMessages([{ en: { sample: {} }, de: {} }])).toThrow('AUTHORING_LOCALE_NAMESPACES');
  expect(() => mergeAuthoringMessages([{ en: { sample: { title: 'Example' } }, de: { sample: {} } }])).toThrow('AUTHORING_LOCALE_KEYS');
  expect(() => mergeAuthoringMessages([{ en: { constructor: {} }, de: { constructor: {} } }])).toThrow('AUTHORING_LOCALE_NAMESPACE');
});
