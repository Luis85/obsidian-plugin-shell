export { parseBrowserStarter, starterProjection, configureBrowserStarter, exportBrowserStarter } from '../../../../src/cli/adapters/starters/browser.ts';
export { prototypeApi } from '../../../../scripts/companion/prototypes/api.ts';
export { mountPrototypes } from './prototype-manager.ts';
import './prototypes.css';
export { validateProjectTooling } from '../../../../scripts/companion/tooling-contract.ts';
import { createApp, h } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import UApp from '@nuxt/ui/components/App.vue';
import SitemapEditor from './components/SitemapEditor.vue';
import { editorStore } from './composables/use-editor.ts';
import { flowKey } from './flow-context.ts';
import { htmlElement } from './dom.ts';
import type { EditorHost, FlowRuntime } from './contracts.ts';
import { validateAuthoringDocument, parseAuthoringDocument, authoringDesignKey } from '../../../../scripts/companion/authoring-contract.ts';
import { validateSitemapModel } from '../../../../scripts/companion/sitemap/validate.ts';
import { canonicalKey } from '../../../../scripts/companion/sitemap/safety.ts';
import './ui.css';
import './editor.css';
import './integration.css';

export { validateAuthoringDocument, parseAuthoringDocument, authoringDesignKey, validateSitemapModel, canonicalKey };
export function mount(root:HTMLElement,host:EditorHost,flow:FlowRuntime = root.ownerDocument.defaultView!.VueFlowCore) {
  const ownedHost={...host,exportRecovery:host.exportRecovery??((value:unknown)=>{const doc=root.ownerDocument,win=doc.defaultView!;const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=htmlElement(doc,'a');link.setAttribute('href',url);link.setAttribute('download','journey-lens-recovery.json');link.click();win.setTimeout(()=>URL.revokeObjectURL(url),1000);})};
  const pinia=createPinia(),store=editorStore(ownedHost)(pinia);
  const app=createApp({render:()=>h(UApp,{toaster:null,portal:root},()=>h(SitemapEditor,{store}))});
  let closed=false;
  app.use(pinia);app.provide(flowKey,flow);root.classList.add('journey-lens-root');
  try{app.mount(root);}catch(cause){store.dispose();disposePinia(pinia);throw cause;}
  const ready=store.load();
  const shortcut=(event:KeyboardEvent)=>{
    const target=event.target;
    if(!target||!('nodeType' in target)||!root.contains(target as Node)||event.defaultPrevented||event.isComposing)return;
    if('closest' in target && typeof target.closest==='function' && (target.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]')))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();event.stopPropagation();void(event.shiftKey?store.redo():store.undo());
    }
  };
  root.addEventListener('keydown',shortcut);
  return {ready,isBusy:()=>store.busy,canLeave:store.canLeave,viewState:store.viewState,recovery:store.recovery,restore:store.restoreDraft,invalidate(){store.available=false;},unmount(){if(closed)return;closed=true;store.dispose();root.removeEventListener('keydown',shortcut);try{app.unmount();}finally{store.$dispose();disposePinia(pinia);}}};
}
