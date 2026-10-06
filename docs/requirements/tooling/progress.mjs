import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const unique = values => new Set(values).size === values.length;
const integer = value => Number.isInteger(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

/** A documented YAML subset: flat mappings, JSON flow values and scalar block lists. */
export function parsePbi(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  ensure(match, 'PBI must start with a delimited YAML frontmatter block');
  const data = {}; let current;
  const scalar = raw => {
    if (/^(?:"|\[|\{|null$|true$|false$|-?\d)/.test(raw)) {
      try { return JSON.parse(raw); } catch { throw new Error(`Unsupported YAML value: ${raw}`); }
    }
    if (/^'[^']*'$/.test(raw)) return raw.slice(1,-1);
    ensure(raw && !/[:#&*!|>{}\[\]]/.test(raw), `Unsupported YAML scalar: ${raw}`);
    return raw;
  };
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const block = line.match(/^  - (.+)$/);
    if (block) { ensure(current && Array.isArray(data[current]), 'Unexpected YAML list'); data[current].push(scalar(block[1])); continue; }
    const field = line.match(/^([a-z_]+):(?: (.*))?$/);
    ensure(field, `Unsupported YAML line: ${line}`);
    current = field[1];
    ensure(!Object.hasOwn(data,current), `Duplicate field ${current}`);
    data[current] = field[2] === undefined || field[2] === '' ? [] : scalar(field[2]);
  }
  const criteria = [...match[2].matchAll(/^### (WB-PBI-\d{3}-AC\d{2})\s*$/gm)].map(x=>x[1]);
  ensure(criteria.length > 0 && unique(criteria), 'Missing or duplicated acceptance criteria');
  return { data, body: match[2], criteria };
}

/** Only keywords used by the checked-in schema are supported; unknown keywords fail closed. */
export function validateSchema(value, schema, path = '$') {
  const known = ['$schema','$id','title','type','additionalProperties','required','properties','anyOf','const','enum','minLength','pattern','minimum','exclusiveMinimum','maximum','minItems','uniqueItems','items'];
  ensure(Object.keys(schema).every(key=>known.includes(key)), `Unsupported schema keyword at ${path}`);
  if (schema.anyOf) {
    const matches = schema.anyOf.some(option=>{ try { validateSchema(value,option,path); return true; } catch { return false; } });
    ensure(matches, `Schema alternative failed at ${path}`);
  }
  if (Object.hasOwn(schema,'const')) ensure(value === schema.const, `Constant mismatch at ${path}`);
  if (schema.enum) ensure(schema.enum.includes(value), `Invalid enum at ${path}`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    ensure(types.includes(actual) || (types.includes('integer') && integer(value)), `Wrong type at ${path}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength) ensure(value.length >= schema.minLength, `Empty string at ${path}`);
    if (schema.pattern) ensure(new RegExp(schema.pattern).test(value), `Pattern mismatch at ${path}`);
  }
  if (typeof value === 'number') {
    ensure(Number.isFinite(value), `Non-finite number at ${path}`);
    if (schema.minimum !== undefined) ensure(value >= schema.minimum, `Below minimum at ${path}`);
    if (schema.exclusiveMinimum !== undefined) ensure(value > schema.exclusiveMinimum, `Below exclusive minimum at ${path}`);
    if (schema.maximum !== undefined) ensure(value <= schema.maximum, `Above maximum at ${path}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems) ensure(value.length >= schema.minItems, `Missing items at ${path}`);
    if (schema.uniqueItems) ensure(unique(value.map(v=>JSON.stringify(v))), `Duplicate items at ${path}`);
    if (schema.items) value.forEach((v,i)=>validateSchema(v,schema.items,`${path}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const key of schema.required ?? []) ensure(Object.hasOwn(value,key), `Missing ${path}.${key}`);
    if (schema.additionalProperties === false) ensure(Object.keys(value).every(key=>Object.hasOwn(schema.properties,key)), `Unknown field at ${path}`);
    for (const [key,subschema] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(value,key)) validateSchema(value[key],subschema,`${path}.${key}`);
  }
}

export function specificationHash(pbi) {
  const fields = ['id','revision','title','product','epic','feature','outcomes','release','requirements','work_packages','acceptance_refs','source_docs','baseline_commit','depends_on','gate_prerequisites','contributes_to','verification_profiles','verification_plan'];
  return sha(JSON.stringify({ specification: Object.fromEntries(fields.map(k=>[k,pbi.data[k]])), body: pbi.body }));
}
function readJson(root, path) {
  ensure(typeof path === 'string' && path.startsWith('evidence/') && !path.split('/').includes('..'), `Unsafe evidence reference ${path}`);
  const base = realpathSync(root), full = realpathSync(resolve(root,path));
  ensure(full.startsWith(base+sep), 'Evidence escapes requirements directory');
  const bytes = readFileSync(full,'utf8'); ensure(bytes.length < 2_000_000, 'Oversized evidence');
  return JSON.parse(bytes);
}
function checkEvidence(root,pbi,candidate) {
  const d=pbi.data, spec=specificationHash(pbi), plan=d.verification_plan ?? [];
  const pairs = plan.map(p=>`${p.criterion}|${p.profile}`);
  ensure(unique(pairs), `${d.id}: duplicate verification-plan pair`);
  for (const item of plan) ensure(pbi.criteria.includes(item.criterion) && d.verification_profiles.includes(item.profile), `${d.id}: unknown verification-plan reference`);
  if (plan.length) {
    ensure(pbi.criteria.every(c=>plan.some(p=>p.criterion===c)), `${d.id}: incomplete criterion plan`);
    ensure(d.verification_profiles.every(m=>plan.some(p=>p.profile===m)), `${d.id}: incomplete profile plan`);
  }
  const results=new Map(); let stale=0;
  for (const path of d.evidence_refs) {
    const e=readJson(root,path);
    ensure(e.type==='PBI-Evidence' && e.pbi===d.id && integer(e.revision), `${d.id}: wrong evidence identity`);
    ensure(/^[a-f0-9]{40}$/.test(e.candidate) && /^[a-f0-9]{64}$/.test(e.spec_sha256), `${d.id}: malformed evidence identity`);
    ensure(typeof e.executed_at==='string' && !Number.isNaN(Date.parse(e.executed_at)) && /T.*Z$/.test(e.executed_at), `${d.id}: execution time required`);
    ensure(e.protocol && e.environment && Array.isArray(e.artifacts) && e.artifacts.length && e.artifacts.every(a=>a.reference && /^[a-f0-9]{64}$/.test(a.sha256)), `${d.id}: missing evidence provenance`);
    ensure(Array.isArray(e.checks) && e.checks.length, `${d.id}: empty evidence checks`);
    if (e.revision!==d.revision || e.spec_sha256!==spec || e.candidate!==candidate) { stale++; continue; }
    for (const check of e.checks) {
      const key=`${check.criterion}|${check.profile}`;
      ensure(pairs.includes(key) && ['passed','failed','blocked','not-run'].includes(check.result), `${d.id}: invalid evidence check`);
      const old=results.get(key), time=Date.parse(e.executed_at);
      ensure(!old || old.time!==time || old.result===check.result, `${d.id}: conflicting evidence at identical timestamp`);
      if (!old || old.time < time) results.set(key,{time,result:check.result});
    }
  }
  const verified=Boolean(candidate && plan.length && pairs.every(k=>results.get(k)?.result==='passed'));
  const passedCriteria=pbi.criteria.filter(c=>plan.some(p=>p.criterion===c) && plan.filter(p=>p.criterion===c).every(p=>results.get(`${c}|${p.profile}`)?.result==='passed')).length;
  let accepted=false;
  if (d.acceptance_record) {
    const a=readJson(root,d.acceptance_record);
    accepted=verified && a.type==='PBI-Acceptance' && a.pbi===d.id && a.revision===d.revision && a.spec_sha256===spec && a.candidate===candidate
      && a.decision==='accepted' && a.reviewed_by===d.accepted_by && a.reviewed_on===d.accepted_on && validDate(a.reviewed_on) && Boolean(a.reviewed_by);
  }
  return {verified,accepted,passedCriteria,stale,planned:plan.length>0,spec_sha256:spec};
}

export function assess(root=defaultRoot, options={}) {
  const registry=JSON.parse(readFileSync(resolve(root,'backlog.json'),'utf8'));
  const schema=JSON.parse(readFileSync(resolve(root,'schema/pbi.schema.json'),'utf8'));
  const files=readdirSync(root).filter(n=>/^WB-PBI-\d{3}\.md$/.test(n)).sort();
  ensure(unique(registry.baseline_pbis), 'Duplicate baseline IDs');
  ensure(files.length===registry.baseline_pbis.length, 'Baseline scope/file count mismatch');
  const pbis=files.map(file=>{
    const p=parsePbi(readFileSync(resolve(root,file),'utf8')); validateSchema(p.data,schema);
    ensure(file===`${p.data.id}.md` && registry.baseline_pbis.includes(p.data.id), 'PBI identity/baseline mismatch');
    ensure(p.criteria.every(c=>c.startsWith(`${p.data.id}-AC`)), 'Foreign acceptance criterion');
    return p;
  });
  const ids=pbis.map(p=>p.data.id); ensure(unique(ids), 'Duplicate PBI IDs');
  const ranks=pbis.map(p=>p.data.rank); ensure(unique(ranks), 'Duplicate suggested rank');
  const byId=new Map(pbis.map(p=>[p.data.id,p]));
  const checked=new Set(), checking=new Set();
  const visit=id=>{
    ensure(!checking.has(id), `Dependency cycle at ${id}`); if (checked.has(id)) return;
    checking.add(id);
    for(const dep of byId.get(id).data.depends_on) { ensure(byId.has(dep),`Unknown dependency ${dep}`); visit(dep); }
    checking.delete(id); checked.add(id);
  };
  ids.forEach(visit);
  const target=options.candidate ?? null;
  if(target) ensure(/^[a-f0-9]{40}$/.test(target),'Candidate must be a full commit SHA');
  const asOf=options.asOf ?? new Date().toISOString().slice(0,10); ensure(validDate(asOf),'Invalid as-of date');
  const results=pbis.map(p=>{
    const d=p.data;
    ensure(registry.epics[d.epic] && registry.features[d.feature]?.epic===d.epic,'Invalid epic/feature hierarchy');
    for(const field of ['requirements','work_packages','acceptance_refs']) ensure(d[field].length && d[field].every(v=>registry[field].includes(v)),`${d.id}: invalid ${field}`);
    ensure(d.outcomes.length && d.outcomes.every(v=>Object.hasOwn(registry.outcomes,v)),`${d.id}: unknown outcome`);
    ensure(d.source_docs.length && d.verification_profiles.length,`${d.id}: missing source/evidence profile`);
    ensure([...d.gate_prerequisites,...d.contributes_to].every(g=>registry.gates[g]),`${d.id}: unknown gate`);
    for(const field of ['created','updated','status_since','started_on','done_on','shipped_on','accepted_on']) if(d[field]) ensure(validDate(d[field]),`${d.id}: invalid date ${field}`);
    ensure(d.updated>=d.created && d.status_since>=d.created,`${d.id}: dates out of order`);
    if(d.done_on) ensure(d.started_on && d.done_on>=d.started_on,`${d.id}: done date requires valid start`);
    if(d.shipped_on) ensure(d.done_on && d.shipped_on>=d.done_on,`${d.id}: shipment predates completion`);
    const ev=checkEvidence(root,p,target ?? d.verification_candidate);
    const active=['ready','in progress','implemented','tested','done','shipped'].includes(d.status);
    if(active) ensure(d.review_record,`${d.id}: review record missing`);
    if(active) {
      const review=readJson(root,d.review_record);
      ensure(review.type==='PBI-Review' && review.pbi===d.id && review.revision===d.revision && review.spec_sha256===ev.spec_sha256 && review.decision==='approved'
        && validDate(review.reviewed_on) && ['product','ux','engineering'].every(role=>typeof review.reviewers?.[role]==='string' && review.reviewers[role].trim()),`${d.id}: review record invalid`);
    }
    if(d.status==='estimated') ensure(d.estimate_points!==null,`${d.id}: estimated state without estimate`);
    if(active) ensure(d.owner && d.review_status==='approved' && d.estimate_points!==null && !d.open_questions.length && ev.planned,`${d.id}: readiness information missing`);
    if(['in progress','implemented','tested','done','shipped'].includes(d.status)) ensure(d.started_on,`${d.id}: start date missing`);
    if(['tested','done','shipped'].includes(d.status)) ensure(ev.verified,`${d.id}: tested state lacks current complete evidence`);
    if(['done','shipped'].includes(d.status)) ensure(ev.accepted && d.done_on && d.accepted_by && d.accepted_on,`${d.id}: completion lacks current acceptance`);
    if(d.status==='shipped') ensure(d.shipped_on && d.release_ref,`${d.id}: shipment evidence missing`);
    return {id:d.id,epic:d.epic,feature:d.feature,lane:d.lane,milestone:d.milestone,outcomes:d.outcomes,status:d.status,blocked:Boolean(d.blocked_reason),
      estimate:d.estimate_points,owner:d.owner,unresolved_questions:d.open_questions.length,contributes_to:d.contributes_to,...ev,
      accepted:ev.accepted && ['done','shipped'].includes(d.status),shipped:ev.accepted && d.status==='shipped',done_on:d.done_on,
      dependencies:d.depends_on,gate_prerequisites:d.gate_prerequisites};
  });
  for(const r of results) if(r.accepted) ensure(r.dependencies.every(dep=>results.find(p=>p.id===dep)?.accepted),`${r.id}: acceptance prerequisite not accepted`);
  for(const field of ['requirements','work_packages','acceptance_refs']) for(const ref of registry[field]) ensure(pbis.some(p=>p.data[field].includes(ref)),`Unmapped source ID ${ref}`);
  const stats=list=>({total:list.length,verified:list.filter(p=>p.verified).length,accepted:list.filter(p=>p.accepted).length,shipped:list.filter(p=>p.shipped).length,
    blocked:list.filter(p=>p.blocked).length,dependency_waiting:list.filter(p=>p.dependencies.some(dep=>!results.find(x=>x.id===dep)?.accepted)).length});
  const group=(field,keys)=>Object.fromEntries(keys.map(key=>[key,stats(results.filter(r=>Array.isArray(r[field])?r[field].includes(key):r[field]===key))]));
  const allEstimated=results.every(p=>p.estimate!==null);
  const estimated=results.filter(p=>p.estimate!==null);
  return {baseline:registry.baseline_id,as_of:asOf,candidate:target ?? 'per-PBI candidate; unknown where unset',scope:stats(results),
    criterion_total:pbis.reduce((n,p)=>n+p.criteria.length,0),criteria_verified:results.reduce((n,p)=>n+p.passedCriteria,0),
    status_counts:Object.fromEntries(registry.lifecycle.map(s=>[s,results.filter(p=>p.status===s).length])),
    unassigned:results.filter(p=>!p.owner).length,unestimated:results.length-estimated.length,without_verification_plan:results.filter(p=>!p.planned).length,
    stale_evidence:results.reduce((n,p)=>n+p.stale,0),open_questions:results.reduce((n,p)=>n+p.unresolved_questions,0),
    estimated_points:estimated.reduce((n,p)=>n+p.estimate,0),estimated_scope_complete:allEstimated,
    accepted_point_fraction:allEstimated ? results.filter(p=>p.accepted).reduce((n,p)=>n+p.estimate,0)/estimated.reduce((n,p)=>n+p.estimate,0):null,
    accepted_in_previous_28_days:results.filter(p=>p.accepted && p.done_on<=asOf && Date.parse(asOf)-Date.parse(p.done_on)<28*86400000).length,
    by_epic:group('epic',Object.keys(registry.epics)),by_feature:group('feature',Object.keys(registry.features)),by_outcome:group('outcomes',Object.keys(registry.outcomes)),
    by_lane:group('lane',[...new Set(results.map(p=>p.lane))]),by_milestone:group('milestone',['I0','I1','I2','I3','I4','I5','I6']),
    gate_contributions:group('contributes_to',Object.keys(registry.gates)),pbis:results,
    limits:['Counts measure this fixed PBI acceptance baseline, not total implementation, customer value or publication approval.','Overlapping outcome/gate groups must not be summed.','Unestimated scope has no weighted completion or forecast.','Local evidence checks verify consistency, not authenticity or honest test execution.','Existing task states and gate decisions remain separate authorities.']};
}
export function markdown(report) {
  const s=report.scope;
  const lines=['# Workbench MVP progress','',`Baseline: **${report.baseline}**. As of: **${report.as_of}**. Candidate: ${report.candidate}.`,
    '',`**Accepted: ${s.accepted}/${s.total} PBIs. Verified criteria: ${report.criteria_verified}/${report.criterion_total}. Shipped: ${s.shipped}/${s.total}.**`,
    '',`Unassigned: ${report.unassigned}. Unestimated: ${report.unestimated}. Missing refined verification plans: ${report.without_verification_plan}. Stale evidence: ${report.stale_evidence}.`,
    '',`Explicitly blocked: ${s.blocked}. Waiting for PBI acceptance prerequisites: ${s.dependency_waiting}. Open questions: ${report.open_questions}.`,
    '',`Weighted completion: ${report.accepted_point_fraction===null?'not available; estimates are incomplete':(100*report.accepted_point_fraction).toFixed(1)+'%'}. Accepted in the preceding 28 days: ${report.accepted_in_previous_28_days}.`,
    '', '## Lifecycle distribution','','| Status | PBIs |','| --- | --- |',...Object.entries(report.status_counts).map(([k,v])=>`| ${k} | ${v} |`)];
  for(const [name,groups] of [['Epic',report.by_epic],['Feature',report.by_feature],['Outcome',report.by_outcome],['Lane',report.by_lane],['Milestone',report.by_milestone],['Gate contribution',report.gate_contributions]]) {
    lines.push('',`## ${name}`,'',`| ${name} | Scope | Verified | Accepted | Shipped |`,'| --- | --- | --- | --- | --- |');
    for(const [k,v] of Object.entries(groups)) lines.push(`| ${k} | ${v.total} | ${v.verified} | ${v.accepted} | ${v.shipped} |`);
  }
  lines.push('','## Interpretation','',...report.limits.map(x=>'- '+x),'','Initial unverified records are not evidence that existing implementation is absent. Read [governance](GOVERNANCE.md) before changing maturity or acceptance.','');
  return lines.join('\n');
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const args=process.argv.slice(2), options={}; let root=defaultRoot,json=false;
    while(args.length) {
      const arg=args.shift();
      if(arg==='--json') json=true;
      else if(['--root','--candidate','--as-of'].includes(arg)) {
        const value=args.shift(); ensure(value && !value.startsWith('--'),`Value required for ${arg}`);
        if(arg==='--root') root=resolve(value); else options[arg==='--as-of'?'asOf':'candidate']=value;
      } else throw new Error(`Unknown option ${arg}`);
    }
    const report=assess(root,options);
    process.stdout.write(json ? JSON.stringify(report,null,2)+'\n' : markdown(report));
  } catch(error) { process.stderr.write(`BACKLOG_INVALID: ${error.message}\n`); process.exitCode=1; }
}
