import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateHttpSource, type JsonHttpSource } from '../runtime/json-http.ts';
import { literal, text, symbol, type Model, type Source } from './model.ts';
import { sampleCode } from './schema-code.ts';
import { relativeImport, type Add } from './file-code.ts';
export function httpDefinition(source:Source):JsonHttpSource {
  const definition={id:source.id,locator:text(source.contract.locator,240),auth:text(source.contract.auth,40),credentialRef:text(source.contract.credentialRef,60),operations:source.operations.map(op=>({slug:op.slug,method:text(op.contract.method,10),resource:text(op.contract.resource,500),input:op.input,output:op.output}))};
  validateHttpSource(definition);return definition;
}
export async function httpCode(template:string,m:Model,add:Add):Promise<void>{
  const sources=m.sources.filter(s=>s.kind==='api');if(!sources.length)return;
  add(`${m.sourceRoot}/infrastructure/json-http.ts`,(await readFile(join(template,'scripts/companion/runtime/json-http.ts'),'utf8')).replace("'./contract.ts'","'../domain/contract.ts'"),'managed');
  for(const source of sources){
    const definition=httpDefinition(source),name=symbol(source.slug);
    add(`${m.sourceRoot}/infrastructure/sources/${source.slug}-http.ts`,`import { createJsonHttpPort, type JsonHttpConfiguration } from '../json-http.ts';
import type { ${name}Port } from '../../application/${source.slug}/contracts.ts';
/** Configure in bootstrap, inject port via createSources, and dispose with the owner. No auth token is exported. */
export function create${name}HttpProvider(configuration?:JsonHttpConfiguration){
 const runtime=createJsonHttpPort(${literal(definition)},configuration);
 const port:${name}Port={${source.operations.map(op=>`${literal(op.slug)}:(input,signal)=>runtime.port[${literal(op.slug)}]!(input,signal)`).join(',')}};
 return {port,dispose:()=>runtime.dispose()};
}
`);
    const testPath=`${m.testRoot}/http/${source.slug}.test.mjs`;
    const provider=`${m.sourceRoot}/infrastructure/sources/${source.slug}-http.ts`;
    const tests=source.operations.map(op=>`test(${literal(op.slug+' runs its generated typed HTTP provider and service')},async()=>{
 let calls=0;
 const provider=create${name}HttpProvider({approvedOrigin:${literal(new URL(definition.locator).origin)},headers:async()=>({Authorization:'Bearer fixture-only'}),transport:async()=>{calls++;return new Response(${op.output?'JSON.stringify('+sampleCode(op.output)+')':'null'});}});
 try{const service=create${name}Service(provider.port);expect(await service[${literal(op.slug)}](${sampleCode(op.input)})).toEqual(${sampleCode(op.output)});expect(calls).toBe(1);}
 finally{provider.dispose();}
});`).join('\n');
    add(testPath,`import { test, expect } from 'vitest';
import { create${name}HttpProvider } from ${literal(relativeImport(testPath,provider))};
import { create${name}Service } from ${literal(relativeImport(testPath,`${m.sourceRoot}/application/${source.slug}/service.ts`))};
${tests}
`,'managed');
  }
  const test=`${m.testRoot}/http.test.mjs`;
  add(test,(await readFile(join(template,'tests/tooling/project-generator-http.checks.mjs'),'utf8'))
    .replace("import { test } from 'node:test';","import { test } from 'vitest';")
    .replace('../../scripts/companion/runtime/json-http.ts',relativeImport(test,`${m.sourceRoot}/infrastructure/json-http.ts`)),'managed');
}
