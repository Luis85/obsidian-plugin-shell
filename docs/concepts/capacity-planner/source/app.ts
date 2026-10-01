import {$,dialog,importInput,stateRef} from "./core.ts";
import {render,renderBacklog,unassignTask,wireTaskCards} from "./render.ts";
import {allocateDialog,assignmentDialog,deleteRole,deleteTask,exportWorkspace,importWorkspace,planDialog,roleDialog,roleSettingsDialog,taskDialog} from "./dialogs.ts";

document.addEventListener("click",event=>{
  const target=event.target?.closest?.("button");
  if(!target)return;
  const action=target.dataset.action;
  if(action==="allocate-role")allocateDialog(target.dataset.roleId);
  if(action==="role-settings")roleSettingsDialog(target.dataset.roleId);
  if(action==="delete-role")deleteRole(target.dataset.roleId);
  if(action==="assign-task")assignmentDialog(target.dataset.taskId);
  if(action==="edit-task")taskDialog(target.dataset.taskId);
  if(action==="unassign-task")unassignTask(target.dataset.taskId);
  if(action==="delete-task")deleteTask(target.dataset.taskId);
});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&dialog.open){dialog.close();return;}
  const card=event.target?.closest?.(".task-card");
  if(card&&(event.key==="Enter"||event.key===" ")&&!event.target.closest?.("button")){event.preventDefault();assignmentDialog(card.dataset.taskId);}
});
$("#new-plan-btn").addEventListener("click",()=>planDialog(true));
$("#edit-plan-btn").addEventListener("click",()=>planDialog(false));
$("#add-role-btn").addEventListener("click",roleDialog);
$("#add-task-btn").addEventListener("click",()=>taskDialog());
$("#sidebar-add-task").addEventListener("click",()=>taskDialog());
$("#task-search").addEventListener("input",event=>{stateRef.taskFilter=event.target.value;renderBacklog();wireTaskCards($("#backlog"));});
$("#export-btn").addEventListener("click",exportWorkspace);
$("#import-btn").addEventListener("click",()=>importInput.click());
importInput.addEventListener("change",()=>{if(importInput.files?.[0])importWorkspace(importInput.files[0]);});
dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
render();
