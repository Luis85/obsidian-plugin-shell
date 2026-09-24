import { success, failure } from '../../src/domain/outcome';
import type { ServiceAdapters } from '../../src/application/ports';
import { pluginIdentity } from '../../src/infrastructure/plugin-identity';
import { browserDocumentStorage } from './document-storage';
import { browserNotification } from './notification-sink';
import { lifecycleResources } from './lifecycle-resources';
import type { HarnessFault } from './test-api';
const prefix = `${pluginIdentity.id}:harness:v1:`;
export function browserAdapters() {
  let failWrite = false;
  let failOpen = false;
  let failSettings = false;
  let failNotice = false;
  let pauseSettings = false;
  let finishSettings: (() => void) | undefined;
  let pauseWrite = false; let finishWrite: (() => void) | undefined;
  let pauseOpen = false; let finishOpen: (() => void) | undefined;
  let openCalls = 0; let disposed = false; const resources = lifecycleResources();

  const dialogs = new Set<HTMLDialogElement>();
  const disposers = new Set<() => void>();
  const errors: { code: string; operation: string }[] = [];
  const read = (key: string): unknown => { const value = localStorage.getItem(prefix + key); return value === null ? null : JSON.parse(value); };
  const write = (key: string, value: unknown) => localStorage.setItem(prefix + key, JSON.stringify(value));
  const files = (): Record<string, string> => {
    const value = read('files') ?? {};
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('INVALID_FILES');
    const entries = Object.entries(value);
    const result: Record<string, string> = {};
    for (const [path, content] of entries) {
      if (typeof content !== 'string') throw new Error('INVALID_FILES');
      Object.defineProperty(result, path, { value: content, enumerable: true, writable: true, configurable: true });
    }
    return result;
  };
  function dialog(title: string, text: string, code = false) {
    const previous = document.activeElement as HTMLElement | null;
    const el = document.createElement('dialog'); el.className = 'harness-modal';
    const heading = document.createElement('h2'); heading.textContent = title;
    const content = document.createElement(code ? 'pre' : 'p'); content.textContent = text;
    const button = document.createElement('button'); button.textContent = 'Close'; button.type = 'button';
    el.append(heading, content, button); document.body.append(el); dialogs.add(el);
    const close = () => { dialogs.delete(el); el.remove(); previous?.focus(); };
    button.onclick = () => el.close(); el.addEventListener('close', close, { once: true }); el.showModal(); button.focus();
  }
  const host: ServiceAdapters['host'] = {
    kind: 'browser',
    async openDocument(path) { openCalls++; if (pauseOpen) await new Promise<void>(resolve => { finishOpen = resolve; }); if (disposed) return failure('disposed', 'error.disposed'); if (failOpen) return failure('storage', 'error.open'); const value = files()[path]; if (value === undefined) return failure('storage', 'error.open'); dialog(path, value, true); return success(undefined); },
    showModal: dialog,
    notification(text, actions) {
      if (failNotice) throw new Error('FIXTURE_NOTICE_FAILURE');
      return resources.notification((message, choices) => browserNotification(message, choices, close => { disposers.add(close); return () => { disposers.delete(close); }; }), text, actions);
    },
    notice(text, duration = 4000) {
      if (failNotice) throw new Error('FIXTURE_NOTICE_FAILURE');
      const el = document.createElement('div'); el.className = 'harness-native-notice'; el.textContent = text; el.setAttribute('role', 'status');
      let container = document.querySelector('.harness-native-notices');
      if (!container) { container = document.createElement('div'); container.className = 'harness-native-notices'; document.body.append(container); }
      container.append(el);
      const hide = () => { clearTimeout(timer); el.remove(); disposers.delete(hide); };
      const timer = duration > 0 ? setTimeout(hide, duration) : undefined; disposers.add(hide); return hide;
    },
  };
  const documents = browserDocumentStorage(files, current => write('files', current), () => failWrite);
  const adapters: ServiceAdapters = {
    settings: { async load() { return read('settings'); }, async read() { return localStorage.getItem(prefix + 'settings'); }, async save(value) { if (pauseSettings) await new Promise<void>(resolve => { finishSettings = resolve; }); if (failSettings) throw new Error('FIXTURE_SETTINGS_FAILURE'); write('settings', value); } },
    local: { get: read, set: write }, host,
    modals: resources.modals, scheduler: resources.scheduler,
    documents: { ...documents, async create(path, markdown) { if (pauseWrite) await new Promise<void>(resolve => { finishWrite = resolve; }); return documents.create(path, markdown); } },
    newId: () => { const sequence = Number(read('sequence') ?? 0) + 1; write('sequence', sequence); return `demo-${String(sequence).padStart(4, '0')}`; },
    now: () => '2026-09-22T12:00:00.000Z',
    observeError: entry => { errors.push({ code: entry.code, operation: entry.operation }); },
  };
  return { adapters, files, errors, resources: () => ({ ...resources.snapshot(), openDialogs: dialogs.size, openCalls }),
    fault(kind: HarnessFault) {
      failWrite = kind === 'write'; failOpen = kind === 'open'; failSettings = kind === 'settings'; failNotice = kind === 'notice';
      pauseSettings = kind === 'settings-pause'; pauseWrite = kind === 'write-pause'; pauseOpen = kind === 'open-pause';
      if (!pauseSettings) { finishSettings?.(); finishSettings = undefined; }
      if (!pauseWrite) { finishWrite?.(); finishWrite = undefined; }
      if (!pauseOpen) { finishOpen?.(); finishOpen = undefined; }
    },
    dispose() { disposed = true; pauseSettings = false; finishSettings?.(); finishSettings = undefined; finishWrite?.(); finishWrite = undefined; finishOpen?.(); finishOpen = undefined; for (const hide of [...disposers]) hide(); for (const el of dialogs) el.close(); },
  };
}
