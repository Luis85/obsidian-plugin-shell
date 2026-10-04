export interface RelationshipRule {
  id: string; source: string; target: string; key: string;
  sourceCard: string; targetCard: string; onDelete: string;
}
export interface RelationshipRecord { readonly entity: string; readonly id: string; readonly path: string; readonly values: object }
export interface RelationshipFinding { relationship: string; record: string; code: string }
const bounds: Readonly<Record<string, readonly [number,number]>> = {'0..1':[0,1],'1':[1,1],'1..1':[1,1],'0..*':[0,Infinity],'1..*':[1,Infinity]};
function targetRecord(value: string, records: readonly RelationshipRecord[]): RelationshipRecord | undefined {
  if (!value || value.length>500 || /[\r\n]/.test(value)) return;
  if (!value.startsWith('[[')) return records.find(record=>record.id===value);
  const match=/^\[\[([^[\]|#^]+)(?:\|[^[\]\r\n]+)?\]\]$/.exec(value); if(!match)return;
  const path=match[1]!.replace(/\.md$/,'');
  if(path.startsWith('/') || path.includes('\\') || path.split('/').some(p=>p==='.' || p==='..' || p===''))return;
  const matches=records.filter(record=>record.path.replace(/\.md$/,'')===path);
  return matches.length===1?matches[0]:undefined;
}
function referenceValues(raw:unknown):unknown[]{
  if(raw===undefined)return [];
  if(!Array.isArray(raw))return [raw];
  if(raw.length>100000 || Reflect.ownKeys(raw).length!==raw.length+1)throw new Error('RELATIONSHIP_VALUES_LIMIT');
  return Array.from({length:raw.length},(_,index)=>{
    const field=Object.getOwnPropertyDescriptor(raw,String(index));
    if(!field || !('value' in field))throw new Error('RELATIONSHIP_ACCESSOR');return field.value;
  });
}
function assertDistinctRecords(records: readonly RelationshipRecord[]): void {
  const identities=new Set<string>(), paths=new Set<string>();
  for(const record of records){const key=record.entity+':'+record.id;
    if(identities.has(key)||paths.has(record.path))throw new Error('RELATIONSHIP_DUPLICATE_RECORD');identities.add(key);paths.add(record.path);
  }
}
function assertRuleDefinitions(rules: readonly RelationshipRule[]): void {
  const ruleIds=new Set<string>();
  for(const rule of rules){
    if(!rule.id || ruleIds.has(rule.id) || !rule.key || ['__proto__','constructor','prototype'].includes(rule.key))throw new Error('RELATIONSHIP_DEFINITION');ruleIds.add(rule.id);
  }
}
/** One rule's walk: the shared link budget, the inverse counts and the finding sink. */
interface RuleScan { rule: RelationshipRule; outward: readonly [number,number]; targets: RelationshipRecord[]; counts: Map<string,number>; budget: { links: number }; findings: RelationshipFinding[] }
function linkedValues(scan: RuleScan, record: RelationshipRecord): { raw: unknown; links: unknown[] } {
  const descriptor=Object.getOwnPropertyDescriptor(record.values,scan.rule.key);
  if(descriptor && !('value' in descriptor))throw new Error('RELATIONSHIP_ACCESSOR');
  const raw:unknown=descriptor?.value, links=referenceValues(raw);
  scan.budget.links+=links.length;if(scan.budget.links>100000)throw new Error('RELATIONSHIP_LIMIT');
  return { raw, links };
}
function inspectRecord(scan: RuleScan, record: RelationshipRecord): void {
  const { rule, outward, targets, counts } = scan, { raw, links } = linkedValues(scan, record);
  const add=(code:string)=>scan.findings.push({relationship:rule.id,record:record.id,code});
  const many=rule.targetCard.endsWith('*');
  if(raw!==undefined && many!==Array.isArray(raw))add('shape');
  if(links.length<outward[0] || links.length>outward[1])add('cardinality');
  const seen=new Set<string>();
  for(const link of links){
    const target=typeof link==='string'?targetRecord(link,targets):undefined;
    if(!target){add('missing-target');continue;}
    if(seen.has(target.id)){add('duplicate-target');continue;}seen.add(target.id);counts.set(target.id,counts.get(target.id)!+1);
  }
}
function inspectRule(rule: RelationshipRule, records: readonly RelationshipRecord[], budget: { links: number }, findings: RelationshipFinding[]): void {
  const outward=bounds[rule.targetCard],inward=bounds[rule.sourceCard];
  if(!outward || !inward || rule.onDelete!=='restrict')throw new Error('RELATIONSHIP_POLICY_UNSUPPORTED');
  const targets=records.filter(r=>r.entity===rule.target);
  const scan: RuleScan={rule,outward,targets,counts:new Map(targets.map(r=>[r.id,0])),budget,findings};
  for(const record of records.filter(r=>r.entity===rule.source))inspectRecord(scan,record);
  for(const [id,count] of scan.counts)if(count<inward[0]||count>inward[1])findings.push({relationship:rule.id,record:id,code:'inverse-cardinality'});
}
/** Validate a complete in-memory graph. No vault mutation or expression evaluation. */
export function inspectRelationships(rules: readonly RelationshipRule[], records: readonly RelationshipRecord[]): RelationshipFinding[] {
  if(rules.length>120 || records.length>12000)throw new Error('RELATIONSHIP_LIMIT');
  assertDistinctRecords(records); assertRuleDefinitions(rules);
  const findings:RelationshipFinding[]=[], budget={links:0};
  for(const rule of rules)inspectRule(rule,records,budget,findings);
  return findings;
}
export type RelationshipMutation = {mode:'create'|'update';record:RelationshipRecord}|{mode:'delete';record:RelationshipRecord};
export function assertRelationshipMutation(rules: readonly RelationshipRule[], records: readonly RelationshipRecord[], mutation: RelationshipMutation): void {
  const old=records.find(r=>r.entity===mutation.record.entity && r.id===mutation.record.id);
  if(mutation.mode==='create' && old || mutation.mode!=='create' && (!old || old.path!==mutation.record.path))throw new Error('RELATIONSHIP_RECORD_STALE');
  const candidate=records.filter(r=>r!==old);
  if(mutation.mode!=='delete')candidate.push(mutation.record);
  const findings=inspectRelationships(rules,candidate);
  if(findings.length)throw new Error('RELATIONSHIP_VIOLATION: '+findings[0]!.code);
}
