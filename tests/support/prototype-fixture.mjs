import { readFileSync } from 'node:fs';
import { prototypeApi as api } from '../../scripts/companion/prototypes/api.ts';
import { migrateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
const seed = JSON.parse(readFileSync(new URL('../../docs/concepts/companion/starters/quick-capture.companion.json',import.meta.url),'utf8'));
export function document(label = 'Sitemap A') {
  const doc = migrateAuthoringDocument(structuredClone(seed)).document;
  doc.project = { ...doc.project, id:'design-lab', name:'Design Lab', author:'Example Author' };
  doc.design.goal = label;
  doc.design.sitemap = { schema:1, routes:[{id:'route-inbox',surface:'node-2',path:label === 'Sitemap A' ? '/inbox' : '/dashboard'}],journeys:[] };
  return doc;
}
export const main = {prototypeId:'exploration',versionId:'v1',variantId:'main'};
export const alternate = {...main,variantId:'sitemap-b'};
export function workspace() { return api.change(api.empty('design-lab'),{type:'create',id:'exploration',name:'Product exploration',description:'Compare alternatives',document:document()}); }
function approve(source,selection=main) { return api.change(source,{type:'status',selection,status:'approved'}); }
export function activate(source,selection=main) { return api.change(approve(source,selection),{type:'activate',selection}); }
export function fork(source) { return api.change(source,{type:'fork',selection:main,id:'sitemap-b',name:'Sitemap B',hypothesis:'Find capture faster'}); }
export { api };
