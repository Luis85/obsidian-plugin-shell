/** Component lifecycle: registered cleanups run once on unload, children first. */
interface Offable { offref(ref: object): void }
function hasSource(ref: object): ref is { e: Offable } {
  return 'e' in ref && typeof ref.e === 'object' && ref.e !== null && 'offref' in ref.e && typeof ref.e.offref === 'function';
}

export class Component {
  private loadedState = false;
  private loading: Promise<void> = Promise.resolve();
  private children: Component[] = [];
  private cleanups: (() => unknown)[] = [];
  load(): void {
    if (this.loadedState) return;
    this.loadedState = true;
    let result: unknown;
    try { result = this.onload(); } catch (error) { result = Promise.reject(error); }
    // Observed through `whenLoaded` (for example `TestApp.loadPlugin`), never an unhandled rejection.
    this.loading = Promise.resolve(result).then(() => undefined);
    void this.loading.catch(() => undefined);
    for (const child of this.children) child.load();
  }
  onload(): void | Promise<void> {}
  /** Children unload first, then registered cleanups, both last-in-first-out, then `onunload`. */
  unload(): void {
    if (!this.loadedState) return;
    this.loadedState = false;
    for (const child of this.children.splice(0).reverse()) child.unload();
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
    this.onunload();
  }
  onunload(): void {}
  addChild<T extends Component>(component: T): T {
    this.children.push(component);
    if (this.loadedState) component.load();
    return component;
  }
  removeChild<T extends Component>(component: T): T {
    if (this.children.includes(component)) { this.children = this.children.filter(child => child !== component); component.unload(); }
    return component;
  }
  register(cleanup: () => unknown): void { this.cleanups.push(cleanup); }
  registerEvent(ref: object): void { this.register(() => { if (hasSource(ref)) ref.e.offref(ref); }); }
  registerDomEvent(target: EventTarget, type: string, callback: (event: Event) => unknown, options?: boolean | AddEventListenerOptions): void {
    target.addEventListener(type, callback, options);
    this.register(() => target.removeEventListener(type, callback, options));
  }
  registerInterval(id: number): number { this.register(() => clearInterval(id)); return id; }
  /** Kit-only: settles with the (possibly asynchronous) `onload` result, rejecting when it failed. */
  whenLoaded(): Promise<void> { return this.loading; }
  /** Kit-only: whether `load` ran without a later `unload`. */
  get isLoaded(): boolean { return this.loadedState; }
}

/** Minimal keymap scope: records handlers so tests can inspect or invoke them. */
export class Scope {
  readonly keys: { modifiers: string[] | null; key: string | null; func: (event: KeyboardEvent) => unknown }[] = [];
  constructor(readonly parent?: Scope) {}
  register(modifiers: string[] | null, key: string | null, func: (event: KeyboardEvent) => unknown) {
    const handler = { modifiers, key, func }; this.keys.push(handler); return handler;
  }
  unregister(handler: object): void { const index = this.keys.findIndex(item => item === handler); if (index >= 0) this.keys.splice(index, 1); }
}
