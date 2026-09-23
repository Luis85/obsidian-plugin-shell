import { vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createServices } from '../../src/bootstrap/services';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
import { host } from './helpers';
import { memoryStorage } from './memory-storage';
import { browserModalSink } from '../../harness/app/modal-sink';
export async function componentFixture(raw: unknown = null) {
  const { files, create: write, storage } = memoryStorage();
  const save = vi.fn(async (_value: unknown): Promise<void> => undefined);
  const observe = vi.fn(); const native = host(); let sequence = 0;
  const modalSink = browserModalSink();
  const services = await createServices({ documents: storage, host: native, modals: modalSink, settings: { load: async () => raw, save },
    local: { get: () => null, set: () => undefined }, newId: () => `component-${++sequence}`, now: () => '2026-09-22T12:00:00.000Z', observeError: observe });
  const root = document.createElement('div'); document.body.append(root);
  const actions = vi.fn(); const close = mountShowcase(root, services, actions);
  await settle();
  return { root, services, storage, modalSink, write, save, files, observe, native, actions, close, dispose() { close(); services.dispose(); root.remove(); } };
}
export async function settle() { await nextTick(); await flushPromises(); await nextTick(); }
export function button(root: HTMLElement, text: string): HTMLButtonElement {
  const result = Array.from(root.querySelectorAll('button')).find(item => item.textContent?.trim() === text);
  if (!result) throw new Error(`BUTTON_NOT_FOUND: ${text}`); return result;
}
export function field(root: HTMLElement, name: string): HTMLInputElement {
  const result = root.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!result) throw new Error(`FIELD_NOT_FOUND: ${name}`); return result;
}
export async function input(element: HTMLInputElement, value: string) { element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); await settle(); }
export async function click(root: HTMLElement, text: string) { button(root, text).click(); await settle(); }
