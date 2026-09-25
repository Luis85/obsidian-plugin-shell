import { httpCode } from './http-code.ts';
import { relationshipCode } from './relationship-code.ts';
import { fixtureCode } from './fixture-code.ts';
import { persistenceCode } from './persistence-code.ts';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { literal, json, type Model } from './model.ts';
import { dataCode } from './data-code.ts';
import { relativeImport, type Entry, type Add } from './file-code.ts';
import { uiCode } from './ui-code.ts';
import { navigationCode } from './navigation-code.ts';
import { hostCode } from './host-code.ts';
import { detailCode } from './detail-code.ts';
import { styleCode } from './style-code.ts';
const roots = ['src','scripts','tests','harness','docs','.github'];
const files = ['package.json','package-lock.json','manifest.json','versions.json','tsconfig.json','vite.config.mjs','vite.harness.config.mjs','vitest.config.mjs','vitest.production.config.mjs','playwright.config.ts','eslint.config.mjs','.fallowrc.json','.oxlintrc.json','.gitignore','.nvmrc','AGENTS.md','LICENSE','README.md','TEMPLATE-GUIDE.md','SHELL-FIRST-OVERVIEW.md','shell.mjs','tsconfig.generator.json'];
export async function projectFiles(templateRoot: string, m: Model): Promise<Entry[]> {
  const entries = new Map<string,Entry>();
  const add: Add = (path,content,ownership = 'extension') => { entries.set(path,{path,content,ownership}); };
  async function copy(path: string) {
    // Source verification may create Python caches; never copy machine bytecode.
    if (path.split('/').includes('__pycache__') || /\.py[co]$/.test(path)) return;
    const stat = await lstat(join(templateRoot,path)); if (stat.isSymbolicLink()) throw new Error('GENERATOR_TEMPLATE_LINK: '+path);
    if (stat.isDirectory()) { for (const name of (await readdir(join(templateRoot,path))).sort()) await copy(path+'/'+name); }
    else {
      if (!stat.isFile() || stat.size > 8_000_000) throw new Error('GENERATOR_TEMPLATE_FILE: '+path);
      const bytes = await readFile(join(templateRoot,path));
      if (/\.(?:ttf|otf|woff2?)$/i.test(path)) throw new Error('GENERATOR_TEMPLATE_FONT_NOT_SUPPORTED: '+path);
      if (path.endsWith('.gz')) entries.set(path,{path,content:bytes.toString('base64'),encoding:'base64',ownership:'framework'});
      else add(path,new TextDecoder('utf-8',{fatal:true}).decode(bytes),'framework');
    }
  }
  for (const path of [...roots,...files]) await copy(path);
  const readJson = (path: string) => JSON.parse(entries.get(path)!.content);
  const manifest = readJson('manifest.json'); Object.assign(manifest,m.project); manifest.isDesktopOnly = true;
  add('manifest.json',json(manifest));
  const pkg = readJson('package.json'); const lock = readJson('package-lock.json');
  Object.assign(pkg,{name:m.project.id,version:m.project.version,description:m.project.description,author:m.project.author});
  Object.assign(lock,{name:pkg.name,version:pkg.version}); Object.assign(lock.packages[''],{name:pkg.name,version:pkg.version});
  pkg.scripts['test:framework'] = pkg.scripts.test;
  pkg.scripts['test'] = 'vitest run --config vitest.project.config.mjs';
  pkg.scripts['test:watch'] = 'vitest --config vitest.project.config.mjs';
  pkg.scripts['test:tdd'] = `vitest --config vitest.project.config.mjs ${JSON.stringify(m.testRoot+'/acceptance')}`;
  pkg.scripts['typecheck:project'] = 'vue-tsc --noEmit --project tsconfig.project.json';
  pkg.scripts['test:ui-effects'] = `node --test ${m.testRoot}/ui-effects/*.checks.mjs`;
  pkg.scripts['verify:project'] = 'npm run build && npm run typecheck:project && npm test && npm run test:ui-effects';
  // Full framework coverage/native/release gates remain present and are NOT relabelled green.
  const fixtures = await fixtureCode(templateRoot,m,add);
  if(fixtures) { pkg.scripts['testdata:check']='node scripts/test-data/verify.mjs'; pkg.scripts['verify:project'] += ' && npm run testdata:check'; }
  if(fixtures) for(const command of ['plan','apply','reset-plan','reset','serve']) pkg.scripts['testdata:'+command]='node scripts/test-data/cli.mjs '+command;
  add('package.json',json(pkg)); add('package-lock.json',json(lock));
  add('versions.json',json({...readJson('versions.json'),[String(m.project.version)]:manifest.minAppVersion}));
  add('tsconfig.project.json',json({extends:'./tsconfig.json',compilerOptions:{allowImportingTsExtensions:true},include:['src/**/*.ts','src/**/*.vue',m.sourceRoot+'/**/*.ts',m.sourceRoot+'/**/*.vue',m.testRoot+'/**/*.ts']}));
  add('vitest.project.config.mjs',`import { defineConfig } from 'vitest/config';\nimport vue from '@vitejs/plugin-vue';\nexport default defineConfig({plugins:[vue()],test:{include:[${literal(m.testRoot+'/**/*.test.{ts,mjs}')}],environment:'node',fileParallelism:false}});\n`);
  add('design/project.json',json(m.document),'managed');
  add('design/traceability.json',json({status:'scaffold-not-accepted',requirements:m.requirements.map(r => ({...r,implementation:`${m.sourceRoot}/application/use-cases/${r.key}.ts`,test:`${m.testRoot}/acceptance/${r.key}.test.ts`,verification:'todo'})),interactions:m.links,flows:m.flows,detailDesigns:((m.document.design as Record<string,unknown>).detailDesigns ?? null),warnings:m.warnings}),'managed');
  add('design/design-system.json',json(m.document.design && (m.document.design as Record<string,unknown>).designSystem || {}),'managed');
  add(`${m.sourceRoot}/domain/contract.ts`,await readFile(join(templateRoot,'scripts/companion/runtime/contract.ts'),'utf8'));
  add(`${m.sourceRoot}/presentation/composables/operation.ts`,await readFile(join(templateRoot,'scripts/companion/runtime/operation.ts'),'utf8'));
  add(`${m.sourceRoot}/application/source-overrides.ts`,await readFile(join(templateRoot,'scripts/companion/runtime/source-overrides.ts'),'utf8'),'managed');
  dataCode(m,add); navigationCode(m,add); uiCode(m,add); hostCode(m,add); styleCode(m,add); await persistenceCode(templateRoot,m,add); await detailCode(templateRoot,m,add); await relationshipCode(templateRoot,m,add); await httpCode(templateRoot,m,add);
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
  add('PROJECT-IMPLEMENTATION.md',`# ${m.project.name}: generated implementation workspace\n\nThis is an independent copy of the shell framework plus generated product scaffolding. It is not the completed companion plugin or proof of native acceptance.\n\n## Start\n\nUse the Node/npm versions in .nvmrc and package.json. Run npm ci explicitly, then npm run verify:project. Build output is dist/main.js, dist/styles.css and dist/manifest.json. Use npm run build:local only with the framework's isolated development-vault configuration.\n\nRun npm test for scaffold contracts/navigation/UI tests. Run npm run test:tdd to select a PRD requirement, replace its TODO with a failing behavioral assertion, and implement its paired use case. TODOs are never passing acceptance evidence. The complete inherited npm run verify, native protocols and release gates are unchanged and remain independent requirements. npm run test:framework retains the original shell tests; product entrypoint tests must be adapted as the product evolves.\n\n## Generated structure\n\nProduct code: ${m.sourceRoot}. Product tests: ${m.testRoot}. The reusable foundation remains under src and its original tests under tests/runtime. Custom folders relocate generated product code, not the foundation's internal source directories.\n\nEach DataSource has an application port, validated service, host-adapter extension point, and per-view Pinia store. Implement adapters using injected shell services. No endpoint, credential, SQL, expression or imported code is executed by generation. Declared native note operations use the canonical shell repository. Supported HTTPS JSON sources include typed providers and remain network-disabled until explicitly configured. Custom and database adapters require complete typed provider overrides. Configure these in bootstrap/source-providers.ts; the native lifecycle disposes returned providers even after setup failure.\n\nNavigation and modal/settings/view hosts are connected. Declared read/on-open flows without payloads are connected; write and payload-bearing flows require an explicit source-action mapping, never prose inference. Responsive layout/token contracts, captured component revisions, saved scenarios and local UI effects remain supported. Authored page/component detail designs compile to semantic Vue layouts with reusable instances, primitive typed props/events, named slots, state visibility and source-output projections. Interactions route navigation or call explicit application hooks. Components without detail designs remain implementation placeholders. Detail schema 2 supports labelled number, checkbox, select, date, local datetime, textarea, bounded JSON file, JSON text and Markdown text controls; schema 1 remains text-only. Slot assignments render selected root subtrees inside reusable instances. Explicit mappings pass typed drafts, props, source fields, events or literal data to source operations/component emits. Native note list/create/update/delete declarations use exact wire schemas and snapshot leases; visual Vue Flow editors, domain-specific business rules, custom database drivers and translations remain product implementation work. Writable native relationships are preflight-checked for declared cardinalities, target existence, duplicate references and restrict deletion. These checks serialize writes through the generated runtime, not arbitrary external writers. Enabled test-data recipes generate a reviewed .test-vault seeding and simulation kit. Read docs/development/GENERATOR-PROVIDERS-AND-RELATIONSHIPS.md for provider configuration, constraints, and executable recipe commands. JSON/Markdown editing is plain text, not a full visual editor. Read docs/development/GENERATOR-DECLARATIVE-ACTIONS.md for native operation and action contracts. Generated styles apply the exported Design System in the plugin-owned scope.\n\n## Traceability and regeneration\n\ndesign/project.json preserves the full export, including PRDs, component contracts, test-data recipes and design-system intent. design/traceability.json links requirements, use cases and TODO tests. design/detail-traceability.json links detail designs, interaction hooks and acceptance tests. .companion/generation.json records generated hashes and ownership. Re-run the same reviewed generate command to add new declarations. Unchanged templates can update; customized extension files are preserved. A changed design that also needs to change a customized file is a conflict, not permission to overwrite. Files are never implicitly deleted.\n\nGeneration never installs dependencies, builds, enables plugins, publishes, or authorizes a release. A successful scaffold build is not acceptance of any PRD requirement.\n`,'managed');
  return [...entries.values()].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
