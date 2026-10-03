import type { TemplateSnapshot } from '../domain/contracts.ts';
import { validateHttpSource, type JsonHttpSource } from '../../../templates/companion/runtime/json-http.ts';
import { literal, text, symbol, type Model, type Source } from '../../../scripts/companion/compiler/model.ts';
import { sampleCode } from '../../../scripts/companion/compiler/schema-code.ts';
import { copiedTemplateTest, relativeImport, rewriteTemplate, type Add } from '../../../scripts/companion/compiler/file-code.ts';
function httpDefinition(source:Source):JsonHttpSource {
  const definition={id:source.id,locator:text(source.contract.locator,240),auth:text(source.contract.auth,40),credentialRef:text(source.contract.credentialRef,60),operations:source.operations.map(op=>({slug:op.slug,method:text(op.contract.method,10),resource:text(op.contract.resource,500),input:op.input,output:op.output}))};
  validateHttpSource(definition);return definition;
}
export async function httpCode(template: TemplateSnapshot,m:Model,add:Add):Promise<void>{
  const sources=m.sources.filter(s=>s.kind==='api');if(!sources.length)return;
  add(`${m.sourceRoot}/infrastructure/json-http.ts`,rewriteTemplate(await template.text(['templates/companion/runtime/json-http.ts'].join('/')),[["'./contract.ts'","'../domain/contract.ts'"]],'json-http.ts'),'managed');
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
  add(test,copiedTemplateTest(await template.text(['tests/tooling/project-generator-http.checks.mjs'].join('/')),
    [['../../templates/companion/runtime/json-http.ts',relativeImport(test,`${m.sourceRoot}/infrastructure/json-http.ts`)]],'project-generator-http.checks.mjs'),'managed');
}
