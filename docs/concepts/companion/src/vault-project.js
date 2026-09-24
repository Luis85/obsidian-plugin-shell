// Fixed host context for this browser concept. Native adapters must supply app.vault,
// not accept a source path from a note, imported blueprint, query string or form.
const CONCEPT_VAULT=Object.freeze({key:'single-project-vault',name:'Plugin Workspace',root:'/workspace/plugin-workspace',config:'.obsidian'});
const LEGACY_STORAGE_KEY='shell-workbench-concept-v1';
let legacySnapshot=null;
function freshVaultFiles(){return {'.obsidian/plugins/shell-workbench/manifest.json':'Companion installation fixture — preserve', '.obsidian/workspace.json':'Host workspace fixture — preserve'};}
function vaultProjectPrepared(){return project()?.phase==='prepared';}
function vaultRoot(){return CONCEPT_VAULT.root;}
function vaultTestRoot(){return vaultRoot()+'/.test-vault';}
function validVaultFiles(files){
 return files&&typeof files==='object'&&!Array.isArray(files)&&Object.keys(files).length<=300&&Object.entries(files).every(([path,text])=>validVaultRelativePath(path)&&typeof text==='string'&&text.length<=500000);
}
function validVaultRelativePath(path){return typeof path==='string'&&path.length>0&&path.length<=240&&!path.startsWith('/')&&!/[\\\x00-\x1f:]/.test(path)&&path.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!['__proto__','constructor','prototype'].includes(part));}
function validVaultScope(s,validateProject){
 return s.schema===2&&s.vaultKey===CONCEPT_VAULT.key&&!['projects','activeId','designDraft'].some(k=>Object.hasOwn(s,k))&&validVaultFiles(s.vaultFiles)&&typeof s.legacyHandled==='boolean'&&
  (s.project===null||(validateProject(s.project)&&s.project.key==='vault-project'&&s.project.root===vaultRoot()&&[vaultTestRoot(),vaultRoot()+'/.dev-vault'].includes(s.project.vault)&&['planning','prepared'].includes(s.project.phase)&&typeof s.project.projectNote==='string'&&(!s.project.design||validSavedDesign(s.project.design))));
}
function projectNoteText(p){return '---\ntype: obsidian-plugin-project\nschema: 1\nproject_id: '+JSON.stringify(p.key)+'\nplugin_id: '+JSON.stringify(p.id)+'\nname: '+JSON.stringify(p.name)+'\nsource_root: "."\ndesign_folder: "project"\n---\n\n# '+p.name+'\n\n'+p.description+'\n\nOne project in this vault. Design artifacts belong under `project/`.\n';}
function projectIdentity(p){return JSON.stringify([p?.key,p?.id,p?.name,p?.author,p?.description,p?.version,p?.root,p?.vault,p?.config]);}
function vaultScopeSnapshot(){const p=project();return JSON.stringify({vault:CONCEPT_VAULT.key,identity:projectIdentity(p),design:p?.design?designSnapshot(p.design):null,files:state.vaultFiles});}
function newPlanningProject(fields={}){
 const p=newProject({...newWizard(),...fields,root:vaultRoot(),vault:vaultTestRoot(),config:'.obsidian'});
 p.design=createDesign('blank');p.design.goal='';p.projectNote=projectNoteText(p);return p;
}
function installPlanningProject(p){
 if(project())throw Error('This vault already has one project. Open another Obsidian vault for a different project.');
 if(Object.keys(state.vaultFiles).some(path=>path.toLowerCase()==='project.md'||path.toLowerCase().startsWith('project.md/')))throw Error('Project.md already exists. Inspect it before initialization; nothing has been overwritten.');
 state.project=p;state.vaultFiles['Project.md']=p.projectNote;state.wizard=null;state.generator.plan=null;return p;
}
function readLegacyWorkspace(){
 try{legacySnapshot=localStorage.getItem(LEGACY_STORAGE_KEY);}catch{/* Existing storage warning owns recovery. */}
}
function legacyChoices(){
 if(!legacySnapshot||legacySnapshot.length>5000000)return [];
 try{
  const old=JSON.parse(legacySnapshot);if(old?.schema!==1||!Array.isArray(old.projects)||old.projects.length>20)return [];
  const choices=old.projects.filter(p=>p&&typeof p.name==='string'&&p.name.length<=80&&p.design&&validSavedDesign(p.design)).map(p=>({label:p.name,identity:p,design:p.design}));
  if(old.designDraft&&validSavedDesign(old.designDraft))choices.push({label:'Unattached outline',identity:{},design:old.designDraft});
  if(old.wizard?.design&&validSavedDesign(old.wizard.design))choices.push({label:'Unfinished setup outline',identity:old.wizard,design:old.wizard.design});
  return choices;
 }catch{return [];}
}
function legacyAvailable(){return Boolean(legacySnapshot)&&!state.legacyHandled;}
