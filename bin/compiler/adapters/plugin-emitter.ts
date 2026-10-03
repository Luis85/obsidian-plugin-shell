import { storybookCode } from '../../../scripts/companion/compiler/storybook-code.ts';
import { previewCode, previewScripts } from '../../../scripts/companion/compiler/preview-code.ts';
import type { TemplateSnapshot } from '../domain/contracts.ts';
import { artifactCollector } from '../domain/artifacts.ts';
import { journeyCode } from '../../../scripts/companion/compiler/journey-code.ts';
import { nativeCode } from '../../../scripts/companion/compiler/native-code.ts';
import { clickdummyCode } from '../../../scripts/companion/compiler/clickdummy-code.ts';
import { httpCode } from '../../../scripts/companion/compiler/http-code.ts';
import { relationshipCode } from '../../../scripts/companion/compiler/relationship-code.ts';
import { renderFixtureCode as fixtureCode } from './fixture-emitter.ts';
import { persistenceCode } from '../../../scripts/companion/compiler/persistence-code.ts';
import { literal, json, type Model } from '../../../scripts/companion/compiler/model.ts';
import { dataCode } from '../../../scripts/companion/compiler/data-code.ts';
import { relativeImport, type Entry, type Add } from '../../../scripts/companion/compiler/file-code.ts';
import { uiCode } from '../../../scripts/companion/compiler/ui-code.ts';
import { navigationCode } from '../../../scripts/companion/compiler/navigation-code.ts';
import { hostCode } from '../../../scripts/companion/compiler/host-code.ts';
import { visualCode } from '../../../scripts/companion/compiler/visual-files.ts';
import { visualDefinitions, visualPackages, visualAdapterPath } from '../../../scripts/companion/compiler/visual-model.ts';
import { visualNodes } from '../../../scripts/companion/visual/visual-ir.mjs';
import { styleCode } from '../../../scripts/companion/compiler/style-code.ts';
import { devkitFiles, makerTests, renderTemplate } from '../../../scripts/companion/compiler/devkit-files.ts';
import { relocateFrameworkDocuments } from '../../../scripts/companion/compiler/framework-docs.ts';
/** Framework customization is explicit; visual lowering replaces only UI placeholders/registries. */
function replacedProducer(previous: string | undefined, producer: string): string | undefined {
  if (previous === 'framework') return 'framework';
  if (producer === 'visual' && previous === 'ui') return 'ui';
  return producer === 'journey' && (previous === 'ui' || previous === 'visual') ? previous : undefined;
}
type Scripts = Record<string, string>;
/** The project test/verification scripts; full framework coverage/native/release gates stay and are NOT relabelled green. */
function projectScripts(scripts: Scripts, m: Model): void {
  const frameworkTests = scripts.test;
  if (frameworkTests !== undefined) scripts['test:framework'] = frameworkTests;
  scripts['test'] = 'vitest run --config configs/testing/vitest.project.config.mjs';
  scripts['test:watch'] = 'vitest --config configs/testing/vitest.project.config.mjs';
  scripts['test:tdd'] = `vitest --config configs/testing/vitest.project.config.mjs ${JSON.stringify(m.testRoot+'/acceptance')}`;
  scripts['typecheck:project'] = 'node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --project configs/types/tsconfig.project.json';
  scripts['test:ui-effects'] = `node --test ${m.testRoot}/ui-effects/*.checks.mjs`;
  scripts['build:clickdummy'] = 'node bin/app clickdummy build';
  scripts['doctor'] = 'node bin/app doctor';
  Object.assign(scripts, previewScripts());
  scripts['test:project'] = 'node scripts/testing/suites.mjs project project:ui-effects';
  scripts['verify:project'] = 'npm run build && npm run typecheck:project && npm test && npm run test:ui-effects';
}
function fixtureScripts(scripts: Scripts): void {
  scripts['testdata:check']='node scripts/test-data/verify.mjs'; scripts['verify:project'] += ' && npm run testdata:check';
  for(const command of ['plan','apply','reset-plan','reset','serve']) scripts['testdata:'+command]='node scripts/test-data/cli.mjs '+command;
}
/** Emit the existing plugin project from explicit template data, without host I/O. */
export async function renderProjectFiles(templateRoot: TemplateSnapshot, m: Model): Promise<Entry[]> {
  const entries = new Map(templateRoot.frameworkFiles.map(file => [file.path, { ...file } ]));
  relocateFrameworkDocuments(entries);
  const collector = artifactCollector([...entries.values()].map(file => ({ ...file, producer: 'framework' })));
  let producer = 'project';
  const add: Add = (path, content, ownership = 'extension') => {
    collector.add({path,content,ownership,producer},replacedProducer(collector.get(path)?.producer,producer));
  };
  async function emit(name: string, work: () => void | Promise<unknown>): Promise<void> {
    producer = name; await work(); producer = 'project';
  }
  const readJson = (path: string) => JSON.parse(entries.get(path)!.content);
  const manifest = readJson('manifest.json'); Object.assign(manifest,m.project); manifest.isDesktopOnly = true;
  add('manifest.json',json(manifest));
  const pkg = readJson('package.json'); const lock = readJson('package-lock.json');
  Object.assign(pkg,{name:m.project.id,version:m.project.version,description:m.project.description,author:m.project.author});
  Object.assign(lock,{name:pkg.name,version:pkg.version}); Object.assign(lock.packages[''],{name:pkg.name,version:pkg.version,...(pkg.bin ? {bin:pkg.bin} : {})});
  projectScripts(pkg.scripts,m);
  let fixtures = false;
  await emit('fixtures', async () => { fixtures = await fixtureCode(templateRoot,m,add); });
  if(fixtures) fixtureScripts(pkg.scripts);
  const pinned: Record<string,string> = {...pkg.devDependencies,...pkg.dependencies};
  const declared = Object.entries(visualPackages(m,pinned)).filter(([name]) => !Object.hasOwn(pinned,name));
  if (declared.length) pkg.dependencies = Object.fromEntries([...Object.entries<string>(pkg.dependencies ?? {}),...declared].sort(([a],[b]) => a < b ? -1 : 1));
  add('package.json',json(pkg)); add('package-lock.json',json(lock));
  add('versions.json',json({...readJson('versions.json'),[String(m.project.version)]:manifest.minAppVersion}));
  add('configs/types/tsconfig.project.json',json({extends:'../../tsconfig.json',compilerOptions:{allowImportingTsExtensions:true,...((m.document.design as {editors?:unknown}).editors ? {allowJs:true,checkJs:false} : {})},include:['src/**/*.ts','src/**/*.vue',m.sourceRoot+'/**/*.ts',m.sourceRoot+'/**/*.vue',m.testRoot+'/**/*.ts','harness/prototype/**/*.ts',makerTests+'/**/*.ts'].map(path => '../../'+path)}));
  add('design/project.json',json(m.document),'managed');
  add('design/traceability.json',json({status:'scaffold-not-accepted',requirements:m.requirements.map(r => ({...r,implementation:`${m.sourceRoot}/application/use-cases/${r.key}.ts`,test:`${m.testRoot}/acceptance/${r.key}.test.ts`,verification:'todo'})),interactions:m.links,flows:m.flows,visualDesigns:((m.document.design as Record<string,unknown>).visualDesigns ?? null),warnings:m.warnings}),'managed');
  add('design/design-system.json',json(m.document.design && (m.document.design as Record<string,unknown>).designSystem || {}),'managed');
  add(`${m.sourceRoot}/domain/contract.ts`,await templateRoot.text(['templates/companion/runtime/contract.ts'].join('/')));
  add(`${m.sourceRoot}/presentation/composables/operation.ts`,await templateRoot.text(['templates/companion/runtime/operation.ts'].join('/')));
  add(`${m.sourceRoot}/application/source-overrides.ts`,await templateRoot.text(['templates/companion/runtime/source-overrides.ts'].join('/')),'managed');
  await emit('data', () => dataCode(m,add));
  await emit('navigation', () => navigationCode(m,add));
  await emit('ui', () => uiCode(m,add));
  await emit('native', () => nativeCode(m,add));
  await emit('host', () => hostCode(m,add));
  await emit('style', () => styleCode(m,add));
  await emit('persistence', () => persistenceCode(templateRoot,m,add));
  await emit('visual', () => visualCode(templateRoot,m,add));
  await emit('relationships', () => relationshipCode(templateRoot,m,add));
  await emit('http', () => httpCode(templateRoot,m,add));
  await emit('journey', () => journeyCode(templateRoot,m,add));
  await emit('clickdummy', () => clickdummyCode(m,add));
  await emit('preview', () => previewCode(m,add));
  const opTest = `${m.testRoot}/operation-lifecycle.test.ts`;
  add(opTest,`import { it, expect } from 'vitest';\nimport { effectScope } from 'vue';\nimport { operation } from ${literal(relativeImport(opTest,`${m.sourceRoot}/presentation/composables/operation.ts`))};
it('latest read wins and disposal prevents late projection updates', async () => {
  const pending: Array<(value:string)=>void> = []; const scope = effectScope();
  const state = scope.run(() => operation<void,string>(() => new Promise(resolve=>pending.push(resolve)),'read'))!;
  const first = state.execute(); const second = state.execute(); pending[1]!('latest'); await second; pending[0]!('old'); await first;
  expect(state.data.value).toBe('latest'); const third = state.execute(); scope.stop(); pending[2]!('late'); expect((await third).ok).toBe(false); expect(state.data.value).toBe('latest');
});
it('does not issue a duplicate pending write', async () => { const scope = effectScope(); let finish: (value:string)=>void = ()=>{}; let calls = 0;
  const state = scope.run(()=>operation<void,string>(()=>{calls++;return new Promise(resolve=>{finish=resolve;});},'write'))!;
  const first = state.execute(); expect(await state.execute()).toEqual({ok:false,code:'busy'}); expect(calls).toBe(1); finish('committed'); await first; scope.stop();
});
`);
  await emit('devkit', () => devkitFiles(templateRoot,m,add));
  const values = {name:String(m.project.name),sourceRoot:m.sourceRoot,testRoot:m.testRoot,dependencies:dependencySection(m)};
  add('PROJECT-IMPLEMENTATION.md',renderTemplate(await templateRoot.text(['templates/companion/devkit/PROJECT-IMPLEMENTATION.md.tmpl'].join('/')),values),'managed');
  for (const file of storybookCode(templateRoot, m)) collector.add(file);
  return collector.values();
}
/** Declared third-party packages with purpose and the real path of every extension-owned adapter; installing the
 * packages and reviewing their licenses stays with the author. */
function dependencySection(m: Model): string {
  const components = visualDefinitions(m).components;
  const uses = components.flatMap(c => (c.dependencies ?? []).map(d => ({...d,component:c.exportName})));
  if (!uses.length) return '## Component library dependencies\n\nNo visual component declares a third-party package.';
  const adapters = components.flatMap(c => visualNodes(c.template).flatMap(n => n.kind === 'external' ? [`- \`${visualAdapterPath(m,c,n.adapter)}\` (${n.package}, ${c.exportName})`] : []));
  return `## Component library dependencies\n\nThese exact versions are merged into package.json dependencies. Run npm install explicitly to add them to package-lock.json before npm ci. Each external node has an extension-owned adapter at presentation/components/library/<component file>/<adapter>.adapter.ts, where the component file is the library ID, with a -component suffix when the ID is a single word (listed below). Its stubs throw NotImplementedError until you implement them; its acceptance TODO stays open. Licenses of these packages are the author's responsibility; review them before distribution.\n\n${uses.map(u => `- ${u.package}@${u.version} (${u.component}): ${u.purpose.replace(/\s+/g,' ')}`).join('\n')}${adapters.length ? '\n\nAdapters:\n\n' + adapters.join('\n') : ''}`;
}
