import { matches, type Schema } from './contract.ts';
export interface JsonHttpOperation { slug:string; method:string; resource:string; input:Schema|null; output:Schema|null }
export interface JsonHttpSource { id:string; locator:string; auth:string; credentialRef:string; operations:readonly JsonHttpOperation[] }
export interface JsonHttpConfiguration {
  approvedOrigin:string;
  transport?:typeof fetch;
  headers?:(context:{source:string;credentialRef:string;signal:AbortSignal})=>Promise<Readonly<Record<string,string>>>;
  timeoutMs?:number;
  maxBytes?:number;
}
function baseUrl(source:JsonHttpSource):URL {
  let base:URL;try{base=new URL(source.locator);}catch{throw new Error('HTTP_SOURCE_INVALID');}
  if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash)throw new Error('HTTP_SOURCE_INVALID');
  return base;
}
export function validateHttpSource(source:JsonHttpSource):void {
  baseUrl(source);
  if(!['none','api-key','oauth','runtime'].includes(source.auth))throw new Error('HTTP_AUTH_INVALID');
  const slugs=new Set<string>();
  for(const op of source.operations){
    if(slugs.has(op.slug))throw new Error('HTTP_DUPLICATE_OPERATION');slugs.add(op.slug);
    if(!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(op.method))throw new Error('HTTP_METHOD_UNSUPPORTED');
    if(!/^\/(?!\/)[^?#\\\s]*$/.test(op.resource) || op.resource.length>500)throw new Error('HTTP_RESOURCE_INVALID');
    const route=op.resource.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(_,key:string)=>{
      const field=op.input?.type==='object'?op.input.properties?.[key]:undefined;
      if(!field || !['string','number','integer','boolean'].includes(String(field.type)) || !op.input?.required?.includes(key))throw new Error('HTTP_PATH_INPUT_REQUIRED');return 'parameter';
    });
    if(/[{}]/.test(route) || route.split('/').some(part=>{try{const decoded=decodeURIComponent(part);return decoded==='.'||decoded==='..'||/[\/\\]/.test(decoded);}catch{return true;}}))throw new Error('HTTP_RESOURCE_INVALID');
    if(['GET','HEAD'].includes(op.method) && op.input && (op.input.type!=='object'||op.input.additionalProperties!==false||Object.values(op.input.properties ?? {}).some(field=>!['string','number','integer','boolean'].includes(String(field.type)))))throw new Error('HTTP_QUERY_OBJECT_REQUIRED');
    if(op.method==='HEAD' && op.output!==null)throw new Error('HTTP_HEAD_OUTPUT_UNSUPPORTED');
  }
}
function requestUrl(base:URL,op:JsonHttpOperation,input:unknown):URL {
  const values=input && typeof input==='object'&&!Array.isArray(input)?Object.fromEntries(Object.entries(input)):{};
  const used=new Set<string>();
  const route=op.resource.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(_,key:string)=>{
    const value=values[key];
    if(!['string','number','boolean'].includes(typeof value))throw new Error('HTTP_PATH_INPUT_INVALID');
    const part=String(value);if(!part || part==='.' || part==='..' || /[\/\\]/.test(part))throw new Error('HTTP_PATH_INPUT_INVALID');
    used.add(key);return encodeURIComponent(part);
  });
  const prefix=base.pathname.replace(/\/$/,'');const url=new URL(base.origin+prefix+route);
  if(url.origin!==base.origin || !url.pathname.startsWith(prefix+'/'))throw new Error('HTTP_RESOURCE_ESCAPE');
  if(['GET','HEAD'].includes(op.method))for(const [key,value]of Object.entries(values))if(!used.has(key))url.searchParams.set(key,String(value));
  return url;
}
/** Bound our wait even when an injected credential provider/transport ignores cancellation. */
function abortable<T>(signal:AbortSignal,start:()=>Promise<T>,late?:(value:T)=>void):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    let settled=false;
    const abort=()=>{if(!settled){settled=true;signal.removeEventListener('abort',abort);reject(new Error('HTTP_ABORTED'));}};
    if(signal.aborted){abort();return;}
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>{if(signal.aborted)throw new Error('HTTP_ABORTED');return start();}).then(value=>{
      signal.removeEventListener('abort',abort);if(settled){try{late?.(value);}catch{}return;}settled=true;resolve(value);
    },error=>{signal.removeEventListener('abort',abort);if(!settled){settled=true;reject(error);}});
  });
}
function cancelResponse(response:Response):void { try{void response.body?.cancel().catch(()=>{});}catch{} }
async function boundedText(response:Response,limit:number,signal:AbortSignal):Promise<string>{
  const declared=response.headers.get('content-length');if(declared && Number(declared)>limit)throw new Error('HTTP_RESPONSE_LIMIT');
  if(!response.body)return '';
  const reader=response.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let total=0,text='';let finished=false;
  try{while(true){if(signal.aborted)throw new Error('HTTP_ABORTED');const chunk=await abortable(signal,()=>reader.read());if(chunk.done){finished=true;break;}total+=chunk.value.byteLength;if(total>limit)throw new Error('HTTP_RESPONSE_LIMIT');text+=decoder.decode(chunk.value,{stream:true});}return text+decoder.decode();}
  finally{if(!finished)void reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** Explicit origin approval is runtime configuration, never supplied by portable project JSON. */
export function createJsonHttpPort(source:JsonHttpSource,configuration?:JsonHttpConfiguration){
  source=structuredClone(source);configuration=configuration?{...configuration}:undefined;
  validateHttpSource(source);const base=baseUrl(source);const pending=new Set<AbortController>();let disposed=false;
  const timeout=configuration?.timeoutMs ?? 8000,limit=configuration?.maxBytes ?? 4_000_000;
  if(!Number.isInteger(timeout)||timeout<1||timeout>30000||!Number.isInteger(limit)||limit<1||limit>4_000_000)throw new Error('HTTP_CONFIGURATION_INVALID');
  async function execute(op:JsonHttpOperation,input:unknown,signal?:AbortSignal):Promise<unknown>{
    if(disposed)throw new Error('HTTP_DISPOSED');
    if(!configuration || configuration.approvedOrigin!==base.origin)throw new Error('HTTP_ORIGIN_NOT_APPROVED');
    if(!matches(input,op.input))throw new Error('HTTP_INPUT_INVALID');input=structuredClone(input);
    const url=requestUrl(base,op,input);const controller=new AbortController();
    const abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    pending.add(controller);const timer=setTimeout(abort,timeout);
    try{
      const headers=new Headers({'Accept':'application/json'});
      if(source.auth!=='none'&&!configuration.headers)throw new Error('HTTP_CREDENTIAL_PROVIDER_REQUIRED');
      if(configuration.headers){
        const provide=configuration.headers;
        const provided=await abortable(controller.signal,()=>provide({source:source.id,credentialRef:source.credentialRef,signal:controller.signal}));
        for(const [name,value]of Object.entries(provided)){
          if(!/^[A-Za-z][A-Za-z0-9-]{0,79}$/.test(name)||/^(cookie|host|origin|referer|content-length|proxy-.*|sec-.*)$/i.test(name)||typeof value!=='string'||/[\r\n]/.test(value)||value.length>8192)throw new Error('HTTP_HEADER_INVALID');
          headers.set(name,value);
        }
      }
      const body=['GET','HEAD'].includes(op.method)||input===undefined?undefined:JSON.stringify(input);
      if(body!==undefined){if(new TextEncoder().encode(body).length>limit)throw new Error('HTTP_REQUEST_LIMIT');headers.set('Content-Type','application/json');}
      if(controller.signal.aborted || disposed)throw new Error('HTTP_ABORTED');
      const transport=configuration.transport ?? fetch;
      const response=await abortable(controller.signal,()=>transport(url.href,{method:op.method,body,headers,signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'}),cancelResponse);
      if(response.redirected || response.url && new URL(response.url).origin!==base.origin){cancelResponse(response);throw new Error('HTTP_REDIRECT_REFUSED');}
      if(!response.ok){cancelResponse(response);throw new Error('HTTP_RESPONSE_FAILED');}
      const raw=await boundedText(response,limit,controller.signal);if(controller.signal.aborted || disposed)throw new Error('HTTP_ABORTED');
      const output=raw.trim()?JSON.parse(raw):undefined;
      if(!matches(output,op.output))throw new Error('HTTP_OUTPUT_INVALID');return output;
    }catch(error){
      // Do not expose response bodies, credentials, request paths or transport exception text.
      if(error instanceof Error && /^HTTP_[A-Z_]+$/.test(error.message))throw error;
      throw new Error(controller.signal.aborted?'HTTP_ABORTED':'HTTP_REQUEST_FAILED');
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);pending.delete(controller);}
  }
  const port=Object.fromEntries(source.operations.map(op=>[op.slug,(input:unknown,signal?:AbortSignal)=>execute(op,input,signal)]));
  return {port,dispose(){disposed=true;for(const controller of pending)controller.abort();pending.clear();}};
}
