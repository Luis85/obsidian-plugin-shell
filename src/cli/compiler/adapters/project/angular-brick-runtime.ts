/** Generated Angular presentation state. No host-global store, HTML evaluation or implicit source calls. */
export const angularBrickRuntime = String.raw`import { Directive, ElementRef, inject, input, output, signal } from '@angular/core';
export interface Expression { kind: string; value?: unknown; name?: string; nodeId?: string; sourceId?: string; operationId?: string; field?: string }
export interface Mapping extends Expression { fields?: Record<string, Mapping> }
export interface Action { kind: string; state?: string; surfaceId?: string; nodeId?: string; value?: unknown; event?: string; payload?: Mapping; sourceId?: string; operationId?: string }
export interface Interaction { id: string; label: string; event: string; actions: readonly Action[] }
export interface Emission { name: string; payload: unknown }
export class BrickState {
  readonly states = signal<Record<string, string>>({});
  readonly values = signal<Record<string, unknown>>({});
  readonly hidden = signal<Record<string, boolean>>({});
  readonly notice = signal('');
  readonly navigate: (id: string) => void;
  constructor(navigate: (id: string) => void) { this.navigate = navigate; }
  set(key: string, value: unknown): void { this.values.update(current => ({ ...current, [key]: value })); }
  toggle(key: string): void { this.hidden.update(current => ({ ...current, [key]: !current[key] })); }
  preview(scope: string): string {
    const states = this.states(), parts = scope.split(':');
    while (parts.length) {
      const key = parts.join(':');
      if (Object.hasOwn(states, key)) return states[key]!;
      parts.pop();
    }
    return 'default';
  }
}
@Directive()
export class BrickContext {
  readonly ui = input.required<BrickState>();
  readonly scope = input('root');
  readonly values = input<Record<string, unknown>>({});
  readonly emitted = output<Emission>();
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  bindings: readonly Expression[] = [];
  interactions: readonly Interaction[] = [];
  emitTypes: Readonly<Record<string, string>> = {};
  read(index: number): unknown { return this.expression(this.bindings[index]); }
  expression(value: Expression | undefined): unknown {
    if (!value) return undefined;
    if (value.kind === 'literal') return value.value;
    if (value.kind === 'prop') return this.values()[value.name ?? ''];
    if (value.kind === 'state') return this.ui().values()[this.key(value.nodeId ?? '')];
    return undefined; // External source expressions require an explicit developer adapter.
  }
  key(id: string): string { return this.scope() + ':' + id; }
  visible(id: string, states: readonly string[]): boolean {
    return !this.ui().hidden()[this.key(id)] && (!states.length || states.includes(this.ui().preview(this.scope())));
  }
  source(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/[\t\r\n]/g, '').trim();
    return /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(normalized) ||
      normalized !== '' && !/^(?:[a-z][a-z0-9+.-]*:|[/\\])/i.test(normalized) ? normalized : null;
  }
  on(index: number, event: Event | unknown): void {
    const interaction = this.interactions[index];
    if (!interaction) return;
    if (!interaction.actions.length) { this.ui().notice.set('Implementation required: ' + interaction.label); return; }
    for (const action of interaction.actions) this.perform(action, event);
  }
  onEmitted(indices: readonly number[], event: Emission): void {
    for (const index of indices) if (this.interactions[index]?.event === event.name) this.on(index, event.payload);
  }
  private perform(action: Action, event: unknown): void {
    const ui = this.ui();
    if (action.kind === 'navigate') { ui.navigate(action.surfaceId ?? ''); return; }
    if (action.kind === 'set-state') { ui.states.update(states => ({ ...states, [this.scope()]: action.state ?? 'default' })); return; }
    if (action.kind === 'toggle') { ui.toggle(this.key(action.nodeId ?? '')); return; }
    if (action.kind === 'set-value') { ui.set(this.key(action.nodeId ?? ''), action.value); return; }
    if (action.kind === 'focus') { this.focus(action.nodeId ?? ''); return; }
    if (action.kind === 'emit') { this.emitAction(action, event); return; }
    ui.notice.set('Adapter required: ' + (action.sourceId ?? action.kind) + '/' + (action.operationId ?? ''));
  }
  private emitAction(action: Action, event: unknown): void {
    const name = action.event ?? '', expected = this.emitTypes[name], payload = this.payload(action.payload, event);
    const valid = expected === 'unknown' || (expected === 'void' ? payload === undefined : typeof payload === expected);
    if (!expected || !valid) { this.ui().notice.set('Invalid or undeclared component event: ' + name); return; }
    this.emitted.emit({ name, payload });
  }
  private payload(mapping: Mapping | undefined, event: unknown): unknown {
    if (!mapping || mapping.kind === 'none') return undefined;
    if (mapping.kind === 'event') return event;
    if (mapping.kind === 'value') return mapping.value;
    if (mapping.kind === 'draft') return this.ui().values()[this.key(mapping.nodeId ?? '')];
    if (mapping.kind === 'object') return Object.fromEntries(Object.entries(mapping.fields ?? {}).map(([key, value]) => [key, this.payload(value, event)]));
    return this.expression(mapping);
  }
  private focus(id: string): void {
    const key = this.key(id);
    const target = [...this.host.nativeElement.querySelectorAll<HTMLElement>('[data-wb-node]')].find(node => node.dataset.wbNode === key);
    target?.focus();
  }
}
`;
