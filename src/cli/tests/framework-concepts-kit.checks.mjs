import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assembleKit, installedCompiler } from '../adapters/framework/kit.ts';
import { extractArchive } from './framework-archive-fixture.mjs';
import { zip } from '../adapters/framework/zip.ts';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { starterDocument } from '../../../tests/support/starter-documents.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
function cli(dir, args) {
  const result = spawnSync(process.execPath,[join(dir,'bin/app'),...args,'--json'],{cwd:dir,encoding:'utf8',timeout:120000,maxBuffer:8_000_000});
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(result.stdout);
}

test('an extracted dependency-free kit imports a feature concept, generates its authored Vue page, then regenerates an improvement', {timeout:300000}, async t=>{
  if (await reviewedExamplesRemoved(root)) { t.skip('Framework kit requires the reviewed example sources.'); return; }
  const dir=await realpath(await mkdtemp(join(tmpdir(),'concept-kit-')));t.after(()=>rm(dir,{recursive:true,force:true}));
  const files=await assembleKit({root,frameworkRoot:root},await installedCompiler());
  await extractArchive(zip(files),dir);
  await mkdir(join(dir,'docs/concepts/capture'),{recursive:true});
  const project=starterDocument('blank');project.project.author='Test Author';
  await writeFile(join(dir,'docs/concepts/capture/project.json'),JSON.stringify(project));
  assert.equal(cli(dir,['concept','schema']).status,'ok');
  assert.equal(cli(dir,['setup','--input','docs/concepts/capture/project.json','--yes']).status,'applied');
  assert.equal(cli(dir,['generate','--yes']).status,'applied');
  const raw=await readFile(join(dir,'design/project.json')),baseline=JSON.parse(raw);
  const page={...baseline.design.nodes[0],id:'node-80',kind:'page',slug:'capture',label:'Capture',parent:baseline.design.nodes[0].id,entry:false,command:false,ribbon:false};
  const concept={kind:'obsidian-companion-concept',schemaVersion:1,id:'capture-concept',mode:'feature',projectId:baseline.project.id,baseSha256:hash(raw),
    references:[{collection:'nodes',id:page.parent}],changes:[
      {collection:'nodes',id:page.id,op:'add',value:page},
      {collection:'visualDesigns.pages',id:'vp-100',op:'add',value:{id:'vp-100',ownerId:page.id,name:'Capture',root:[{id:'vn-101',kind:'text',role:'h1',value:{kind:'literal',value:'Capture your idea'}}],scenarios:[],notes:''}},
      {collection:'features.items',id:'capture',op:'add',value:{id:'capture',name:'Capture',surfaces:[page.id],entryPoints:[page.id],components:[],requirements:[],dependsOn:[]}},
    ]};
  await writeFile(join(dir,'docs/concepts/capture/concept.json'),JSON.stringify(concept));
  const planned=cli(dir,['concept','import','--input','docs/concepts/capture/concept.json','--plan-out','concept.plan.json']);
  assert.equal(planned.status,'planned');
  assert.equal(cli(dir,['plan','apply','concept.plan.json','--yes']).status,'applied');
  assert.equal(cli(dir,['generate','--yes']).status,'applied');
  assert.match(await readFile(join(dir,'src/generated/presentation/components/details/vp-100.vue'),'utf8'),/model.text\('vn-101'\)/);
  assert.match(await readFile(join(dir,'src/generated/domain/visual/vp-100.ts'),'utf8'),/Capture your idea/);
  assert.match(await readFile(join(dir,'src/generated/presentation/components/screens/capture-screen.vue'),'utf8'),/vp-100/);
  assert.equal(cli(dir,['concept','import','--input','docs/concepts/capture/concept.json','--yes']).status,'unchanged');
  assert.equal(cli(dir,['generate','--yes']).status,'unchanged');
  const extension=join(dir,'src/generated/presentation/components/screens/capture-screen.vue');
  const edited=(await readFile(extension,'utf8'))+'\n<!-- Consumer extension retained -->\n';await writeFile(extension,edited);
  const after=await readFile(join(dir,'design/project.json')),document=JSON.parse(after);
  const improvement={...concept,id:'capture-improvement',mode:'improvement',baseSha256:hash(after),references:[],changes:[
    {collection:'nodes',id:page.id,op:'replace',value:{...document.design.nodes.find(node=>node.id===page.id),label:'Capture details'}},
  ]};
  await writeFile(join(dir,'docs/concepts/capture/improve.json'),JSON.stringify(improvement));
  assert.equal(cli(dir,['concept','import','--input','docs/concepts/capture/improve.json','--yes']).status,'applied');
  assert.equal(cli(dir,['generate','--yes']).status,'applied');
  assert.equal(await readFile(extension,'utf8'),edited);
  assert.match(await readFile(join(dir,'src/generated/domain/screens.ts'),'utf8'),/Capture details/);
  const saved=JSON.parse(await readFile(join(dir,'design/project.json'),'utf8'));assert.equal(saved.schemaVersion,6);
  assert.equal(await readFile(join(dir,'docs/concepts/capture/concept.json'),'utf8'),JSON.stringify(concept));
});
