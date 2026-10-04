import type { NoticeAction, NoticeHandle } from '../../src/application/ports';
/** Persistent synthetic sink; runtime policy is the only owner of lifetime timers. */
export function browserNotification(text: string, actions: readonly NoticeAction[], register: (close: () => void) => () => void): NoticeHandle {
  let closed = false; const root = document.createElement('div'); root.className = 'harness-native-notice'; root.setAttribute('role', 'status');
  let buttons: HTMLButtonElement[] = [];
  let container = document.querySelector('.harness-native-notices');
  if (!container) { container = document.createElement('div'); container.className = 'harness-native-notices'; document.body.append(container); }
  const update = (message: string, choices: readonly NoticeAction[]) => {
    if (closed) return; for (const button of buttons) button.onclick = null; buttons = []; root.replaceChildren(document.createTextNode(message));
    for (const action of choices) { const button = document.createElement('button'); button.type = 'button'; button.textContent = action.label; button.disabled = action.disabled; button.onclick = action.invoke; buttons.push(button); root.append(button); }
  };
  let unregister = () => {};
  const dismiss = () => { if (closed) return; closed = true; for (const button of buttons) button.onclick = null; buttons = []; root.remove(); unregister(); };
  update(text, actions); container.append(root); unregister = register(dismiss); return { update, dismiss };
}
