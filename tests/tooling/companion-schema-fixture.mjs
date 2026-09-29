import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { companionProjectSchema } from '../../scripts/companion/schema/project.mjs';
import { migrateAuthoringDocument, validateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
const root = new URL('../../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
/** Shared inert corpus; an independent Draft 2020-12 implementation also consumes these bytes. */
export function schemaCorpus() {
  const starters = 'docs/concepts/companion/starters/';
  const paths = [
    'docs/concepts/companion/companion-project.json',
    ...readdirSync(fileURLToPath(new URL(starters, root))).filter(name => name.endsWith('.companion.json')).sort().map(name => starters + name),
  ];
  const positive = paths.map(path => ({ name: path, document: migrateAuthoringDocument(read(path)).document }));
  const full = positive[0].document;
  const negative = [];
  const bad = (name, edit, schemaRejects = true) => {
    const document = structuredClone(full); edit(document);
    let rejected = false;
    try { validateAuthoringDocument(document); } catch { rejected = true; }
    if (!rejected) throw new Error('CORPUS_INVALID_NEGATIVE: ' + name);
    negative.push({ name, document, schemaRejects });
  };
  bad('future version', doc => { doc.schemaVersion = 7; });
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
