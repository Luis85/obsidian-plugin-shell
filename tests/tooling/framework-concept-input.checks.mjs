import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { decodeConceptInput } from '../../scripts/framework/concept-input.ts';
import { starterDocumentText } from '../support/starter-documents.mjs';
const project = starterDocumentText('blank');
const direct = `<script type="application/json" id="companion-project">${project}</script>`;
const digest = value => createHash('sha256').update(value).digest('hex');
const decode = html => decodeConceptInput(Buffer.from(html), 'html');

test('inert canonical project JSON is extracted without interpreting executable sibling scripts',()=>{
  const result=decode(`<script>throw Error('never execute'); globalThis.__conceptExecuted=true;</script>${direct}`);
  assert.equal(result.status,'data'); assert.equal(result.encoding,'project-json');
  assert.deepEqual(result.concept.project,JSON.parse(project)); assert.equal(globalThis.__conceptExecuted,undefined);
});
test('current prototype worker base64 payload is decoded with exact checksum verification',()=>{
  const data=JSON.stringify({encoding:'base64',sha256:digest(project),content:Buffer.from(project).toString('base64')});
  const result=decode(`<script id="prototype-project-data" type="application/json">${data}</script>`);
  assert.equal(result.status,'data');assert.equal(result.payloadSha256,digest(project));
  assert.equal(result.encoding,'prototype-base64');
  assert.throws(()=>decode(`<script id="prototype-project-data" type="application/json">${data.replace(digest(project),'a'.repeat(64))}</script>`),/CONCEPT_INTEGRITY/);
});
test('raw HTML without a recognized inert payload is reference-only, not inferred app source',()=>{
  assert.equal(decode('<button onclick="alert(1)">Save</button>').status,'reference-only');
  assert.equal(decode(`<!--${direct}-->`).status,'reference-only');
  assert.equal(decode(`<textarea>${direct}</textarea>`).status,'reference-only');
  assert.equal(decode(`<script>const text = '${direct.replaceAll('</script>', '<\\/script>')}'</script>`).status,'reference-only');
});
test('duplicate markers and executable or external marker scripts fail without choosing one',()=>{
  assert.throws(()=>decode(direct+direct),/CONCEPT_AMBIGUOUS/);
  assert.throws(()=>decode(direct.replace('application/json','text/javascript')),/CONCEPT_PAYLOAD/);
  assert.throws(()=>decode(direct.replace('id="companion-project"','id="companion-project" src="https://host/x"')),/CONCEPT_PAYLOAD/);
  assert.throws(()=>decode(direct.replace('id="companion-project"','id="companion-project" id="other"')),/CONCEPT_PAYLOAD/);
});
test('malformed UTF-8, payload JSON and noncanonical base64 are rejected',()=>{
  assert.throws(()=>decodeConceptInput(Buffer.from([0xc3,0x28]),'json'),/CONCEPT_UTF8/);
  assert.throws(()=>decode(direct.replace(project,'broken')),/CONCEPT_JSON/);
  assert.throws(()=>decode('<script type="application/json" id="prototype-project-data">{"encoding":"base64","sha256":"'+digest(project)+'","content":"!"}</script>'),/CONCEPT_PAYLOAD/);
});
test('JSON files use the same versioned contract and fail on wrong-kind export',()=>{
  assert.equal(decodeConceptInput(Buffer.from(project),'json').concept.mode,'project');
  assert.throws(()=>decodeConceptInput(Buffer.from('{"kind":"blueprint"}'),'json'));
});


test('quoted attributes and nested templates cannot turn reference text into an importable project',()=>{
  assert.equal(decode(`<div title='${direct.replaceAll("'",'&#39;')}'>Reference</div>`).status,'reference-only');
  assert.equal(decode(`<template><template><p>Nested</p></template>${direct}</template>`).status,'reference-only');
  assert.throws(()=>decode(direct.replace('</script>','')),/CONCEPT_PAYLOAD/);
});
