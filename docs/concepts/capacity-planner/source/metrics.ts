import {activeScenario,addDays,parseDate,personById,roleById,stateRef,taskById} from "./core.ts";

export function workingDates(iteration,state=stateRef.state) {
  const project=state.project,start=parseDate(iteration.start),end=parseDate(iteration.end);if(!start||!end)return[];
  const holidays=new Set((project.holidays||[]).map(item=>item.date)),allowed=new Set(project.workingDays||[1,2,3,4,5]),dates=[];
  for(let cursor=start;cursor<=end;cursor=addDays(cursor,1)){const day=cursor.getUTCDay();if(allowed.has(day)&&!holidays.has(cursor.toISOString().slice(0,10)))dates.push(cursor.toISOString().slice(0,10));}
  return dates;
}
export function workingDays(iteration,state=stateRef.state){return workingDates(iteration,state).length;}
function datesInLeave(leave,iteration,state) {
  const start=parseDate(leave.start),end=parseDate(leave.end);if(!start||!end)return 0;
  const valid=new Set(workingDates(iteration,state));let count=0;
  for(let cursor=start;cursor<=end;cursor=addDays(cursor,1))if(valid.has(cursor.toISOString().slice(0,10)))count+=1;
  return count;
}
export function personAvailability(person,iteration,state=stateRef.state) {
  const project=state.project,days=workingDays(iteration,state),baseFte=Number(person.availabilityByIteration?.[iteration.id] ?? person.baseFte ?? 0),gross=baseFte*days*Number(project.hoursPerDay||8);
  const leaveHours=(person.leave||[]).reduce((sum,leave)=>sum+datesInLeave(leave,iteration,state)*Math.min(Number(project.hoursPerDay||8),Number(project.hoursPerDay||8)*baseFte),0);
  const hours=Math.max(0,gross-leaveHours),fte=days>0?hours/(days*Number(project.hoursPerDay||8)):0;
  return {hours,fte,leaveHours,workingDays:days};
}
export function roleEnvelope(role,iteration,state=stateRef.state) {
  const people=state.project.people.filter(person=>person.roleId===role.id),days=workingDays(iteration,state),hoursPerDay=Number(state.project.hoursPerDay||8);
  if(people.length){const hours=people.reduce((sum,person)=>sum+personAvailability(person,iteration,state).hours,0);return{hours,fte:days>0?hours/(days*hoursPerDay):0,source:"people"};}
  const fte=Number(role.manualFte||0);return{hours:fte*days*hoursPerDay,fte,source:"manual"};
}
export function rolePlan(role,iteration,scenario=activeScenario()) {
  const plan=scenario.rolePlans?.[role.id]||{fteByIteration:{},rateByIteration:{}};
  const fte=Number(plan.fteByIteration?.[iteration.id]||0),rate=Number(plan.rateByIteration?.[iteration.id] ?? role.dayRate ?? 0),days=workingDays(iteration),hours=fte*days*Number(stateRef.state.project.hoursPerDay||8),pt=fte*days,cost=pt*rate;
  return{fte,rate,days,hours,pt,cost};
}
export function taskEstimateHours(task,state=stateRef.state){return Number(task.units||0)*Number(state.project.hoursPerUnit||0);}
export function taskAllocations(taskId,scenario=activeScenario()){return scenario.allocations.filter(item=>item.taskId===taskId);}
export function allocatedTaskHours(taskId,scenario=activeScenario()){return taskAllocations(taskId,scenario).reduce((sum,item)=>sum+Number(item.hours||0),0);}
export function remainingTaskHours(task,scenario=activeScenario()){return Math.max(0,taskEstimateHours(task)-allocatedTaskHours(task.id,scenario));}
export function cellAllocations(roleId,iterationId,scenario=activeScenario()){return scenario.allocations.filter(item=>item.roleId===roleId&&item.iterationId===iterationId);}
export function cellLoad(roleId,iterationId,scenario=activeScenario()){return cellAllocations(roleId,iterationId,scenario).reduce((sum,item)=>sum+Number(item.hours||0),0);}
export function actualHoursFor({taskId,roleId,personId,iterationId},state=stateRef.state){return state.project.actuals.filter(item=>item.taskId===taskId&&item.roleId===roleId&&item.iterationId===iterationId&&(!personId||item.personId===personId)).reduce((sum,item)=>sum+Number(item.hours||0),0);}
export function cellActualHours(roleId,iterationId,state=stateRef.state){return state.project.actuals.filter(item=>item.roleId===roleId&&item.iterationId===iterationId).reduce((sum,item)=>sum+Number(item.hours||0),0);}
export function cellActualCost(role,iteration,state=stateRef.state,scenario=activeScenario(state)) {const hours=cellActualHours(role.id,iteration,state),rate=rolePlan(role,iteration,scenario).rate;return hours/Number(state.project.hoursPerDay||8)*rate;}
export function personLoad(personId,iterationId,scenario=activeScenario()){return scenario.allocations.filter(item=>item.personId===personId&&item.iterationId===iterationId).reduce((sum,item)=>sum+Number(item.hours||0),0);}

export function roleTotals(role,scenario=activeScenario()) {
  const result={pt:0,hours:0,cost:0,actualHours:0,actualCost:0,envelopeHours:0,peakFte:0,envelopeBreaches:0,load:0,budgetOver:false};
  for(const it of stateRef.state.project.iterations){const p=rolePlan(role,it,scenario),e=roleEnvelope(role,it);result.pt+=p.pt;result.hours+=p.hours;result.cost+=p.cost;result.actualHours+=cellActualHours(role.id,it.id);result.actualCost+=cellActualCost(role,it,stateRef.state,scenario);result.envelopeHours+=e.hours;result.peakFte=Math.max(result.peakFte,p.fte);if(p.hours>e.hours+.01)result.envelopeBreaches+=1;result.load+=cellLoad(role.id,it.id,scenario);}
  result.budgetOver=Number(role.budgetCap||0)>0&&result.cost>Number(role.budgetCap)+.01;return result;
}
export function iterationTotals(iteration,scenario=activeScenario()) {
  const result={plannedFte:0,envelopeFte:0,pt:0,hours:0,cost:0,load:0,actualHours:0,actualCost:0,envelopeBreaches:0,overloadCells:0,personOverloads:0};
  for(const role of stateRef.state.project.roles){const p=rolePlan(role,iteration,scenario),e=roleEnvelope(role,iteration);result.plannedFte+=p.fte;result.envelopeFte+=e.fte;result.pt+=p.pt;result.hours+=p.hours;result.cost+=p.cost;result.load+=cellLoad(role.id,iteration.id,scenario);result.actualHours+=cellActualHours(role.id,iteration.id);result.actualCost+=cellActualCost(role,iteration,stateRef.state,scenario);if(p.hours>e.hours+.01)result.envelopeBreaches+=1;if(cellLoad(role.id,iteration.id,scenario)>p.hours+.01)result.overloadCells+=1;}
  for(const person of stateRef.state.project.people)if(personLoad(person.id,iteration.id,scenario)>personAvailability(person,iteration).hours+.01)result.personOverloads+=1;
  return result;
}
export function scenarioMetrics(scenario=activeScenario()) {
  const project=stateRef.state.project,hpd=Number(project.hoursPerDay||8),result={plannedHours:0,plannedLaborCost:0,actualHours:0,actualLaborCost:0,etcHours:0,etcLaborCost:0,envelopeBreaches:0,overloadCells:0,personOverloads:0,unallocatedHours:0,unallocatedTasks:0,nonLaborPlanned:0,nonLaborActual:0,nonLaborForecast:0};
  for(const role of project.roles){for(const it of project.iterations){const p=rolePlan(role,it,scenario),planned=cellLoad(role.id,it.id,scenario),actual=cellActualHours(role.id,it.id),remaining=Math.max(0,planned-actual);result.plannedHours+=p.hours;result.plannedLaborCost+=p.cost;result.actualHours+=actual;result.actualLaborCost+=actual/hpd*p.rate;result.etcHours+=remaining;result.etcLaborCost+=remaining/hpd*p.rate;const e=roleEnvelope(role,it);if(p.hours>e.hours+.01)result.envelopeBreaches+=1;if(planned>p.hours+.01)result.overloadCells+=1;}}
  for(const it of project.iterations)for(const person of project.people)if(personLoad(person.id,it.id,scenario)>personAvailability(person,it).hours+.01)result.personOverloads+=1;
  for(const task of project.tasks){const remaining=remainingTaskHours(task,scenario);result.unallocatedHours+=remaining;if(remaining>.01)result.unallocatedTasks+=1;}
  for(const cost of scenario.nonLaborCosts||[]){const planned=Number(cost.planned||0),actual=Number(cost.actual||0);result.nonLaborPlanned+=planned;result.nonLaborActual+=actual;result.nonLaborForecast+=Math.max(planned,actual);}
  result.plannedInternalCost=result.plannedLaborCost+result.nonLaborPlanned;
  result.actualInternalCost=result.actualLaborCost+result.nonLaborActual;
  result.forecastInternalCost=result.actualLaborCost+result.etcLaborCost+result.nonLaborForecast;
  result.forecastWithContingency=result.forecastInternalCost*(1+Number(scenario.contingencyPct||0)/100);
  result.budgetVariance=Number(scenario.budget||0)-result.forecastWithContingency;
  result.margin=Number(project.orderValue||0)-result.forecastWithContingency;
  result.marginPct=Number(project.orderValue||0)>0?result.margin/Number(project.orderValue):0;
  return result;
}
export function baselineComparison(baseline,scenario=activeScenario()) {
  const current=scenarioMetrics(scenario),summary=baseline?.summary||{};
  return {costDelta:current.forecastWithContingency-Number(summary.forecastWithContingency||0),hoursDelta:current.plannedHours-Number(summary.plannedHours||0),marginDelta:current.margin-Number(summary.margin||0),taskDelta:current.unallocatedTasks-Number(summary.unallocatedTasks||0)};
}
export function taskLabel(taskId){return taskById(taskId)?.title||"Unknown task";}
export function roleLabel(roleId){return roleById(roleId)?.name||"Unknown role";}
export function personLabel(personId){return personId?(personById(personId)?.name||"Unknown person"):"Unassigned person";}
