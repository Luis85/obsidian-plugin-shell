import { success, failure } from '../../src/domain/outcome';
import type { ServiceAdapters } from '../../src/application/ports';
const prefix = 'plugin-shell:harness:v1:';
export function browserAdapters() {
  let failWrite = false;
  let failOpen = false;
  let failSettings = false;
  let failNotice = false;
  let pauseSettings = false;
  let finishSettings: (() => void) | undefined;

  const dialogs = new Set<HTMLDialogElement>();
  const disposers = new Set<() => void>();
  const errors: { code: string; operation: string }[] = [];
  const read = (key: string): unknown => { const value = localStorage.getItem(prefix + key); return value === null ? null : JSON.parse(value); };
  const write = (key: string, value: unknown) => localStorage.setItem(prefix + key, JSON.stringify(value));
  const files = () => (read('files') ?? {}) as Record<string, string>;
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
    async openDocument(path) { if (failOpen) return failure('storage', 'error.open'); const value = files()[path]; if (value === undefined) return failure('storage', 'error.open'); dialog(path, value, true); return success(undefined); },
    showModal: dialog,
    notice(text, duration = 4000) {
      if (failNotice) throw new Error('FIXTURE_NOTICE_FAILURE');
      const el = document.createElement('div'); el.className = 'harness-native-notice'; el.textContent = text; el.setAttribute('role', 'status');
      let container = document.querySelector('.harness-native-notices');
      if (!container) { container = document.createElement('div'); container.className = 'harness-native-notices'; document.body.append(container); }
      container.append(el);
      const hide = () => { clearTimeout(timer); el.remove(); disposers.delete(hide); };
      const timer = setTimeout(hide, duration); disposers.add(hide); return hide;
    },
  };
  const adapters: ServiceAdapters = {
    settings: { async load() { return read('settings'); }, async save(value) { if (pauseSettings) await new Promise<void>(resolve => { finishSettings = resolve; }); if (failSettings) throw new Error('FIXTURE_SETTINGS_FAILURE'); write('settings', value); } },
    local: { get: read, set: write }, host,
    documents: { async create(path, markdown) { if (failWrite) return failure('storage', 'error.write'); const current = files(); if (current[path] !== undefined) return failure('conflict', 'error.conflict'); write('files', { ...current, [path]: markdown }); return success(undefined); } },
    newId: () => { const sequence = Number(read('sequence') ?? 0) + 1; write('sequence', sequence); return `demo-${String(sequence).padStart(4, '0')}`; },
    now: () => '2026-09-22T12:00:00.000Z',
    observeError: entry => errors.push({ code: entry.code, operation: entry.operation }),
  };
  return { adapters, files, errors,
    fault(kind: 'write' | 'open' | 'settings' | 'settings-pause' | 'notice' | 'none') { failWrite = kind === 'write'; failOpen = kind === 'open'; failSettings = kind === 'settings'; failNotice = kind === 'notice'; pauseSettings = kind === 'settings-pause'; if (!pauseSettings) { finishSettings?.(); finishSettings = undefined; } },
    dispose() { pauseSettings = false; finishSettings?.(); finishSettings = undefined; for (const hide of [...disposers]) hide(); for (const el of dialogs) el.close(); },
  };
}
