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
import { devkitFiles, renderTemplate } from './devkit-files.ts';
import { maintainerOnly, relocateFrameworkDocuments } from './framework-docs.ts';
const roots = ['src','scripts','tests','harness','docs','.github'];
const files = ['package.json','package-lock.json','manifest.json','versions.json','tsconfig.json','vite.config.mjs','vite.harness.config.mjs','vitest.config.mjs','vitest.production.config.mjs','playwright.config.ts','eslint.config.mjs','.fallowrc.json','.oxlintrc.json','.gitignore','.nvmrc','AGENTS.md','LICENSE','README.md','TEMPLATE-GUIDE.md','SHELL-FIRST-OVERVIEW.md','shell.mjs','vitest.obsidian.config.mjs','tsconfig.generator.json','tsconfig.framework.json'];
export async function projectFiles(templateRoot: string, m: Model): Promise<Entry[]> {
  const entries = new Map<string,Entry>();
  const add: Add = (path,content,ownership = 'extension') => { entries.set(path,{path,content,ownership}); };
  async function copy(path: string) {
    // Source verification may create Python caches; never copy machine bytecode.
    if (path.split('/').includes('__pycache__') || /\.py[co]$/.test(path) || maintainerOnly(path)) return;
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
  relocateFrameworkDocuments(entries);
  const readJson = (path: string) => JSON.parse(entries.get(path)!.content);
  const manifest = readJson('manifest.json'); Object.assign(manifest,m.project); manifest.isDesktopOnly = true;
  add('manifest.json',json(manifest));
  const pkg = readJson('package.json'); const lock = readJson('package-lock.json');
  Object.assign(pkg,{name:m.project.id,version:m.project.version,description:m.project.description,author:m.project.author});
  Object.assign(lock,{name:pkg.name,version:pkg.version}); Object.assign(lock.packages[''],{name:pkg.name,version:pkg.version,...(pkg.bin ? {bin:pkg.bin} : {})});
  pkg.scripts['test:framework'] = pkg.scripts.test;
  pkg.scripts['test'] = 'vitest run --config vitest.project.config.mjs';
  pkg.scripts['test:watch'] = 'vitest --config vitest.project.config.mjs';
  pkg.scripts['test:tdd'] = `vitest --config vitest.project.config.mjs ${JSON.stringify(m.testRoot+'/acceptance')}`;
  pkg.scripts['typecheck:project'] = 'vue-tsc --noEmit --project tsconfig.project.json';
  pkg.scripts['test:ui-effects'] = `node --test ${m.testRoot}/ui-effects/*.checks.mjs`;
  pkg.scripts['doctor'] = 'node shell.mjs doctor';
  pkg.scripts['verify:project'] = 'npm run build && npm run typecheck:project && npm test && npm run test:ui-effects';
  // Full framework coverage/native/release gates remain present and are NOT relabelled green.
  const fixtures = await fixtureCode(templateRoot,m,add);
  if(fixtures) { pkg.scripts['testdata:check']='node scripts/test-data/verify.mjs'; pkg.scripts['verify:project'] += ' && npm run testdata:check'; }
  if(fixtures) for(const command of ['plan','apply','reset-plan','reset','serve']) pkg.scripts['testdata:'+command]='node scripts/test-data/cli.mjs '+command;
  add('package.json',json(pkg)); add('package-lock.json',json(lock));
  add('versions.json',json({...readJson('versions.json'),[String(m.project.version)]:manifest.minAppVersion}));
  add('tsconfig.project.json',json({extends:'./tsconfig.json',compilerOptions:{allowImportingTsExtensions:true},include:['src/**/*.ts','src/**/*.vue',m.sourceRoot+'/**/*.ts',m.sourceRoot+'/**/*.vue',m.testRoot+'/**/*.ts']}));
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
  await devkitFiles(templateRoot,m,add);
  const values = {name:String(m.project.name),sourceRoot:m.sourceRoot,testRoot:m.testRoot};
  add('PROJECT-IMPLEMENTATION.md',renderTemplate(await readFile(join(templateRoot,'scripts/companion/devkit/PROJECT-IMPLEMENTATION.md.tmpl'),'utf8'),values),'managed');
  return [...entries.values()].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
