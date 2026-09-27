/** Run with node --inspect-brk --experimental-strip-types scripts/compiler/debug-fixture.mjs. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { analyzeProject } from './index.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=await readFile(join(root,'docs/concepts/companion/starters/blank.companion.json'),'utf8');
const result=await analyzeProject(source,'blank.companion.json',{
  onEvent:event=>process.stderr.write(JSON.stringify(event)+'\n'),
  onFailure:error=>console.error(error),
});
process.stdout.write(JSON.stringify({status:result.status,diagnostics:result.diagnostics})+'\n');
process.exitCode=result.status==='ok'?0:1;
