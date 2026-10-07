const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { hostCode } from '../../src/cli/compiler/emitters/host-code.ts';
import { uiCode } from '../../src/cli/compiler/emitters/ui-code.ts';
import { navigationCode } from '../../src/cli/compiler/emitters/navigation-code.ts';
import { clickdummyCode } from '../../src/cli/compiler/emitters/clickdummy-code.ts';
import { previewCode, previewScripts } from '../../src/cli/compiler/emitters/preview-code.ts';
import { styleCode } from '../../src/cli/compiler/emitters/style-code.ts';
import { journeyDocument, dataDocument, richVisualDocument, model, recorder } from './compiler-emitters-fixture.mjs';
import { starterDocument } from '../support/starter-documents.mjs';

// Plugin host, workbench UI, navigation, browser clickdummy, source preview and style emission.
const run = (emitter, m) => { const out = recorder(); emitter(m, out.add); return out; };
const lines = (out, path) => out.text(path).split('\n');
const plain = async () => model(await starterDocument('blank'));

test('the plugin host wires the journey runtime and relationship integrity only when declared', async () => {
  const blank = run(hostCode, await plain()), journey = run(hostCode, model(await journeyDocument())), data = run(hostCode, model(await dataDocument()));
  assert.deepEqual([...blank.files.keys()], ['src/generated/bootstrap/install.ts', 'src/generated/bootstrap/source-providers.ts', 'src/generated/bootstrap/mount.ts', 'src/main.ts', 'src/generated/styles/layout.css']);
  const install = 'src/generated/bootstrap/install.ts', mount = 'src/generated/bootstrap/mount.ts';
  assert.deepEqual(lines(blank, install).slice(1, 3), ['import { createServices } from "../../bootstrap/services.ts";', 'import { bindNativeIntegrations } from "../../infrastructure/obsidian/native-integrations.ts";']);
  assert.equal(lines(blank, install)[14], ''); assert.equal(lines(data, install)[14], "import { disposeRelationshipIntegrity } from './relationships.ts';");
  assert.equal(lines(data, install)[29], '    disposeRelationshipIntegrity(shell);'); assert.equal(lines(blank, install)[29], '    ');
  assert.deepEqual(lines(journey, install).slice(16, 21), ["import { mountProject } from './mount.ts';", "import { createJourneyNative } from './journey-native.ts';",
    'export async function initializeProject(plugin: Plugin) {', '  const shell = await createServices(nativeAdapters(plugin));',
    "  const journey = createJourneyNative(plugin.app.vault, () => shell.diagnostics.report('journey.storage', 'project.file'));"]);
  for (const [out, suffix] of [[blank, ''], [journey, ',journey']]) {
    const text = out.text(install);
    assert.ok(text.includes(`modal.onOpen = () => { release = mountProject(modal.contentEl,shell,sources,openModal,id,true${suffix}); };`));
    assert.ok(text.includes(`element => mountProject(element,shell,sources,openModal,definition.id${suffix ? ',false,journey' : ''}),`));
    assert.ok(text.includes(`this.release = mountProject(this.containerEl,shell,sources,openModal,screen.id,true${suffix}); settings.add(this.release); }`));
  }
  assert.ok(journey.text(install).includes('    stopNative();\n    journey.dispose();\n'));
  assert.ok(journey.text(mount).includes("import { provideJourney, type JourneyRuntime } from './journey-workspace.ts';\nexport function mountProject(root: HTMLElement,shell: Services,sources: Sources,openModal: (id: string) => void,initial?: string,isolated = false,journey?: JourneyRuntime) {"));
  assert.ok(journey.text(mount).includes('    if (journey) provideJourney(app,pinia,journey);\n    mounted = true;'));
  assert.ok(blank.text(mount).includes("import '../presentation/detail-layout.css';\nexport function mountProject(root: HTMLElement,shell: Services,sources: Sources,openModal: (id: string) => void,initial?: string,isolated = false) {"));
  assert.equal(blank.text('src/main.ts'), `import { Plugin } from 'obsidian';
import { initializeProject } from "./generated/bootstrap/install.ts";
import './styles/app.css';
import "./generated/styles/project.css";
export default class GeneratedPlugin extends Plugin {
  private runtime?: Awaited<ReturnType<typeof initializeProject>>;
  async onload(): Promise<void> { this.runtime = await initializeProject(this); }
  onunload(): void { this.runtime?.dispose(); }
}
`);
  assert.equal(blank.text('src/generated/bootstrap/source-providers.ts'), `import type { Services } from "../../bootstrap/services.ts";
import type { SourcePorts } from '../application/sources.ts';
/** Developer-owned runtime configuration. Portable JSON never authorizes network access.
 * Return complete source ports. Dispose each configured provider on plugin unload. */
export const configureSourceProviders: (shell: Services) => {ports: Partial<SourcePorts>; dispose(): void} = () => ({ports: {}, dispose() {}});
`);
});

test('the workbench UI renders screens, components, flows and a journey-aware smoke test', async () => {
  const m = model(await dataDocument());
  m.screens[1].components = ['record-card-a', 'record-card-b']; m.components.push({ id: 'record-card-a', name: 'A', description: 'First' }, { id: 'list', name: 'List' });
  m.screens[1].components = ['record-card-a', 'list'];
  m.flows.push({ ...m.flows[0], id: 'ds-flow-9', operation: 'ds-operation-9', direction: 'write', label: 'Archive', trigger: 'manual' });
  const out = run(uiCode, m);
  assert.equal(out.text('src/generated/domain/components/record-card-a.ts'), 'export const specification = {"id":"record-card-a","name":"A","description":"First"};\n');
  assert.ok(out.files.has('src/generated/presentation/components/library/list-component.vue'));
  const screen = lines(out, 'src/generated/presentation/components/screens/tasks-screen.vue');
  assert.deepEqual(screen.slice(2, 5), ["import C0 from '../library/record-card-a.vue';", "import C1 from '../library/list-component.vue';", 'const model = useScreen("node-2");']);
  assert.deepEqual(screen.slice(10, 12), ['    <C0 />', '    <C1 />']);
  const flows = lines(out, 'src/generated/bootstrap/flows.ts');
  // Only the source a flow runs is imported and bound; the flow-less task-notes and status-api sources stay unbound.
  assert.deepEqual(flows.slice(0, 1), ["import { defineGStarterRecordsStore } from '../presentation/stores/starter-records.ts';"]);
  assert.ok(!flows.some(line => line.includes('GTaskNotes') || line.includes('GStatusApi')));
  assert.equal(flows[6], '  return [{id:"ds-flow-3",card:"node-2",label:"Read declared records",trigger:"manual",direction:"read",requiresInput:false,get pending(){return GStarterRecords["list-records"].pending;},get error(){return GStarterRecords["list-records"].error;},run: () => GStarterRecords["list-records"].execute(undefined)},');
  assert.equal(flows[7], `{id:"ds-flow-9",card:"node-2",label:"Archive",trigger:"manual",direction:"write",requiresInput:true,get pending(){return GStarterRecords["archive"].pending;},get error(){return GStarterRecords["archive"].error;},run: async () => ({ok:false,code:'input-mapping-required'})}];`);
  assert.equal(lines(out, 'src/generated/bootstrap/panels.ts')[0], "import GWorkspace from '../presentation/components/screens/workspace-screen.vue';");
  const plainUi = run(uiCode, await plain());
  assert.equal(plainUi.text('src/generated/bootstrap/flows.ts'), "\nimport type { Pinia } from 'pinia';\nimport type { Sources } from '../application/sources.ts';\nimport type { Flow } from '../presentation/context/project.ts';\nexport const bindFlows: (sources: Sources, pinia: Pinia) => Flow[] = () => [];\n");
  const smoke = plainUi.text('tests/project/workbench.test.ts');
  assert.ok(smoke.includes("import { mount } from '@vue/test-utils';") && !smoke.includes('journey'));
  const journey = run(uiCode, model(await journeyDocument())).text('tests/project/workbench.test.ts');
  assert.ok(journey.includes("import { mount, flushPromises } from '@vue/test-utils';") && journey.includes('const journey=createJourneyPreview(); ') && journey.includes('journey.dispose(); disposePinia(pinia);'));
});

test('navigation tests follow navigable edges and leave business interactions as TODOs', async () => {
  const m = model(await journeyDocument());
  m.screens.push({ ...m.screens[1], id: 'node-90', slug: 'group-a', kind: 'group' }, { ...m.screens[1], id: 'node-91', slug: 'act', kind: 'action' });
  m.links.push({ id: 'edge-90', from: 'node-2', to: 'node-4', kind: 'submit', label: 'Submit' }, { id: 'edge-91', from: 'node-2', to: 'node-91', kind: 'navigate', label: 'Act' },
    { id: 'edge-92', from: 'node-90', to: 'node-2', kind: 'navigate', label: 'From group' });
  const out = run(navigationCode, m), cases = lines(out, 'tests/project/navigation.test.ts');
  assert.deepEqual(cases.slice(3, 9).map(line => line.slice(0, 40)), ['it("[edge-6] Open capture inbox", () => ', 'it("[edge-7] Open capture an idea", () =',
    'it("[edge-8] Open captured item", () => ', 'it.todo("[edge-90] Submit requires busin', 'it.todo("[edge-91] Act requires business',
    'it.todo("[edge-92] From group requires b']);
  assert.ok(cases[4].includes('expect(result).toEqual({kind:"modal",target:"node-3"}); expect(nav.current).toBe("node-2");'));
  const store = out.text('src/generated/presentation/stores/navigation.ts');
  assert.ok(store.startsWith("import { defineStore } from 'pinia';\nimport { screens, interactions } from '../../domain/screens.ts';\nexport const useNavigation = defineStore(\"quick-capture:navigation\", {"));
  assert.ok(store.includes(', leaveGuard: null as (() => boolean) | null }),') && store.includes('    back() { if (this.leaveGuard && !this.leaveGuard()) return; const id'));
  const blank = run(navigationCode, await plain()).text('src/generated/presentation/stores/navigation.ts');
  assert.ok(!blank.includes('leaveGuard') && blank.includes('    back() { const id = this.history.pop(); if (id) this.current = id; },'));
  assert.equal(out.files.get('src/generated/domain/screens.ts').ownership, 'managed');
});

test('the clickdummy composes read-only synthetic sources, scenarios and the journey preview', async () => {
  const routed = model(richVisualDocument()); routed.document.design.sitemap = { routes: [{ id: 'route-1', surface: 'node-27', path: '/library' }] };
  const rich = run(clickdummyCode, routed);
  assert.deepEqual([...rich.files.keys()], ['harness/prototype/clickdummy-host.ts', 'harness/prototype/clickdummy-scenarios.ts', 'src/generated/bootstrap/clickdummy-sources.ts',
    'src/generated/presentation/context/clickdummy.ts', 'src/generated/presentation/components/ClickdummyPreview.vue', 'harness/prototype/clickdummy.ts', 'harness/prototype/clickdummy.css']);
  assert.ok(rich.text('harness/prototype/clickdummy-scenarios.ts').includes('const scenarios: readonly PreviewScenario[] = [{"id":"filled","definition":"vp-15","surface":"node-27","name":"Filled","state":"default","width":"wide"}];\n'));
  const sources = rich.text('src/generated/bootstrap/clickdummy-sources.ts');
  assert.ok(sources.includes('"save-record": async () => { throw new Error(\'NOT_IMPLEMENTED: Clickdummy has no business-write adapter.\'); },\n"touch": async () => { throw new Error('));
  assert.ok(sources.includes('"list-components": async () => { return [{"id":"fixture","type":"component","title":"fixture"}]; }'));
  const entry = lines(rich, 'harness/prototype/clickdummy.ts');
  assert.equal(entry[3], 'import Preview from "../../src/generated/presentation/components/ClickdummyPreview.vue";');
  assert.equal(entry.find(line => line.startsWith('const owner')), 'const owner = "plugin-companion", name = "Plugin Companion";');
  assert.ok(entry.includes('const routes: ReadonlyArray<{id: string; surface: string; path: string}> = [{"id":"route-1","surface":"node-27","path":"/library"}];'));
  assert.ok(!rich.text('harness/prototype/clickdummy.ts').includes('journey'));
  const journey = run(clickdummyCode, model(await journeyDocument()));
  const listed = journey.text('harness/prototype/clickdummy-scenarios.ts').split('\n')[4];
  assert.ok(listed.startsWith('const scenarios: readonly PreviewScenario[] = [') && listed.endsWith('];'));
  const scenarios = JSON.parse(listed.slice(listed.indexOf('= ') + 2, -1));
  assert.deepEqual([...new Set(scenarios.map(item => item.surface + ':' + item.definition))], ['node-3:vp-16', 'node-4:vp-31', 'node-5:vp-46']);
  assert.deepEqual(scenarios[0], { id: 'scenario-33', definition: 'vp-16', surface: 'node-3', name: 'Default synthetic example', state: 'default', width: 'wide' });
  assert.ok(journey.text('src/generated/presentation/context/clickdummy.ts').includes('  selectScenario(id: string): void;\n  editorSurface(): boolean;\n'));
  const preview = journey.text('src/generated/presentation/components/ClickdummyPreview.vue');
  assert.ok(preview.includes('; ($event.target as HTMLSelectElement).value = model.current()"') && preview.includes(' :disabled="model.editorSurface()"'));
  const composed = journey.text('harness/prototype/clickdummy.ts');
  assert.ok(composed.includes('import { createJourneyPreview } from "../../src/generated/bootstrap/journey-preview.ts";\nimport { provideJourney } from "../../src/generated/bootstrap/journey-workspace.ts";\nimport \'./clickdummy.css\';'));
  assert.ok(composed.includes('      editorSurface: () => ["node-2"].includes(navigation.current),\n'));
  const blank = run(clickdummyCode, await plain());
  assert.ok(blank.text('src/generated/bootstrap/clickdummy-sources.ts').endsWith('export function createClickdummySources(): Sources { return {}; }\n'));
  assert.ok(blank.text('harness/prototype/clickdummy.ts').includes('const routes: ReadonlyArray<{id: string; surface: string; path: string}> = [];'));
  const host = blank.text('harness/prototype/clickdummy-host.ts');
  assert.ok(host.startsWith('type Dispose = () => void;\ninterface DialogOptions {') && host.includes('export function createPreviewLifecycle(window: Window, options: LifecycleOptions) {'));
});

test('source preview and Airship configuration follow the canonical tooling options', async () => {
  const m = await plain(), out = run(previewCode, m);
  assert.deepEqual([...out.files.keys()], ['harness/prototype/index.html', 'configs/bundling/vite.preview.config.mjs', 'AIRSHIP.md']);
  assert.equal(out.text('harness/prototype/index.html'), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source preview</title></head>
<body class="theme-dark"><main id="prototype-app" class="ps--my-vault-tool" data-plugin-ui="my-vault-tool"></main>
<script type="module" src="/harness/prototype/clickdummy.ts"></script></body></html>
`);
  assert.equal(out.text('configs/bundling/vite.preview.config.mjs'), "import { previewConfig } from '../../scripts/airship/preview-config.mjs';\nexport default previewConfig(\"src/generated\");\n");
  m.document.tooling = { airship: { enabled: true } };
  const enabled = run(previewCode, m);
  assert.deepEqual([...enabled.files.keys()], ['harness/prototype/index.html', 'configs/bundling/vite.preview.config.mjs', 'airship.config.json', 'AIRSHIP.md']);
  assert.ok(JSON.parse(enabled.text('airship.config.json')));
  assert.deepEqual(Object.keys(previewScripts()), ['dev:preview', 'airship:status', 'airship:enable', 'airship:disable', 'airship:install', 'airship:start', 'airship:doctor']);
});

test('design-system styles always emit the same fragments and a managed manifest', async () => {
  const out = run(styleCode, await plain());
  const pieces = ['fonts', 'typography', 'spacing', 'sizes', 'radii', 'colors', 'theme'];
  assert.deepEqual([...out.files].map(([path, entry]) => [path, entry.ownership]), [...pieces.map(name => [`src/generated/styles/design-system/${name}.css`, 'managed']),
    ['src/generated/styles/design-system.css', 'managed'], ['src/generated/styles/project.css', 'managed'], ['src/generated/styles/custom.css', 'extension'], ['design/style-manifest.json', 'managed']]);
  assert.equal(out.text('src/generated/styles/design-system.css'), pieces.map(name => `@import "./design-system/${name}.css";`).join('\n') + '\n');
  assert.equal(out.text('src/generated/styles/project.css'), '@import "./layout.css";\n@import "./design-system.css";\n@import "./custom.css";\n');
  assert.equal(out.text('src/generated/styles/custom.css'), '/* Application-specific overrides. Use owned selectors and design-system variables. */\n');
});
