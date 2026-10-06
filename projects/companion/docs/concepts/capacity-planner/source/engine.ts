import {clone,normalizeWorkspace,nowIso,uid,validate} from "./core.ts";

export const ENGINE_NAME="capacity-planner";
export const ENGINE_VERSION=1;
export const PLAN_SCHEMA="capacity-planner.plan";
export const PLAN_VERSION=1;

function assertFinite(value,name,{min=-Infinity,max=Infinity}={}) {
  const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)throw new Error(`${name} is invalid.`);return number;
}
function assertName(value,label="Plan name") {const name=String(value||"").trim();if(!name)throw new Error(`${label} is required.`);return name;}
function blankRolePlans(project) {return Object.fromEntries(project.roles.map(role=>[role.id,{fteByIteration:{},rateByIteration:{}}]));}
function validateWorkspaceOrThrow(workspace) {const normalized=normalizeWorkspace(workspace),error=validate(normalized);if(error)throw new Error(error);return normalized;}

export function createPlan(workspace,input) {
  const next=clone(workspace),source=next.scenarios.find(item=>item.id===(input.basisScenarioId||next.activeScenarioId));
  if(!source)throw new Error("The source resource plan does not exist.");
  const basis=input.basis==="blank"?"blank":"clone";
  const scenario=basis==="clone"?clone(source):{rolePlans:blankRolePlans(next.project),allocations:[],nonLaborCosts:[]};
  scenario.id=uid("scenario");scenario.name=assertName(input.name);scenario.status="draft";
  scenario.budget=assertFinite(input.budget,"Resource budget",{min:0});
  scenario.contingencyPct=assertFinite(input.contingencyPct,"Contingency",{min:0,max:100});
  scenario.targetMarginPct=assertFinite(input.targetMarginPct,"Target margin",{min:-100,max:100});
  scenario.createdAt=nowIso();next.scenarios.push(scenario);next.activeScenarioId=scenario.id;
  return {workspace:validateWorkspaceOrThrow(next),planId:scenario.id,plan:scenario,basis,sourcePlanId:source.id};
}

export function updatePlan(workspace,planId,patch) {
  const next=clone(workspace),scenario=next.scenarios.find(item=>item.id===planId);if(!scenario)throw new Error("Resource plan not found.");
  scenario.name=assertName(patch.name??scenario.name);
  if(patch.status!==undefined){const status=String(patch.status);if(!["draft","approved","archived"].includes(status))throw new Error("Plan status is invalid.");scenario.status=status;}
  if(patch.budget!==undefined)scenario.budget=assertFinite(patch.budget,"Resource budget",{min:0});
  if(patch.contingencyPct!==undefined)scenario.contingencyPct=assertFinite(patch.contingencyPct,"Contingency",{min:0,max:100});
  if(patch.targetMarginPct!==undefined)scenario.targetMarginPct=assertFinite(patch.targetMarginPct,"Target margin",{min:-100,max:100});
  return {workspace:validateWorkspaceOrThrow(next),planId:scenario.id,plan:scenario};
}

export function exportPlanDocument(workspace,planId=workspace.activeScenarioId) {
  const scenario=workspace.scenarios.find(item=>item.id===planId);if(!scenario)throw new Error("Resource plan not found.");
  return {schema:PLAN_SCHEMA,version:PLAN_VERSION,engine:{name:ENGINE_NAME,version:ENGINE_VERSION},exportedAt:nowIso(),project:clone(workspace.project),plan:clone(scenario),baselines:clone((workspace.baselines||[]).filter(item=>item.scenarioId===scenario.id))};
}

export function validatePlanDocument(document) {
  if(!document||document.schema!==PLAN_SCHEMA||document.version!==PLAN_VERSION)return"Unsupported Capacity Planner plan document.";
  if(document.engine?.name!==ENGINE_NAME||Number(document.engine?.version)!==ENGINE_VERSION)return"Unsupported planner engine version.";
  if(!document.project||!document.plan)return"Plan document is incomplete.";
  const candidate=normalizeWorkspace({schema:"capacity-planner.workspace",version:2,id:"plan-validation",revision:1,updatedAt:document.exportedAt||nowIso(),project:clone(document.project),scenarios:[clone(document.plan)],activeScenarioId:document.plan.id,baselines:clone(document.baselines||[]),audit:[]});
  return validate(candidate);
}

export function parsePlanJson(text) {
  let document;try{document=JSON.parse(String(text));}catch{throw new Error("Plan JSON is not valid JSON.");}
  const error=validatePlanDocument(document);if(error)throw new Error(error);return document;
}
export function stringifyPlanDocument(document) {
  const error=validatePlanDocument(document);if(error)throw new Error(error);return JSON.stringify(document,null,2);
}

export function workspaceFromPlanDocument(document) {
  const error=validatePlanDocument(document);if(error)throw new Error(error);
  const plan=clone(document.plan),at=nowIso();
  return validateWorkspaceOrThrow({schema:"capacity-planner.workspace",version:2,id:uid("workspace"),revision:1,updatedAt:at,project:clone(document.project),scenarios:[plan],activeScenarioId:plan.id,baselines:clone(document.baselines||[]),audit:[{id:uid("audit"),at,revision:1,action:"plan.opened",detail:`${plan.name} opened from engine JSON`}]});
}

export function addPlanDocument(workspace,document,{name=null}={}) {
  const error=validatePlanDocument(document);if(error)throw new Error(error);
  if(document.project.id!==workspace.project.id)throw new Error("This plan belongs to a different project. Open it as a new workspace instead.");
  const next=clone(workspace),scenario=clone(document.plan),oldId=scenario.id;scenario.id=uid("scenario");scenario.name=assertName(name||scenario.name);scenario.status="draft";scenario.createdAt=nowIso();
  next.scenarios.push(scenario);next.activeScenarioId=scenario.id;
  for(const source of document.baselines||[]){const baseline=clone(source);baseline.id=uid("baseline");baseline.scenarioId=scenario.id;next.baselines.push(baseline);}
  try{return {workspace:validateWorkspaceOrThrow(next),planId:scenario.id,plan:scenario,sourcePlanId:oldId};}
  catch(error){throw new Error(`Plan cannot be added to the current project: ${error.message}`);}
}

export function describePlanDocument(document) {
  const project=document?.project||{},plan=document?.plan||{};
  return {projectId:project.id||"",projectName:project.name||"",planId:plan.id||"",planName:plan.name||"",iterations:Array.isArray(project.iterations)?project.iterations.length:0,roles:Array.isArray(project.roles)?project.roles.length:0,people:Array.isArray(project.people)?project.people.length:0,tasks:Array.isArray(project.tasks)?project.tasks.length:0,allocations:Array.isArray(plan.allocations)?plan.allocations.length:0};
}
