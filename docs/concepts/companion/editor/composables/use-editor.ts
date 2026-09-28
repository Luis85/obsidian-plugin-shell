import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { EditorHost, EditorViewState } from '../contracts.ts';
import type { SitemapCommand, SitemapDesign, SurfaceKind } from '../../../../../scripts/companion/sitemap/model.ts';
import { SitemapSession } from '../../../../../scripts/companion/sitemap/session.ts';
import { planSurfaceRemoval } from '../../../../../scripts/companion/sitemap/commands.ts';
import { sitemapContext, sitemapProjection } from '../../../../../scripts/companion/sitemap/projection.ts';
import { newSitemapSurface } from '../../../../../scripts/companion/sitemap/create.ts';
import { sitemapDisplayLayout } from '../../../../../scripts/companion/sitemap/layout.ts';
import { arrangeSitemap } from '../../../../../scripts/companion/sitemap/arrangement.ts';
import { beginJourneyDraft, editJourneyDraft, finishJourneyDraft, journeyStepTransitions, type JourneyDraft, type JourneyEdit } from '../../../../../scripts/companion/sitemap/journey-draft.ts';
import { inspectSitemap } from '../../../../../scripts/companion/sitemap/validate.ts';

let serial = 0;
export function editorStore(host: EditorHost) {
  const session = new SitemapSession(host);
  return defineStore('journey-editor-' + ++serial, () => {
    const snapshot = shallowRef<SitemapDesign | null>(null), selectedId = ref(host.selected ?? '');
    const busy = ref(false), available = ref(false), canUndo = ref(false), canRedo = ref(false);
    const message = ref('Loading project…'), error = ref(''), query = ref('');
    const lens = ref<'hierarchy'|'navigation'|'journey'>(host.viewState?.lens ?? 'hierarchy'), journeyId = ref(host.viewState?.journeyId ?? '');
    const treeOpen = ref(host.viewState?.treeOpen ?? false), inspectorOpen = ref(host.viewState?.inspectorOpen ?? true), tab = ref(host.viewState?.tab ?? 'details');
    query.value = host.viewState?.query ?? '';
    function viewState(): EditorViewState { return { lens: lens.value, journeyId: journeyId.value, query: query.value, treeOpen: treeOpen.value, inspectorOpen: inspectorOpen.value, tab: tab.value, focused: focused.value, priorPanels: {...priorPanels} }; }
    const focused=ref(host.viewState?.focused??false);let priorPanels=host.viewState?.priorPanels??{tree:false,inspector:true};
    const draftName = ref(''), dirty = ref(false), panel = ref('');
    const form = ref({name:'',parent:'',kind:'page' as SurfaceKind,target:'',journeyName:'',x:'',y:''});
    const journeyDraft = shallowRef<JourneyDraft | null>(null);
    const removal = shallowRef<ReturnType<typeof planSurfaceRemoval> | null>(null);
    const selected = computed(() => snapshot.value?.nodes.find(n => n.id === selectedId.value) ?? null);
    const context = computed(() => snapshot.value && selected.value ? sitemapContext(snapshot.value, selected.value.id) : null);
    const projection = computed(() => snapshot.value ? sitemapProjection(snapshot.value, {
      lens: lens.value === 'journey' && !journeyId.value ? 'hierarchy' : lens.value,
      ...(journeyId.value ? {journey:journeyId.value}:{}), query:query.value,
    }) : {nodes:[],edges:[]});
    const findings = computed(() => snapshot.value ? inspectSitemap(snapshot.value) : []);
    const saveStatus=computed(()=>busy.value?'Working…':!available.value?'Read-only · resolve recovery before editing':dirty.value?'Name not saved':panel.value?'Changes not applied':message.value);
    const route = computed(() => snapshot.value?.sitemap?.routes.find(r => r.surface === selectedId.value));
    function toggleFocus(){if(!canLeave())return;
      if(!focused.value){priorPanels={tree:treeOpen.value,inspector:inspectorOpen.value};treeOpen.value=false;inspectorOpen.value=false;}
      else{treeOpen.value=priorPanels.tree;inspectorOpen.value=priorPanels.inspector;}focused.value=!focused.value;
    }
    function showPanel(kind:'outline'|'details'){if(!canLeave())return;if(focused.value)toggleFocus();
      if(kind==='outline')treeOpen.value=true;else inspectorOpen.value=true;
    }
    function resetDraft() { draftName.value=selected.value?.label ?? '';dirty.value=false; }
    function sync() {
      const current=session.snapshot(); snapshot.value=current ? current.design : null;
      const state=session.state(); available.value=state.writable;canUndo.value=state.canUndo;canRedo.value=state.canRedo;
      if (!snapshot.value?.nodes.some(n=>n.id===selectedId.value)) selectedId.value=snapshot.value?.nodes[0]?.id ?? '';
      if (!snapshot.value?.sitemap?.journeys.some(j=>j.id===journeyId.value)) journeyId.value='';
      resetDraft();
    }
    async function load() { if(!canLeave())return;error.value='';busy.value=true;const result=await session.load();busy.value=false;sync();
      message.value=result.status==='loaded'?'Saved project · local authoring':'Project unavailable';
      if(result.status!=='loaded')error.value='Reload failed. The previous project remains unchanged.'; }
    function canLeave() { if(!dirty.value && !panel.value && !busy.value)return true;
      error.value='Save or cancel the current edit before leaving the sitemap.';return false; }
    function select(id:string) { if(!canLeave())return;selectedId.value=id;host.select(id);inspectorOpen.value=!focused.value;resetDraft(); }
    async function run(action:()=>Promise<{status:string;evicted?:number;requiresReload?:boolean}>) {
      if(busy.value)return false;busy.value=true;error.value='';
      try { const result=await action();if(!['committed','unchanged'].includes(result.status)||result.requiresReload){
        error.value=result.status==='conflict'?'Another view changed the project. Export recovery, then reload.':
          result.status==='uncertain'||result.requiresReload?'The save outcome needs recovery. Do not retry; reload after resolving storage.':'The edit was refused. Check its references and reload if the project changed.';
        const state=session.state();available.value=state.writable;return false;
      } sync();message.value=result.evicted?'Saved · oldest undo entries released to stay within storage bounds':'Saved project · local authoring';return true;
      }catch(e){error.value=e instanceof Error?e.message:'The edit could not be applied.';return false;}finally{busy.value=false;} }
    async function commit(command:SitemapCommand) {
      try{return await run(()=>session.apply(session.plan(command)));}catch(e){error.value=e instanceof Error?e.message:'Invalid edit';return false;}
    }
    async function saveName(){if(selected.value&&await commit({type:'rename',surface:selected.value.id,label:draftName.value}))dirty.value=false;}

    function open(kind:string) {
      if(!canLeave()||!snapshot.value)return;
      error.value='';form.value={name:'',parent:selected.value && ['view','page','group'].includes(selected.value.kind)?selected.value.id:'',kind:'page',target:'',journeyName:'',x:'',y:''};
      if(kind==='journey'||kind==='journey-edit'){
        try { journeyDraft.value=beginJourneyDraft(snapshot.value,kind==='journey-edit'?journeyId.value:undefined);form.value.journeyName=journeyDraft.value.journey.name; }
        catch { error.value='The selected journey is unavailable. Reload the current project.';return; }
      }
      if(kind==='position'&&selected.value){const point=sitemapDisplayLayout(sitemapProjection(snapshot.value,{lens:'hierarchy'}).nodes)[selected.value.id]!;form.value.x=String(point.x);form.value.y=String(point.y);}
      if(kind==='route')form.value.name=route.value?.path??'';
      if(kind==='remove'&&selected.value)removal.value=planSurfaceRemoval(snapshot.value,selected.value.id);
      panel.value=kind;
    }
    function proposeMove(child:string,parent:string) {
      if(!canLeave())return;selectedId.value=child;resetDraft();form.value={...form.value,parent};panel.value='move';
    }
    function proposeConnection(source:string,target:string) {
      if(!canLeave()||!snapshot.value||source===target)return;
      if(lens.value==='hierarchy'){proposeMove(target,source);return;}
      if(lens.value==='journey'){error.value='Edit the journey steps to change this path. Connections do not change hierarchy here.';return;}
      const from=snapshot.value.nodes.find(n=>n.id===source),to=snapshot.value.nodes.find(n=>n.id===target);
      if(!from||!to||from.kind==='group'||to.kind==='group'){error.value='Navigation connects surfaces, not navigation groups.';return;}
      select(source);open('link');form.value.target=target;
    }
    async function applyForm(){
      if(!snapshot.value)return;
      let change:SitemapCommand;
      try {
        if(panel.value==='arrange')change={type:'arrange',positions:arrangeSitemap(snapshot.value,'all')};
        else if(panel.value==='position'&&selected.value){
          if(!String(form.value.x).trim()||!String(form.value.y).trim())throw Error('Enter both X and Y coordinates.');
          change={type:'arrange',positions:{[selected.value.id]:{x:Number(form.value.x),y:Number(form.value.y)}}};
        }
        else if(panel.value==='create') change={type:'create',surface:newSitemapSurface(snapshot.value,form.value.name,form.value.kind,
          form.value.kind==='page'||form.value.kind==='group'?form.value.parent||null:null)};
        else if(panel.value==='route'&&selected.value)change={type:'route',route:{id:route.value?.id??'route-'+selected.value.id,surface:selected.value.id,path:form.value.name}};
        else if(panel.value==='move'&&selected.value)change={type:'move',surface:selected.value.id,parent:form.value.parent||null,before:null};
        else if(panel.value==='remove'&&removal.value)change={type:'remove',surface:removal.value.surface,review:removal.value.review};
        else if(panel.value==='link'&&selected.value){
          const target=snapshot.value.nodes.find(n=>n.id===form.value.target);if(!target)throw Error('Choose a destination.');
          let n=Number(snapshot.value.nextId??1);while(snapshot.value.links.some(e=>e.id==='edge-'+n))n++;
          change={type:'link',transition:{id:'edge-'+n,from:selected.value.id,to:target.id,label:form.value.name||'Open '+target.label,kind:target.kind==='modal'?'open':'navigate'}};
        }else if((panel.value==='journey'||panel.value==='journey-edit')&&journeyDraft.value){
          change={type:'journey',journey:finishJourneyDraft(snapshot.value,journeyDraft.value,form.value.journeyName)};
        }else return;
        if(await commit(change)){panel.value='';journeyDraft.value=null;if(change.type==='create')select(change.surface.id);
          if(change.type==='journey'){journeyId.value=change.journey.id;lens.value='journey';} }
      }catch(e){error.value=e instanceof Error?e.message:'Invalid edit.';}
    }
    function cancel(){if(busy.value)return;panel.value='';journeyDraft.value=null;error.value='';resetDraft();}
    function editJourney(edit:JourneyEdit){
      if(busy.value||!available.value||!snapshot.value||!journeyDraft.value)return;
      try {journeyDraft.value=editJourneyDraft(snapshot.value,journeyDraft.value,edit);error.value='';}
      catch(e){error.value=e instanceof Error?e.message:'Invalid journey edit.';}
    }
    function transitionOptions(index:number){return snapshot.value&&journeyDraft.value?journeyStepTransitions(snapshot.value,journeyDraft.value.journey.steps,index):[];}
    function go(kind:string){if(!canLeave())return;
      if(kind==='page'&&selected.value)host.openPage(selected.value.id);else if(kind==='components')host.openComponents();
      else if(kind==='sources')host.openSources();else if(kind==='import')host.importProject();else if(kind==='export')host.exportProject();}
    return { snapshot,selectedId,selected,context,projection,findings,lens,journeyId,query,treeOpen,inspectorOpen,tab,
      draftName,dirty,panel,form,removal,busy,available,canUndo,canRedo,message,error,route,
      load,select,canLeave,commit,saveName,resetDraft,open,proposeMove,proposeConnection,applyForm,cancel,go,viewState,
      focused,toggleFocus,showPanel,saveStatus,journeyDraft,editJourney,transitionOptions,
      undo:()=>canLeave()?run(()=>session.undo()):Promise.resolve(false),redo:()=>canLeave()?run(()=>session.redo()):Promise.resolve(false),dispose:()=>session.dispose(),
    };
  });
}
export type EditorStore = ReturnType<ReturnType<typeof editorStore>>;
