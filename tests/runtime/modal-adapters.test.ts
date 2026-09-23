// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';
import { App } from 'obsidian';
import { ModalService } from '../../src/application/modal-service';
import { nativeModalSink } from '../../src/infrastructure/obsidian/modal-sink';
import { browserModalSink } from '../../harness/app/modal-sink';
import { failure, success, type Result } from '../../src/domain/outcome';
import { deferred } from './helpers';
import type { ModalPresentation } from '../../src/application/modal-port';
const native = vi.hoisted(() => ({ modals: [] as { containerEl: HTMLDivElement; contentEl: HTMLDivElement; open: Mock<() => void>; close: Mock<() => void> }[], failOpen: false }));
vi.mock('obsidian', () => ({ App: class {}, Modal: class {
  containerEl = document.createElement('div'); contentEl = document.createElement('div'); titleEl = document.createElement('h2');
  constructor() {
    const content = this.contentEl; content.createEl = <K extends keyof HTMLElementTagNameMap>(tag: K) => { const child = document.createElement(tag); content.append(child); return child; };
    this.containerEl.append(this.titleEl, this.contentEl); native.modals.push(this);
  }
  setTitle(value: string) { this.titleEl.textContent = value; return this; }
  onOpen() {} onClose() {}
  open = vi.fn(() => { document.body.append(this.containerEl); if (native.failOpen) throw new Error('native open'); this.onOpen(); });
  close = vi.fn(() => { this.onClose(); this.containerEl.remove(); });
} }));
beforeEach(() => { native.modals = []; native.failOpen = false; });
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
const request = { owner: 'view', titleKey: 'title', messageKey: 'message' };
it('[MODAL-ADAPTER-01] real native adapter uses public Modal with owned safe text, validation and focus restoration', async () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const errors = { report: vi.fn() }; const service = new ModalService(nativeModalSink(new App()), key => key, errors);
  const barrier = deferred<Result<string>>();
  try {
    const pending = service.prompt({ ...request, message: undefined, messageKey: 'message', validate: () => barrier.promise });
    const modal = native.modals[0]; const input = modal?.contentEl.querySelector('input'); const form = modal?.contentEl.querySelector('form');
    expect(document.activeElement).toBe(input); if (!input || !form) throw new Error('MISSING_NATIVE_CONTROLS'); input.value = '<script>safe</script>';
    const backwards = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }); form.dispatchEvent(backwards);
    expect(backwards.defaultPrevented).toBe(true); expect(document.activeElement).toBe(form.querySelector('button[type="submit"]'));
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); form.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true); expect(document.activeElement).toBe(input);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); form.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(false);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); expect(input.disabled).toBe(true); expect(form.getAttribute('aria-busy')).toBe('true');
    barrier.resolve(failure('validation', 'invalid')); await Promise.resolve(); await Promise.resolve();
    expect(input.value).toBe('<script>safe</script>'); expect(input.disabled).toBe(false); expect(input.getAttribute('aria-invalid')).toBe('true'); expect(document.activeElement).toBe(input);
    modal?.close(); expect(await pending).toEqual({ status: 'cancelled' }); expect(modal?.close).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('script')).toBeNull(); expect(errors.report).not.toHaveBeenCalled();
  } finally { service.dispose(); }
});
it('[MODAL-ADAPTER-02] browser dialog shares form outcomes, Escape cancellation and input/error state with native adapter', async () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const errors = { report: vi.fn() }; const service = new ModalService(browserModalSink(), key => key, errors);
  try {
    const pending = service.prompt({ ...request, validate: value => value ? success(value) : failure('validation', 'invalid') });
    const dialog = document.querySelector('dialog'); const form = dialog?.querySelector('form'); const input = dialog?.querySelector('input');
    expect(dialog?.open).toBe(true); expect(document.activeElement).toBe(input); if (!form || !input) throw new Error('MISSING_BROWSER_CONTROLS');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); expect(input.getAttribute('aria-invalid')).toBe('true');
    input.value = 'approved'; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); expect(await pending).toEqual({ status: 'confirmed', value: 'approved' });
    expect(document.querySelector('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
    const cancel = service.confirm(request); document.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true })); expect(await cancel).toEqual({ status: 'cancelled' });
    const info = service.info({ owner: 'report', titleKey: 'title', message: '{\n"safe":"<b>"\n}' });
    expect(document.querySelector('.shell-modal-copy')?.textContent).toBe('{\n"safe":"<b>"\n}'); expect(document.querySelector('b')).toBeNull();
    document.querySelector<HTMLButtonElement>('button[type="submit"]')?.click(); expect(await info).toEqual({ status: 'confirmed', value: undefined });
    expect(errors.report).not.toHaveBeenCalled();
  } finally { service.dispose(); }
});
it('[MODAL-ADAPTER-03] partial host openings and closing errors leave no owned dialog and never become confirmation', async () => {
  const errors = { report: vi.fn() }; native.failOpen = true;
  const service = new ModalService(nativeModalSink(new App()), key => key, errors);
  expect(await service.confirm(request)).toMatchObject({ status: 'failed' }); expect(native.modals[0]?.close).toHaveBeenCalledOnce(); expect(document.body.children.length).toBe(0); service.dispose();
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementationOnce(() => { throw new Error('DOM open'); });
  const browser = new ModalService(browserModalSink(), key => key, errors);
  expect(await browser.info(request)).toMatchObject({ status: 'failed' }); expect(document.querySelector('dialog')).toBeNull();
  const pending = browser.confirm(request); vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementationOnce(() => { throw new Error('DOM close'); });
  browser.closeOwner(request.owner); expect(await pending).toEqual({ status: 'cancelled' }); expect(document.querySelector('dialog')).toBeNull(); browser.dispose();
  expect(errors.report.mock.calls.map(([code]) => code)).toEqual(['modal.open', 'modal.open', 'modal.close']);
});
it('[MODAL-ADAPTER-04] adapter handles and controls cannot revive after direct disposal', () => {
  const presentation: ModalPresentation = { kind: 'confirm', title: 'Title', message: 'Message', confirmLabel: 'Confirm', cancelLabel: 'Cancel', inputLabel: 'Value', busyLabel: 'Busy', initialValue: '', maxLength: 100 };
  for (const sink of [nativeModalSink(new App()), browserModalSink()]) {
    const callbacks = { submit: vi.fn(), cancel: vi.fn(), failed: vi.fn() }; const handle = sink.open(presentation, callbacks);
    const button = document.querySelector<HTMLButtonElement>('button[type="button"]'); button?.click(); expect(callbacks.cancel).toHaveBeenCalledOnce();
    handle.update({ busy: true, error: null }); handle.close(); handle.close(); handle.update({ busy: false, error: 'late' });
    const count = callbacks.cancel.mock.calls.length; button?.click(); expect(callbacks.cancel).toHaveBeenCalledTimes(count);
    expect(document.querySelector('form')).toBeNull();
  }
});
it('[MODAL-ADAPTER-05] failed focus restoration still settles and cleans an externally closed dialog', async () => {
  for (const sink of [nativeModalSink(new App()), browserModalSink()]) {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const errors = { report: vi.fn() }; const service = new ModalService(sink, key => key, errors); const pending = service.confirm(request);
    const focus = vi.spyOn(trigger, 'focus').mockImplementationOnce(() => { throw new Error('owner window unavailable'); });
    const dialog = document.querySelector('dialog'); if (dialog) dialog.dispatchEvent(new Event('cancel', { cancelable: true })); else native.modals.at(-1)?.close();
    expect(await pending).toMatchObject({ status: 'failed' }); expect(document.querySelector('form')).toBeNull();
    expect(errors.report).toHaveBeenCalledExactlyOnceWith('modal.close', 'modal.close'); focus.mockRestore(); service.dispose(); trigger.remove();
  }
});
