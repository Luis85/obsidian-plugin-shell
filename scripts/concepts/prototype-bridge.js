// Trusted browser adapter. Prototype data is inert and remains inside the existing project persistence.
let pmEditor = null;
const pmOpened = new WeakMap();
function pmApi(){return CompanionJourney.prototypeApi;}
function pmValidWorkspace(value,id){try{if(value===undefined)return true;return pmApi().validate(value).projectId===id;}catch{return false;}}
function pmWorkspace(){const p=project();if(!p)throw Error('Define a project first.');return p.prototypes??pmApi().empty(p.id);}
function pmRead(){return {workspace:pmWorkspace(),working:companionProjectDocument(),opened:pmOpened.get(project())??null,writable:!storageWarning&&!state.activeRun&&!tdUi.busy};}
function pmCheck(expected){companionCanReplace(companionProjectToken());if(pmApi().key(pmWorkspace())!==expected)throw Error('The prototype workspace changed. Review it again; nothing was replaced.');}
function pmPreflight(){if(!validState(state))throw Error('The candidate cannot be safely persisted. Nothing was changed.');if(state.settings.remember&&JSON.stringify(state).length>5000000)throw Error('This workspace exceeds this browser’s 5 MB session limit. Export recovery and use the shell for larger libraries; nothing was replaced.');}
function pmSave(value,expected){
 pmCheck(expected);const candidate=pmApi().validate(value),p=project();
 if(candidate.projectId!==p.id)throw Error('The workspace belongs to another project.');
 const prior=p.prototypes,priorGeneratorPlan=state.generator.plan,priorDesignPlan=designUi.plan;
 p.prototypes=designCopy(candidate);state.generator.plan=null;designUi.plan=null;
 try{pmPreflight();if(!saveConceptState())throw Error('Storage could not commit the workspace. Previous in-memory data is retained; export recovery before reloading.');}
 catch(error){if(prior===undefined)delete p.prototypes;else p.prototypes=prior;state.generator.plan=priorGeneratorPlan;designUi.plan=priorDesignPlan;throw error;}
}
function pmGuardIdentity(id){if(project()?.prototypes&&project().prototypes.projectId!==id)throw Error('Saved prototypes pin this project ID. Create a separate vault for a different project; names and descriptions remain editable.');}
function pmPreserveWorkspace(p){
 const prior=project()?.prototypes;if(!prior)return;
 if(prior.projectId!==p.id)throw Error('This vault has saved prototypes for another project. Export that workspace and open a separate vault instead of discarding it.');
 p.prototypes=designCopy(prior);
}
function pmOpen(selection,expected){
 pmCheck(expected);const doc=pmApi().selected(pmWorkspace(),selection).variant.document,p=project();
 const fresh=companionReview(pmApi().json(doc)).project;
 const next={...p,...doc.project,design:fresh.design,folders:fresh.folders,notes:fresh.notes,rev:p.rev+1,builtRev:0,installedRev:0,trusted:false,enabled:false,phase:'planning',quality:{}};
 if(doc.tooling===undefined)delete next.tooling;else next.tooling=designCopy(doc.tooling);
 next.design.revision=p.design.revision+1;next.projectNote=projectNoteText(next);
 const prior=state;state={...state,project:next,vaultFiles:{...state.vaultFiles,'Project.md':next.projectNote},wizard:null,generator:{...state.generator,plan:null}};
 try{pmPreflight();if(!saveConceptState())throw Error('The working design could not be saved. Previous data remains in memory.');}
 catch(error){state=prior;throw error;}
 pmOpened.set(next,{...selection});tdDropSession();veReset();smUi.owner=null;smNormalize();designUi.plan=null;designUi.selected=next.design.nodes[0]?.id??null;
 designUi.error='';productUi.prd=null;productUi.component=null;dsUi.selected=null;dsUi.catalogSelected=null;erUi.selected=null;erUi.edge=null;
 pmUnmount();setView('sitemap');notify('Saved variant opened as a working copy. The active generator snapshot is unchanged.');
}
function pmDownload(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function pmExportActive(){
 const p=project();if(!p)throw Error('Define a project first.');
 const document=p.prototypes?pmApi().active(pmApi().validate(p.prototypes)).variant.document:companionProjectDocument(p);
 pmDownload(new Blob([pmApi().json(document)],{type:'application/json'}),document.project.id+(p.prototypes?'-'+pmApi().selectionKey(p.prototypes.active).replaceAll('/','-'):'')+'.companion.json');
}
async function pmExportWorkspace(format){
 const value=designCopy(pmWorkspace());pmApi().validate(value);
 if(format==='json'){pmDownload(new Blob([pmApi().json(value)],{type:'application/json'}),value.projectId+'.prototypes.json');return;}
 if(!globalThis.crypto?.subtle)throw Error('Directory export needs Web Crypto. Export workspace JSON and import it through the shell instead.');
 const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
 const files=await pmApi().files(value,digest);pmDownload(tdZip(files),value.projectId+'.prototype-folders.zip');
}
function pmImport(text,expected){const value=pmApi().validate(JSON.parse(text));pmApi().replacement(project().prototypes??null,value);pmSave(value,expected);}
function pmGenerationProject(){const p=project();if(!p?.prototypes)return p;try{return companionReview(pmApi().json(pmApi().active(pmApi().validate(p.prototypes)).variant.document)).project;}catch{return null;}}
function pmGenerationLabel(){const value=project()?.prototypes;if(!value)return 'Current working project (no managed prototype workspace).';const active=pmApi().active(value);return active.prototype.name+' / '+active.version.label+' / '+active.variant.name+' · snapshot '+active.variant.revision;}
function pmWorkspaceView(){return '<div id="pm-root"></div>';}
function pmUnmount(){pmEditor?.unmount();pmEditor=null;}
function pmMount(){const root=document.getElementById('pm-root');if(!root||pmEditor||!project())return;
 const owner=project(),owned=fn=>(...args)=>{if(project()!==owner)throw Error('The current project was replaced. Reopen Manage prototypes.');return fn(...args);};
 pmEditor=CompanionJourney.mountPrototypes(root,{read:owned(pmRead),save:owned(pmSave),open:owned(pmOpen),confirm:text=>confirm(text),exportWorkspace:owned(pmExportWorkspace),exportActive:owned(pmExportActive),importWorkspace:owned(pmImport)});
}
function pmAction(event){const button=event.target.closest?.('[data-action]');if(!button)return;
 if(button.dataset.action==='prototype-download-active'){event.preventDefault();event.stopImmediatePropagation();try{pmExportActive();}catch(error){notify(error.message);}}
 if(button.dataset.action==='prototype-manage'){event.preventDefault();event.stopImmediatePropagation();if(document.getElementById('modal').open)closeModal();setView('prototypes');}
}
document.addEventListener('click',pmAction,true);
