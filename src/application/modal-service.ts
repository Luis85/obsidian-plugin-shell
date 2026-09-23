import type { Failure, Result } from '../domain/outcome';
import type { ErrorReporter } from './ports';
import type { ModalHandle, ModalSink, ModalState } from './modal-port';
export type ModalOutcome<T> = { readonly status: 'confirmed'; readonly value: T } | { readonly status: 'cancelled' } | { readonly status: 'failed'; readonly error: Failure };
export type ModalRequest = { readonly owner: string; readonly titleKey: string; readonly confirmKey?: string; readonly cancelKey?: string }
  & ({ readonly messageKey: string; readonly message?: never } | { readonly message: string; readonly messageKey?: never });
export type PromptRequest = ModalRequest & { readonly labelKey?: string; readonly initialValue?: string; readonly maxLength?: number; readonly validate?: (value: string) => Result<string> | Promise<Result<string>> };
interface Owned { close(): void }
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value);
/** Owns outcomes/validation/lifetime; adapters own only their native or DOM dialog. */
export class ModalService {
  private disposed = false;
  private readonly owners = new Map<string, Owned>();
  constructor(private readonly sink: ModalSink | undefined, private readonly text: (key: string) => string, private readonly errors: ErrorReporter,
    private readonly validKey: (key: string) => boolean = token) {}
  info(request: ModalRequest): Promise<ModalOutcome<void>> { return this.open(request, 'info', () => undefined); }
  confirm(request: ModalRequest): Promise<ModalOutcome<boolean>> { return this.open(request, 'confirm', () => true); }
  prompt(request: PromptRequest): Promise<ModalOutcome<string>> { return this.open(request, 'prompt', value => value); }
  private failed(code: 'disposed' | 'unexpected' = 'unexpected', key = 'error.unexpected'): ModalOutcome<never> { return { status: 'failed', error: { code, key, effect: 'none' } }; }
  private open<T>(request: PromptRequest, kind: 'info' | 'confirm' | 'prompt', confirmed: (value: string) => T): Promise<ModalOutcome<T>> {
    if (this.disposed) return Promise.resolve(this.failed('disposed', 'error.disposed'));
    try { request = Object.freeze({ ...request }); } catch { this.errors.report('modal.request', 'modal.open'); return Promise.resolve(this.failed()); }
    const maxLength = request.maxLength ?? 1000;
    const confirmKey = request.confirmKey ?? (kind === 'info' ? 'modal.close' : 'modal.confirm'); const cancelKey = request.cancelKey ?? 'modal.cancel';
    const labelKey = request.labelKey ?? 'modal.input';
    const keys = [request.titleKey, confirmKey, cancelKey, labelKey, 'modal.validating', ...(request.messageKey === undefined ? [] : [request.messageKey])];
    let keysValid = false;
    try { keysValid = keys.every(key => token(key) && this.validKey(key)); } catch { this.errors.report('modal.request', 'modal.open'); return Promise.resolve(this.failed()); }
    if (!token(request.owner) || !keysValid || !Number.isInteger(maxLength) || maxLength < 1 || maxLength > 10000
      || typeof (request.initialValue ?? '') !== 'string' || (request.initialValue ?? '').length > maxLength
      || (request.messageKey === undefined && (typeof request.message !== 'string' || request.message.length > 64000))) {
      this.errors.report('modal.request', 'modal.open'); return Promise.resolve(this.failed());
    }
    if (!this.sink) { this.errors.report('modal.unavailable', 'modal.open'); return Promise.resolve(this.failed()); }
    this.closeOwner(request.owner);
    // Host closing callbacks can dispose the runtime or open a successor dialog.
    if (this.disposed) return Promise.resolve(this.failed('disposed', 'error.disposed'));
    if (this.owners.has(request.owner)) return Promise.resolve({ status: 'cancelled' });
    if (this.owners.size >= 16) { this.errors.report('modal.capacity', 'modal.open'); return Promise.resolve(this.failed()); }
    let resolve!: (outcome: ModalOutcome<T>) => void;
    const result = new Promise<ModalOutcome<T>>(done => { resolve = done; });
    let closed = false; let busy = false; let opening = true; let earlyCancel = false; let earlySubmit: { value: unknown } | undefined; let handle: ModalHandle | undefined;
    const closeHandle = () => { const current = handle; handle = undefined; try { current?.close(); } catch { this.errors.report('modal.close', 'modal.close'); } };
    const finish = (outcome: ModalOutcome<T>) => {
      if (closed) return; closed = true;
      if (this.owners.get(request.owner) === owned) this.owners.delete(request.owner);
      closeHandle(); resolve(outcome);
    };
    const owned: Owned = { close: () => finish({ status: 'cancelled' }) }; this.owners.set(request.owner, owned);
    const update = (state: ModalState) => {
      try { handle?.update(state); } catch { this.errors.report('modal.update', 'modal.update'); finish(this.failed()); }
    };
    const submit = async (raw: unknown) => {
      if (closed || busy) return;
      busy = true; update({ busy: true, error: null });
      if (closed) return;
      try {
        if (kind !== 'prompt') { finish({ status: 'confirmed', value: confirmed('') }); return; }
        if (typeof raw !== 'string' || raw.length > maxLength) { update({ busy: false, error: this.text('modal.invalid') }); return; }
        const value = request.validate ? await request.validate(raw) : { ok: true as const, value: raw };
        if (closed) return;
        if (value.ok !== true) {
          const key = value.error.key;
          if (!token(key) || !this.validKey(key)) throw new Error('MODAL_VALIDATION_KEY');
          update({ busy: false, error: this.text(key) }); return;
        }
        const normalized = value.value;
        if (typeof normalized !== 'string' || normalized.length > maxLength) { update({ busy: false, error: this.text('modal.invalid') }); return; }
        finish({ status: 'confirmed', value: confirmed(normalized) });
      } catch { this.errors.report('modal.validation', 'modal.submit'); finish(this.failed()); }
      finally { busy = false; }
    };
    try {
      handle = this.sink.open({ kind, title: this.text(request.titleKey), message: request.messageKey === undefined ? request.message : this.text(request.messageKey),
        confirmLabel: this.text(confirmKey), cancelLabel: this.text(cancelKey), inputLabel: this.text(labelKey), busyLabel: this.text('modal.validating'), initialValue: request.initialValue ?? '', maxLength },
      { submit: value => { if (opening) earlySubmit = { value }; else void submit(value); }, cancel: () => { if (opening) earlyCancel = true; else finish({ status: 'cancelled' }); },
        failed: () => { this.errors.report('modal.close', 'modal.close'); finish(this.failed()); } });
      opening = false;
      if (earlyCancel) finish({ status: 'cancelled' }); else if (earlySubmit) void submit(earlySubmit.value);
      // A synchronous host cancellation during open must still release its handle.
      if (closed) closeHandle();
    } catch { opening = false; this.errors.report('modal.open', 'modal.open'); finish(this.failed()); }
    return result;
  }
  closeOwner(owner: string): void { this.owners.get(owner)?.close(); }
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const owned of this.owners.values()) owned.close(); this.owners.clear(); }
}
