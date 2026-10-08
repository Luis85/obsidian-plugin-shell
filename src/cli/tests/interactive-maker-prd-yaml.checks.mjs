import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {test}=await(process.env.VITEST?import('vitest'):import('node:test'));
import {parsePrdMarkdown as decodePrd} from '../adapters/prd-yaml.ts';
import {intakePrds} from '../adapters/prd-intake.ts';
import {defaultSettings,readSettings} from '../domain/user-settings.ts';
import {PRD_LIMITS} from '../domain/prd-markdown.ts';
import {newDocument,documentText,openDocument} from '../domain/document.ts';
import {runOperations} from '../application/operations.ts';
async function scratch(work){const root=await mkdtemp(join(await realpath(tmpdir()),'wb-prds-'));try{await work(root);}finally{await rm(root,{recursive:true,force:true});}}
test('YAML intake supports folded identity, comments and inert rich metadata without changing Markdown bytes',async()=>{
 const source='\uFEFF---\r\ntype: PRD\r\nid: PRD-ONE\r\ntitle: >-\r\n  Customer\r\n  service\r\nowners: [Alice, Bob]\r\nmetadata:\r\n  milestone: 1\r\n---\r\n# Original\r\nDo not execute this text.\r\n';
 const result=await decodePrd(source,'one.md');assert.equal(result.title,'Customer service');assert.equal(result.markdown,source);assert.equal(result.id,'PRD-ONE');
 assert.equal(await decodePrd('# ordinary note','note.md'),null);
 assert.equal(await decodePrd('---\ntype: PBI\ntitle: Other\n---\n','other.md'),null);
 const aliased=await decodePrd('---\nkind: &kind prd\ntype: *kind\n---\n','one.md');assert.equal(aliased.id,'one');
});
test('YAML parse errors, duplicate keys, non-scalar identities and unsafe tags fail closed',async()=>{
 const bad=['---\ntype: prd\ntype: prd\n---','---\ntype: [prd]\n---','---\ntype: !execute prd\n---','---\n- item\n---','---\ntype: prd\nid: 12\n---','---\ntype: prd\ntitle: {x: y}\n---','---\ntype: prd\nmeta: [\n---'];
 for(const value of bad)await assert.rejects(()=>decodePrd(value,'bad.md'));
});
test('all 256 PRDs round-trip and the next document is rejected, never truncated',async()=>scratch(async root=>{
 const docs=Array.from({length:PRD_LIMITS.count},(_,i)=>({filename:`prd-${i}.md`,markdown:`---\ntype: prd\nid: PRD-${i}\ntitle: Document ${i}\n---\nText ${i}\n`}));
 const intake=await intakePrds(root,defaultSettings,{mode:'add',documents:docs});assert.equal(intake.prds.length,256);
 let document=runOperations(newDocument('Many requirements'),[{op:'page.add',title:'Home'}]).document;
 document.design.prds=intake.prds;assert.equal(openDocument(JSON.parse(documentText(document))).design.prds.length,256);
 await assert.rejects(()=>intakePrds(root,defaultSettings,{mode:'add',documents:[...docs,{filename:'last.md',markdown:'---\ntype: prd\n---\n'}]}));
}));
test('aggregate byte limit and per-document limit fail without creating imports',async()=>scratch(async root=>{
 const source='---\ntype: prd\n---\n'+'x'.repeat(240000);
 const docs=Array.from({length:14},(_,i)=>({filename:`p${i}.md`,markdown:source}));
 await assert.rejects(()=>intakePrds(root,defaultSettings,{mode:'add',documents:docs}),/aggregate|3 MB|bytes/i);
 await assert.rejects(readFile(join(root,'docs/prds/p0.md')));
 await assert.rejects(()=>decodePrd(source+'x'.repeat(20000),'large.md'));
}));
test('configured intake directories use the YAML parser and preserve scanner source bytes',async()=>scratch(async root=>{
 await mkdir(join(root,'requirements'),{recursive:true});const source='---\ntype: prd\ntitle: >-\n  A folded title\n---\nOriginal';
 await writeFile(join(root,'requirements/spec.md'),source);const settings=readSettings({schemaVersion:1,paths:{prds:'requirements'}});
 const scanned=await intakePrds(root,settings,{mode:'scan'});assert.equal(scanned.prds[0].title,'A folded title');assert.equal(scanned.guards[0].content,source);
}));
