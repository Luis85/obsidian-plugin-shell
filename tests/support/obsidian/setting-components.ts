/** Setting controls backed by real DOM elements; user events drive `onChange` like the host. */
import { make } from './dom';
import { track } from './events';

type Listener<T> = (value: T) => unknown;
/** Listeners run synchronously like the host; a returned promise is tracked for `flushObsidian`. */
function notify<T>(listener: Listener<T> | undefined, value: T): void {
  const result = listener?.(value);
  if (result instanceof Promise) void track(result);
}

export abstract class BaseComponent {
  disabled = false;
  then(callback: (component: this) => unknown): this { callback(this); return this; }
  setDisabled(disabled: boolean): this { this.disabled = disabled; return this; }
}
export abstract class ValueComponent<T> extends BaseComponent {
  abstract getValue(): T;
  abstract setValue(value: T): this;
  registerOptionListener(listeners: Record<string, (value?: T) => T>, key: string): this {
    listeners[key] = (value?: T) => { if (value !== undefined) this.setValue(value); return this.getValue(); };
    return this;
  }
}

abstract class InputComponent<E extends HTMLInputElement | HTMLTextAreaElement> extends ValueComponent<string> {
  private changed?: Listener<string>;
  constructor(readonly inputEl: E) { super(); inputEl.addEventListener('input', () => this.onChanged()); }
  getValue(): string { return this.inputEl.value; }
  /** Programmatic updates never call `onChange`; dispatch an `input` event to simulate typing. */
  setValue(value: string): this { this.inputEl.value = value; return this; }
  setPlaceholder(placeholder: string): this { this.inputEl.placeholder = placeholder; return this; }
  onChange(callback: Listener<string>): this { this.changed = callback; return this; }
  onChanged(): void { notify(this.changed, this.getValue()); }
  override setDisabled(disabled: boolean): this { super.setDisabled(disabled); this.inputEl.disabled = disabled; return this; }
}
export class TextComponent extends InputComponent<HTMLInputElement> {
  constructor(containerEl: HTMLElement) { super(make(containerEl, 'input', { type: 'text', attr: { spellcheck: 'false' } })); }
}
export class TextAreaComponent extends InputComponent<HTMLTextAreaElement> {
  constructor(containerEl: HTMLElement) { super(make(containerEl, 'textarea')); }
}
export class SearchComponent extends TextComponent {
  constructor(containerEl: HTMLElement) { super(containerEl); this.inputEl.type = 'search'; }
}

export class ToggleComponent extends ValueComponent<boolean> {
  readonly toggleEl: HTMLElement;
  private readonly input: HTMLInputElement;
  private value = false;
  private changed?: Listener<boolean>;
  constructor(containerEl: HTMLElement) {
    super();
    this.toggleEl = make(containerEl, 'div', { cls: 'checkbox-container', attr: { tabindex: 0 } });
    this.input = make(this.toggleEl, 'input', { type: 'checkbox' });
    this.toggleEl.addEventListener('click', () => this.onClick());
  }
  getValue(): boolean { return this.value; }
  /** Like the host, a value that differs from the current one also calls `onChange`. */
  setValue(on: boolean): this {
    const changed = on !== this.value; this.value = on;
    this.toggleEl.classList.toggle('is-enabled', on); this.input.checked = on;
    if (changed) notify(this.changed, on);
    return this;
  }
  onClick(): void { if (!this.disabled) this.setValue(!this.value); }
  onChange(callback: Listener<boolean>): this { this.changed = callback; return this; }
  setTooltip(tooltip: string): this { this.toggleEl.setAttribute('aria-label', tooltip); return this; }
  override setDisabled(disabled: boolean): this { super.setDisabled(disabled); this.toggleEl.classList.toggle('is-disabled', disabled); this.input.disabled = disabled; return this; }
}

export class DropdownComponent extends ValueComponent<string> {
  readonly selectEl: HTMLSelectElement;
  private changed?: Listener<string>;
  constructor(containerEl: HTMLElement) {
    super(); this.selectEl = make(containerEl, 'select', 'dropdown');
    this.selectEl.addEventListener('change', () => notify(this.changed, this.getValue()));
  }
  addOption(value: string, display: string): this { make(this.selectEl, 'option', { value, text: display }); return this; }
  addOptions(options: Record<string, string>): this { for (const [value, display] of Object.entries(options)) this.addOption(value, display); return this; }
  getValue(): string { return this.selectEl.value; }
  setValue(value: string): this { this.selectEl.value = value; return this; }
  onChange(callback: Listener<string>): this { this.changed = callback; return this; }
  override setDisabled(disabled: boolean): this { super.setDisabled(disabled); this.selectEl.disabled = disabled; return this; }
}

export class SliderComponent extends ValueComponent<number> {
  readonly sliderEl: HTMLInputElement;
  private changed?: Listener<number>;
  constructor(containerEl: HTMLElement) {
    super(); this.sliderEl = make(containerEl, 'input', { type: 'range', cls: 'slider' });
    this.sliderEl.addEventListener('change', () => notify(this.changed, this.getValue()));
  }
  setLimits(min: number | null, max: number | null, step: number | 'any'): this {
    if (min !== null) this.sliderEl.min = String(min);
    if (max !== null) this.sliderEl.max = String(max);
    this.sliderEl.step = String(step); return this;
  }
  setDynamicTooltip(): this { return this; }
  getValue(): number { return Number(this.sliderEl.value); }
  setValue(value: number): this { this.sliderEl.value = String(value); return this; }
  onChange(callback: Listener<number>): this { this.changed = callback; return this; }
}

export class ColorComponent extends ValueComponent<string> {
  readonly colorPickerEl: HTMLInputElement;
  private changed?: Listener<string>;
  constructor(containerEl: HTMLElement) {
    super(); this.colorPickerEl = make(containerEl, 'input', { type: 'color' });
    this.colorPickerEl.addEventListener('change', () => notify(this.changed, this.getValue()));
  }
  getValue(): string { return this.colorPickerEl.value; }
  setValue(value: string): this { this.colorPickerEl.value = value; return this; }
  onChange(callback: Listener<string>): this { this.changed = callback; return this; }
}

export class ButtonComponent extends BaseComponent {
  readonly buttonEl: HTMLButtonElement;
  constructor(containerEl: HTMLElement) { super(); this.buttonEl = make(containerEl, 'button', { attr: { type: 'button' } }); }
  setButtonText(name: string): this { this.buttonEl.textContent = name; return this; }
  setIcon(icon: string): this { this.buttonEl.setAttribute('data-icon', icon); return this; }
  setTooltip(tooltip: string): this { this.buttonEl.setAttribute('aria-label', tooltip); return this; }
  setCta(): this { this.buttonEl.classList.add('mod-cta'); return this; }
  removeCta(): this { this.buttonEl.classList.remove('mod-cta'); return this; }
  setWarning(): this { this.buttonEl.classList.add('mod-warning'); return this; }
  setClass(cls: string): this { this.buttonEl.classList.add(cls); return this; }
  onClick(callback: (event: MouseEvent) => unknown): this {
    this.buttonEl.addEventListener('click', event => notify(callback, event));
    return this;
  }
  override setDisabled(disabled: boolean): this { super.setDisabled(disabled); this.buttonEl.disabled = disabled; return this; }
}

export class ExtraButtonComponent extends BaseComponent {
  readonly extraSettingsEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    super(); this.extraSettingsEl = make(containerEl, 'div', { cls: ['clickable-icon', 'extra-setting-button'], attr: { role: 'button' } });
  }
  setIcon(icon: string): this { this.extraSettingsEl.setAttribute('data-icon', icon); return this; }
  setTooltip(tooltip: string): this { this.extraSettingsEl.setAttribute('aria-label', tooltip); return this; }
  onClick(callback: () => unknown): this {
    this.extraSettingsEl.addEventListener('click', () => { if (!this.disabled) notify(callback, undefined); });
    return this;
  }
  override setDisabled(disabled: boolean): this { super.setDisabled(disabled); this.extraSettingsEl.classList.toggle('is-disabled', disabled); return this; }
}
