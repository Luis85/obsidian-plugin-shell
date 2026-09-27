import { computed, markRaw, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { EditorHost } from '../contracts.ts';
import type { SitemapCommand, SitemapDesign, SurfaceKind, SitemapJourney } from '../../../../../scripts/companion/sitemap/model.ts';
import { SitemapSession } from '../../../../../scripts/companion/sitemap/session.ts';
import { planSurfaceRemoval } from '../../../../../scripts/companion/sitemap/commands.ts';
import { sitemapContext, sitemapProjection } from '../../../../../scripts/companion/sitemap/projection.ts';
import { newSitemapSurface } from '../../../../../scripts/companion/sitemap/create.ts';
import { inspectSitemap } from '../../../../../scripts/companion/sitemap/validate.ts';

let serial = 0;
export function editorStore(host: EditorHost) {
  const session = new SitemapSession(host);
  return defineStore('journey-editor-' + ++serial, () => {
    const snapshot = shallowRef<SitemapDesign | null>(null), selectedId = ref(host.selected ?? '');
    const busy = ref(false), available = ref(false), canUndo = ref(false), canRedo = ref(false);
    const message = ref('Loading project…'), error = ref(''), query = ref('');
    const lens = ref<'hierarchy'|'navigation'|'journey'>('hierarchy'), journeyId = ref('');
    const treeOpen = ref(false), inspectorOpen = ref(true), tab = ref('details');
    const draftName = ref(''), dirty = ref(false), panel = ref('');
    const form = ref({name:'',parent:'',kind:'page' as SurfaceKind,target:'',journeyName:'',steps:[] as string[]});
    const removal = shallowRef<ReturnType<typeof planSurfaceRemoval> | null>(null);
    const selected = computed(() => snapshot.value?.nodes.find(n => n.id === selectedId.value) ?? null);
    const context = computed(() => snapshot.value && selected.value ? sitemapContext(snapshot.value, selected.value.id) : null);
    const projection = computed(() => snapshot.value ? sitemapProjection(snapshot.value, {
      lens: lens.value === 'journey' && !journeyId.value ? 'hierarchy' : lens.value,
      ...(journeyId.value ? {journey:journeyId.value}:{}), query:query.value,
    }) : {nodes:[],edges:[]});
    const findings = computed(() => snapshot.value ? inspectSitemap(snapshot.value) : []);
    const route = computed(() => snapshot.value?.sitemap?.routes.find(r => r.surface === selectedId.value));
    function resetDraft() { draftName.value=selected.value?.label ?? '';dirty.value=false; }
    function sync() {
      const current=session.snapshot(); snapshot.value=current ? markRaw(current.design) : null;
      const state=session.state(); available.value=state.writable;canUndo.value=state.canUndo;canRedo.value=state.canRedo;
      if (!snapshot.value?.nodes.some(n=>n.id===selectedId.value)) selectedId.value=snapshot.value?.nodes[0]?.id ?? '';
      if (!snapshot.value?.sitemap?.journeys.some(j=>j.id===journeyId.value)) journeyId.value='';
      resetDraft();
    }
    async function load() { error.value='';busy.value=true;const result=await session.load();busy.value=false;sync();
      message.value=result.status==='loaded'?'Saved project · local authoring':'Project unavailable';
      if(result.status!=='loaded')error.value='Reload failed. The previous project remains unchanged.'; }
    function canLeave() { if(!dirty.value && !panel.value && !busy.value)return true;
      error.value='Save or cancel the current edit before leaving the sitemap.';return false; }
    function select(id:string) { if(!canLeave())return;selectedId.value=id;host.select(id);inspectorOpen.value=true;resetDraft(); }
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
      error.value='';form.value={name:'',parent:selected.value && ['view','page','group'].includes(selected.value.kind)?selected.value.id:'',kind:'page',target:'',journeyName:'',steps:[]};
      if(kind==='route')form.value.name=route.value?.path??'';
      if(kind==='remove'&&selected.value)removal.value=planSurfaceRemoval(snapshot.value,selected.value.id);
      panel.value=kind;
    }
    function proposeMove(child:string,parent:string) {
      if(!canLeave())return;selectedId.value=child;resetDraft();form.value={...form.value,parent};panel.value='move';
    }
    async function applyForm(){
      if(!snapshot.value)return;
      let change:SitemapCommand;
      try {
        if(panel.value==='create') change={type:'create',surface:newSitemapSurface(snapshot.value,form.value.name,form.value.kind,
          form.value.kind==='page'||form.value.kind==='group'?form.value.parent||null:null)};
        else if(panel.value==='route'&&selected.value)change={type:'route',route:{id:route.value?.id??'route-'+selected.value.id,surface:selected.value.id,path:form.value.name}};
        else if(panel.value==='move'&&selected.value)change={type:'move',surface:selected.value.id,parent:form.value.parent||null,before:null};
        else if(panel.value==='remove'&&removal.value)change={type:'remove',surface:removal.value.surface,review:removal.value.review};
        else if(panel.value==='link'&&selected.value){
          const target=snapshot.value.nodes.find(n=>n.id===form.value.target);if(!target)throw Error('Choose a destination.');
          let n=Number(snapshot.value.nextId??1);while(snapshot.value.links.some(e=>e.id==='edge-'+n))n++;
          change={type:'link',transition:{id:'edge-'+n,from:selected.value.id,to:target.id,label:form.value.name||'Open '+target.label,kind:target.kind==='modal'?'open':'navigate'}};
        }else if(panel.value==='journey'){
          if(!form.value.journeyName.trim()||form.value.steps.length<2)throw Error('Name the journey and add at least two steps.');
          const prior=snapshot.value.sitemap?.journeys??[];let n=1;while(prior.some(j=>j.id==='journey-'+n))n++;
          const journey:SitemapJourney={id:'journey-'+n,name:form.value.journeyName,steps:form.value.steps.map((surface,i)=>{
            const edge=snapshot.value!.links.find(e=>e.from===form.value.steps[i-1]&&e.to===surface&&['navigate','open'].includes(e.kind));
            return {id:'step-'+(i+1),surface,via:i===0?null:edge?.id??null};
          })};change={type:'journey',journey};
        }else return;
        if(await commit(change)){panel.value='';if(change.type==='create')select(change.surface.id);
          if(change.type==='journey'){journeyId.value=change.journey.id;lens.value='journey';} }
      }catch(e){error.value=e instanceof Error?e.message:'Invalid edit.';}
    }
    function cancel(){panel.value='';error.value='';resetDraft();}
    function go(kind:string){if(!canLeave())return;
      if(kind==='page'&&selected.value)host.openPage(selected.value.id);else if(kind==='components')host.openComponents();
      else if(kind==='sources')host.openSources();else if(kind==='import')host.importProject();else if(kind==='export')host.exportProject();}
    return { snapshot,selectedId,selected,context,projection,findings,lens,journeyId,query,treeOpen,inspectorOpen,tab,
      draftName,dirty,panel,form,removal,busy,available,canUndo,canRedo,message,error,route,
      load,select,canLeave,commit,saveName,resetDraft,open,proposeMove,applyForm,cancel,go,
      undo:()=>canLeave()?run(()=>session.undo()):Promise.resolve(false),redo:()=>canLeave()?run(()=>session.redo()):Promise.resolve(false),dispose:()=>session.dispose(),
    };
  });
}
export type EditorStore = ReturnType<ReturnType<typeof editorStore>>;
