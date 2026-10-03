import { posix } from 'node:path';
import type { TemplateSnapshot } from '../domain/contracts.ts';
import { editorBindings } from '../../../scripts/companion/sitemap/editor-bindings.ts';
import type { SitemapDesign } from '../../../scripts/companion/sitemap/model.ts';
import { componentFile, relativeImport, type Add } from '../../../scripts/companion/compiler/file-code.ts';
import { literal, type Model } from '../../../scripts/companion/compiler/model.ts';
import { journeyBootstrapCode } from './journey-bootstrap-code.ts';
import { journeyTestCode } from './journey-test-code.ts';

/** Copy the maintained editor, not a mock representation of its page. Only a closed binding opts in. */
export function journeyCode(template: TemplateSnapshot, m: Model, add: Add): void {
  const bindings = editorBindings(m.document.design as SitemapDesign);
  if (!bindings.length) return;
  const prefix = 'docs/concepts/companion/editor/', target = `${m.sourceRoot}/presentation/journey/`;
  const sources = template.frameworkFiles.filter(file => file.path.startsWith(prefix) && /\.(?:ts|vue|css)$/.test(file.path) && file.path !== prefix + 'ui.css');
  for (const required of ['main.ts','flow-context.ts','contracts.ts','components/SitemapEditor.vue','components/SitemapGraph.vue','workspace/JourneyWorkspace.vue','workspace/use-workspace.ts','workspace/contracts.ts']) {
    if (!sources.some(file=>file.path===prefix+required)) throw new Error('JOURNEY_TEMPLATE_MISSING: '+required);
  }
  const relocated = new Map(sources.map(file => [file.path, file.path === prefix + 'main.ts'
    ? `${m.sourceRoot}/bootstrap/journey-mount.ts` : target + file.path.slice(prefix.length)]));
  for (const file of sources) {
    const to = relocated.get(file.path)!;
    let source = file.content.replace("import './ui.css';\n", '');
    if (file.path === prefix + 'main.ts') {
      // The prototype bridge exports validators; a native mount is not that browser bridge.
      source = source.replace(/^import .* from '.*\/(?:authoring-contract|sitemap\/(?:validate|safety))\.ts';\r?\n/gm, '')
        .replace(/^export \{ validateAuthoringDocument,[^\n]+\r?\n/m, '')
        .replace('flow:FlowRuntime = root.ownerDocument.defaultView!.VueFlowCore', 'flow:FlowRuntime');
      if (source.includes('authoring-contract.ts') || source.includes('defaultView!.VueFlowCore')) throw new Error('JOURNEY_MOUNT_CONTRACT');
    }
    source = source.replace(/((?:from\s*|import\s*)['"])(\.[^'"]+)(['"])/g, (_match, before, path, after) => {
      const resolved = posix.normalize(posix.join(posix.dirname(file.path), path));
      return before + relativeImport(to, relocated.get(resolved) ?? resolved) + after;
    });
    add(to, source);
  }
  add(`${target}flow-module.d.ts`, `declare module 'virtual:journey-flow' { const runtime: import('./contracts.ts').FlowRuntime; export default runtime; }\ndeclare module 'virtual:journey-flow.css';\n`);
  for (const binding of bindings) {
    const screen = m.screens.find(screen => screen.id === binding.surface)!;
    add(`${m.sourceRoot}/presentation/components/screens/${componentFile(screen.slug, 'screen')}.vue`, `<script setup lang="ts">
import { useId } from 'vue';
import JourneyWorkspace from '../../journey/workspace/JourneyWorkspace.vue';
const heading = useId(), label = ${literal(screen.label)};
</script>
<template><section class="generated-screen" :aria-labelledby="heading"><h2 :id="heading">{{ label }}</h2><JourneyWorkspace /></section></template>
`);
  }
  journeyBootstrapCode(m, add);
  journeyTestCode(m, bindings[0]!.surface, add);
  add('design/journey-lens.json', JSON.stringify({ schema: 1, bindings, implementation: 'shared-journey-lens', persistence: 'reviewed-whole-project-vault-file', nativeAcceptance: 'not-inferred' }, null, 2) + '\n', 'managed');
  add('JOURNEY-LENS.md', `# Journey Lens in this generated plugin

Open the declared sitemap surface to use the actual Vue 3 / Nuxt UI / Vue Flow editor.
The editor is copied from the maintained framework source; it is not the static visual page definition.

Native views start with project.companion.json. Opening never creates a file. Enter a visible vault-relative
.json or .companion path, then Open file. To create a project, use Create from generated definition,
Validate and review, and the explicit approval checkbox. The parent folder must already exist.
Every applied editor command saves the complete validated project using the vault's serialized process operation.
JSON imports are inert data: they cannot supply code, paths for other writes, dependencies or permissions.

Each view owns its draft and undo history. Other views and external edits cannot be overwritten by stale approval.
An uncertain save blocks further writes to that file until explicit recovery reads and validates the stored bytes.
Download draft recovery before discarding edits. Export project returns the last saved full canonical definition,
not pending fields. Missing/corrupt files are never silently repaired. Closing a view discards its unexported draft;
committed changes reopen from the file. The chosen path is remembered for this plugin session, not across application restarts.

Browser clickdummies use the same editor and an explicitly labelled memory-only file store. Export JSON to retain
those edits. Resetting or closing the preview does not persist them in a vault.

Generated page/component/source screens outside this binding retain their existing implementation contracts.
Opening an adjacent editor is navigation, not a claim that all Companion editors have been implemented.
Regenerate from an exported canonical project through the normal reviewed plan/apply workflow; customized
extension files are preserved or reported as conflicts. This does not authorize publication or activation.

Native acceptance is executable through npm run test:obsidian -- --allow-download journey-lens.
It exercises create/edit/plugin reload and independent leaves in isolated native fixtures.
A generated test file is not evidence of a passing run; retain its actual host report separately.
`);
  const test = `${m.testRoot}/journey-generated.test.ts`;
  add(test, `import { it, expect } from 'vitest';
import { JourneyProjectStore } from ${literal(relativeImport(test,'scripts/companion/journey/project-store.ts'))};
import { SitemapSession } from ${literal(relativeImport(test,'scripts/companion/sitemap/session.ts'))};
import { seed } from ${literal(relativeImport(test,`${m.sourceRoot}/domain/journey-seed.ts`))};
it('saves the complete generated project and reopens an independent editor session',async()=>{
  let bytes=seed;
  const store=new JourneyProjectStore({read:async()=>bytes,create:async()=>({status:'conflict'}),replace:async(_path,before,next)=>{
    if(bytes!==before)return {status:'conflict'};bytes=next;return {status:'committed',content:bytes};
  }});
  const first=store.connect('project.companion.json'),session=new SitemapSession(first);
  await session.load();const snapshot=session.snapshot()!,node=snapshot.design.nodes.find(n=>n.kind!=='group')!;
  const plan=session.plan({type:'rename',surface:node.id,label:'Native journey test'});const outcome=await session.apply(plan);
  expect(outcome.status).toBe('committed');const second=store.connect('project.companion.json');await second.read();
  expect(JSON.parse(second.export()).design.nodes.find((n:{id:string})=>n.id===node.id).label).toBe('Native journey test');
  const original=JSON.parse(seed),saved=JSON.parse(bytes);expect(saved.project).toEqual(original.project);
  expect(saved.design.visualDesigns).toEqual(original.design.visualDesigns);expect(JSON.parse(second.export())).toEqual(saved);
  session.dispose();first.dispose();second.dispose();store.dispose();
});
`);
}
