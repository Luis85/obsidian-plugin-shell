import { literal, json, digest, type Model } from '../../../companion/compiler/model.ts';
import { validateAuthoringDocument } from '../../../companion/authoring-contract.ts';
import { emptyVisualDesigns, type VisualDesigns } from '../../../companion/visual/visual-ir.mjs';
import { angularDefinitionSource, type AngularDefinition, type AngularGap } from './angular-brick-templates.ts';
import { compositionTheme } from '../../../companion/composition-contract.mjs';
import { angularBrickRuntime } from './angular-brick-runtime.ts';
/** AOT component/page sources are derived from the canonical IR, not from user-supplied template strings. */
export function angularBrickFiles(model: Model): Record<string, string> {
  const document = validateAuthoringDocument(model.document);
  const raw = document.design.visualDesigns ?? emptyVisualDesigns();
  const store = raw as VisualDesigns; // Authoring validation includes the complete shared visual contract.
  const definitions: AngularDefinition[] = [
    ...store.components.map(component => ({ key: component.id, nodes: component.template, contract: component, ...(component.implementation ? { adapterRequired: 'Component implementation ' + component.implementation.entryId + ' requires an Angular adapter.' } : {}) })),
    ...store.revisions.map(revision => ({ key: revision.id, nodes: revision.template, contract: revision.contract, designSystem: revision.designSystem })),
    ...model.screens.filter(page => !['group', 'action'].includes(page.kind)).map(page => ({ key: page.id,
      nodes: store.pages.find(item => item.ownerId === page.id)?.root ?? [] })),
  ].map(definition => ({ ...definition, name: 'Brick_' + definition.key.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32) + '_' + digest(definition.key).slice(0, 12), selector: 'wb-brick-' + digest(definition.key).slice(0, 16) }));
  const gaps: AngularGap[] = [];
  const files = Object.fromEntries(definitions.map(definition => ['src/ui/' + definition.name + '.ts', angularDefinitionSource(definition, definitions, gaps, definition.designSystem ?? document.design.designSystem)]));
  const routes = document.design.sitemap?.routes ?? [];
  files['src/core/brick-manifest.ts'] = `// Contracts and routes are source data. Providers/business operations are not implemented by this manifest.\nexport const brickManifest: { routes: readonly { id: string; surface: string; path: string }[]; journeys: readonly unknown[]; entities: readonly unknown[]; dataSources: readonly unknown[]; definitions: readonly {id: string; source: string}[]; adapterRequirements: readonly {definition: string; node: string; reason: string}[] } = ${literal({
    routes, journeys: document.design.sitemap?.journeys ?? [], entities: model.entities, dataSources: model.sources,
    definitions: definitions.map(({ key, name }) => ({ id: key, source: 'src/ui/' + name + '.ts' })), adapterRequirements: gaps,
  })} as const;\n`;
  files['design/angular-capabilities.json'] = json({ schemaVersion: 1, nativeTemplates: true, routes: 'browser-hash',
    definitions: definitions.map(({ key, name, selector }) => ({ id: key, source: 'src/ui/' + name + '.ts', selector })),
    supported: ['native-elements', 'text', 'project-components', 'pinned-revisions', 'props', 'slots', 'variants', 'layout', 'visibility', 'navigate', 'set-state', 'toggle', 'focus', 'emit'],
    adapterRequirements: gaps, businessAcceptance: 'not-run' });
  files['src/ui/brick-runtime.ts'] = angularBrickRuntime;
  files['src/ui/Starter.ts'] = starter(model, definitions);
  return files;
}
function starter(model: Model, definitions: AngularDefinition[]): string {
  const system = validateAuthoringDocument(model.document).design.designSystem;
  const theme = (dark: boolean) => Object.entries(compositionTheme(system, dark)).map(([key, value]) => key + ':' + value).join(';');
  const styles = `:host{display:block;container-type:inline-size;container-name:wb-view;${theme(false)}}@media(prefers-color-scheme:dark){:host{${theme(true)}}}`;
  const pages = model.screens.filter(page => !['group', 'action'].includes(page.kind));
  const components = pages.map(page => ({ page, definition: definitions.find(item => item.key === page.id)! }));
  const branches = components.map(({ page, definition }) => `@case (${literal(page.id)}) { <${definition.selector} [ui]="ui" [scope]="current()"/> }`).join('\n');
  return `import { Component, ElementRef, inject, signal, computed, viewChild, type OnDestroy } from '@angular/core';
import { project, scaffoldNotice, type Page } from '../core/project.ts';
import { brickManifest } from '../core/brick-manifest.ts';
import { BrickState } from './brick-runtime.ts';
${components.map(({ definition }) => `import { ${definition.name} } from './${definition.name}.ts';`).join('\n')}
@Component({ selector: 'project-surface', standalone: true, imports: [${components.map(({ definition }) => definition.name).join(', ')}],
  template: ${literal(`<h1>{{ project.title }}</h1><p role="status">{{ notice }}</p>
    <nav aria-label="Project pages">@for (item of project.pages; track item.id) {
      <button type="button" [attr.aria-current]="item.id === current() ? 'page' : null" (click)="select(item.id)">{{ item.title }}</button>
    }</nav><p role="status" aria-live="polite">{{ ui.notice() }}</p><main #main tabindex="-1" [attr.data-preview-state]="ui.preview(current())">@if (page(); as selected) {
      <h2>{{ selected.title }}</h2><p>{{ selected.goal }}</p>
      @switch (current()) { ${branches} }
    } @else { <p>No pages yet.</p> }</main>`)}, styles: [${literal(styles)}] })
export class Starter implements OnDestroy {
  readonly project = project; readonly notice = scaffoldNotice;
  readonly current = signal<string>(${literal(pages.find(page => page.entry)?.id ?? pages[0]?.id ?? '')});
  readonly page = computed<Page | undefined>(() => project.pages.find(item => item.id === this.current()));
  readonly main = viewChild<ElementRef<HTMLElement>>('main');
  readonly ui = new BrickState(id => this.select(id));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly window = this.host.nativeElement.classList.contains('browser-project') ? this.host.nativeElement.ownerDocument.defaultView : null;
  private readonly hashChanged = () => {
    const route = brickManifest.routes.find(item => '#' + item.path === this.window?.location.hash);
    if (route && project.pages.some(page => page.id === route.surface)) this.select(route.surface, false);
  };
  constructor() { this.window?.addEventListener('hashchange', this.hashChanged); this.hashChanged(); }
  select(id: string, updateHash = true): void {
    if (!project.pages.some(page => page.id === id)) { this.ui.notice.set('Unknown page: ' + id); return; }
    this.current.set(id); this.ui.states.set({}); this.ui.notice.set('');
    const route = brickManifest.routes.find(item => item.surface === id);
    if (updateHash && route && this.window) this.window.location.hash = route.path;
    this.main()?.nativeElement.focus();
  }
  ngOnDestroy(): void { this.window?.removeEventListener('hashchange', this.hashChanged); }
}
`;
}
