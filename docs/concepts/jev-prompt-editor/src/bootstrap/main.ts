namespace Jev {
  export function mount(render:Function):void {
    const ids=()=> 'p_'+(typeof crypto.randomUUID==='function'?crypto.randomUUID().replace(/-/g,'').slice(0,16):Date.now().toString(36)+Math.random().toString(36).slice(2,9));
    const service=new StudioService(new BrowserLibrary(),ids,()=>new Date().toISOString());
    Vue.createApp({setup:()=>setupWorkbench(service),render}).mount('#app');
  }
}
