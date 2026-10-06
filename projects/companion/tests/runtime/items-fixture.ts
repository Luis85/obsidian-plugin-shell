import { vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { createServices } from '../../src/bootstrap/services';
import { contextKey } from '../../src/presentation/context/use-services';
import { useItems } from '../../src/presentation/stores/items';
import { browserModalSink } from '../../harness/app/modal-sink';
import { memoryStorage } from './memory-storage';
import { host } from './helpers';

let runtimeSequence = 0;
export async function itemsFixture(initial: unknown = null) {
  let raw: unknown = initial; let sequence = 0; const runtime = ++runtimeSequence;
  const storage = { load: vi.fn(async () => raw), save: vi.fn(async (value: unknown) => { raw = structuredClone(value); }) };
  const memory = memoryStorage(); const observe = vi.fn();
  const services = await createServices({ documents: memory.storage, host: host(), settings: storage, modals: browserModalSink(),
    local: { get: () => null, set: () => undefined }, newId: () => `items-${runtime}-${++sequence}`, now: () => '2026-09-23T12:00:00.000Z', observeError: observe });
  const releases: (() => void)[] = [];
  function view() {
    const pinia = createPinia(); let state: ReturnType<typeof useItems> | undefined;
    const root = document.createElement('div'); document.body.append(root);
    const app = createApp({ setup() { state = useItems(); return () => null; } });
    app.use(pinia); app.provide(contextKey, services); app.mount(root);
    if (!state) throw new Error('Missing item state');
    let closed = false;
    const close = () => { if (closed) return; closed = true; app.unmount(); disposePinia(pinia); root.remove(); };
    releases.push(close);
    return { state, close };
  }
  return { services, storage, observe, memory, view, raw: () => raw,
    dispose() { for (const release of releases) release(); services.dispose(); },
  };
}
export async function modalDecision(confirm: boolean) {
  await flushPromises();
  const dialog = document.querySelector('dialog');
  if (!dialog) throw new Error('Missing item confirmation');
  const buttons = Array.from(dialog.querySelectorAll('button'));
  const button = buttons.find(value => value.textContent === (confirm ? 'Delete item' : 'Cancel'));
  if (!button) throw new Error('Missing confirmation action');
  button.click(); await flushPromises();
}
