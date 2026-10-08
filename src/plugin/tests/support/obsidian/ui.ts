/** Notice, Modal and Menu doubles that build real DOM and record what the plugin showed. */
import type { App } from './app';
import { Component, Scope } from './component';
import { element, hasDom } from './dom';
import { track } from './events';

/** Kit-only logs; `createTestApp` clears them so each test starts empty. */
export const uiLog = { notices: [] as Notice[], menus: [] as Menu[] };

export class Notice {
  noticeEl!: HTMLElement;
  containerEl!: HTMLElement;
  messageEl!: HTMLElement;
  /** Kit-only: false after `hide()` or after `duration` ms (fake timers apply). 0 keeps it open. */
  visible = true;
  private text: string;
  constructor(message: string | DocumentFragment, readonly duration = 5000) {
    this.text = typeof message === 'string' ? message : message.textContent ?? '';
    if (hasDom()) {
      this.containerEl = element(document.body, 'div', 'notice-container');
      this.noticeEl = element(this.containerEl, 'div', 'notice');
      this.messageEl = element(this.noticeEl, 'div', { cls: 'notice-message', text: message });
    }
    uiLog.notices.push(this);
    if (duration > 0) setTimeout(() => this.hide(), duration);
  }
  /** Kit-only: current message text. */
  get message(): string { return this.messageEl?.textContent ?? this.text; }
  setMessage(message: string | DocumentFragment): this {
    this.text = typeof message === 'string' ? message : message.textContent ?? '';
    if (this.messageEl) { this.messageEl.replaceChildren(); if (typeof message === 'string') this.messageEl.textContent = message; else this.messageEl.append(message); }
    return this;
  }
  hide(): void { this.visible = false; this.containerEl?.remove(); }
}

export class Modal {
  scope = new Scope();
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  shouldRestoreSelection = false;
  /** Kit-only: whether the modal is currently open. */
  isOpen = false;
  private closeCallback?: () => unknown;
  constructor(readonly app: App) {
    this.containerEl = element(null, 'div', 'modal-container');
    element(this.containerEl, 'div', 'modal-bg');
    this.modalEl = element(this.containerEl, 'div', 'modal');
    const close = element(this.modalEl, 'div', { cls: 'modal-close-button', attr: { 'aria-label': 'Close' } });
    close.addEventListener('click', () => this.close());
    this.titleEl = element(this.modalEl, 'div', 'modal-title');
    this.contentEl = element(this.modalEl, 'div', 'modal-content');
    this.containerEl.addEventListener('keydown', event => { if (event.key === 'Escape') this.close(); });
  }
  /** Attaches to `document.body` and runs `onOpen` synchronously (its promise is tracked). */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true; document.body.append(this.containerEl); this.app.openModals.push(this);
    void track(Promise.resolve(this.onOpen()));
  }
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false; this.containerEl.remove();
    this.app.openModals.splice(this.app.openModals.indexOf(this), 1);
    this.onClose(); this.closeCallback?.();
  }
  onOpen(): Promise<void> | void {}
  onClose(): void {}
  setTitle(title: string): this { this.titleEl.textContent = title; return this; }
  setContent(content: string | DocumentFragment): this {
    this.contentEl.replaceChildren(); if (typeof content === 'string') this.contentEl.textContent = content; else this.contentEl.append(content);
    return this;
  }
  setCloseCallback(callback: () => unknown): this { this.closeCallback = callback; return this; }
}

export class MenuItem {
  title = '';
  icon: string | null = null;
  checked: boolean | null = null;
  disabled = false;
  warning = false;
  section = '';
  callback?: (event: MouseEvent | KeyboardEvent) => unknown;
  setTitle(title: string | DocumentFragment): this { this.title = typeof title === 'string' ? title : title.textContent ?? ''; return this; }
  setIcon(icon: string | null): this { this.icon = icon; return this; }
  setChecked(checked: boolean | null): this { this.checked = checked; return this; }
  setDisabled(disabled: boolean): this { this.disabled = disabled; return this; }
  setWarning(warning: boolean): this { this.warning = warning; return this; }
  setIsLabel(_label: boolean): this { return this; }
  setSection(section: string): this { this.section = section; return this; }
  onClick(callback: (event: MouseEvent | KeyboardEvent) => unknown): this { this.callback = callback; return this; }
  /** Kit-only: invoke like a user click (ignored when disabled); needs a DOM environment. */
  async click(): Promise<void> {
    if (this.disabled) return;
    if (!hasDom()) throw new Error('OBSIDIAN_TEST_KIT_DOM_REQUIRED: menu clicks need a DOM test environment');
    await this.callback?.(new MouseEvent('click'));
  }
}

export class Menu extends Component {
  /** Kit-only: items in order; separators are recorded as `null`. */
  readonly entries: (MenuItem | null)[] = [];
  /** Kit-only: whether the menu is showing. */
  shown = false;
  private readonly hideCallbacks: (() => unknown)[] = [];
  get items(): MenuItem[] { return this.entries.filter(entry => entry !== null); }
  /** Kit-only: find an item by exact title. */
  item(title: string): MenuItem | undefined { return this.items.find(entry => entry.title === title); }
  setNoIcon(): this { return this; }
  setUseNativeMenu(_native: boolean): this { return this; }
  addItem(callback: (item: MenuItem) => unknown): this { const item = new MenuItem(); callback(item); this.entries.push(item); return this; }
  addSeparator(): this { this.entries.push(null); return this; }
  setParentElement(_element: HTMLElement): this { return this; }
  showAtMouseEvent(_event: MouseEvent): this { return this.show(); }
  showAtPosition(_position: { x: number; y: number }, _doc?: Document): this { return this.show(); }
  hide(): this {
    if (!this.shown) return this;
    this.shown = false; for (const callback of this.hideCallbacks) callback();
    return this;
  }
  close(): void { this.hide(); }
  onHide(callback: () => unknown): void { this.hideCallbacks.push(callback); }
  static forEvent(_event: MouseEvent | PointerEvent): Menu { return new Menu(); }
  private show(): this { this.shown = true; if (!uiLog.menus.includes(this)) uiLog.menus.push(this); return this; }
}

/** Records the icon id on the element; real Lucide SVGs are not rendered. */
export function setIcon(parent: HTMLElement, icon: string): void { parent.setAttribute('data-icon', icon); }
export function setTooltip(target: HTMLElement, tooltip: string): void { target.setAttribute('aria-label', tooltip); }

/** Timer-based like the host, so `vi.useFakeTimers()` controls it. */
export function debounce<T extends unknown[]>(callback: (...args: T) => unknown, timeout = 0, resetTimer = false) {
  let timer: ReturnType<typeof setTimeout> | undefined; let latest: T | undefined;
  const run = () => { const args = latest; timer = undefined; latest = undefined; if (args) callback(...args); };
  const debounced = (...args: T) => {
    latest = args;
    if (timer && resetTimer) { clearTimeout(timer); timer = undefined; }
    timer ??= setTimeout(run, timeout);
    return debounced;
  };
  return Object.assign(debounced, {
    cancel() { if (timer) clearTimeout(timer); timer = undefined; latest = undefined; return debounced; },
    run() { if (timer) clearTimeout(timer); run(); },
  });
}

/** Mutable desktop defaults; `createTestApp({ platform })` resets and overrides them. */
export const Platform = {
  isDesktop: true, isMobile: false, isDesktopApp: true, isMobileApp: false, isIosApp: false, isAndroidApp: false,
  isPhone: false, isTablet: false, isMacOS: false, isWin: false, isLinux: true, isSafari: false, resourcePathPrefix: 'app://obsidian-test-kit/',
};
export const platformDefaults = Object.freeze({ ...Platform });
