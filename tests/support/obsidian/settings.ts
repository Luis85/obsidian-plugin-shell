/** Setting rows, groups and tabs, including a renderer for Obsidian 1.13 declarative definitions. */
import type { App } from './app';
import { make } from './dom';
import { hostErrors, track } from './events';
import type { Plugin } from './plugin';
import { BaseComponent, ButtonComponent, ColorComponent, DropdownComponent, ExtraButtonComponent, SearchComponent, SliderComponent, TextAreaComponent, TextComponent, ToggleComponent } from './setting-components';

function setContent(target: HTMLElement, value: string | DocumentFragment): void {
  target.replaceChildren(); if (typeof value === 'string') target.textContent = value; else target.append(value);
}

export class Setting {
  readonly settingEl: HTMLElement;
  readonly infoEl: HTMLElement;
  readonly nameEl: HTMLElement;
  readonly descEl: HTMLElement;
  readonly controlEl: HTMLElement;
  components: BaseComponent[] = [];
  errorEl: HTMLElement | null = null;
  constructor(containerEl: HTMLElement) {
    this.settingEl = make(containerEl, 'div', 'setting-item');
    this.infoEl = make(this.settingEl, 'div', 'setting-item-info');
    this.nameEl = make(this.infoEl, 'div', 'setting-item-name');
    this.descEl = make(this.infoEl, 'div', 'setting-item-description');
    this.controlEl = make(this.settingEl, 'div', 'setting-item-control');
  }
  setName(name: string | DocumentFragment): this { setContent(this.nameEl, name); return this; }
  setDesc(desc: string | DocumentFragment): this { setContent(this.descEl, desc); return this; }
  setClass(cls: string): this { this.settingEl.classList.add(cls); return this; }
  setTooltip(tooltip: string): this { this.settingEl.setAttribute('aria-label', tooltip); return this; }
  setHeading(): this { this.settingEl.classList.add('setting-item-heading'); return this; }
  setDisabled(disabled: boolean): this {
    this.settingEl.classList.toggle('is-disabled', disabled);
    for (const component of this.components) component.setDisabled(disabled);
    return this;
  }
  /** `null` hides the message; the element is created on first use with `role="alert"`. */
  setErrorMessage(message: string | null): this {
    if (message === null && !this.errorEl) return this;
    this.errorEl ??= make(this.infoEl, 'div', { cls: 'setting-item-error', attr: { role: 'alert' } });
    this.errorEl.textContent = message ?? ''; this.errorEl.hidden = message === null;
    return this;
  }
  addButton(callback: (component: ButtonComponent) => unknown): this { return this.add(new ButtonComponent(this.controlEl), callback); }
  addExtraButton(callback: (component: ExtraButtonComponent) => unknown): this { return this.add(new ExtraButtonComponent(this.controlEl), callback); }
  addToggle(callback: (component: ToggleComponent) => unknown): this { return this.add(new ToggleComponent(this.controlEl), callback); }
  addText(callback: (component: TextComponent) => unknown): this { return this.add(new TextComponent(this.controlEl), callback); }
  addSearch(callback: (component: SearchComponent) => unknown): this { return this.add(new SearchComponent(this.controlEl), callback); }
  addTextArea(callback: (component: TextAreaComponent) => unknown): this { return this.add(new TextAreaComponent(this.controlEl), callback); }
  addDropdown(callback: (component: DropdownComponent) => unknown): this { return this.add(new DropdownComponent(this.controlEl), callback); }
  addColorPicker(callback: (component: ColorComponent) => unknown): this { return this.add(new ColorComponent(this.controlEl), callback); }
  addSlider(callback: (component: SliderComponent) => unknown): this { return this.add(new SliderComponent(this.controlEl), callback); }
  addComponent<T extends BaseComponent>(callback: (element: HTMLElement) => T): this { this.components.push(callback(this.controlEl)); return this; }
  then(callback: (setting: this) => unknown): this { callback(this); return this; }
  clear(): this { this.controlEl.replaceChildren(); this.components = []; return this; }
  private add<T extends BaseComponent>(component: T, callback: (component: T) => unknown): this {
    this.components.push(component); callback(component); return this;
  }
}

export class SettingGroup {
  readonly groupEl: HTMLElement;
  readonly listEl: HTMLElement;
  private heading?: Setting;
  constructor(containerEl: HTMLElement) {
    this.groupEl = make(containerEl, 'div', 'setting-group');
    this.listEl = make(this.groupEl, 'div', 'setting-items');
  }
  setHeading(text: string | DocumentFragment): this {
    if (!this.heading) { this.heading = new Setting(this.groupEl).setHeading(); this.groupEl.insertBefore(this.heading.settingEl, this.listEl); }
    this.heading.setName(text); return this;
  }
  addClass(...classes: string[]): this { this.groupEl.classList.add(...classes); return this; }
  addSetting(callback: (setting: Setting) => void): this { callback(new Setting(this.listEl)); return this; }
  addExtraButton(callback: (component: ExtraButtonComponent) => unknown): this { callback(new ExtraButtonComponent(this.groupEl)); return this; }
}

type Flag = boolean | (() => boolean) | undefined;
/** Structural subset of `SettingDefinitionItem` the kit renders. */
export interface KitSettingControl {
  type: string; key: string; defaultValue?: unknown; options?: Record<string, string>; disabled?: Flag;
  validate?(value: unknown): unknown;
}
export interface KitSettingItem {
  type?: 'group' | 'list' | 'page'; name?: string; heading?: string; cls?: string; desc?: string | DocumentFragment; visible?: Flag; disabled?: Flag;
  items?: KitSettingItem[]; control?: KitSettingControl;
  render?(setting: Setting, group: SettingGroup): unknown;
  action?(element: HTMLElement, index: number): void;
}
const flag = (value: Flag, fallback: boolean) => typeof value === 'function' ? value() : value ?? fallback;

/** Renders definitions like the host settings modal. Pages render inline; lists do not reorder. */
class DefinitionRenderer {
  private readonly cleanups: (() => unknown)[] = [];
  private readonly refreshers: (() => void)[] = [];
  private refreshing = false;
  constructor(private readonly tab: SettingTab) {}
  render(items: KitSettingItem[], container: HTMLElement): void {
    let group: SettingGroup | undefined;
    items.forEach((item, index) => {
      if (!flag(item.visible, true)) return;
      if (item.type === 'group' || item.type === 'list') {
        group = undefined; const own = new SettingGroup(container);
        if (item.heading) own.setHeading(item.heading);
        if (item.cls) own.addClass(item.cls);
        (item.items ?? []).forEach((child, childIndex) => this.definition(child, own, childIndex));
        return;
      }
      group ??= new SettingGroup(container);
      this.definition(item, group, index);
    });
  }
  refresh(): void {
    this.refreshing = true;
    try { for (const refresh of this.refreshers) refresh(); } finally { this.refreshing = false; }
  }
  dispose(): void { for (const cleanup of this.cleanups.splice(0).reverse()) cleanup(); }
  private definition(item: KitSettingItem, group: SettingGroup, index: number): void {
    if (!flag(item.visible, true)) return;
    const setting = new Setting(group.listEl).setName(item.name ?? '');
    if (item.desc) setting.setDesc(item.desc);
    if (item.type === 'page') { setting.setHeading(); this.render(item.items ?? [], group.listEl); return; }
    if (item.render) { const cleanup = item.render(setting, group); if (typeof cleanup === 'function') this.cleanups.push(() => cleanup()); return; }
    const action = item.action?.bind(item);
    if (action) { setting.settingEl.addEventListener('click', () => { if (!flag(item.disabled, false)) action(setting.settingEl, index); }); return; }
    if (item.control) this.control(setting, item.control);
  }
  private control(setting: Setting, control: KitSettingControl): void {
    const current = () => this.tab.getControlValue(control.key) ?? control.defaultValue;
    const commit = async (value: unknown) => {
      const message = await control.validate?.(value);
      const error = typeof message === 'string' && message ? message : null;
      setting.setErrorMessage(error);
      if (!error) await this.tab.setControlValue(control.key, value);
    };
    const changed = (value: unknown) => { if (!this.refreshing) void track(commit(value)); };
    const text = (component: TextComponent | TextAreaComponent, parse: (value: string) => unknown = value => value) => {
      component.setValue(String(current() ?? '')).onChange(value => changed(parse(value)));
      this.refreshers.push(() => { component.setValue(String(current() ?? '')); });
    };
    if (control.type === 'toggle') setting.addToggle(toggle => {
      toggle.setValue(current() === true).onChange(changed); this.refreshers.push(() => { toggle.setValue(current() === true); });
    });
    else if (control.type === 'dropdown') setting.addDropdown(dropdown => {
      dropdown.addOptions(control.options ?? {}).setValue(String(current() ?? '')).onChange(changed);
      this.refreshers.push(() => { dropdown.setValue(String(current() ?? '')); });
    });
    else if (control.type === 'textarea') setting.addTextArea(area => text(area));
    else if (control.type === 'number') setting.addText(input => { input.inputEl.type = 'number'; text(input, Number); });
    else if (['text', 'file', 'folder', 'color', 'slider'].includes(control.type)) setting.addText(input => text(input));
    else throw new Error(`OBSIDIAN_TEST_KIT_UNSUPPORTED_SETTING_CONTROL: ${control.type}`);
    // Components expose Obsidian's chaining `then`; block bodies keep them from looking like promises.
    const disabled = () => { setting.setDisabled(flag(control.disabled, false)); };
    disabled(); this.refreshers.push(disabled);
  }
}

export abstract class SettingTab {
  app!: App;
  icon = '';
  settingItems: KitSettingItem[] = [];
  private container?: HTMLElement;
  private renderer?: DefinitionRenderer;
  /** Created on first access so setting tabs can be constructed in node-environment tests. */
  get containerEl(): HTMLElement { return this.container ??= make(null, 'div', 'vertical-tab-content'); }
  set containerEl(element: HTMLElement) { this.container = element; }
  getSettingDefinitions(): KitSettingItem[] { return []; }
  getControlValue(_key: string): unknown { return undefined; }
  setControlValue(_key: string, _value: unknown): void | Promise<void> {}
  /** Default: render `getSettingDefinitions()`. Classic tabs override `display` and build rows themselves. */
  display(): void {
    this.teardown(); this.settingItems = this.getSettingDefinitions();
    this.renderer = new DefinitionRenderer(this); this.renderer.render(this.settingItems, this.containerEl);
  }
  hide(): void { this.teardown(); }
  /** Re-reads control values and disabled state in place without calling `setControlValue`. */
  update(): void { this.renderer?.refresh(); }
  refreshDomState(): void { this.update(); }
  private teardown(): void {
    const renderer = this.renderer; this.renderer = undefined;
    try { renderer?.dispose(); } catch (error) { hostErrors.push(error); }
    this.containerEl.replaceChildren();
  }
}
export abstract class PluginSettingTab extends SettingTab {
  constructor(app: App, readonly plugin: Plugin) { super(); this.app = app; }
}
