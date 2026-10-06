/** Obsidian's DOM prototype extensions for happy-dom/jsdom tests, plus the kit's own element helper. */
export interface DomElementInfo {
  cls?: string | string[]; text?: string | DocumentFragment; attr?: Record<string, string | number | boolean | null>;
  title?: string; parent?: Node; value?: string; type?: string; prepend?: boolean; placeholder?: string; href?: string;
}
type Info = DomElementInfo | string | undefined;
type Callback = ((element: HTMLElement) => void) | undefined;

function ownerOf(node: Node): Document {
  if (node.ownerDocument) return node.ownerDocument;
  if (node instanceof Document) return node;
  throw new Error('OBSIDIAN_TEST_KIT_DOM_REQUIRED');
}
function setText(element: Node, text: string | DocumentFragment): void {
  element.textContent = typeof text === 'string' ? text : '';
  if (typeof text !== 'string') element.appendChild(text);
}
function setAttr(element: Element, name: string, value: string | number | boolean | null): void {
  if (value === null || value === false) element.removeAttribute(name);
  else element.setAttribute(name, value === true ? '' : String(value));
}
function apply(element: HTMLElement, info: Info): void {
  const options = typeof info === 'string' ? { cls: info } : info ?? {};
  const classes = Array.isArray(options.cls) ? options.cls : options.cls?.split(' ') ?? [];
  element.classList.add(...classes.filter(Boolean));
  if (options.text !== undefined) setText(element, options.text);
  for (const [name, value] of Object.entries(options.attr ?? {})) setAttr(element, name, value);
  for (const name of ['title', 'value', 'type', 'placeholder', 'href'] as const) {
    const value = options[name]; if (value !== undefined) element.setAttribute(name, value);
  }
  if ('value' in element && typeof options.value === 'string') element.value = options.value;
}
function documentFor(parent: Node | null): Document {
  if (parent) return ownerOf(parent);
  if (!hasDom()) throw new Error('OBSIDIAN_TEST_KIT_DOM_REQUIRED: add `// @vitest-environment happy-dom` to this test file');
  return document;
}
function place(parent: Node | null, created: HTMLElement, info: Info): void {
  const options = typeof info === 'object' ? info : undefined;
  const target = options?.parent ?? parent;
  if (target && options?.prepend) target.insertBefore(created, target.firstChild);
  else target?.appendChild(created);
}
/** Kit-internal typed creation with Obsidian's `DomElementInfo` options. */
export function make<K extends keyof HTMLElementTagNameMap>(parent: Node | null, tag: K, info?: Info): HTMLElementTagNameMap[K] {
  const created = documentFor(parent).createElement(tag); apply(created, info); place(parent, created, info);
  return created;
}
/** Create an arbitrary tag, as Obsidian's `createEl` does. */
export function element(parent: Node | null, tag: string, info?: Info, callback?: Callback): HTMLElement {
  const created = documentFor(parent).createElement(tag); apply(created, info); place(parent, created, info);
  callback?.(created);
  return created;
}

const nodeMethods = {
  createEl(this: Node, tag: string, info?: Info, callback?: Callback) { return element(this, tag, info, callback); },
  createDiv(this: Node, info?: Info, callback?: Callback) { return element(this, 'div', info, callback); },
  createSpan(this: Node, info?: Info, callback?: Callback) { return element(this, 'span', info, callback); },
  empty(this: Node) { while (this.firstChild) this.removeChild(this.firstChild); },
  detach(this: Node) { this.parentNode?.removeChild(this); },
  appendText(this: Node, text: string) { this.appendChild(ownerOf(this).createTextNode(text)); },
  setText(this: Node, text: string | DocumentFragment) { setText(this, text); },
  getText(this: Node) { return this.textContent ?? ''; },
};
const elementMethods = {
  addClass(this: Element, ...names: string[]) { this.classList.add(...names); },
  addClasses(this: Element, names: string[]) { this.classList.add(...names); },
  removeClass(this: Element, ...names: string[]) { this.classList.remove(...names); },
  removeClasses(this: Element, names: string[]) { this.classList.remove(...names); },
  toggleClass(this: Element, names: string | string[], value: boolean) { for (const name of [names].flat()) this.classList.toggle(name, value); },
  hasClass(this: Element, name: string) { return this.classList.contains(name); },
  setAttr(this: Element, name: string, value: string | number | boolean | null) { setAttr(this, name, value); },
  setAttrs(this: Element, values: Record<string, string | number | boolean | null>) { for (const [name, value] of Object.entries(values)) setAttr(this, name, value); },
  getAttr(this: Element, name: string) { return this.getAttribute(name); },
  find(this: Element, selector: string) { return this.querySelector(selector); },
  findAll(this: Element, selector: string) { return Array.from(this.querySelectorAll(selector)); },
};
const htmlMethods = {
  show(this: HTMLElement) { this.style.display = ''; },
  hide(this: HTMLElement) { this.style.display = 'none'; },
  toggle(this: HTMLElement, show: boolean) { this.style.display = show ? '' : 'none'; },
  isShown(this: HTMLElement) { return this.isConnected && this.style.display !== 'none'; },
  setCssProps(this: HTMLElement, props: Record<string, string>) { for (const [name, value] of Object.entries(props)) this.style.setProperty(name, value); },
};
const globals = {
  createEl: (tag: string, info?: Info, callback?: Callback) => element(null, tag, info, callback),
  createDiv: (info?: Info, callback?: Callback) => element(null, 'div', info, callback),
  createSpan: (info?: Info, callback?: Callback) => element(null, 'span', info, callback),
  createFragment(callback?: (fragment: DocumentFragment) => void) { const fragment = document.createDocumentFragment(); callback?.(fragment); return fragment; },
};

/**
 * Install Obsidian's `Node`/`Element`/`HTMLElement` helpers and the `createEl`/`createDiv`/
 * `createSpan`/`createFragment`/`activeDocument`/`activeWindow` globals. Needs a DOM test
 * environment; returns an uninstall function restoring the previous descriptors.
 */
export function installObsidianDom(): () => void {
  if (typeof Node === 'undefined' || typeof document === 'undefined') throw new Error('OBSIDIAN_TEST_KIT_DOM_REQUIRED: add `// @vitest-environment happy-dom` to this test file');
  const restores: (() => void)[] = [];
  const define = (target: object, name: string, value: unknown) => {
    const previous = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { value, configurable: true, writable: true });
    restores.push(() => { if (previous) Object.defineProperty(target, name, previous); else Reflect.deleteProperty(target, name); });
  };
  for (const [name, value] of Object.entries(nodeMethods)) define(Node.prototype, name, value);
  for (const [name, value] of Object.entries(elementMethods)) define(Element.prototype, name, value);
  for (const [name, value] of Object.entries(htmlMethods)) define(HTMLElement.prototype, name, value);
  for (const [name, value] of Object.entries(globals)) define(globalThis, name, value);
  define(globalThis, 'activeDocument', document); define(globalThis, 'activeWindow', window);
  return () => { for (const restore of restores.reverse()) restore(); };
}
/** Kit-internal: DOM exists in this test environment. */
export function hasDom(): boolean { return typeof document !== 'undefined' && typeof Node !== 'undefined'; }
