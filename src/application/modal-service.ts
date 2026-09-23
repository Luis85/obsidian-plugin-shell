import type { Failure, Result } from '../domain/outcome';
import type { ErrorReporter } from './ports';
import type { ModalHandle, ModalPresentation, ModalSink, ModalState } from './modal-port';
export type ModalOutcome<T> = { readonly status: 'confirmed'; readonly value: T } | { readonly status: 'cancelled' } | { readonly status: 'failed'; readonly error: Failure };
export type ModalRequest = { readonly owner: string; readonly titleKey: string; readonly confirmKey?: string; readonly cancelKey?: string }
  & ({ readonly messageKey: string; readonly message?: never } | { readonly message: string; readonly messageKey?: never });
export type PromptRequest = ModalRequest & { readonly labelKey?: string; readonly initialValue?: string; readonly maxLength?: number; readonly validate?: (value: string) => Result<string> | Promise<Result<string>> };
interface Owned { close(): void }
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value);
const textWithin = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.length <= maximum;
function requestLabels(request: PromptRequest, kind: 'info' | 'confirm' | 'prompt') {
  return { maxLength: request.maxLength ?? 1000, confirmKey: request.confirmKey ?? (kind === 'info' ? 'modal.close' : 'modal.confirm'),
    cancelKey: request.cancelKey ?? 'modal.cancel', labelKey: request.labelKey ?? 'modal.input' };
}
function validRequest(request: PromptRequest, maxLength: number): boolean {
  return token(request.owner) && Number.isInteger(maxLength) && maxLength >= 1 && maxLength <= 10000
    && textWithin(request.initialValue ?? '', maxLength)
    && (request.messageKey !== undefined || textWithin(request.message, 64000));
}
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
  private prepare(request: PromptRequest, kind: 'info' | 'confirm' | 'prompt') {
    const labels = requestLabels(request, kind);
    const keys = [request.titleKey, labels.confirmKey, labels.cancelKey, labels.labelKey, 'modal.validating', ...(request.messageKey === undefined ? [] : [request.messageKey])];
    if (!keys.every(key => token(key) && this.validKey(key)) || !validRequest(request, labels.maxLength)) throw new Error('MODAL_REQUEST');
    return labels;
  }
  private replaceOwner(owner: string): ModalOutcome<never> | undefined {
    this.closeOwner(owner);
    // Closing callbacks may dispose the runtime or synchronously open a successor.
    if (this.disposed) return this.failed('disposed', 'error.disposed');
    if (this.owners.has(owner)) return { status: 'cancelled' };
    if (this.owners.size >= 16) { this.errors.report('modal.capacity', 'modal.open'); return this.failed(); }
    return undefined;
  }
  private validationMessage(key: string): string {
    if (!token(key) || !this.validKey(key)) throw new Error('MODAL_VALIDATION_KEY');
    return this.text(key);
  }
  private presentation(request: PromptRequest, kind: ModalPresentation['kind'], labels: ReturnType<typeof requestLabels>): ModalPresentation {
    return { kind, title: this.text(request.titleKey), message: request.messageKey === undefined ? request.message : this.text(request.messageKey),
      confirmLabel: this.text(labels.confirmKey), cancelLabel: this.text(labels.cancelKey), inputLabel: this.text(labels.labelKey),
      busyLabel: this.text('modal.validating'), initialValue: request.initialValue ?? '', maxLength: labels.maxLength };
  }
  private open<T>(request: PromptRequest, kind: 'info' | 'confirm' | 'prompt', confirmed: (value: string) => T): Promise<ModalOutcome<T>> {
    if (this.disposed) return Promise.resolve(this.failed('disposed', 'error.disposed'));
    try { request = Object.freeze({ ...request }); } catch { this.errors.report('modal.request', 'modal.open'); return Promise.resolve(this.failed()); }
    let labels;
    try { labels = this.prepare(request, kind); } catch { this.errors.report('modal.request', 'modal.open'); return Promise.resolve(this.failed()); }
    const { maxLength } = labels;
    if (!this.sink) { this.errors.report('modal.unavailable', 'modal.open'); return Promise.resolve(this.failed()); }
    const replaced = this.replaceOwner(request.owner);
    if (replaced) return Promise.resolve(replaced);
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
    const invalidText = () => update({ busy: false, error: this.text('modal.invalid') });
    const completePrompt = (normalized: unknown) => {
      if (!textWithin(normalized, maxLength)) { invalidText(); return; }
      finish({ status: 'confirmed', value: confirmed(normalized) });
    };
    const submit = async (raw: unknown) => {
      if (closed || busy) return;
      busy = true; update({ busy: true, error: null });
      if (closed) return;
      try {
        if (kind !== 'prompt') { finish({ status: 'confirmed', value: confirmed('') }); return; }
        if (!textWithin(raw, maxLength)) { invalidText(); return; }
        const value = request.validate ? await request.validate(raw) : { ok: true as const, value: raw };
        if (closed) return;
        if (value.ok !== true) {
          update({ busy: false, error: this.validationMessage(value.error.key) }); return;
        }
        completePrompt(value.value);
      } catch { this.errors.report('modal.validation', 'modal.submit'); finish(this.failed()); }
      finally { busy = false; }
    };
    try {
      handle = this.sink.open(this.presentation(request, kind, labels),
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
