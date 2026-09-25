import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJsonHttpPort, validateHttpSource } from '../../scripts/companion/runtime/json-http.ts';
const source={id:'test-api',locator:'https://example.invalid/v1',auth:'none',credentialRef:'',operations:[{slug:'list',method:'GET',resource:'/items/{id}',input:{type:'object',properties:{id:{type:'string'},query:{type:'string'}},required:['id','query'],additionalProperties:false},output:{type:'array',items:{type:'string'}}}]};
const input={id:'hello world',query:'a&b'};
test('HTTP adapter serializes declared path/query and validates real response bytes',async()=>{
 const calls=[];const adapter=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',transport:async(url,init)=>{calls.push({url,init});return new Response('["item"]');}});
 try{assert.deepEqual(await adapter.port.list(input),['item']);assert.equal(calls[0].url,'https://example.invalid/v1/items/hello%20world?query=a%26b');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.credentials,'omit');}finally{adapter.dispose();}
});
test('origin approval and input validation prevent all transport and credential access',async()=>{
 let calls=0;const transport=async()=>{calls++;return new Response('[]');};
 for(const config of [undefined,{approvedOrigin:'https://wrong.invalid',transport}]){const a=createJsonHttpPort(source,config);await assert.rejects(a.port.list(input),/NOT_APPROVED/);a.dispose();}
 const a=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',transport});await assert.rejects(a.port.list({id:'only'}),/INPUT/);await assert.rejects(a.port.list({...input,id:'..'}),/PATH/);assert.equal(calls,0);a.dispose();
});
test('symbolic credentials resolve at request time and are not retained in source data or exceptions',async()=>{
 const configured={...source,auth:'oauth',credentialRef:'profile-key'};const before=JSON.stringify(configured);let context;
 const a=createJsonHttpPort(configured,{approvedOrigin:'https://example.invalid',headers:async(c)=>{context=c;return {Authorization:'Bearer ephemeral'};},transport:async(_,init)=>{assert.equal(init.headers.get('Authorization'),'Bearer ephemeral');throw Error('secret-token server body');}});
 await assert.rejects(a.port.list(input),{message:'HTTP_REQUEST_FAILED'});assert.equal(context.credentialRef,'profile-key');assert.equal(JSON.stringify(configured),before);a.dispose();
 const missing=createJsonHttpPort(configured,{approvedOrigin:'https://example.invalid'});await assert.rejects(missing.port.list(input),/CREDENTIAL_PROVIDER/);missing.dispose();
});
test('response schema, byte limits, invalid JSON, redirects and status errors never produce data',async()=>{
 const responses=[()=>new Response('{}'),()=>new Response('not-json'),()=>new Response('[]',{status:503}),()=>new Response('[]',{headers:{'content-length':'100'}}),()=>({ok:true,redirected:true})];
 for(const response of responses){const a=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',maxBytes:30,transport:async()=>response()});await assert.rejects(a.port.list(input),/HTTP_/);a.dispose();}
 let cancelled=false;const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(31));},cancel(){cancelled=true;}});
 const a=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',maxBytes:30,transport:async()=>new Response(stream)});await assert.rejects(a.port.list(input),/RESPONSE_LIMIT/);assert.equal(cancelled,true);a.dispose();
});
test('disposal and caller cancellation abort actual pending transport without retries',async()=>{
 let calls=0;let started;const ready=new Promise(r=>started=r);
 const a=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',transport:async(_,init)=>{calls++;started();return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});
 const work=a.port.list(input);await ready;a.dispose();await assert.rejects(work,/ABORTED/);assert.equal(calls,1);await assert.rejects(a.port.list(input),/DISPOSED/);
 let contacted=false;const b=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',transport:async()=>{contacted=true;return new Response('[]');}});await assert.rejects(b.port.list(input,AbortSignal.abort()),/ABORTED/);assert.equal(contacted,false);b.dispose();
});
test('unsafe static source paths, methods and unsupported query shapes are rejected',()=>{
 for(const change of [s=>s.locator='http://example.invalid',s=>s.locator='https://user:secret@example.invalid',s=>s.operations[0].resource='//elsewhere.invalid',s=>s.operations[0].resource='/%2e%2e/items',s=>s.operations[0].resource='/items/{missing}',s=>s.operations[0].method='adapter',s=>s.operations[0].input.additionalProperties=true]){const s=structuredClone(source);change(s);assert.throws(()=>validateHttpSource(s),/HTTP_/);}
});
test('POST bodies preserve false and zero, while unsafe headers and oversize requests never contact transport',async()=>{
 const s={...source,operations:[{slug:'save',method:'POST',resource:'/items',input:{type:'object',properties:{value:{type:'number'},active:{type:'boolean'}},required:['value','active'],additionalProperties:false},output:{type:'boolean'}}]};let calls=0;
 const a=createJsonHttpPort(s,{approvedOrigin:'https://example.invalid',transport:async(_,init)=>{calls++;assert.deepEqual(JSON.parse(init.body),{value:0,active:false});assert.equal(init.headers.get('Content-Type'),'application/json');return new Response('true');}});
 assert.equal(await a.port.save({value:0,active:false}),true);a.dispose();
 for(const config of [{maxBytes:2},{headers:async()=>({Cookie:'ambient=secret'})},{headers:async()=>({Authorization:'a\r\nb'})}]){
  const b=createJsonHttpPort(s,{approvedOrigin:'https://example.invalid',...config,transport:async()=>{calls++;throw Error('unexpected');}});await assert.rejects(b.port.save({value:0,active:false}),/HTTP_/);b.dispose();
 }assert.equal(calls,1);
});
test('timeouts bound uncooperative credentials, transport and body readers; late responses are cancelled',async()=>{
 let called=0;
 const a=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',timeoutMs:10,headers:()=>new Promise(()=>{}),transport:async()=>{called++;return new Response('[]');}});
 await assert.rejects(a.port.list(input),/ABORTED/);a.dispose();assert.equal(called,0);
 let finish;let cancelled=false;const ready=new Promise(resolve=>{finish=resolve;});
 const b=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',timeoutMs:10,transport:()=>ready});await assert.rejects(b.port.list(input),/ABORTED/);
 finish(new Response(new ReadableStream({cancel(){cancelled=true;}})));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancelled,true);b.dispose();
 const c=createJsonHttpPort(source,{approvedOrigin:'https://example.invalid',timeoutMs:10,transport:async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});}}))});
 await assert.rejects(c.port.list(input),/ABORTED/);c.dispose();
});
test('provider snapshots prevent caller edits from redirecting an approved source',async()=>{
 const configured=structuredClone(source);const settings={approvedOrigin:'https://example.invalid',transport:async(url)=>{assert.match(url,/^https:\/\/example.invalid\/v1/);return new Response('[]');}};
 const a=createJsonHttpPort(configured,settings);configured.locator='https://other.invalid';configured.operations[0].resource='/changed';settings.transport=()=>{throw Error('mutated');};await a.port.list(input);a.dispose();
});
