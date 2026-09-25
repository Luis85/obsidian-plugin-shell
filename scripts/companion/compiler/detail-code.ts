import { controlElement } from './detail-fields.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { literal, json, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
import { componentMembers, detailDocuments, detailDefinitions } from './detail-model.ts';
import type { DetailDocument, DetailElement } from '../runtime/detail-runtime.ts';
import { detailTests } from './detail-tests.ts';
import { detailPorts } from './detail-ports.ts';
import { compositionTestSource } from '../composition-contract.mjs';
import { detailRuntimeTests } from './detail-runtime-tests.ts';
const detailPath = (m: Model, doc: DetailDocument) => `${m.sourceRoot}/presentation/components/${doc.kind === 'component' ? 'library/' + doc.ownerId : 'details/' + doc.id}.vue`;
function element(doc: DetailDocument, node: DetailElement, componentNames: Map<string, string>): string {
  const index = doc.nodes.indexOf(node), ref = `spec.nodes[${index}]!`;
  const attrs = `data-design-node="${node.id}" v-if="model.visible.value.has('${node.id}')" :style="model.style(${index})"`;
  const events = `v-on="model.listeners('${node.id}')"`, disabled = `:disabled="['loading', 'disabled'].includes(model.state.value)"`;
  const children = doc.nodes.filter(n => n.parentId === node.id).map(n => element(doc, n, componentNames)).join('\n');
  if (node.kind === 'region') return `<section ${attrs} class="generated-region" data-design-layout="${node.layout}" :aria-label="${ref}.label" ${events}>${children}</section>`;
  if (['text','heading','alert'].includes(node.kind)) { const tag=node.kind==='heading'?'h3':node.kind==='alert'?'aside':'p'; return `<${tag} ${attrs} class="generated-detail-text" ${events}>{{ model.display(${index}) }}</${tag}>`; }
  if (node.kind === 'divider') return `<hr ${attrs} />`;
  if (node.kind === 'image') return `<div ${attrs} role="img" :aria-label="${ref}.label" class="generated-asset">{{ ${ref}.label }} — {{ ${ref}.text }}</div>`;
  if (['input','number','textarea','checkbox','select'].includes(node.kind)) return controlElement(node,index,attrs,disabled);
  if (node.kind === 'button') return `<button ${attrs} type="button" ${disabled} ${events}>{{ model.display(${index}) || ${ref}.label }}</button>`;
  if (node.kind === 'tabs') return `<div ${attrs}><div role="tablist" :aria-label="${ref}.label"><button v-for="(option,i) in ${ref}.options" :key="option" role="tab" type="button" :aria-selected="option === model.display(${index}) || (!model.values[${ref}.id] && i===0)" ${disabled} @click="model.tab(${index},option)">{{option}}</button></div></div>`;
  if (node.kind === 'table') return `<div ${attrs} class="generated-table"><table><caption>{{${ref}.label}}</caption><thead><tr><th v-for="column in ${ref}.options" :key="column" scope="col">{{column}}</th></tr></thead><tbody><tr v-for="(row,i) in model.rows(${index})" :key="i"><td v-for="column in ${ref}.options" :key="column">{{model.cell(row,column)}}</td></tr><tr v-if="!model.rows(${index}).length"><td :colspan="${ref}.options?.length || 1">{{${ref}.text}}</td></tr></tbody></table></div>`;
  if (node.kind === 'list') return `<div ${attrs}><strong>{{${ref}.label}}</strong><ul><li v-for="(item,i) in (model.rows(${index}).length ? model.rows(${index}) : ${ref}.options || [])" :key="i">{{item}}</li></ul></div>`;
  if (node.kind === 'slot') return `<div ${attrs} ${events}><slot :name="${ref}.label">${children || `{{ ${ref}.text }}`}</slot></div>`;
  const assignments:Record<string,string[]>={...(node.slots ?? {})};
  for(const child of doc.nodes.filter(n=>n.parentId===node.id))(assignments[child.slotName!] ??= []).push(child.id);
  const slots=Object.entries(assignments).map(([name,ids])=>`<template #${name}>${ids.map(id=>element(doc,doc.nodes.find(n=>n.id===id)!,componentNames)).join('\n')}</template>`).join('\n');
  return `<div ${attrs}><${componentNames.get(node.component!.id)} v-bind="${ref}.props" :design-state="model.state.value === 'default' ? undefined : model.state.value" ${events}>${slots}</${componentNames.get(node.component!.id)}></div>`;
}
function documentCode(m: Model, doc: DetailDocument): string {
  const path = detailPath(m, doc); const references = [...new Set(doc.nodes.flatMap(n => n.component ? [n.component.id] : []))];
  const names = new Map(references.map((id, i) => [id, 'Reusable' + i]));
  const imports = references.map(id => `import ${names.get(id)} from ${literal(relativeImport(path, `${m.sourceRoot}/presentation/components/library/${id}.vue`))};`).join('\n');
  const contract = doc.kind === 'component' ? `import type { ComponentProps, ComponentEvents } from ${literal(relativeImport(path, `${m.sourceRoot}/domain/components/contracts/${doc.ownerId}.ts`))};\n` : '';
  const events=doc.kind==='component'?componentMembers(detailDefinitions(m).find(c=>c.id===doc.ownerId)!).events:{};
  const emitted=Object.entries(events).map(([event,type])=>`case ${literal(event)}: if (${type==='undefined'?'payload === undefined':`typeof payload === ${literal(type)}`}) { emit(${literal(event)},payload); return; } throw new Error('DETAIL_EMIT_PAYLOAD');`).join('\n');
  const slotted=new Set(doc.nodes.flatMap(n=>Object.values(n.slots ?? {}).flat()));
  return `<script setup lang="ts">
import { useDetail } from '../../composables/use-detail.ts';
import type { DetailState, DetailRequest } from '../../../domain/detail-runtime.ts';
import { specification as spec } from '../../../domain/details/${doc.id}.ts';
${imports}
${contract}const props = defineProps<${doc.kind === 'component' ? 'ComponentProps & ' : ''}{ designState?: DetailState; designScenario?: string }>();
const emit = defineEmits<${doc.kind === 'component' ? 'ComponentEvents & ' : ''}{ interaction: [request: DetailRequest] }>();
const model = useDetail(spec, props, request => emit('interaction', request), (name,payload) => { switch(name) { ${emitted} default: throw new Error('DETAIL_EMIT_UNKNOWN'); } });
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="${doc.id}" :data-design-state="model.state.value" :aria-label="spec.ownerLabel" :aria-busy="model.state.value === 'loading'">
${doc.nodes.filter(n => n.parentId === null && !slotted.has(n.id)).map(n => element(doc, n, names)).join('\n')}
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
`;
}
export async function detailCode(templateRoot: string, m: Model, add: Add): Promise<void> {
  const documents = detailDocuments(m); const root = m.sourceRoot;
  for (const c of detailDefinitions(m)) {
    const contract = componentMembers(c);
    add(`${root}/domain/components/contracts/${c.id}.ts`, `export interface ComponentProps {\n${Object.entries(contract.props).map(([name, type]) => `  ${literal(name)}?: ${type};`).join('\n')}\n}\nexport interface ComponentEvents {\n${Object.entries(contract.events).map(([name, type]) => `  ${literal(name)}: [payload: ${type}];`).join('\n')}\n}\nexport type ComponentSlot = ${contract.slots.map(literal).join(' | ') || 'never'};\n`, 'managed');
    if (!documents.some(d => d.kind === 'component' && d.ownerId === c.id)) {
      const hasTitle = contract.props.title === 'string';
      add(`${root}/presentation/components/library/${c.id}.vue`, `<script setup lang="ts">
import { specification } from '../../../domain/components/${c.id}.ts';
import type { ComponentProps, ComponentEvents } from '../../../domain/components/contracts/${c.id}.ts';
import type { DetailState, DetailRequest } from '../../../domain/detail-runtime.ts';
const props = defineProps<ComponentProps & { designState?: DetailState; designScenario?: string }>();
defineEmits<ComponentEvents & { interaction: [request: DetailRequest] }>();
</script>
<template>
<section class="generated-component" :aria-label="specification.name" :data-design-state="props.designState">
<h3>{{ ${hasTitle ? 'props.title ?? ' : ''}specification.name }}</h3><p>{{ specification.description }}</p>
<p class="generated-hint">Component implementation point</p>
${contract.slots.map(name => `<slot name="${name}" />`).join('\n')}
</section>
</template>
`);
    }
  }
  for(const file of ['detail-controls.ts','detail-actions.ts']) add(`${root}/domain/${file}`,await readFile(join(templateRoot,'scripts/companion/runtime',file),'utf8'));
  add(`${root}/domain/detail-runtime.ts`, (await readFile(join(templateRoot, 'scripts/companion/runtime/detail-runtime.ts'), 'utf8')).replace("'../composition-contract.mjs'","'./composition-contract.mjs'"));
  for (const name of ['composition-contract.mjs','composition-contract.d.mts']) add(`${root}/domain/${name}`,await readFile(join(templateRoot,'scripts/companion',name),'utf8'));
  add(`${root}/presentation/composables/use-detail.ts`, (await readFile(join(templateRoot, 'scripts/companion/runtime/use-detail.ts'), 'utf8')).replace("'./detail-runtime.ts'", "'../../domain/detail-runtime.ts'").replace("'../composition-contract.mjs'","'../../domain/composition-contract.mjs'").replaceAll("'./detail-controls.ts'","'../../domain/detail-controls.ts'").replaceAll("'./detail-actions.ts'","'../../domain/detail-actions.ts'"));
  const handlers: string[] = []; const cases: string[] = []; const trace = [];
  for (const doc of documents) {
    add(`${root}/domain/details/${doc.id}.ts`, `import type { DetailDocument } from '../detail-runtime.ts';\nexport const specification: DetailDocument = ${literal(doc)};\n`, 'managed');
    const path = detailPath(m, doc); add(path, documentCode(m, doc));
    if (doc.kind === 'page') {
      const screen = m.screens.find(s => s.id === doc.ownerId)!;
      add(`${root}/presentation/components/screens/${screen.slug}.vue`, `<script setup lang="ts">
import { useScreen } from '../../composables/use-screen.ts';
import Detail from '../details/${doc.id}.vue';
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
    for (const edge of doc.edges) {
      const implementation = `${root}/application/interactions/${edge.id}.ts`;
      const test = `${m.testRoot}/acceptance/${edge.id}.test.ts`;
      if (!edge.targetSurfaceId && !edge.effect && !edge.action) {
        handlers.push(`import { execute as E${handlers.length} } from './interactions/${edge.id}.ts';`);
        cases.push(`case ${literal(edge.id)}: return E${handlers.length - 1}(request, sources);`);
        add(implementation, `import type { DetailRequest } from '../../domain/detail-runtime.ts';\nimport type { Sources } from '../sources.ts';\nimport { NotImplementedError } from '../../domain/contract.ts';\nexport const intent = ${literal(edge)};\n/** Start with a failing acceptance test. This hook does not infer business rules from prose. */\nexport async function execute(_request: DetailRequest, _sources: Sources): Promise<unknown> { throw new NotImplementedError(${literal(doc.id)}, ${literal(edge.id)}); }\n`);
      }
      if (!edge.effect && (edge.acceptance || !edge.targetSurfaceId)) add(test, `import { it } from 'vitest';\n// UI dispatch/navigation tests are separate from this unimplemented business acceptance.\nit.todo(${literal('[' + edge.id + '] ' + edge.label + ' — ' + (edge.acceptance || edge.notes))});\n`);
      trace.push({ documentId: doc.id, ...edge, component: path, implementation: edge.effect || edge.action || edge.targetSurfaceId ? null : implementation, test: !edge.effect && (edge.acceptance || !edge.targetSurfaceId) ? test : null, verification: edge.action ? 'declarative-action' : edge.effect ? 'executable-ui-effect' : edge.targetSurfaceId ? 'navigation-scaffold' : 'todo' });
    }
    detailTests(m, doc, path, add);
    add(`${m.testRoot}/ui-effects/${doc.id}.checks.mjs`,compositionTestSource(doc),'managed');
  }
  add(`${root}/application/detail-interactions.ts`, `${handlers.join('\n')}\nimport type { DetailRequest } from '../domain/detail-runtime.ts';\nimport type { Sources } from './sources.ts';\nexport async function handleDetailInteraction(request: DetailRequest, sources: Sources): Promise<unknown> { switch (request.edgeId) { ${cases.join('\n')} default: throw new Error('DETAIL_INTERACTION_UNKNOWN'); } }\n`);
  add('design/detail-traceability.json', json({ documents: documents.map(d => ({ id: d.id, ownerId: d.ownerId, kind: d.kind, component: detailPath(m, d) })), interactions: trace, businessAcceptance: 'not-implemented' }), 'managed');
  add(`${root}/presentation/detail-layout.css`, `.generated-detail, .generated-region, .generated-field { display: flex; flex-direction: column; gap: var(--size-4-3, 12px); min-width: 0; }
.generated-region[data-design-layout="row"] { flex-direction: row; flex-wrap: wrap; align-items: start; }
.generated-region[data-design-layout="grid"] { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); }
.generated-table { overflow:auto; max-width:100%; } .generated-table table { width:100%; border-collapse:collapse; } .generated-table th,.generated-table td { padding:8px; border-bottom:1px solid var(--background-modifier-border); text-align:left; } .generated-detail input,.generated-detail textarea,.generated-detail select { max-width:100%; } .generated-asset { min-height:80px; border:1px dashed var(--background-modifier-border); }\n.generated-detail-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.generated-detail input { max-width: 100%; }
.generated-detail :focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
`);
  detailPorts(m, add); detailRuntimeTests(m, documents, add);
}
