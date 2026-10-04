// @vitest-environment happy-dom
import { it, expect, vi } from 'vitest';
import { defineComponent, h, nextTick, reactive, resolveComponent, type App } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import UFormField from '@nuxt/ui/components/FormField.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import { useVisual, provideVisualContext, type VisualContext, type VisualPort } from "../../src/generated/presentation/composables/use-visual.ts";
import type { VisualPageSpec, VisualRequest } from "../../src/generated/domain/visual-runtime.ts";
import type { UiNode, VisualAction, Scenario } from "../../src/generated/domain/visual/visual-ir.mjs";
const button = (id: string, actions: VisualAction[]): UiNode => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-button' }, props: {}, slots: {}, events: [{ id, event: 'click', label: 'Run ' + id, notes: '', acceptance: '', actions }] });
const control = (id: string, kind: string, entryId = 'u-input', maxBytes?: number): UiNode => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props: {}, slots: {}, events: [], control: { kind, ...(maxBytes ? { maxBytes } : {}) } });
const shown = (id: string, nodeId: string): UiNode => ({ id, kind: 'text', role: 'p', value: { kind: 'state', nodeId } });
const page = (root: UiNode[], scenarios: Scenario[] = []): VisualPageSpec => ({ kind: 'page', id: 'vp-runtime', ownerId: 'surface', name: 'Runtime', root, scenarios, notes: '' });
const port = (run: VisualPort['run'], operationId = 'save'): VisualPort => ({ sourceId: 'source', operationId, direction: 'write', requiresInput: true, data: null, pending: false, error: null, run });
function subject(context: VisualContext, spec: VisualPageSpec, props: Record<string, unknown> = {}) {
  return mount(defineComponent({ setup: () => ({ model: useVisual(spec, props, () => {}) }), render: () => null }), { global: { plugins: [{ install(app: App) { provideVisualContext(app, context); } }] } });
}
function update(model: ReturnType<typeof useVisual>, id: string, value: unknown): void {
  const handler = model.props(id)['onUpdate:modelValue']; if (typeof handler !== 'function') throw new Error('NOT_A_CONTROL'); handler(value);
}
const wrong = async (): Promise<unknown> => { throw new Error('WRONG_HANDLER'); };
it('value effects replace invalid raw drafts while preserving typed mapped actions', async () => {
  const run = vi.fn(async (_input?: unknown) => ({ ok: true }));
  const wrapper = subject({ ports: [port(run)], navigate: () => {}, handle: wrong }, page([control('amount', 'number'), button('fix', [{ kind: 'set-value', nodeId: 'amount', value: 0 }]), button('save', [{ kind: 'source', sourceId: 'source', operationId: 'save', input: { kind: 'draft', nodeId: 'amount' } }])]));
  try { const model = wrapper.vm.model; update(model, 'amount', 'invalid'); expect(model.errors.amount).toMatch(/valid number/);
    model.on('fix').click!(); await flushPromises(); expect(model.props('amount').modelValue).toBe(0); expect(model.errors.amount).toBeUndefined();
    model.on('save').click!(); await flushPromises(); expect(run).toHaveBeenCalledExactlyOnceWith(0);
  } finally { wrapper.unmount(); }
});
it('saved fixture scenarios never execute a real source action', async () => {
  const run = vi.fn(async (_input?: unknown) => ({ ok: true }));
  const design = page([control('input', 'text'), button('save', [{ kind: 'source', sourceId: 'source', operationId: 'save', input: { kind: 'draft', nodeId: 'input' } }])], [{ id: 'review', name: 'Review', state: 'default', width: 'wide', values: { input: 'fixture' }, bindings: [] }]);
  const wrapper = subject({ ports: [port(run)], navigate: () => {}, handle: wrong }, design, { designScenario: 'review' });
  try { const model = wrapper.vm.model; model.on('save').click!(); await flushPromises();
    expect(run).not.toHaveBeenCalled(); expect(model.props('input').modelValue).toBe('fixture'); expect(model.message.value).toContain('retained');
  } finally { wrapper.unmount(); }
});
it('typed drafts map false and zero to a source call and retain raw invalid input', async () => {
  const run = vi.fn(async (_input?: unknown) => ({ ok: false }));
  const save = button('save', [{ kind: 'source', sourceId: 'source', operationId: 'save', input: { kind: 'object', fields: { amount: { kind: 'draft', nodeId: 'amount' }, enabled: { kind: 'draft', nodeId: 'enabled' } } } }]);
  const wrapper = subject({ ports: [port(run)], navigate: () => {}, handle: wrong }, page([control('amount', 'number'), control('enabled', 'checkbox', 'u-checkbox'), save]));
  try { const model = wrapper.vm.model; update(model, 'amount', '0'); update(model, 'enabled', false);
    model.on('save').click!(); await flushPromises(); expect(run).toHaveBeenCalledExactlyOnceWith({ amount: 0, enabled: false }); expect(model.message.value).toContain('retained');
    update(model, 'amount', 'invalid'); expect(model.props('amount').modelValue).toBe('invalid'); expect(model.errors.amount).toMatch(/valid number/);
    model.on('save').click!(); await flushPromises(); expect(run).toHaveBeenCalledTimes(1); expect(model.message.value).toContain('Correct the input errors');
  } finally { wrapper.unmount(); }
});
it('JSON controls are byte-bounded, keep the last valid value and ignore input after disposal', async () => {
  const wrapper = subject({ ports: [], navigate: () => {}, handle: async () => undefined }, page([control('json', 'json-file', 'u-textarea', 20), shown('shown', 'json')]));
  const model = wrapper.vm.model;
  update(model, 'json', JSON.stringify({ new: true })); expect(model.text('shown')).toBe(JSON.stringify({ new: true }, null, 2));
  update(model, 'json', JSON.stringify({ tooLarge: 'x'.repeat(40) })); expect(model.errors.json).toBeDefined(); expect(model.text('shown')).toBe(JSON.stringify({ new: true }, null, 2));
  update(model, 'json', '{bad}'); expect(model.text('shown')).toBe(JSON.stringify({ new: true }, null, 2));
  update(model, 'json', ''); expect(model.errors.json).toBeUndefined(); expect(model.text('shown')).toBe('');
  wrapper.unmount(); update(model, 'json', JSON.stringify({ late: true })); expect(model.text('shown')).toBe('');
});
it('retains drafts and reports unimplemented behavior without pretending success', async () => {
  const wrapper = subject({ ports: [], navigate: () => {}, handle: async () => { throw new Error('NOT_IMPLEMENTED: change'); } }, page([control('input', 'text'), button('change', [])]));
  try { const model = wrapper.vm.model; update(model, 'input', 'Preserve me'); model.on('change').click!(); await flushPromises();
    expect(model.props('input').modelValue).toBe('Preserve me'); expect(model.state.value).toBe('error'); expect(model.message.value).toBe('Interaction implementation required.');
  } finally { wrapper.unmount(); }
});
it('ignores duplicate dispatch while pending and late results after unmount', async () => {
  let finish: () => void = () => {}; const handle = vi.fn((_request: VisualRequest) => new Promise<void>(resolve => { finish = resolve; }));
  const wrapper = subject({ ports: [], navigate: () => {}, handle }, page([button('change', [])])); const model = wrapper.vm.model;
  model.on('change').click!(); model.on('change').click!(); expect(handle).toHaveBeenCalledOnce();
  expect(model.state.value).toBe('loading'); wrapper.unmount(); finish(); await flushPromises();
  model.on('change').click!(); expect(handle).toHaveBeenCalledOnce(); expect(model.message.value).toBe('');
});
it('runs mixed actions in authored order and stops at the first failing action', async () => {
  for (const ok of [true, false]) {
    const seen: unknown[] = [], navigated: string[] = [], note: UiNode = { id: 'note', kind: 'text', role: 'p', value: { kind: 'literal', value: 'Note' } };
    const run = vi.fn(async (input?: unknown) => { seen.push([input, wrapper.vm.model.visible('note')]); return { ok }; });
    const go = button('go', [{ kind: 'set-value', nodeId: 'input', value: 'typed' }, { kind: 'source', sourceId: 'source', operationId: 'save', input: { kind: 'draft', nodeId: 'input' } }, { kind: 'toggle', nodeId: 'note' }, { kind: 'navigate', surfaceId: 'next' }]);
    const wrapper = subject({ ports: [port(run)], navigate: target => { navigated.push(target); }, handle: wrong }, page([control('input', 'text'), note, go]));
    try { const model = wrapper.vm.model; model.on('go').click!(); await flushPromises();
      expect(seen).toEqual([['typed', true]]); expect(model.visible('note')).toBe(!ok); expect(navigated).toEqual(ok ? ['next'] : []);
    } finally { wrapper.unmount(); }
  }
});
it('dispatches menu item data once and ignores disabled, non-action and disposed entries', async () => {
  const original = [[{ id: 'open', label: 'Open' }, { id: 'disabled', label: 'Disabled', disabled: true }, { type: 'separator' }]];
  const menu: UiNode = { id: 'menu', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-dropdown-menu' }, props: { items: { kind: 'literal', value: original } }, slots: {},
    events: [{ id: 'select', event: 'item:select', label: 'Select item', notes: '', acceptance: '', actions: [{ kind: 'navigate', surfaceId: 'next' }] }] };
  const navigate = vi.fn(), wrapper = subject({ ports: [], navigate, handle: wrong }, page([menu]));
  const items = wrapper.vm.model.props('menu').items;
  if (!Array.isArray(items) || !Array.isArray(items[0])) throw new Error('MENU_FIXTURE');
  const [active, disabled, separator] = items[0];
  if (![active, disabled, separator].every(item => item && typeof item.onSelect === 'function')) throw new Error('MENU_ADAPTER');
  try { disabled.onSelect(); separator.onSelect(); expect(navigate).not.toHaveBeenCalled();
    active.onSelect(); await flushPromises(); expect(navigate).toHaveBeenCalledExactlyOnceWith('next');
    expect(Object.hasOwn(original[0]![0]!, 'onSelect')).toBe(false); expect(wrapper.vm.model.on('menu')['item:select']).toBeUndefined();
  } finally { wrapper.unmount(); }
  active.onSelect(); expect(navigate).toHaveBeenCalledTimes(1);
});
it('uses typed initial state bindings without recursing on uninitialized cycles', () => {
  const a = control('a', 'text'), b = control('b', 'text'), initial = control('initial', 'checkbox', 'u-checkbox');
  if (a.kind !== 'component' || b.kind !== 'component' || initial.kind !== 'component') throw new Error('FIXTURE');
  a.props.modelValue = { kind: 'state', nodeId: 'b' }; b.props.modelValue = { kind: 'state', nodeId: 'a' };
  initial.props.modelValue = { kind: 'literal', value: false };
  const wrapper = subject({ ports: [], navigate: () => {}, handle: wrong }, page([a, b, initial, shown('initial-text', 'initial')]));
  try { expect(wrapper.vm.model.props('a').modelValue).toBeUndefined(); expect(wrapper.vm.model.text('initial-text')).toBe('false'); }
  finally { wrapper.unmount(); }
});
for (const entryId of ['u-modal', 'u-drawer']) it(entryId + ' preserves explicit two-way open state and lifecycle boundaries', async () => {
  const checked = control('open', 'checkbox', 'u-checkbox');
  if (checked.kind !== 'component') throw new Error('FIXTURE'); checked.props.modelValue = { kind: 'literal', value: false };
  const overlay: UiNode = { id: 'overlay', kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props: { open: { kind: 'state', nodeId: 'open' } }, slots: {}, events: [] };
  const wrapper = subject({ ports: [], navigate: () => {}, handle: wrong }, page([checked, overlay, button('show', [{ kind: 'set-value', nodeId: 'open', value: true }])]));
  const model = wrapper.vm.model, change = model.props('overlay')['onUpdate:open'];
  if (typeof change !== 'function') throw new Error('NO_OPEN_BINDING');
  try {
    expect(model.props('overlay').open).toBe(false); model.on('show').click!(); await flushPromises();
    change(true); expect(model.props('overlay').open).toBe(true);
    change('false'); expect(model.props('overlay').open).toBe(true);
    change(false); expect(model.props('overlay').open).toBe(false);
    expect(model.message.value).toBe('');
  } finally { wrapper.unmount(); }
  change(true); expect(model.props('overlay').open).toBe(false);
  const disabled = subject({ ports: [], navigate: () => {}, handle: wrong }, page([checked, overlay]), { designState: 'disabled' });
  try { const ignored = disabled.vm.model.props('overlay')['onUpdate:open']; if (typeof ignored === 'function') ignored(true);
    expect(disabled.vm.model.props('overlay').open).toBe(false);
  } finally { disabled.unmount(); }
});
it('typed controls expose native input types and independent select options', () => {
  const select = { ...control('select', 'select', 'u-select'), control: { kind: 'select', options: [{ label: 'Alpha', value: 'alpha' }, { label: 'Beta', value: 'beta' }] } };
  const wrapper = subject({ ports: [], navigate: () => {}, handle: wrong }, page([control('number', 'number'), control('date', 'date'), control('date-time', 'datetime-local'), select]));
  try { const model = wrapper.vm.model;
    expect(model.props('number').type).toBe('number'); expect(model.props('date').type).toBe('date'); expect(model.props('date-time').type).toBe('datetime-local');
    expect(model.props('select').items).toEqual(select.control.options); expect(model.props('select').items).not.toBe(select.control.options);
    update(model, 'select', 'beta'); expect(model.errors.select).toBeUndefined();
    update(model, 'select', 'other'); expect(model.errors.select).toMatch(/valid select/);
  } finally { wrapper.unmount(); }
});
it('JSON file input parses bounded UTF-8 data, preserves valid values, and ignores stale reads', async () => {
  const wrapper = subject({ ports: [], navigate: () => {}, handle: wrong }, page([control('json', 'json-file', 'u-input', 100), shown('read', 'json')]));
  const model = wrapper.vm.model, input = document.createElement('input'); input.type = 'file';
  const change = model.props('json').onChange;
  if (typeof change !== 'function') throw new Error('NO_FILE_HANDLER');
  const choose = (file: File) => { Object.defineProperty(input, 'files', { configurable: true, value: [file] }); change({ target: input }); };
  try {
    expect(model.props('json').type).toBe('file'); expect(model.props('json').accept).toBe('.json,application/json'); expect(model.props('json').modelValue).toBeUndefined();
    choose(new File(['{"ok":true}'], 'good.json')); await flushPromises(); expect(model.text('read')).toContain('true');
    choose(new File(['bad'], 'bad.json')); await flushPromises(); expect(model.errors.json).toMatch(/valid json-file/); expect(model.text('read')).toContain('true');
    choose(new File([' '.repeat(101)], 'large.json')); await flushPromises(); expect(model.errors.json).toMatch(/size limit/); expect(model.text('read')).toContain('true');
    const pending = new File(['{}'], 'pending.json'); let finish!: (value: ArrayBuffer) => void;
    Object.defineProperty(pending, 'arrayBuffer', { value: () => new Promise<ArrayBuffer>(resolve => { finish = resolve; }) });
    choose(pending); choose(new File(['{"new":true}'], 'new.json')); await flushPromises(); finish(new TextEncoder().encode('{"old":true}').buffer); await flushPromises();
    expect(model.text('read')).toContain('new'); expect(model.text('read')).not.toContain('old'); expect(model.errors.json).toBeUndefined();
    choose(new File([new Uint8Array([255])], 'bad-utf8.json')); await flushPromises(); expect(model.errors.json).toMatch(/UTF-8/);
    choose(pending); wrapper.unmount(); finish(new TextEncoder().encode('{"late":true}').buffer); await flushPromises(); expect(model.text('read')).not.toContain('late');
  } finally { wrapper.unmount(); }
});
it('a control inside a labelled form field is announced by the field label, never its catalog node name', () => {
  const email: UiNode = { ...control('email', 'text'), name: 'Input' }, search: UiNode = { ...control('search', 'text'), name: 'Search' };
  const field: UiNode = { id: 'field', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-form-field' }, props: { label: { kind: 'literal', value: 'Email address' } }, slots: { default: [email] }, events: [] };
  const spec = page([field, search]);
  // Components resolve by name as in the generated SFC templates, so the runtime's whole prop record binds like v-bind.
  const wrapper = mount(defineComponent({ components: { UFormField, UInput }, setup() {
    const model = useVisual(spec, {}, () => {});
    return () => { const Field = resolveComponent('UFormField'), Input = resolveComponent('UInput');
      return [h(Field, model.props('field'), { default: () => h(Input, model.props('email')) }), h(Input, model.props('search'))]; };
  } }), { attachTo: document.body, global: { plugins: [{ install(app: App) { provideVisualContext(app, { ports: [], navigate: () => {}, handle: wrong }); } }] } });
  const accessibleName = (input: HTMLInputElement): string => input.getAttribute('aria-label') ?? [...document.querySelectorAll('label')].filter(label => input.id !== '' && label.htmlFor === input.id).map(label => label.textContent?.trim() ?? '').join(' ');
  try { const [named, bare] = wrapper.findAll('input').map(found => found.element);
    if (!(named instanceof HTMLInputElement) || !(bare instanceof HTMLInputElement)) throw new Error('INPUTS_NOT_RENDERED');
    expect(named.getAttribute('aria-label')).toBeNull(); expect(accessibleName(named)).toBe('Email address'); expect(accessibleName(bare)).toBe('Search');
  } finally { wrapper.unmount(); }
});
it('maps source pending, error and empty states without starting a source operation', async () => {
  const run = vi.fn(async (_input?: unknown) => undefined);
  const source = reactive({ ...port(run, 'read'), direction: 'read', requiresInput: false, data: undefined as unknown, pending: false, error: null as string | null });
  const wrapper = subject({ ports: [source], navigate: () => {}, handle: async () => undefined }, page([{ id: 'bound', kind: 'text', role: 'p', value: { kind: 'source', sourceId: 'source', operationId: 'read', field: '' } }]));
  try { const model = wrapper.vm.model; expect(model.state.value).toBe('default');
    source.pending = true; await nextTick(); expect(model.state.value).toBe('loading');
    source.pending = false; source.error = 'failed'; await nextTick(); expect(model.state.value).toBe('error');
    source.error = null; source.data = []; await nextTick(); expect(model.state.value).toBe('empty');
    source.data = [{ title: 'Loaded' }]; await nextTick(); expect(model.state.value).toBe('default');
    expect(run).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); }
});
