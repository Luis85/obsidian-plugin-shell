function handleFlowAction(action,value){
 if(!action.startsWith('flow-'))return false;
 if(state.activeRun&&!['flow-settings','flow-components','flow-deselect'].includes(action)){notify('Finish the active simulation before editing the design.');return true;}
 switch(action){
 case 'flow-settings':interactionUi.settingsOwner=designOwner();showModal('flow-settings');break;
 case 'flow-settings-reset':design().canvas.interaction=defaultCanvasPreferences();canvasState().snap=true;save();refreshFlowConfig();redrawModal();break;
 case 'flow-components':selectSitemapItem('surface',value);canvasUi.inspector='bricks';interactionUi.componentQuery='';render();break;
 case 'flow-place-component':{const [node,id]=value.split(':');beginBindingReview(node,id);break;}
 case 'flow-binding':reviewExistingBinding(value);break;
 case 'flow-binding-save':saveBindingRegion();break;
 case 'flow-binding-remove':showModal('flow-binding-remove');break;
 case 'flow-binding-remove-confirm':{const f=interactionUi.binding;if(f.owner!==designOwner()||f.revision!==design().revision){notify('The binding changed. Reopen it before removal.');break;}recordDesign();const n=design().nodes.find(n=>n.id===f.node);n.components=n.components.filter(b=>!(b.id===f.id&&b.slot===f.originalSlot));designChanged();closeModal();render();break;}
 case 'flow-intent':editSurfaceIntent(value);break;
 case 'flow-intent-save':saveSurfaceIntent();break;
 case 'flow-deselect':deselectFlow();break;
 default:return false;
 }return true;
}
function editFlowField(el,commit){
 const k=el.dataset.field;if(!k?.startsWith('flow-'))return false;const v=el.type==='checkbox'?el.checked:el.value;
 if(k==='flow-component-query'){interactionUi.componentQuery=v;const n=selectedNode(),target=document.getElementById('flow-component-options');if(n&&target)target.innerHTML=componentPalette(design(),n);return true;}
 if(k==='flow-intent-text'){interactionUi.form.intent=v;return true;}
 if(k==='flow-goals-text'){interactionUi.form.goals=v;return true;}
 if(k==='flow-binding-slot'){interactionUi.binding.slot=v;return true;}
 if(interactionUi.settingsOwner!==designOwner()){notify('Reopen settings for the current project.');return true;}
 const p=canvasPreferences();if(k==='flow-snap')canvasState().snap=v;else if(Object.hasOwn(p,k.slice(5)))p[k.slice(5)]=v;
 if(validCanvasPreferences(p)){save();refreshFlowConfig();}return true;
}
document.addEventListener('dragstart',event=>{const item=event.target.closest('[data-component][draggable="true"]');if(!item)return;event.dataTransfer.setData('application/x-companion-component',item.dataset.component);event.dataTransfer.effectAllowed='copy';});
document.addEventListener('dragover',event=>{if(!event.dataTransfer.types.includes('application/x-companion-component'))return;const card=event.target.closest('.map-node');if(card){event.preventDefault();event.dataTransfer.dropEffect='copy';card.classList.add('component-drop-target');}});
document.addEventListener('dragleave',event=>{const card=event.target.closest('.map-node');if(card&&!card.contains(event.relatedTarget))card.classList.remove('component-drop-target');});
document.addEventListener('drop',event=>{const card=event.target.closest('.map-node'),id=event.dataTransfer.getData('application/x-companion-component');document.querySelectorAll('.component-drop-target').forEach(e=>e.classList.remove('component-drop-target'));if(!card||!id)return;event.preventDefault();beginBindingReview(card.dataset.node,id);});
