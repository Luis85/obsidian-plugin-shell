import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseAuthoringDocument } from './authoring-contract.ts';

/** Bind qualification to the actual modern build's HTML and complete export, never an abbreviated schema example. */
export async function authoringEvidence(root) {
  const folder=join(root,'reports/companion-mvp');
  const read=async(name,limit)=>{const path=join(folder,name),stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>limit)throw Error('AUTHORING_EVIDENCE_FILE');return readFile(path);};
  const receipt=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await read('build.json',10000)));
  const project=await read('companion-project.json',4_000_000),html=await read('index.html',16_000_000);
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(receipt.schema!==1||receipt.project!==hash(project)||receipt.html!==hash(html))throw Error('AUTHORING_EVIDENCE_CHANGED: rebuild the companion and export before qualification.');
  const document=parseAuthoringDocument(new TextDecoder('utf-8',{fatal:true}).decode(project));
  if(document.schemaVersion!==6)throw Error('AUTHORING_EVIDENCE_VERSION');
  return {input:join(folder,'companion-project.json'),projectSha256:hash(project),htmlSha256:hash(html),projectBytes:project.length};
}
