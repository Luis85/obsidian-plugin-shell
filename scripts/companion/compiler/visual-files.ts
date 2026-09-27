import type { TemplateSnapshot } from '../../compiler/domain/contracts.ts';
import type { ComponentDefinition, ExternalNode, Interaction } from '../visual/visual-ir.mjs';
import { visualAssert, visualNodes, visualRoot } from '../visual/visual-ir.mjs';
import { visualTestSource } from '../visual/visual-session.mjs';
import type { VisualSpec } from '../runtime/visual-runtime.ts';
import { literal, json, requireValue, type Model } from './model.ts';
import { componentFile, relativeImport, type Add } from './file-code.ts';
import { visualDefinitions, visualSpecs, visualDefinitionPath, visualAdapterPath, visualContractTypes } from './visual-model.ts';
import { visualSfc } from './visual-code.ts';
import { visualPorts, visualSources } from './visual-ports.ts';
import { visualTests } from './visual-tests.ts';
import { visualRuntimeTests } from './visual-runtime-tests.ts';

/** How a generated interaction is verified: routed navigation, a declarative source/emit action, an executable UI effect or a business TODO. */
export type VisualVerification = 'navigation' | 'declarative-action' | 'executable-ui-effect' | 'business-todo';
export function visualVerification(interaction: Interaction): VisualVerification {
  const kinds = interaction.actions.map(a => a.kind);
  if (!kinds.length) return 'business-todo';
  if (kinds.some(kind => kind === 'source' || kind === 'emit')) return 'declarative-action';
  return kinds.some(kind => kind !== 'navigate') ? 'executable-ui-effect' : 'navigation';
}
/** Business acceptance stays a TODO for hooks, declarative actions and navigation that states acceptance; UI effects are executable. */
export function visualAcceptanceTodo(interaction: Interaction): boolean {
  const verification = visualVerification(interaction);
  return verification === 'business-todo' || verification === 'declarative-action' || (verification === 'navigation' && interaction.acceptance !== '');
}
/** Identifiers become file names: no separators, dots or drive/stream characters. */
function vfFileId(value: string, what: string): string {
  visualAssert(/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value), `${what} ${JSON.stringify(value)} cannot name a generated file.`);
  return value;
}
function vfRewrite(source: string, pairs: [string, string][], file: string): string {
  for (const [from, to] of pairs) { requireValue(source.includes(from), `Template ${file} no longer imports ${from}.`); source = source.replaceAll(from, to); }
  return source;
}
/** Runtime modules are copied from the trusted template with import paths rewritten to the generated layout. */
async function vfRuntime(templateRoot: TemplateSnapshot, m: Model, add: Add): Promise<void> {
  const read = (path: string) => templateRoot.text(['scripts/companion', path].join('/')), domain = `${m.sourceRoot}/domain`;
  for (const file of ['detail-controls.ts', 'detail-actions.ts']) add(`${domain}/${file}`, await read('runtime/' + file));
  add(`${domain}/visual-runtime.ts`, vfRewrite(await read('runtime/visual-runtime.ts'), [["'../visual/visual-ir.mjs'", "'./visual/visual-ir.mjs'"]], 'visual-runtime.ts'));
  for (const name of ['composition-contract.mjs', 'composition-contract.d.mts']) add(`${domain}/${name}`, await read(name));
  for (const name of ['visual-ir.mjs', 'visual-ir.d.mts', 'visual-session.mjs', 'visual-session.d.mts']) add(`${domain}/visual/${name}`, await read('visual/' + name));
  add(`${m.sourceRoot}/presentation/composables/use-visual.ts`, vfRewrite(await read('runtime/use-visual.ts'), [
    ["'./detail-controls.ts'", "'../../domain/detail-controls.ts'"], ["'./detail-actions.ts'", "'../../domain/detail-actions.ts'"],
    ["'../composition-contract.mjs'", "'../../domain/composition-contract.mjs'"], ["'../visual/visual-session.mjs'", "'../../domain/visual/visual-session.mjs'"],
    ["'../visual/visual-ir.mjs'", "'../../domain/visual/visual-ir.mjs'"], ["'./visual-runtime.ts'", "'../../domain/visual-runtime.ts'"],
  ], 'use-visual.ts'));
}
/** Extension-owned bridge to a declared package: typed props, stubs that fail loudly until implemented. */
function vfAdapter(m: Model, component: ComponentDefinition, node: ExternalNode, add: Add): string {
  const path = visualAdapterPath(m, component, node.adapter), fail = (method: string) => `throw new NotImplementedError(${literal(node.package + ' adapter ' + node.adapter)}, ${literal(method)});`;
  add(path, `import type { VisualExternalAdapter } from ${literal(relativeImport(path, `${m.sourceRoot}/domain/visual-runtime.ts`))};
import { NotImplementedError } from ${literal(relativeImport(path, `${m.sourceRoot}/domain/contract.ts`))};
// Implement with: import … from ${literal(node.package)}
export interface Props extends Record<string, unknown> {
${Object.keys(node.props).map(name => `  ${literal(name)}: unknown;\n`).join('')}}
export function createAdapter(): VisualExternalAdapter<Props> {
  return {
    // Implement mount(el, props, emit), update(props) and destroy(); the stubs declare no unused parameters.
    mount(): void { ${fail('mount')} },
    update(): void { ${fail('update')} },
    destroy(): void { ${fail('destroy')} },
  };
}
`, 'extension');
  return path;
}
function vfScreen(m: Model, spec: VisualSpec & { kind: 'page' }, add: Add): void {
  const screen = m.screens.find(s => s.id === spec.ownerId);
  requireValue(screen, 'Missing page owner: ' + spec.ownerId);
  add(`${m.sourceRoot}/presentation/components/screens/${componentFile(screen.slug, 'screen')}.vue`, `<script setup lang="ts">
import { useScreen } from '../../composables/use-screen.ts';
import Detail from '../details/${spec.id}.vue';
const model = useScreen(${literal(screen.id)});
</script>
<template><section class="generated-screen" :aria-labelledby="model.headingId">
<h2 :id="model.headingId">{{ model.screen.label }}</h2><p>{{ model.screen.goal }}</p>
<Detail />
<button v-for="edge in model.edges" :key="edge.id" type="button" @click="model.follow(edge.id)">{{ edge.label }}</button>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section></template>
`);
}
const vfLayout = `.generated-detail, .generated-region, .generated-field { display: flex; flex-direction: column; gap: var(--size-4-3, 12px); min-width: 0; }
.generated-region[data-design-layout="row"] { flex-direction: row; flex-wrap: wrap; align-items: start; }
.generated-region[data-design-layout="grid"] { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); }
.generated-table { overflow:auto; max-width:100%; } .generated-table table { width:100%; border-collapse:collapse; } .generated-table th,.generated-table td { padding:8px; border-bottom:1px solid var(--background-modifier-border); text-align:left; } .generated-detail input,.generated-detail textarea,.generated-detail select { max-width:100%; } .generated-asset { min-height:80px; border:1px dashed var(--background-modifier-border); }\n.generated-detail-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.generated-detail input { max-width: 100%; }
.generated-detail :focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
`;

/** Emits every page/component definition as typed spec, SFC, contract, tests, hooks, adapters and traceability. */
export async function visualCode(templateRoot: TemplateSnapshot, m: Model, add: Add): Promise<void> {
  const root = m.sourceRoot, store = visualDefinitions(m), specs = visualSpecs(m);
  visualSources(m, specs);
  await vfRuntime(templateRoot, m, add);
  const handlers: string[] = [], cases: string[] = [], trace: Record<string, unknown>[] = [], adapters: { component: ComponentDefinition; node: ExternalNode; path: string }[] = [];
  for (const component of store.components) add(`${root}/domain/components/contracts/${vfFileId(component.libraryId, 'Library id')}.ts`, visualContractTypes(component), 'managed');
  for (const spec of specs) {
    const id = vfFileId(spec.id, 'Definition id'), path = visualDefinitionPath(m, spec), type = spec.kind === 'page' ? 'VisualPageSpec' : 'VisualComponentSpec';
    add(`${root}/domain/visual/${id}.ts`, `import type { ${type} } from '../visual-runtime.ts';\nexport const specification: ${type} = ${literal(spec)};\n`, 'managed');
    add(path, visualSfc(m, spec, store));
    if (spec.kind === 'page') vfScreen(m, spec, add);
    else for (const node of visualNodes(spec.template)) if (node.kind === 'external') adapters.push({ component: spec, node, path: vfAdapter(m, spec, node, add) });
    add(`${m.testRoot}/ui-effects/${id}.checks.mjs`, visualTestSource(spec), 'managed');
    for (const node of visualNodes(visualRoot(spec))) for (const interaction of 'events' in node ? node.events : []) {
      const interactionId = vfFileId(interaction.id, 'Interaction id'), verification = visualVerification(interaction);
      const implementation = `${root}/application/interactions/${interactionId}.ts`, test = `${m.testRoot}/acceptance/${interactionId}.test.ts`;
      if (verification === 'business-todo') {
        handlers.push(`import { execute as E${handlers.length} } from './interactions/${interactionId}.ts';`);
        cases.push(`case ${literal(interactionId)}: return E${handlers.length - 1}(request, sources);`);
        add(implementation, `import type { VisualRequest } from '../../domain/visual-runtime.ts';\nimport type { Sources } from '../sources.ts';\nimport { NotImplementedError } from '../../domain/contract.ts';\nexport const intent = ${literal({ definitionId: spec.id, nodeId: node.id, ...interaction })};\n/** Start with a failing acceptance test. This hook does not infer business rules from prose. */\nexport const execute: (request: VisualRequest, sources: Sources) => Promise<unknown> = async () => { throw new NotImplementedError(${literal(spec.id)}, ${literal(interactionId)}); };\n`);
      }
      const accepted = visualAcceptanceTodo(interaction);
      if (accepted) add(test, `import { it } from 'vitest';\n// UI dispatch/navigation tests are separate from this unimplemented business acceptance.\nit.todo(${literal('[' + interactionId + '] ' + interaction.label + ' — ' + (interaction.acceptance || interaction.notes || 'implementation required'))});\n`);
      trace.push({ definitionId: spec.id, nodeId: node.id, ...interaction, component: path, implementation: verification === 'business-todo' ? implementation : null, test: accepted ? test : null, verification });
    }
  }
  // Without hooks the dispatcher declares no parameters it would never read.
  const dispatch = cases.length ? `export async function handleVisualInteraction(request: VisualRequest, sources: Sources): Promise<unknown> {\n  switch (request.interactionId) {\n${cases.map(line => '    ' + line + '\n').join('')}    default: throw new Error('VISUAL_INTERACTION_UNKNOWN');\n  }\n}\n`
    : "export const handleVisualInteraction: (request: VisualRequest, sources: Sources) => Promise<unknown> = async () => { throw new Error('VISUAL_INTERACTION_UNKNOWN'); };\n";
  add(`${root}/application/visual-interactions.ts`, `${handlers.map(line => line + '\n').join('')}import type { VisualRequest } from '../domain/visual-runtime.ts';\nimport type { Sources } from './sources.ts';\n${dispatch}`);
  const definitions = specs.map(spec => ({ id: spec.id, kind: spec.kind, ...(spec.kind === 'page' ? { ownerId: spec.ownerId } : { libraryId: spec.libraryId }), component: visualDefinitionPath(m, spec) }));
  add('design/visual-traceability.json', json({ definitions, interactions: trace, adapters: adapters.map(a => ({ componentId: a.component.id, nodeId: a.node.id, package: a.node.package, adapter: a.node.adapter, path: a.path })), businessAcceptance: 'not-implemented' }), 'managed');
  add(`${root}/presentation/detail-layout.css`, vfLayout);
  visualPorts(m, add); visualTests(m, specs, add); visualRuntimeTests(m, specs, adapters, add);
}
