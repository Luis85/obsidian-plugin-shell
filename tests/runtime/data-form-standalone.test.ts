// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { flushPromises, mount } from '@vue/test-utils';
import ui from '@nuxt/ui/vue-plugin';
import DataForm from '../../src/presentation/components/forms/DataForm.vue';
import { useDataForm, type DataFormProps } from '../../src/presentation/composables/use-data-form';
import { defineForm, type DataFormValues } from '../../src/features/api';
import en from '../../src/locales/en.json';

afterEach(() => { document.body.replaceChildren(); });
/** A distinct feature-owned definition: every runtime kind, nested binds and help on some fields only. */
const contact = defineForm({
  schemaVersion: 1, id: 'contact-card', version: 2, title: 'Contact card', fields: [
    { id: 'name', kind: 'title', label: 'Name', help: 'Shown on the card' },
    { id: 'age', kind: 'number', label: 'Age', integer: true, min: 0 },
    { id: 'channel', kind: 'select', label: 'Channel', choices: [{ id: 'email', label: 'Email' }, { id: 'phone', label: 'Phone' }] },
    { id: 'topics', kind: 'multi', label: 'Topics', choices: ['a', 'b', 'c'] },
    { id: 'subscribe', kind: 'boolean', label: 'Subscribe', help: 'Weekly digest' },
    { id: 'notes', kind: 'text', label: 'Notes', multiline: true },
    { id: 'address', kind: 'section', label: 'Address', bind: 'address', fields: [
      { id: 'street', kind: 'text', label: 'Street', required: true },
      { id: 'tags', kind: 'list', label: 'Tags', maxItems: 2, help: 'Delivery tags' },
    ] },
  ],
});
const plugins = () => [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } }), ui];
const field = <T extends Element>(root: Element, path: string, selector: string): T => {
  const element = root.querySelector<T>(`[data-field="${path}"] ${selector}`);
  if (!element) throw new Error(`FORM_CONTROL_MISSING: ${path}`);
  return element;
};
async function settle() { await nextTick(); await flushPromises(); await nextTick(); }

describe('DataForm outside the showcase', () => {
  it('[FORMS-14] seeds offered initial values, labels every control and emits the typed value on submit', async () => {
    const initial: DataFormValues = { name: 'Grace', age: 42, channel: 'fax', topics: ['b', 'z'], subscribe: true, address: { tags: ['x', 'y'] } };
    const wrapper = mount(DataForm, { props: { definition: contact, initial, submitLabel: 'Save contact' }, global: { plugins: plugins() }, attachTo: document.body });
    const root: HTMLElement = document.body;
    expect(field<HTMLInputElement>(root, 'name', 'input').value).toBe('Grace');
    expect(field<HTMLInputElement>(root, 'age', 'input').value).toBe('42');
    expect(field<HTMLSelectElement>(root, 'channel', 'select').value).toBe('');
    expect(Array.from(root.querySelectorAll<HTMLInputElement>('[data-field="topics"] input')).map(item => item.checked)).toEqual([false, true, false]);
    expect(field<HTMLInputElement>(root, 'subscribe', 'input').checked).toBe(true);
    expect(field<HTMLTextAreaElement>(root, 'address.tags', 'textarea').value).toBe('x\ny');
    for (const control of Array.from(root.querySelectorAll<HTMLElement>('[data-field] > input, [data-field] select, [data-field] textarea'))) {
      expect(root.querySelector(`label[for="${control.id}"]`), control.id).not.toBeNull();
    }
    expect(field<HTMLInputElement>(root, 'subscribe', 'input').getAttribute('aria-describedby')).toMatch(/subscribe-help$/);
    const age = field<HTMLInputElement>(root, 'age', 'input');
    age.value = '-1'; age.dispatchEvent(new Event('input')); await settle();
    await wrapper.find('form').trigger('submit'); await settle();
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(root.querySelector('[data-field="age"]')?.textContent).toContain('Enter a number of at least 0.');
    expect(root.querySelector('[data-field="address.street"]')?.textContent).toContain('This field is required.');
    expect(document.activeElement).toBe(age);
    age.value = '43'; age.dispatchEvent(new Event('input'));
    const street = field<HTMLInputElement>(root, 'address.street', 'input'); street.value = ' Main 1 '; street.dispatchEvent(new Event('input'));
    const channel = field<HTMLSelectElement>(root, 'channel', 'select'); channel.value = 'email'; channel.dispatchEvent(new Event('change'));
    await settle();
    expect(wrapper.text()).toContain('Save contact');
    await wrapper.find('form').trigger('submit'); await settle();
    expect(wrapper.emitted('submit')).toEqual([[{ name: 'Grace', age: 43, channel: 'email', topics: ['b'], subscribe: true, notes: '', address: { street: 'Main 1', tags: ['x', 'y'] } }]]);
    wrapper.unmount();
  });

  it('[FORMS-15] a disabled form neither submits nor accepts edits', async () => {
    const wrapper = mount(DataForm, { props: { definition: contact, disabled: true }, global: { plugins: plugins() } });
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined();
    await wrapper.find('form').trigger('submit'); await settle();
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Submit');
    wrapper.unmount();
  });

  it('optional selects can be cleared without resetting the rest of the form', async () => {
    const wrapper = mount(DataForm, { props: { definition: contact, initial: { name: 'Grace', address: { street: 'Main 1' } } }, global: { plugins: plugins() } });
    try {
      const select = wrapper.find('[data-field="channel"] select');
      await select.setValue('email');
      expect(select.find('option[value=""]').attributes('disabled')).toBeUndefined();
      await select.setValue('');
      await wrapper.find('form').trigger('submit'); await settle();
      expect(wrapper.emitted('submit')).toEqual([[{ name: 'Grace', topics: [], subscribe: false, notes: '', address: { street: 'Main 1', tags: [] } }]]);
    } finally { wrapper.unmount(); }
  });

  it('choice errors and list instructions are described directly on their controls', async () => {
    const definition = defineForm({ schemaVersion: 1, id: 'accessible-choices', version: 1, title: 'Choices', fields: [
      { id: 'channels', kind: 'multi', label: 'Channels', required: true, help: 'Pick at least one', choices: ['email', 'phone'] },
      { id: 'channel', kind: 'select', label: 'Primary channel', default: 'email', choices: ['email', 'phone'] },
      { id: 'names', kind: 'list', label: 'Names', required: true },
    ] });
    const wrapper = mount(DataForm, { props: { definition }, global: { plugins: plugins() }, attachTo: document.body });
    try {
      await wrapper.find('form').trigger('submit'); await settle();
      for (const control of wrapper.findAll('input, textarea')) {
        const ids = control.attributes('aria-describedby')?.split(' ') ?? [];
        expect(ids).toHaveLength(2);
        expect(ids.map(id => document.getElementById(id)?.textContent)).toContain('This field is required.');
      }
      expect(document.activeElement).toBe(wrapper.find('input').element);
      expect(wrapper.find('textarea').attributes('aria-describedby')).toContain('names-hint');
      expect(wrapper.find('select option[value=""]').attributes('disabled')).toBeDefined();
    } finally { wrapper.unmount(); }
  });

  it('[FORMS-16] the composable tolerates foreign events and unknown paths without inventing values', () => {
    const pinia = createPinia(); const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
    let model: ReturnType<typeof useDataForm> | undefined;
    const props: DataFormProps = { definition: contact };
    const app = createApp({ setup() { model = useDataForm(props, () => undefined); return () => null; } });
    app.use(pinia); app.use(i18n); app.mount(document.createElement('div'));
    try {
      if (!model) throw new Error('MODEL_MISSING');
      model.onText('notes', new Event('change'));
      model.onFlag('subscribe', new Event('change'));
      expect(model.text('notes')).toBe(''); expect(model.flag('subscribe')).toBe(false);
      expect(model.text('unknown')).toBe(''); expect(model.picked('unknown', 'a')).toBe(false);
      model.setText('name', { not: 'text' }); expect(model.text('name')).toBe('');
      model.setText('age', 7); expect(model.text('age')).toBe('7');
      expect(model.describedBy({ field: { id: 'x', kind: 'text', label: 'X' }, path: 'x' })).toBeUndefined();
      expect(model.issue('name')).toBeUndefined(); expect(model.invalid('name')).toBeUndefined();
    } finally { app.unmount(); disposePinia(pinia); }
  });
});
