import {$,activeScenario,announce,commit,dialog,importInput,save,stateRef} from "./core.ts";
import {exportWorkspace,exportMarkdownZip,importWorkspace} from "./persistence.ts";
import {render,renderSummaryVisibility} from "./render.ts";
import {activateScenario,archiveScenario,duplicateScenario,newPlanDialog,planSettingsDialog,projectTimelineDialog,scenarioManagerDialog} from "./dialogs-plan.ts";
import {fteDialog,personAvailabilityDialog,personDialog,roleDialog,teamDialog} from "./dialogs-team.ts";
import {actualDialog,allocationDialog,removeAllocation,taskDialog} from "./dialogs-work.ts";
import {approveBaseline,auditDialog,baselinesDialog,commercialDialog,createBaselineDialog,nonLaborDialog,persistenceDialog,removeNonLabor,restoreBaseline,scenarioComparisonDialog} from "./dialogs-governance.ts";
import {manageDialog} from "./dialogs-navigation.ts";

function closeDialogIfOpen(){if(dialog.open)dialog.close();}
function handleAction(target) {
  const action=target.dataset.action;
  if(action==="new-plan")newPlanDialog();
  else if(action==="plan-settings")planSettingsDialog();
  else if(action==="project-timeline")projectTimelineDialog();
  else if(action==="plans")scenarioManagerDialog();
  else if(action==="compare-plans")scenarioComparisonDialog();
  else if(action==="team")teamDialog();
  else if(action==="commercial")commercialDialog();
  else if(action==="baselines"||action==="open-baselines")baselinesDialog();
  else if(action==="audit")auditDialog();
  else if(action==="persistence")persistenceDialog();
  else if(action==="add-role")roleDialog();
  else if(action==="edit-role")roleDialog(target.dataset.roleId);
  else if(action==="plan-fte")fteDialog(target.dataset.roleId);
  else if(action==="add-person")personDialog();
  else if(action==="edit-person")personDialog(target.dataset.personId);
  else if(action==="person-availability")personAvailabilityDialog(target.dataset.personId);
  else if(action==="add-task")taskDialog();
  else if(action==="edit-task")taskDialog(target.dataset.taskId);
  else if(action==="allocate-task")allocationDialog(target.dataset.taskId);
  else if(action==="edit-allocation"){const allocation=activeScenario().allocations.find(item=>item.id===target.dataset.allocationId);if(allocation)allocationDialog(allocation.taskId,allocation.id);}
  else if(action==="remove-allocation")removeAllocation(target.dataset.allocationId);
  else if(action==="record-actual")actualDialog(target.dataset.allocationId);
  else if(action==="add-nonlabor")nonLaborDialog();
  else if(action==="edit-nonlabor")nonLaborDialog(target.dataset.costId);
  else if(action==="remove-nonlabor")removeNonLabor(target.dataset.costId);
  else if(action==="create-baseline")createBaselineDialog();
  else if(action==="approve-baseline")approveBaseline(target.dataset.baselineId);
  else if(action==="restore-baseline")restoreBaseline(target.dataset.baselineId);
  else if(action==="activate-scenario")activateScenario(target.dataset.scenarioId);
  else if(action==="duplicate-scenario")duplicateScenario(target.dataset.scenarioId);
  else if(action==="archive-scenario")archiveScenario(target.dataset.scenarioId);
  else if(action==="export-workspace")exportWorkspace();
  else if(action==="import-workspace"){closeDialogIfOpen();importInput.click();}
  else if(action==="export-markdown")exportMarkdownZip();
}
function setSummary(expanded){stateRef.summaryExpanded=expanded;renderSummaryVisibility();}

document.addEventListener("click",event=>{const target=event.target?.closest?.("button[data-action]");if(target)handleAction(target);});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&dialog.open){dialog.close();return;}const card=event.target?.closest?.(".backlog-card");if(card&&(event.key==="Enter"||event.key===" ")&&!event.target.closest?.("button")){event.preventDefault();allocationDialog(card.dataset.taskId);}});
document.addEventListener("capacity-drop",event=>{const {taskId,allocationId,roleId,iterationId}=event.detail||{};if(taskId)allocationDialog(taskId,null,roleId,iterationId);else if(allocationId){const allocation=activeScenario().allocations.find(item=>item.id===allocationId);if(allocation)allocationDialog(allocation.taskId,allocation.id,roleId,iterationId);}});

$("#save-btn").addEventListener("click",()=>{const persisted=save();if(persisted)announce(`Workspace saved at revision r${stateRef.state.revision}.`);else{exportWorkspace();announce("Browser storage unavailable; downloaded a workspace backup instead.");}});
$("#new-plan-btn").addEventListener("click",newPlanDialog);
$("#manage-btn").addEventListener("click",manageDialog);
$("#add-task-btn").addEventListener("click",()=>taskDialog());
$("#sidebar-add-task").addEventListener("click",()=>taskDialog());
$("#summary-toggle").addEventListener("click",()=>setSummary(!stateRef.summaryExpanded));
$("#summary-close").addEventListener("click",()=>setSummary(false));
$("#scenario-select").addEventListener("change",event=>{stateRef.state.activeScenarioId=event.target.value;commit("scenario.activated",activeScenario().name);render();announce(`${activeScenario().name} opened.`);});
$("#task-search").addEventListener("input",event=>{stateRef.taskFilter=event.target.value;render();});
importInput.addEventListener("change",async()=>{if(importInput.files?.[0]&&await importWorkspace(importInput.files[0]))render();importInput.value="";});
dialog.addEventListener("click",event=>{if(event.target===dialog)closeDialogIfOpen();});

render();
