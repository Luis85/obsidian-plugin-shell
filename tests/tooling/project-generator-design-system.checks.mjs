import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileDesignSystem } from '../../scripts/companion/design-system-css.mjs';
import { DESIGN_SYSTEM_ROLES } from '../../scripts/companion/design-system-roles.mjs';
import { resolveDesignSystemFrontend, validateDesignSystem } from '../../scripts/companion/design-system-contract.mjs';
import { validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { compositionDefaultUI, compositionStyle, validateCompositionDesignSystem } from '../../scripts/companion/composition-contract.mjs';
import { styleCode } from '../../scripts/companion/compiler/style-code.ts';
import { planProject, applyProject } from '../../scripts/companion/compiler/plan.ts';
const fixture = JSON.parse(await readFile(new URL('../../docs/concepts/companion/companion-project.json',import.meta.url),'utf8'));
const system = () => structuredClone(fixture.design.designSystem);
const declaration = (colorPolicy='declared',bindings={}) => ({schema:1,target:'nuxt-ui',colorPolicy,bindings});
const compile = s => compileDesignSystem(s,'sample-plugin');
test('deterministic compilation neither mutates nor loses tokens and guidelines',()=>{
  const s=system(); const before=JSON.stringify(s); const a=compile(s); const b=compile(s);
  assert.deepEqual(a,b); assert.equal(JSON.stringify(s),before); assert.equal(a.pieces.length,7);
  for (const group of ['fonts','typography','spacing','sizes','radii','colors']) {
    assert.equal(a.manifest.tokens[group].length,s[group].length);
    for (const token of a.manifest.tokens[group]) for (const variable of token.variables) assert.ok(a.css.includes(variable+':'));
  }
  const shuffled=system();for(const group of ['fonts','typography','spacing','sizes','radii','colors'])shuffled[group].reverse();
  assert.deepEqual(compile(shuffled),a);
  assert.ok(a.manifest.notes.some(n=>n.includes('Guidelines')));
});
test('legacy systems remain valid and conventional roles resolve without inventing tokens',()=>{
  const s=system(); delete s.frontend; validateDesignSystem(s);
  const m=resolveDesignSystemFrontend(s); assert.equal(m.colorPolicy,'host');
  assert.deepEqual(m.bindings.primary,{group:'colors',token:'accent',origin:'convention'});
  assert.equal(m.bindings.secondary.token,null);
});
test('explicit null suppresses a conventional mapping but preserves the reusable token',()=>{
  const s=system();s.frontend=declaration('declared',{primary:null});const c=compile(s);
  assert.doesNotMatch(c.css,/--ui-primary:/);assert.match(c.css,/--sample-plugin-ds-colors-accent:/);
  assert.equal(c.manifest.bindings.primary.origin,'inherit');
});
test('custom token IDs work through explicit semantic bindings',()=>{
  const s=system();s.colors.push({...s.colors[0],id:'brand-violet',light:'#8844aa',dark:'#ccaaff'});
  s.frontend=declaration('declared',{primary:'brand-violet'});const c=compile(s);
  assert.match(c.css,/--ui-primary: var\(--sample-plugin-ds-colors-brand-violet\)/);
  assert.equal(c.manifest.bindings.primary.origin,'explicit');
});
test('host policy is a fallback chain; declared policy ignores native color preferences',()=>{
  const s=system();s.frontend=declaration('host');const host=compile(s).css;
  assert.match(host,/var\(--background-primary, #ffffff\)/i);
  s.frontend.colorPolicy='declared';const palette=compile(s).css;
  assert.doesNotMatch(palette,/var\(--background-primary,/);assert.match(palette,/\.dark \{/);
  assert.match(palette,/--sample-plugin-ds-colors-background: #1e1e24/i);
});
test('local fonts, typography, units, zero radii and icon/control dimensions emit exact values',()=>{
  const s=system();s.frontend=declaration();s.fonts[0].source='custom';s.fonts[0].families='Example Sans, Second Family';
  s.typography[0].unit='rem';s.typography[0].size=1.75;s.typography[0].letterSpacing=-1;
  s.radii[0].value=0;const css=compile(s).css;
  assert.match(css,/"Example Sans", "Second Family", system-ui/);assert.match(css,/-size: 1.75rem/);
  assert.match(css,/-tracking: -1px/);assert.match(css,/--sample-plugin-ds-radii-control: 0px/);
  assert.match(css,/--ps-spacing:/);assert.match(css,/--ui-radius: calc\(var\(--sample-plugin-ds-radii-control\) \/ 1.5\)/);
  assert.match(css,/min-height: var\(--sample-plugin-ds-sizes-control\)/);
  assert.match(css,/data-slot="leadingIcon"/);assert.match(css,/--sample-plugin-space-md:/);
});
test('a zero spacing token is valid but is not inferred as the Tailwind base unit',()=>{
  const s=system();s.spacing.find(t=>t.id==='xs').value=0;
  assert.equal(compile(s).manifest.bindings.spacingUnit.token,null);
  s.frontend=declaration('declared',{spacingUnit:'xs'});assert.throws(()=>compile(s),/positive/);
  s.frontend.bindings.spacingUnit=null;assert.doesNotThrow(()=>compile(s));
});
for(const [name,edit] of [
  ['unknown frontend version',s=>s.frontend.schema=2],
  ['unknown frontend property',s=>s.frontend.rawCss='body {display:none}'],
  ['unknown mapping role',s=>s.frontend.bindings.selector='accent'],
  ['wrong token group',s=>s.frontend.bindings.primary='body'],
  ['missing token',s=>s.frontend.bindings.primary='absent'],
  ['non-string mapping',s=>s.frontend.bindings.primary=0],
  ['invalid palette policy',s=>s.frontend.colorPolicy='automatic-download'],
  ['CSS injection in color',s=>s.colors[0].light='#fff;display:none'],
  ['CSS injection in variable',s=>s.colors[0].host='--x); color:red'],
  ['generated UI color cycle',s=>s.colors[0].host='--ui-bg'],
  ['color entry without a host field',s=>s.colors[0]={id:'x',name:'X',usage:'',light:'#000000',dark:'#000000'}],
  ['null color entry',s=>s.colors[0]=null],
  ['generated token color cycle',s=>s.colors[0].host='--sample-plugin-ds-colors-background'],
  ['font URL',s=>{s.fonts[0].source='custom';s.fonts[0].families='url(https://evil.invalid/font)';}],
  ['negative spacing',s=>s.spacing[0].value=-1],
  ['duplicate token',s=>s.colors.push({...s.colors[0]})],
  ['missing font',s=>s.typography[0].font='absent'],
]) test('rejects '+name+' before source generation',()=>{
  const s=system();s.frontend=declaration();edit(s);assert.throws(()=>compile(s),/DESIGN_SYSTEM/);
  const doc=structuredClone(fixture);doc.design.designSystem=s;assert.throws(()=>validateCompanionDocument(doc),/DESIGN_SYSTEM/);
});
for(const id of ['../escape','x"] body {','UpperCase','constructor','',null])test('rejects untrusted scope '+JSON.stringify(id),()=>assert.throws(()=>compileDesignSystem(system(),id),/DESIGN_SYSTEM_SCOPE/));
test('every selector starts in the exact owned root and no native variables are written',()=>{
  const out=compile(system());
  for(const line of out.css.split('\n').filter(line=>line.includes('{')))assert.ok(line.startsWith(out.manifest.scope),line);
  assert.doesNotMatch(out.css,/(?:^|\n)\s*(?:body|html|:root|:host|\*)\s*\{/);
  assert.doesNotMatch(out.css,/\n\s*--(?:background-|text-normal|font-interface|input-height):/);
  assert.doesNotMatch(out.css,/@(?:import|font-face)|url\(|!important/);
});
test('all finite roles can be explicitly assigned to their declared group',()=>{
  const s=system();s.frontend=declaration();
  for(const [key,role] of Object.entries(DESIGN_SYSTEM_ROLES))s.frontend.bindings[key]=s[role.group][0].id;
  const out=compile(s);assert.equal(Object.keys(out.manifest.bindings).length,Object.keys(DESIGN_SYSTEM_ROLES).length);
  for(const value of Object.values(out.manifest.bindings))assert.equal(value.origin,'explicit');
});
test('maximum-size style fragments stay below the handwritten CSS line ceiling',()=>{
  const s=system();s.frontend=declaration();
  for(const group of ['typography','spacing','sizes','radii','colors']) {
    const prototype={...s[group][0]};s[group]=Array.from({length:64},(_,n)=>({...prototype,id:'token-'+n}));
  }
  for(const piece of compile(s).pieces)assert.ok(piece.css.split('\n').length<=400,piece.name);
});
test('absent system emits the same empty managed paths and no application rules',()=>{
  const out=compile(undefined);assert.equal(out.pieces.length,7);assert.doesNotMatch(out.css,/\{/);
  assert.ok(Object.values(out.manifest.bindings).every(b=>b.token===null));
});
test('generator uses the same compiler under custom roots with a separate customization file',()=>{
  const doc=structuredClone(fixture);doc.settings={codebaseFolder:'product/src',testsFolder:'product/tests'};
  const entries=new Map();styleCode(projectModel(doc),(path,content,ownership)=>entries.set(path,{content,ownership}));
  const compiled=compileDesignSystem(doc.design.designSystem,doc.project.id);
  for(const piece of compiled.pieces)assert.deepEqual(entries.get('product/src/generated/styles/design-system/'+piece.name+'.css'),{content:piece.css,ownership:'managed'});
  assert.match(entries.get('product/src/generated/styles/project.css').content,/design-system\.css/);
  assert.match(entries.get('product/src/generated/styles/project.css').content,/custom\.css/);
  assert.deepEqual(JSON.parse(entries.get('design/style-manifest.json').content),compiled.manifest);
});
test('real plan/apply updates saved palette, preserves custom CSS and clears a removed design system',async()=>{
  const vault=await mkdtemp(join(tmpdir(),'design-system-plan-'));const input=join(vault,'input.json');const options={vault,input,target:'plugin'};
  try {
    const doc=structuredClone(fixture);doc.design.designSystem.frontend=declaration();await writeFile(input,JSON.stringify(doc));
    const initial=await planProject(options);await applyProject(initial,initial.hash);
    const base=join(vault,'plugin/src/generated/styles');await writeFile(join(base,'custom.css'),'/* consumer owned */\n');
    doc.design.designSystem.colors[0].light='#123456';await writeFile(input,JSON.stringify(doc));
    const next=await planProject(options);assert.equal(next.conflicts.length,0);await applyProject(next,next.hash);
    assert.match(await readFile(join(base,'design-system/colors.css'),'utf8'),/#123456/);
    assert.equal(await readFile(join(base,'custom.css'),'utf8'),'/* consumer owned */\n');
    delete doc.design.designSystem;await writeFile(input,JSON.stringify(doc));
    const removal=await planProject(options);assert.equal(removal.conflicts.length,0);await applyProject(removal,removal.hash);
    for(const name of ['fonts','typography','spacing','sizes','radii','colors','theme'])assert.doesNotMatch(await readFile(join(base,'design-system/'+name+'.css'),'utf8'),/\{/);
    assert.equal(await readFile(join(base,'custom.css'),'utf8'),'/* consumer owned */\n');
  } finally {await rm(vault,{recursive:true,force:true});}
});
test('a manually changed managed stylesheet is a regeneration conflict, never an overwrite',async()=>{
  const vault=await mkdtemp(join(tmpdir(),'design-system-conflict-'));const input=join(vault,'input.json');const options={vault,input,target:'plugin'};
  try {
    const doc=structuredClone(fixture);await writeFile(input,JSON.stringify(doc));const initial=await planProject(options);await applyProject(initial,initial.hash);
    const path=join(vault,'plugin/src/generated/styles/design-system/colors.css');await writeFile(path,'/* manual edit */\n');
    doc.design.designSystem.colors[0].light='#123456';await writeFile(input,JSON.stringify(doc));const result=await planProject(options);
    assert.ok(result.conflicts.some(c=>c.includes('design-system/colors.css')));await assert.rejects(applyProject(result,result.hash),/conflicts/);
    assert.equal(await readFile(path,'utf8'),'/* manual edit */\n');
  } finally {await rm(vault,{recursive:true,force:true});}
});

test('composition snapshots and previews share declared rem and local font semantics',()=>{
  const s=system();s.fonts[0].source='custom';s.fonts[0].families='Example Sans, Second Family';
  s.typography[0].font=s.fonts[0].id;s.typography[0].unit='rem';s.typography[0].size=1.75;
  s.spacing[0].unit='rem';s.spacing[0].value=100;s.radii[0].unit='px';s.radii[0].value=1600;
  validateDesignSystem(s);validateCompositionDesignSystem(s);
  const node={kind:'text',layout:'stack',ui:compositionDefaultUI()};
  Object.assign(node.ui.tokens,{typography:s.typography[0].id,gap:s.spacing[0].id,radius:s.radii[0].id});
  const style=compositionStyle(node,s);
  assert.equal(style.fontSize,'1.75rem');assert.equal(style.fontFamily,'"Example Sans", "Second Family", system-ui');
  assert.equal(style.gap,'100rem');assert.equal(style.borderRadius,'1600px');
  const doc=structuredClone(fixture);doc.design.detailDesigns.revisions[0].designSystem=s;
  assert.doesNotThrow(()=>validateCompanionDocument(doc));
});
test('composition native font preferences remain scoped references and injection stays inert',()=>{
  const s=system(),node={kind:'text',layout:'stack',ui:compositionDefaultUI()};node.ui.tokens.typography=s.typography[0].id;
  s.typography[0].font=s.fonts[0].id;s.fonts[0].source='interface';
  assert.equal(compositionStyle(node,s).fontFamily,'var(--font-interface, system-ui)');
  s.fonts[0].source='custom';s.fonts[0].families='Example; background:url(https://invalid.test)';
  assert.equal(compositionStyle(node,s).fontFamily,undefined);
  for(const [unit,size] of [['rem',12.1],['px',192.1],['url(x)',16]]){
    s.typography[0].unit=unit;s.typography[0].size=size;
    assert.throws(()=>validateCompositionDesignSystem(s),/typography/);
    assert.equal(compositionStyle(node,s).fontSize,undefined);
  }
});
