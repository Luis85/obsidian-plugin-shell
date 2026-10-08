const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { journeyCode } from '../compiler/emitters/journey-code.ts';
import { journeyBootstrapCode } from '../compiler/emitters/journey-bootstrap-code.ts';
import { journeyTestCode } from '../compiler/emitters/journey-test-code.ts';
import { journeyDocument, model, recorder, template } from './support/compiler-emitters-fixture.mjs';
import { starterDocument } from '#shared/testing/starter-documents.mjs';

// Journey Lens emission (journey-{code,bootstrap-code,test-code}.ts): relocation, import rewriting, refusals and generated wiring.
const prefix = 'src/companion/editor/';
const required = ['main.ts', 'flow-context.ts', 'contracts.ts', 'components/SitemapEditor.vue', 'components/SitemapGraph.vue', 'workspace/JourneyWorkspace.vue', 'workspace/use-workspace.ts', 'workspace/contracts.ts'];
const editorTemplate = (main, extra = []) => ({ frameworkFiles: [
  ...required.map(path => ({ path: prefix + path, content: `// ${path}\n` })).map(file => file.path === prefix + 'main.ts' ? { ...file, content: main } : file),
  { path: prefix + 'components/SitemapEditor.vue', content: "import './ui.css';\nimport Graph from './SitemapGraph.vue';\nimport { flowKey } from \"../flow-context.ts\";\n" },
  { path: prefix + 'workspace/use-workspace.ts', content: "import { mount } from '../main.ts';\nimport { SitemapSession } from '../../sitemap/session.ts';\nimport('./contracts.ts');\nconst text = 'from ./not-an-import';\n" },
  { path: prefix + 'ui.css', content: 'body {}\n' }, { path: prefix + 'README.md', content: '# Editor\n' }, { path: 'docs/concepts/companion/other.ts', content: '' }, ...extra,
].filter((file, index, all) => all.findLastIndex(other => other.path === file.path) === index) });
const bridge = "import './ui.css';\nimport { validateAuthoringDocument } from '../../../../shared/companion/authoring-contract.ts';\nimport { validateSitemap } from '../../../../shared/companion/sitemap/validate.ts';\n"
  + "import { contracts } from './contracts.ts';\nexport { validateAuthoringDocument, validateSitemap };\nexport function start(root, flow:FlowRuntime = root.ownerDocument.defaultView!.VueFlowCore) { return [root, flow, contracts]; }\n";

test('the closed editor binding relocates editor sources and rewrites every relative import exactly', async () => {
  const m = model(await journeyDocument()), out = recorder();
  journeyCode(editorTemplate(bridge), m, out.add);
  const editor = 'src/plugin/generated/presentation/journey/';
  assert.deepEqual([...out.files.keys()], [editor + 'main.ts', editor + 'flow-context.ts', editor + 'contracts.ts', editor + 'components/SitemapGraph.vue', editor + 'workspace/JourneyWorkspace.vue',
    editor + 'workspace/contracts.ts', editor + 'components/SitemapEditor.vue', editor + 'workspace/use-workspace.ts', 'docs/concepts/companion/other.ts', editor + 'flow-module.d.ts',
    'src/plugin/generated/presentation/components/screens/inbox-screen.vue', 'src/plugin/generated/domain/journey-seed.ts', 'src/plugin/generated/bootstrap/journey-workspace.ts',
    'src/plugin/generated/bootstrap/journey-native.ts', 'src/plugin/generated/bootstrap/journey-preview.ts', 'tooling/tests/obsidian/journey-lens.obsidian.ts', 'design/journey-lens.json', 'JOURNEY-LENS.md',
    'src/plugin/tests/project/journey-generated.test.ts'].map(path => path === editor + 'main.ts' ? 'src/plugin/generated/bootstrap/journey-mount.ts' : path).filter(path => !path.startsWith('docs/')));
  assert.equal(out.text('src/plugin/generated/bootstrap/journey-mount.ts'), "import { contracts } from '../presentation/journey/contracts.ts';\nexport function start(root, flow:FlowRuntime) { return [root, flow, contracts]; }\n");
  assert.equal(out.text(editor + 'components/SitemapEditor.vue'), "import Graph from './SitemapGraph.vue';\nimport { flowKey } from \"../flow-context.ts\";\n");
  assert.equal(out.text(editor + 'workspace/use-workspace.ts'), "import { mount } from '../../../bootstrap/journey-mount.ts';\nimport { SitemapSession } from '../../../../../companion/sitemap/session.ts';\nimport('./contracts.ts');\nconst text = 'from ./not-an-import';\n");
  assert.equal(out.text(editor + 'contracts.ts'), '// contracts.ts\n');
  assert.equal(out.text(editor + 'flow-module.d.ts'), "declare module 'virtual:journey-flow' { const runtime: import('./contracts.ts').FlowRuntime; export default runtime; }\ndeclare module 'virtual:journey-flow.css';\n");
  assert.equal(out.text('src/plugin/generated/presentation/components/screens/inbox-screen.vue'), `<script setup lang="ts">
import { useId } from 'vue';
import JourneyWorkspace from '../../journey/workspace/JourneyWorkspace.vue';
const heading = useId(), label = "Capture inbox";
</script>
<template><section class="generated-screen" :aria-labelledby="heading"><h2 :id="heading">{{ label }}</h2><JourneyWorkspace /></section></template>
`);
  assert.deepEqual(JSON.parse(out.text('design/journey-lens.json')), { schema: 1, bindings: [{ surface: 'node-2', editor: 'journey-lens' }],
    implementation: 'shared-journey-lens', persistence: 'reviewed-whole-project-vault-file', nativeAcceptance: 'not-inferred' });
  assert.equal(out.files.get('design/journey-lens.json').ownership, 'managed');
  assert.ok(out.text('JOURNEY-LENS.md').startsWith('# Journey Lens in this generated plugin\n\nOpen the declared sitemap surface'));
  const generated = out.text('src/plugin/tests/project/journey-generated.test.ts').split('\n');
  assert.deepEqual(generated.slice(1, 4), ["import { JourneyProjectStore } from \"../../../shared/companion/journey/project-store.ts\";",
    "import { SitemapSession } from \"../../../shared/companion/sitemap/session.ts\";", "import { seed } from \"../../generated/domain/journey-seed.ts\";"]);
});

test('the real maintained editor template is copied completely for a custom-root project', async () => {
  const m = model(await journeyDocument(true)), out = recorder();
  journeyCode(template, m, out.add);
  const sources = template.frameworkFiles.filter(file => file.path.startsWith(prefix) && /\.(?:ts|vue|css)$/.test(file.path) && file.path !== prefix + 'ui.css');
  const relocated = sources.map(file => file.path === prefix + 'main.ts' ? 'application/source/generated/bootstrap/journey-mount.ts'
    : 'application/source/generated/presentation/journey/' + file.path.slice(prefix.length));
  assert.deepEqual([...out.files.keys()].slice(0, relocated.length), relocated);
  for (const path of relocated) assert.equal(out.files.get(path).ownership, 'extension');
  const mount = out.text('application/source/generated/bootstrap/journey-mount.ts');
  assert.ok(!mount.includes('authoring-contract.ts') && !mount.includes("import './ui.css'") && !mount.includes('defaultView!.VueFlowCore'));
  // The extracted kit ships the compiled CLI, not bin/ sources, so the mount must not reach into them.
  assert.ok(!mount.includes('/bin/') && !mount.includes('parseBrowserStarter'), 'the native mount drops the starter bridge');
  assert.ok(mount.includes("from '../../../../../shared/companion/tooling-contract.ts';"));
  assert.ok(out.files.has('checks/project/journey-generated.test.ts') && out.files.has('application/source/generated/presentation/components/screens/inbox-screen.vue'));
});

test('journey emission is opt-in and refuses an incomplete or still-bridged editor template', async () => {
  const unbound = recorder(); journeyCode(editorTemplate(bridge), model(await starterDocument('quick-capture')), unbound.add);
  assert.equal(unbound.files.size, 0);
  const m = model(await journeyDocument());
  const missing = editorTemplate(bridge); missing.frameworkFiles = missing.frameworkFiles.filter(file => file.path !== prefix + 'workspace/contracts.ts');
  assert.throws(() => journeyCode(missing, m, recorder().add), { message: 'JOURNEY_TEMPLATE_MISSING: workspace/contracts.ts' });
  for (const leaked of ["const contract = 'authoring-contract.ts';\n", 'const flow = root.ownerDocument.defaultView!.VueFlowCore;\n', "import { x } from '../../../../src/cli/adapters/starters/browser.ts';\n"])
    assert.throws(() => journeyCode(editorTemplate(leaked), m, recorder().add), { message: 'JOURNEY_MOUNT_CONTRACT' });
});

test('native and preview composition roots share one editor and keep disjoint storage', async () => {
  const document = await journeyDocument(true), m = model(document), out = recorder();
  journeyBootstrapCode(m, out.add);
  const base = 'application/source/generated/';
  assert.deepEqual([...out.files].map(([path, entry]) => [path, entry.ownership]), [[base + 'domain/journey-seed.ts', 'managed'],
    [base + 'bootstrap/journey-workspace.ts', 'extension'], [base + 'bootstrap/journey-native.ts', 'extension'], [base + 'bootstrap/journey-preview.ts', 'extension']]);
  const seed = out.text(base + 'domain/journey-seed.ts');
  const prefixText = '/** Complete inert seed. Reading the native view never writes it automatically. */\nexport const seed: string = ';
  assert.ok(seed.startsWith(prefixText) && seed.endsWith(';\n'));
  assert.deepEqual(JSON.parse(JSON.parse(seed.slice(prefixText.length, -2))), m.document);
  const workspace = out.text(base + 'bootstrap/journey-workspace.ts').split('\n');
  assert.equal(workspace[2], 'import type { JourneyProjectStore } from "../../../../../shared/companion/journey/project-store.ts";');
  assert.equal(workspace[12], "  const navigation=useNavigation(pinia),id=\"quick-capture\"+'-journey-'+(++runtime.serial);");
  assert.equal(workspace[14], '    store:runtime.store,seed,mode:runtime.mode,ownerId:"quick-capture",initialPath:runtime.path,');
  const native = out.text(base + 'bootstrap/journey-native.ts').split('\n');
  assert.deepEqual(native.slice(1, 3), ['import { JourneyProjectStore } from "../../../../../shared/companion/journey/project-store.ts";',
    'import { journeyVaultFiles } from "../../../../templates/companion/runtime/journey-vault.ts";']);
  const preview = out.text(base + 'bootstrap/journey-preview.ts');
  assert.ok(preview.startsWith('import { JourneyProjectStore } from "../../../../../shared/companion/journey/project-store.ts";\nimport type { JourneyRuntime } from \'./journey-workspace.ts\';\n'));
  assert.ok(!preview.includes('obsidian') && preview.includes("return {store,mode:'preview',path:'project.companion.json',serial:0,dispose(){store.dispose();files.clear();}};"));
});

test('the native acceptance suite targets the bound surface view type', async () => {
  const m = model(await journeyDocument(true)), out = recorder();
  journeyTestCode(m, 'node-2', out.add);
  assert.deepEqual([...out.files.keys()], ['tooling/tests/obsidian/journey-lens.obsidian.ts']);
  const lines = out.text('tooling/tests/obsidian/journey-lens.obsidian.ts').split('\n');
  assert.deepEqual(lines.slice(0, 5), ["import { expect } from 'vitest';", "import { expect as browserExpect } from '@playwright/test';", "import { test } from './support/obsidian-fixture';",
    'import { seed } from "../../application/source/generated/domain/journey-seed.ts";', 'const suffix = "-view-project-workbench-inbox";']);
  assert.equal(lines.filter(line => line.startsWith('test(')).length, 2);
});
