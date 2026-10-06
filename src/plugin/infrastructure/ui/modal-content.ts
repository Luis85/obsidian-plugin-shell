import type { ModalCallbacks, ModalPresentation, ModalState } from '../../application/modal-port';
import { pluginIdentity } from '../plugin-identity';
let sequence = 0;
/** Shared safe DOM surface with an owned control loop; hosts own modal isolation. */
export function mountModalContent(container: HTMLElement, presentation: ModalPresentation, callbacks: ModalCallbacks,
  create: <K extends keyof HTMLElementTagNameMap>(tag: K) => HTMLElementTagNameMap[K]) {
  const form = create('form'); form.className = `${pluginIdentity.id} shell-modal-form`; let closed = false;
  const description = create('p'); description.className = 'shell-modal-copy'; description.textContent = presentation.message; form.append(description);
  let input: HTMLInputElement | undefined;
  if (presentation.kind === 'prompt') {
    const label = create('label'); label.textContent = presentation.inputLabel;
    input = create('input'); input.type = 'text'; input.value = presentation.initialValue; input.maxLength = presentation.maxLength;
    label.append(input); form.append(label);
  }
  const error = create('p'); error.id = `${pluginIdentity.id}-modal-error-${++sequence}`; error.setAttribute('role', 'alert'); error.hidden = true;
  input?.setAttribute('aria-describedby', error.id); form.append(error);
  const status = create('p'); status.setAttribute('role', 'status'); status.textContent = presentation.busyLabel; status.hidden = true; form.append(status);
  const controls = create('div'); controls.className = 'shell-modal-actions'; const confirm = create('button'); confirm.type = 'submit'; confirm.textContent = presentation.confirmLabel;
  const cancel = presentation.kind === 'info' ? undefined : create('button'); if (cancel) { cancel.type = 'button'; cancel.textContent = presentation.cancelLabel; }
  const submit = (event: Event) => { event.preventDefault(); if (!closed) callbacks.submit(input?.value ?? ''); };
  const dismiss = () => { if (!closed) callbacks.cancel(); };
  const keyboard = (event: KeyboardEvent) => {
    if (closed || event.key !== 'Tab') return;
    const elements = Array.from(form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input:not([disabled]), button:not([disabled])'));
    const first = elements[0]; const last = elements.at(-1); const active = form.ownerDocument.activeElement;
    if (event.shiftKey && active === first && last) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last && first) { event.preventDefault(); first.focus(); }
  };
  form.addEventListener('submit', submit); cancel?.addEventListener('click', dismiss);
  form.addEventListener('keydown', keyboard);
  if (cancel) controls.append(cancel); controls.append(confirm); form.append(controls); container.append(form);
  return {
    focus() { if (!closed) (input ?? confirm).focus(); },
    update(state: ModalState) {
      if (closed) return; form.setAttribute('aria-busy', String(state.busy)); confirm.disabled = state.busy; if (input) input.disabled = state.busy;
      status.hidden = !state.busy; error.hidden = state.error === null; error.textContent = state.error ?? '';
      input?.setAttribute('aria-invalid', String(state.error !== null)); if (state.error) input?.focus();
    },
    dispose() { if (closed) return; closed = true; form.removeEventListener('submit', submit); form.removeEventListener('keydown', keyboard); cancel?.removeEventListener('click', dismiss); form.remove(); },
  };
}
