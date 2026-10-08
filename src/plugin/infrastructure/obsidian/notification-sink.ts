import { Notice } from 'obsidian';
import type { NoticeAction, NoticeHandle } from '../../application/ports';
/** Native public Notice API cannot promise targeting a particular pop-out window. */
export function nativeNotification(text: string, actions: readonly NoticeAction[]): NoticeHandle {
  let closed = false;
  let cleanups: (() => void)[] = [];
  const content = (message: string, choices: readonly NoticeAction[]) => {
    for (const cleanup of cleanups) cleanup(); cleanups = [];
    const fragment = createFragment(); fragment.append(document.createTextNode(message));
    for (const action of choices) {
      const button = createEl('button'); button.type = 'button'; button.textContent = action.label; button.disabled = action.disabled;
      button.addEventListener('click', action.invoke); cleanups.push(() => button.removeEventListener('click', action.invoke)); fragment.append(button);
    }
    return fragment;
  };
  const notice = new Notice(content(text, actions), 0);
  return { update(message, choices) { if (!closed) notice.setMessage(content(message, choices)); }, dismiss() { if (closed) return; closed = true; for (const cleanup of cleanups) cleanup(); cleanups = []; notice.hide(); } };
}
