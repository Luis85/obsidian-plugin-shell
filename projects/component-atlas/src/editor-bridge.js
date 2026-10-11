/* One bridge, embedded identically in each trusted prototype editor. */
(() => {
  'use strict';
  const CHANNEL='opf:bridge:1';
  let token='',timer=0,last='';
  const methods=new Set(['getSnapshot','navigate','command','setTheme','exportNative','inspectNative','restoreNative','canAdopt','adopt']);
  function send(data){if(token&&parent!==window)parent.postMessage({channel:CHANNEL,token,...data},'*');}
  function publish(){
    clearTimeout(timer);
    try{const snapshot=window.FamilyAdapter?.getSnapshot();if(!snapshot)return;const next=JSON.stringify(snapshot);if(next!==last){last=next;send({type:'snapshot',snapshot});}}
    catch(error){send({type:'error',error:error.message||'The editor state could not be read.'});}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(publish,100);}
  window.addEventListener('message',async event=>{
    if(event.source!==parent || event.data?.channel!==CHANNEL)return;
    const request=event.data;
    if(request.method==='init'&&typeof request.token==='string')token=request.token;
    if(!token||request.token!==token)return;
    try{
      const adapter=window.FamilyAdapter;if(!adapter)throw new Error('This editor did not initialize. Reload the prototype.');
      let result;
      if(request.method==='init'){await adapter.setTheme(request.args.theme);result=adapter.getSnapshot();}
      else {if(!methods.has(request.method))throw new Error('Unsupported editor command.');result=await adapter[request.method](request.args);}
      // Vue editors settle their reactive values before the response is published.
      await Promise.resolve();
      send({type:'response',requestId:request.requestId,result:result===undefined?null:result});publish();
    }catch(error){send({type:'response',requestId:request.requestId,error:error?.message||'The editor could not complete that action.'});publish();}
  });
  window.addEventListener('family:changed',schedule);
  for(const name of ['click','change','input','keyup','pointerup'])document.addEventListener(name,schedule,true);
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();event.stopImmediatePropagation();send({type:'shortcut',name:'search'});
    }
    if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='l'){
      event.preventDefault();event.stopImmediatePropagation();send({type:'shortcut',name:'links'});
    }
  },true);
  window.addEventListener('beforeunload',()=>clearTimeout(timer));
})();
