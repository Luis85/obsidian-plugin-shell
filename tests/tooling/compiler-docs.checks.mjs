import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseCliArguments } from '../../scripts/framework/catalog.ts';
import { diagnosticCatalog } from '../../scripts/compiler/domain/diagnostics.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('compiler documentation includes every stable diagnostic with the exact repair guidance',async()=>{
  const text=await readFile(join(root,'docs/development/compiler/DIAGNOSTICS.md'),'utf8');
  for(const [code,help] of Object.entries(diagnosticCatalog)){assert.ok(text.includes('`'+code+'`'),code);assert.ok(text.includes(help),code+' guidance');}
});
test('documented read commands are accepted by the real CLI catalog',()=>{
  for(const args of [['compiler','check','--input','project.json','--json'],['compiler','inspect','--input','project.json','--stage','artifacts','--output-kind','clickdummy'],['compiler','explain','COMPILER_REFERENCE_MISSING'],['compiler','check','--input','project.json','--report-dir','reports/compiler','--debug']])assert.ok(parseCliArguments(args));
});
