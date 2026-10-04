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
const SCALARS=['string','number','integer','boolean'];
const BODYLESS=['GET','HEAD'];
/** A `{name}` path parameter must be a required scalar property of the object input. */
function pathParameter(op:JsonHttpOperation,key:string):string {
  const field=op.input?.type==='object'?op.input.properties?.[key]:undefined;
  if(!field || !SCALARS.includes(String(field.type)) || !op.input?.required?.includes(key))throw new Error('HTTP_PATH_INPUT_REQUIRED');
  return 'parameter';
}
function unsafeSegment(part:string):boolean {
  try{const decoded=decodeURIComponent(part);return decoded==='.'||decoded==='..'||/[/\\]/.test(decoded);}catch{return true;}
}
function validateResource(op:JsonHttpOperation):void {
  if(!/^\/(?!\/)[^?#\\\s]*$/.test(op.resource) || op.resource.length>500)throw new Error('HTTP_RESOURCE_INVALID');
  const route=op.resource.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(_,key:string)=>pathParameter(op,key));
  if(/[{}]/.test(route) || route.split('/').some(unsafeSegment))throw new Error('HTTP_RESOURCE_INVALID');
}
/** GET/HEAD input becomes the query string, so it must be a closed object of scalars. */
function queryInputProblem(op:JsonHttpOperation):boolean {
  if(!BODYLESS.includes(op.method) || !op.input)return false;
  if(op.input.type!=='object'||op.input.additionalProperties!==false)return true;
  return Object.values(op.input.properties ?? {}).some(field=>!SCALARS.includes(String(field.type)));
}
function validateOperation(op:JsonHttpOperation):void {
  if(!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(op.method))throw new Error('HTTP_METHOD_UNSUPPORTED');
  validateResource(op);
  if(queryInputProblem(op))throw new Error('HTTP_QUERY_OBJECT_REQUIRED');
  if(op.method==='HEAD' && op.output!==null)throw new Error('HTTP_HEAD_OUTPUT_UNSUPPORTED');
}
export function validateHttpSource(source:JsonHttpSource):void {
  baseUrl(source);
  if(!['none','api-key','oauth','runtime'].includes(source.auth))throw new Error('HTTP_AUTH_INVALID');
  const slugs=new Set<string>();
  for(const op of source.operations){
    if(slugs.has(op.slug))throw new Error('HTTP_DUPLICATE_OPERATION');slugs.add(op.slug);
    validateOperation(op);
  }
}
function requestUrl(base:URL,op:JsonHttpOperation,input:unknown):URL {
  const values=input && typeof input==='object'&&!Array.isArray(input)?Object.fromEntries(Object.entries(input)):{};
  const used=new Set<string>();
  const route=op.resource.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(_,key:string)=>{
    const value=values[key];
    if(!['string','number','boolean'].includes(typeof value))throw new Error('HTTP_PATH_INPUT_INVALID');
    const part=String(value);if(!part || part==='.' || part==='..' || /[/\\]/.test(part))throw new Error('HTTP_PATH_INPUT_INVALID');
    used.add(key);return encodeURIComponent(part);
  });
  const prefix=base.pathname.replace(/\/$/,'');const url=new URL(base.origin+prefix+route);
  if(url.origin!==base.origin || !url.pathname.startsWith(prefix+'/'))throw new Error('HTTP_RESOURCE_ESCAPE');
  if(BODYLESS.includes(op.method))for(const [key,value]of Object.entries(values))if(!used.has(key))url.searchParams.set(key,String(value));
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
const HEADER_NAME=/^[A-Za-z][A-Za-z0-9-]{0,79}$/,RESERVED_HEADER=/^(cookie|host|origin|referer|content-length|proxy-.*|sec-.*)$/i;
function safeHeader(name:string,value:unknown):value is string {
  return HEADER_NAME.test(name)&&!RESERVED_HEADER.test(name)&&typeof value==='string'&&!/[\r\n]/.test(value)&&value.length<=8192;
}
/** Credential headers come only from the runtime provider; a source that needs auth never runs without one. */
async function requestHeaders(source:JsonHttpSource,configuration:JsonHttpConfiguration,signal:AbortSignal):Promise<Headers>{
  const headers=new Headers({'Accept':'application/json'}),provide=configuration.headers;
  if(!provide){if(source.auth!=='none')throw new Error('HTTP_CREDENTIAL_PROVIDER_REQUIRED');return headers;}
  const provided=await abortable(signal,()=>provide({source:source.id,credentialRef:source.credentialRef,signal}));
  for(const [name,value]of Object.entries(provided)){if(!safeHeader(name,value))throw new Error('HTTP_HEADER_INVALID');headers.set(name,value);}
  return headers;
}
function requestBody(op:JsonHttpOperation,input:unknown,limit:number,headers:Headers):string|undefined {
  if(BODYLESS.includes(op.method)||input===undefined)return undefined;
  const body=JSON.stringify(input);
  if(new TextEncoder().encode(body).length>limit)throw new Error('HTTP_REQUEST_LIMIT');
  headers.set('Content-Type','application/json');return body;
}
function acceptResponse(response:Response,base:URL):void {
  if(response.redirected || response.url && new URL(response.url).origin!==base.origin){cancelResponse(response);throw new Error('HTTP_REDIRECT_REFUSED');}
  if(!response.ok){cancelResponse(response);throw new Error('HTTP_RESPONSE_FAILED');}
}
function parseOutput(op:JsonHttpOperation,raw:string):unknown {
  const output=raw.trim()?JSON.parse(raw):undefined;
  if(!matches(output,op.output))throw new Error('HTTP_OUTPUT_INVALID');return output;
}
/** Do not expose response bodies, credentials, request paths or transport exception text. */
function publicError(error:unknown,aborted:boolean):Error {
  if(error instanceof Error && /^HTTP_[A-Z_]+$/.test(error.message))return error;
  return new Error(aborted?'HTTP_ABORTED':'HTTP_REQUEST_FAILED');
}
function portLimits(configuration?:JsonHttpConfiguration):{timeout:number;limit:number} {
  const timeout=configuration?.timeoutMs ?? 8000,limit=configuration?.maxBytes ?? 4_000_000;
  const valid=(value:number,max:number)=>Number.isInteger(value)&&value>=1&&value<=max;
  if(!valid(timeout,30000)||!valid(limit,4_000_000))throw new Error('HTTP_CONFIGURATION_INVALID');
  return {timeout,limit};
}
interface Exchange { source:JsonHttpSource; configuration:JsonHttpConfiguration; base:URL; limit:number; controller:AbortController; live:()=>boolean }
/** One approved request: headers, bounded body, transport, response checks and output validation. */
async function exchange(context:Exchange,op:JsonHttpOperation,url:URL,input:unknown):Promise<unknown>{
  const {source,configuration,base,limit,controller,live}=context,signal=controller.signal;
  const headers=await requestHeaders(source,configuration,signal);
  const body=requestBody(op,input,limit,headers);
  if(!live())throw new Error('HTTP_ABORTED');
  const transport=configuration.transport ?? fetch;
  const response=await abortable(signal,()=>transport(url.href,{method:op.method,body,headers,signal,credentials:'omit',cache:'no-store',redirect:'error'}),cancelResponse);
  acceptResponse(response,base);
  const raw=await boundedText(response,limit,signal);if(!live())throw new Error('HTTP_ABORTED');
  return parseOutput(op,raw);
}
/** Explicit origin approval is runtime configuration, never supplied by portable project JSON. */
export function createJsonHttpPort(source:JsonHttpSource,configuration?:JsonHttpConfiguration){
  source=structuredClone(source);configuration=configuration?{...configuration}:undefined;
  validateHttpSource(source);const base=baseUrl(source);const pending=new Set<AbortController>();let disposed=false;
  const {timeout,limit}=portLimits(configuration);
  function approved(op:JsonHttpOperation,input:unknown):JsonHttpConfiguration {
    if(disposed)throw new Error('HTTP_DISPOSED');
    if(!configuration || configuration.approvedOrigin!==base.origin)throw new Error('HTTP_ORIGIN_NOT_APPROVED');
    if(!matches(input,op.input))throw new Error('HTTP_INPUT_INVALID');
    return configuration;
  }
  async function execute(op:JsonHttpOperation,input:unknown,signal?:AbortSignal):Promise<unknown>{
    const approval=approved(op,input);input=structuredClone(input);
    const url=requestUrl(base,op,input);const controller=new AbortController();
    const abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    pending.add(controller);
    // eslint-disable-next-line obsidianmd/prefer-window-timers -- portable runtime: Node contract tests have no window; the timer is always cleared below.
    const timer=setTimeout(abort,timeout);
    try{return await exchange({source,configuration:approval,base,limit,controller,live:()=>!controller.signal.aborted&&!disposed},op,url,input);}
    catch(error){throw publicError(error,controller.signal.aborted);}
    finally{
      // eslint-disable-next-line obsidianmd/prefer-window-timers -- pairs with the portable setTimeout above.
      clearTimeout(timer);signal?.removeEventListener('abort',abort);pending.delete(controller);
    }
  }
  const port=Object.fromEntries(source.operations.map(op=>[op.slug,(input:unknown,signal?:AbortSignal)=>execute(op,input,signal)]));
  return {port,dispose(){disposed=true;for(const controller of pending)controller.abort();pending.clear();}};
}
