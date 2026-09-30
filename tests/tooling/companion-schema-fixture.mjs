import { companionProjectSchema } from '../../scripts/companion/schema/project.mjs';
import { validateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { companionStarterIds, starterDocument, starterPath } from '../support/starter-documents.mjs';
/** Shared inert corpus; an independent Draft 2020-12 implementation also consumes these bytes. */
export function schemaCorpus() {
  const ids = companionStarterIds();
  const positive = ids.map(id => ({ name: starterPath(id), document: validateAuthoringDocument(starterDocument(id)) }));
  const full = positive[ids.indexOf('companion-plugin')].document;
  const negative = [];
  const bad = (name, edit, schemaRejects = true) => {
    const document = structuredClone(full); edit(document);
    let rejected = false;
    try { validateAuthoringDocument(document); } catch { rejected = true; }
    if (!rejected) throw new Error('CORPUS_INVALID_NEGATIVE: ' + name);
    negative.push({ name, document, schemaRejects });
  };
  bad('future version', doc => { doc.schemaVersion = 7; });
  bad('retired version', doc => { doc.schemaVersion = 5; doc.design.schema = 5; });
  bad('retired detail designs', doc => { doc.design.detailDesigns = { schema: 2, nextId: 1, documents: [], revisions: [] }; });
  bad('future design', doc => { doc.design.schema = 7; });
  bad('wrong kind', doc => { doc.kind = 'jev-workspace'; });
  bad('execution flag', doc => { doc.executable = true; });
  bad('unknown design property', doc => { doc.design.eval = 'never run'; });
  bad('unknown envelope property', doc => { doc.authorization = true; });
  bad('unsafe recursive key', doc => { doc.design.librarySchema = JSON.parse('{"constructor":1}'); });
  bad('visual future schema', doc => { doc.design.visualDesigns.schema = 4; });
  bad('visual unknown prop', doc => { doc.design.visualDesigns.pages[0].executable = true; });
  bad('visual unknown node', doc => { doc.design.visualDesigns.pages[0].root[0].kind = 'script'; });
  bad('visual raw css', doc => { doc.design.visualDesigns.pages[0].root[0].layout = { mode: 'stack', ui: 'position:fixed' }; });
  bad('visual unsafe attributes', doc => { const node = doc.design.visualDesigns.pages[0].root[0]; node.tag = 'div'; node.attrs.href = { kind: 'literal', value: 'javascript:1' }; });
  bad('native unknown version', doc => { doc.design.nativeIntegrations = { schemaVersion: 2, fileTypes: [], contextMenus: [] }; });
  bad('native reserved extension', doc => { doc.design.nativeIntegrations = { schemaVersion: 1, fileTypes: [{ id: 'sample', name: 'Sample', extension: 'md', format: 'text', initialContent: '' }], contextMenus: [] }; });
  bad('route external', doc => { doc.design.sitemap = { schema: 1, routes: [{ id: 'route-one', surface: doc.design.nodes.find(node => node.kind === 'view').id, path: 'https://invalid' }], journeys: [] }; });
  bad('feature unknown version', doc => { doc.design.features = { schema: 2, items: [] }; });
  bad('storymap unknown key', doc => { doc.design.storymaps = { schema: 1, nextId: 1, maps: [], eval: true }; });
  bad('design system malformed color', doc => { doc.design.designSystem.colors[0].light = 'red;body{}'; });
  bad('duplicate stable surface', doc => { doc.design.nodes.push(structuredClone(doc.design.nodes[0])); }, false);
  bad('missing parent', doc => { doc.design.nodes[0].parent = 'nonexistent'; }, false);
  bad('foreign visual owner', doc => { doc.design.visualDesigns.pages[0].ownerId = 'nonexistent'; }, false);
  bad('unresolved route reference', doc => { doc.design.sitemap = { schema: 1, routes: [{ id: 'route-one', surface: 'missing', path: '/valid' }], journeys: [] }; }, false);
  return { schema: companionProjectSchema(), positive, negative };
}
