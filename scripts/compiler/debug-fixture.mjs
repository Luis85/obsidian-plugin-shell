import { loadDefinitions } from '../../bin/adapters/starters/repository.ts';
/** Run with node --inspect-brk --experimental-strip-types scripts/compiler/debug-fixture.mjs. */
import { fileURLToPath } from 'node:url';
import { analyzeProject } from '../../bin/compiler/index.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=JSON.stringify((await loadDefinitions(root)).find(entry=>entry.definition.id==='blank').definition.generator.document);
const result=await analyzeProject(source,'blank.companion.json',{
  onEvent:event=>process.stderr.write(JSON.stringify(event)+'\n'),
  onFailure:error=>console.error(error),
});
process.stdout.write(JSON.stringify({status:result.status,diagnostics:result.diagnostics})+'\n');
process.exitCode=result.status==='ok'?0:1;
