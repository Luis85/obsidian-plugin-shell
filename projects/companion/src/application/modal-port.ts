export interface ModalPresentation {
  readonly kind: 'info' | 'confirm' | 'prompt'; readonly title: string; readonly message: string;
  readonly confirmLabel: string; readonly cancelLabel: string; readonly inputLabel: string;
  readonly busyLabel: string;
  readonly initialValue: string; readonly maxLength: number;
}
export interface ModalState { readonly busy: boolean; readonly error: string | null }
export interface ModalCallbacks { submit(value: unknown): void; cancel(): void; failed(): void }
export interface ModalHandle { update(state: ModalState): void; close(): void }
export interface ModalSink { open(presentation: ModalPresentation, callbacks: ModalCallbacks): ModalHandle }
