import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { authoringEvidence } from '../companion-tools/authoring-evidence.mjs';
import { selfProject } from '../../tests/support/starter-documents.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'authoring-evidence-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const folder=join(root,'reports/companion-mvp');await mkdir(folder,{recursive:true});
  const project=JSON.stringify(selfProject()), html='<!doctype html><title>Evidence</title>';
  await writeFile(join(folder,'index.html'),html);await writeFile(join(folder,'companion-project.json'),project);
  await writeFile(join(folder,'build.json'),JSON.stringify({schema:1,project:hash(project),html:hash(html)}));
  return {root,folder,project,html};
}
test('qualification binds the complete actual v6 input to the matching build receipt', async t=> {
  const f=await fixture(t),e=await authoringEvidence(f.root);assert.equal(e.projectSha256,hash(f.project));assert.equal(e.htmlSha256,hash(f.html));
});
test('changed HTML or JSON invalidates qualification before workspace generation or install', async t=> {
  const f=await fixture(t);await writeFile(join(f.folder,'index.html'),'Changed');await assert.rejects(authoringEvidence(f.root),/AUTHORING_EVIDENCE_CHANGED/);
  await writeFile(join(f.folder,'index.html'),f.html);await writeFile(join(f.folder,'companion-project.json'),f.project+' ');await assert.rejects(authoringEvidence(f.root),/AUTHORING_EVIDENCE_CHANGED/);
});
test('malformed project remains invalid even when someone updates the matching hash', async t=> {
  const f=await fixture(t),project=JSON.stringify({schemaVersion:6});await writeFile(join(f.folder,'companion-project.json'),project);
  await writeFile(join(f.folder,'build.json'),JSON.stringify({schema:1,project:hash(project),html:hash(f.html)}));await assert.rejects(authoringEvidence(f.root));
});
