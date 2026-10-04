import { createFixtureAdapter } from './adapters.mjs';
export function createProjectTestPorts(manifest) {
  const adapter=createFixtureAdapter(manifest);
  const sources=[...new Set(manifest.operations.filter(op=>op.kind!=='vault').map(op=>op.source))];
  const ports=Object.fromEntries(sources.map(source=>{const port=adapter.port(source);return [source,Object.fromEntries(Object.entries(port).map(([slug,run])=>[slug,(input,signal)=>run(input,{signal})]))];}));
  return {ports,dispose:()=>adapter.dispose()};
}
