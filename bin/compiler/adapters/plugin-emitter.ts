import { storybookCode } from '../emitters/storybook-code.ts';
import { previewCode, previewScripts } from '../emitters/preview-code.ts';
import type { Artifact, TemplateSnapshot } from '../domain/contracts.ts';
import { artifactCollector } from '../domain/artifacts.ts';
import { journeyCode } from '../emitters/journey-code.ts';
import { nativeCode } from '../emitters/native-code.ts';
import { clickdummyCode } from '../emitters/clickdummy-code.ts';
import { httpCode } from '../emitters/http-code.ts';
import { relationshipCode } from '../emitters/relationship-code.ts';
import { renderFixtureCode as fixtureCode } from './fixture-emitter.ts';
import { persistenceCode } from '../emitters/persistence-code.ts';
import { literal, json, type Model } from '../emitters/model.ts';
import { dataCode } from '../emitters/data-code.ts';
import { relativeImport, type Entry, type Add } from '../emitters/file-code.ts';
import { uiCode } from '../emitters/ui-code.ts';
import { authoredJourneyCode } from '../emitters/authored-journey-code.ts';
import { navigationCode } from '../emitters/navigation-code.ts';
import { uiQualityCode, uiQualityScripts } from '../emitters/ui-quality-code.ts';
import { hostCode } from '../emitters/host-code.ts';
import { visualCode } from '../emitters/visual-files.ts';
import { visualDefinitions, visualPackages, visualAdapterPath } from '../emitters/visual-model.ts';
import { visualNodes } from '../../../scripts/companion/visual/visual-ir.mjs';
import { styleCode } from '../emitters/style-code.ts';
import { devkitFiles, makerTests, renderTemplate } from '../emitters/devkit-files.ts';
import { maintainerOnly, relocateFrameworkDocuments, scopeExampleOwnership } from '../emitters/framework-docs.ts';
import { hostingProfile, projectHosting, prunedByHosting } from '../../../scripts/companion/hosting-contract.mjs';
import { maintainerScript, rewriteDocReferences } from '../emitters/framework-scope.ts';
/** Framework customization is explicit; visual lowering replaces only UI placeholders/registries. */
function replacedProducer(previous: string | undefined, producer: string): string | undefined {
  if (previous === 'framework') return 'framework';
  if (producer === 'visual' && previous === 'ui') return 'ui';
  return producer === 'journey' && (previous === 'ui' || previous === 'visual') ? previous : undefined;
}
type Scripts = Record<string, string>;
/** Without visual definitions no UI-effect check is generated: the script says so and passes explicitly. With them,
 * the suite runner requires a non-empty suite, so deleted checks fail instead of reporting "tests 0". */
const noUiEffects = 'node -e "console.log(\'test:ui-effects skipped: this project declares no visual definitions, so no UI-effect checks were generated.\')"';
/** The project test/verification scripts; full framework coverage/native/release gates stay and are NOT relabelled green. */
function projectScripts(scripts: Scripts, m: Model): void {
  const frameworkTests = scripts.test, definitions = visualDefinitions(m), effects = definitions.pages.length + definitions.components.length > 0;
  if (frameworkTests !== undefined) scripts['test:framework'] = frameworkTests;
  scripts['test'] = 'vitest run --config configs/testing/vitest.project.config.mjs';
  scripts['test:watch'] = 'vitest --config configs/testing/vitest.project.config.mjs';
  scripts['test:tdd'] = `vitest --config configs/testing/vitest.project.config.mjs ${JSON.stringify(m.testRoot+'/acceptance')}`;
  scripts['typecheck:project'] = 'node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --project configs/types/tsconfig.project.json';
  // The root tsconfig is the framework's; generated sources import with .ts extensions that only the project config allows.
  scripts['typecheck'] = scripts['typecheck:project'];
  scripts['test:ui-effects'] = effects ? 'node scripts/testing/suites.mjs project:ui-effects' : noUiEffects;
  scripts['build:clickdummy'] = 'node bin/app clickdummy build';
  scripts['ui:gallery'] = 'node scripts/ui/review-gallery.mjs --target clickdummy';
  scripts['doctor'] = 'node bin/app doctor';
  Object.assign(scripts, previewScripts());
  uiQualityScripts(scripts);
  scripts['test:project'] = effects ? 'node scripts/testing/suites.mjs project project:ui-effects' : 'node scripts/testing/suites.mjs project && npm run test:ui-effects';
  // What the full gate adds to `check` (which already runs typecheck, both linters, the product tests and the maker
  // tooling tests): CI runs `check` then this, so no gate runs twice.
  scripts['verify:artifacts'] = 'npm run build && npm run test:ui-effects';
  // The full local gate is `check` plus that addition, so it is a superset of `check` by construction.
  scripts['verify:project'] = 'npm run check && npm run verify:artifacts';
  for (const name of Object.keys(scripts)) if (maintainerScript(name)) delete scripts[name];
}
function fixtureScripts(scripts: Scripts): void {
  scripts['testdata:check']='node scripts/test-data/verify.mjs'; scripts['verify:artifacts'] += ' && npm run testdata:check';
  for(const command of ['plan','apply','reset-plan','reset','serve']) scripts['testdata:'+command]='node scripts/test-data/cli.mjs '+command;
}
/** Always present, so `npm run test:tdd` has a real acceptance check before the first requirement exists. */
function acceptanceSmoke(m: Model, add: Add): void {
  const test = `${m.testRoot}/acceptance/traceability.test.ts`, root = relativeImport(test, 'package.json').replace(/package\.json$/, '');
  add(test, `import { it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
interface Row { id: string; implementation: string; test: string }
const root = new URL(${literal(root)}, import.meta.url);
const trace: { requirements: Row[] } = JSON.parse(readFileSync(new URL('design/traceability.json', root), 'utf8'));
it('every requirement in design/traceability.json keeps its use case and acceptance test', () => {
  expect(new Set(trace.requirements.map(row => row.id)).size).toBe(trace.requirements.length);
  for (const row of trace.requirements) {
    expect(existsSync(new URL(row.implementation, root)), row.implementation).toBe(true);
    expect(existsSync(new URL(row.test, root)), row.test).toBe(true);
  }
});
`);
}
/** Emit the existing plugin project from explicit template data, without host I/O. */
export async function renderProjectFiles(templateRoot: TemplateSnapshot, m: Model): Promise<Entry[]> {
  // A project hosted outside GitHub receives none of the framework's GitHub files (CODEOWNERS, Dependabot, actions,
  // maintainer workflows); links to them in copied docs become plain text.
  const hosting = hostingProfile(projectHosting(m.document));
  const entries = new Map(templateRoot.frameworkFiles.filter(file => !prunedByHosting(hosting, file.path)).map(file => [file.path, { ...file } ]));
  relocateFrameworkDocuments(entries, path => maintainerOnly(path) || prunedByHosting(hosting, path)); scopeExampleOwnership(entries);
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
  await emit('fixtures', () => { fixtures = fixtureCode(templateRoot,m,add); });
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
  add(`${m.sourceRoot}/domain/contract.ts`,templateRoot.text('templates/companion/runtime/contract.ts'));
  add(`${m.sourceRoot}/presentation/composables/operation.ts`,templateRoot.text('templates/companion/runtime/operation.ts'));
  add(`${m.sourceRoot}/application/source-overrides.ts`,templateRoot.text('templates/companion/runtime/source-overrides.ts'),'managed');
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
  await emit('journey-specs', () => authoredJourneyCode(m,add));
  await emit('preview', () => previewCode(m,add));
  await emit('ui-quality', () => uiQualityCode(m,add));
  acceptanceSmoke(m,add);
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
  add('PROJECT-IMPLEMENTATION.md',renderTemplate(templateRoot.text('templates/companion/devkit/PROJECT-IMPLEMENTATION.md.tmpl'),values),'managed');
  for (const file of storybookCode(templateRoot, m)) collector.add(file);
  return collector.values().map(productDocReferences);
}
/** Product-authored text names kept framework docs by the repository path; a project carries them under docs/framework/. */
function productDocReferences(file: Artifact): Artifact {
  if (file.ownership === 'framework' || file.encoding || !/\.(?:md|mdc|ts|mjs)$/.test(file.path)) return file;
  const content = rewriteDocReferences(file.content);
  return content === file.content ? file : { ...file, content };
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
