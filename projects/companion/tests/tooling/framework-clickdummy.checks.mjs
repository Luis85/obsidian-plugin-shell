import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { commandHelp } from '../../bin/adapters/framework/help-text.ts';
import { descriptor } from '../../bin/adapters/framework/catalog.ts';

test('clickdummy dry run has zero writes and never needs or launches executable project config', async t=> {
  const root=await mkdtemp(join(tmpdir(),'clickdummy-plan-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const response=await executeOperation(parseCliArguments(['clickdummy','build','--dry-run','--json']),{root,frameworkRoot:root});
  assert.equal(response.status,'planned');assert.equal(response.data.execution,'not-run');assert.deepEqual(await readdir(root),[]);
});
test('clickdummy build refuses non-generated projects with an actionable diagnostic', async ()=> {
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const response=await executeOperation(parseCliArguments(['clickdummy','build']),{root,frameworkRoot:root});
  assert.equal(response.status,'failed');assert.equal(response.diagnostics[0].code,'CLICKDUMMY_PROJECT_REQUIRED');
});
test('fixed entry/output and explicit replace are discoverable; caller-supplied source code paths are refused',()=> {
  const request=parseCliArguments(['clickdummy','build','--replace']);assert.equal(request.options.replace,true);
  assert.throws(()=>parseCliArguments(['clickdummy','build','--input','arbitrary.ts']));
  const help=commandHelp(descriptor('clickdummy build'));assert.equal(help.group,'develop');assert.match(help.optionHelp.replace.description,/successful build/);
});
