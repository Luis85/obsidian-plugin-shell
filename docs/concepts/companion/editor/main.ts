export { validateProjectTooling } from '../../../../scripts/companion/tooling-contract.ts';
import { createApp, h } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import UApp from '@nuxt/ui/components/App.vue';
import SitemapEditor from './components/SitemapEditor.vue';
import { editorStore } from './composables/use-editor.ts';
import type { EditorHost } from './contracts.ts';
import { validateAuthoringDocument, parseAuthoringDocument, migrateAuthoringDocument, authoringDesignKey } from '../../../../scripts/companion/authoring-contract.ts';
import { validateSitemapModel } from '../../../../scripts/companion/sitemap/validate.ts';
import { canonicalKey } from '../../../../scripts/companion/sitemap/safety.ts';
import './ui.css';
import './editor.css';
import './integration.css';

export { validateAuthoringDocument, parseAuthoringDocument, migrateAuthoringDocument, authoringDesignKey, validateSitemapModel, canonicalKey };
export function mount(root:HTMLElement,host:EditorHost) {
  const pinia=createPinia(),store=editorStore(host)(pinia);
  const app=createApp({render:()=>h(UApp,{toaster:null,portal:root},()=>h(SitemapEditor,{store}))});
  app.use(pinia);app.mount(root);void store.load();
  const shortcut=(event:KeyboardEvent)=>{
    if(!root.contains(event.target instanceof Node?event.target:null)||event.defaultPrevented)return;
    const target=event.target;
    if(target instanceof HTMLElement&&['INPUT','TEXTAREA','SELECT'].includes(target.tagName))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();event.stopPropagation();void(event.shiftKey?store.redo():store.undo());
    }
  };
  root.addEventListener('keydown',shortcut);
  return {canLeave:store.canLeave,viewState:store.viewState,unmount(){store.dispose();root.removeEventListener('keydown',shortcut);app.unmount();store.$dispose();disposePinia(pinia);}};
}
