import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assess, parsePbi, specificationHash, validateSchema } from './progress.mjs';

const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const candidate='a'.repeat(40), file='WB-PBI-001.md';
function sandbox(run) {
  const root=mkdtempSync(join(tmpdir(),'workbench-pbi-'));
  try { cpSync(source,root,{recursive:true}); return run(root); }
  finally { rmSync(root,{recursive:true,force:true}); }
}
function edit(root,name,change) {
  const p=parsePbi(readFileSync(join(root,name),'utf8')); change(p.data,p);
  writeFileSync(join(root,name),'---\n'+Object.entries(p.data).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n')+'\n---\n'+p.body);
  return p;
}
function json(root,name,value) { writeFileSync(join(root,name),JSON.stringify(value)); }
function accepted(root) {
  const p=edit(root,file,(d,p)=>{
    Object.assign(d,{status:'done',owner:'Synthetic test owner',review_status:'approved',estimate_points:3,verification_candidate:candidate,
      verification_plan:p.criteria.flatMap(criterion=>d.verification_profiles.map(profile=>({criterion,profile}))),
      review_record:'evidence/test-review.json',evidence_refs:['evidence/test-run.json'],accepted_by:'Synthetic PO',accepted_on:'2026-09-29',
      acceptance_record:'evidence/test-acceptance.json',started_on:'2026-09-28',done_on:'2026-09-29'});
  });
  const spec=specificationHash(p), common={pbi:p.data.id,revision:1,spec_sha256:spec,candidate};
  json(root,'evidence/test-review.json',{...common,type:'PBI-Review',decision:'approved',reviewed_on:'2026-09-29',reviewers:{product:'P',ux:'U',engineering:'E'}});
  json(root,'evidence/test-run.json',{...common,type:'PBI-Evidence',executed_at:'2026-09-29T12:00:00Z',protocol:'Synthetic validator fixture',environment:'Temporary directory',
    artifacts:[{reference:'synthetic-test-artifact',sha256:'b'.repeat(64)}],checks:p.data.verification_plan.map(c=>({...c,result:'passed'}))});
  json(root,'evidence/test-acceptance.json',{...common,type:'PBI-Acceptance',decision:'accepted',reviewed_by:'Synthetic PO',reviewed_on:'2026-09-29'});
}

test('real baseline has 55 new PBIs, 220 criteria and no invented acceptance',()=>{
  const r=assess(source,{asOf:'2026-09-29'});
  assert.equal(r.scope.total,55); assert.equal(r.criterion_total,220); assert.equal(r.scope.accepted,0);
  assert.equal(r.status_counts.new,55); assert.equal(r.accepted_point_fraction,null); assert.equal(r.unassigned,55);
});
test('duplicate frontmatter keys and unsupported YAML fail closed',()=>{
  assert.throws(()=>parsePbi('---\ntype: PBI\ntype: PBI\n---\n### WB-PBI-001-AC01\n'),/Duplicate/);
  assert.throws(()=>parsePbi('---\ntype: &unsafe PBI\n---\n### WB-PBI-001-AC01\n'),/Unsupported/);
});
test('conventional block string lists parse without hidden execution',()=>{
  const p=parsePbi('---\ntype: PBI\nrefs:\n  - "A01"\n  - A02\n---\n### WB-PBI-001-AC01\n');
  assert.deepEqual(p.data.refs,['A01','A02']);
});
test('unknown schema keywords and wrong typed values fail',()=>{
  assert.throws(()=>validateSchema('PBI',{type:'string',unknown:true}),/Unsupported schema/);
  sandbox(root=>{edit(root,file,d=>d.estimate_points='five');assert.throws(()=>assess(root),/Wrong type/);});
});
test('missing baseline file cannot shrink the denominator',()=>sandbox(root=>{
  rmSync(join(root,file)); assert.throws(()=>assess(root),/scope\/file count/);
}));
test('deferred item stays in scope and earns no completion',()=>sandbox(root=>{
  edit(root,file,d=>d.status='deferred');const r=assess(root);assert.equal(r.scope.total,55);assert.equal(r.scope.accepted,0);
}));
test('unknown dependencies and dependency cycles are rejected',()=>sandbox(root=>{
  edit(root,file,d=>d.depends_on=['WB-PBI-003']);
  edit(root,'WB-PBI-002.md',d=>d.depends_on=['WB-PBI-001']);
  assert.throws(()=>assess(root),/Dependency cycle/);
  edit(root,file,d=>d.depends_on=['WB-PBI-999']);assert.throws(()=>assess(root),/Unknown dependency/);
}));
test('done label alone cannot earn acceptance',()=>sandbox(root=>{
  edit(root,file,d=>d.status='done');assert.throws(()=>assess(root),/review record missing/);
}));
test('complete synthetic evidence and PO decision can earn one acceptance',()=>sandbox(root=>{
  accepted(root);const r=assess(root,{candidate,asOf:'2026-09-29'});
  assert.equal(r.scope.accepted,1);assert.equal(r.criteria_verified,4);assert.equal(r.scope.shipped,0);
  assert.equal(r.accepted_point_fraction,null);assert.equal(r.accepted_in_previous_28_days,1);
}));
test('specification edit invalidates old review/evidence',()=>sandbox(root=>{
  accepted(root);edit(root,file,(d,p)=>p.body+='\nChanged normative scope.\n');
  assert.throws(()=>assess(root),/review record invalid/);
}));
test('changed candidate cannot reuse an old passing run',()=>sandbox(root=>{
  accepted(root);assert.throws(()=>assess(root,{candidate:'c'.repeat(40)}),/lacks current complete evidence/);
}));
test('omitted criterion/profile result cannot pass tested state',()=>sandbox(root=>{
  accepted(root);const e=JSON.parse(readFileSync(join(root,'evidence/test-run.json'),'utf8'));e.checks.pop();json(root,'evidence/test-run.json',e);
  assert.throws(()=>assess(root),/lacks current complete evidence/);
}));
test('newer failing run overrides an older pass for the same plan',()=>sandbox(root=>{
  accepted(root);const e=JSON.parse(readFileSync(join(root,'evidence/test-run.json'),'utf8'));
  e.executed_at='2026-09-29T13:00:00Z';e.checks[0].result='failed';json(root,'evidence/test-failed.json',e);
  edit(root,file,d=>d.evidence_refs.push('evidence/test-failed.json'));
  assert.throws(()=>assess(root),/lacks current complete evidence/);
}));
test('shipped state requires an actual recorded release reference',()=>sandbox(root=>{
  accepted(root);edit(root,file,d=>{d.status='shipped';d.shipped_on='2026-09-29';});
  assert.throws(()=>assess(root),/shipment evidence missing/);
}));
test('unmapped source IDs block a misleading traceability report',()=>sandbox(root=>{
  const b=JSON.parse(readFileSync(join(root,'backlog.json'),'utf8'));b.requirements.push('MVP-99');json(root,'backlog.json',b);
  assert.throws(()=>assess(root),/Unmapped source ID/);
}));
test('evidence paths cannot escape the requirements directory',()=>sandbox(root=>{
  edit(root,file,d=>d.evidence_refs=['../secret.json']);assert.throws(()=>assess(root),/Unsafe evidence/);
}));
