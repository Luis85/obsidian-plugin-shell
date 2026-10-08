/** Tiny synthetic Companion projects in retired formats (schema 1-5). Current tooling must refuse them, never migrate. History lives in git. */
const identity = { id: 'retired-sample', name: 'Retired sample', author: '', version: '0.1.0', description: '' };
/** A structurally plausible envelope of the given retired version; v3/v4 carry an empty detail store, v5 an empty visual store. */
export function retiredProject(version) {
  if (!Number.isInteger(version) || version < 1 || version > 5) throw new Error('RETIRED_SAMPLE: versions 1-5 only.');
  const design = { schema: version, blueprint: 'workspace', goal: '', platform: 'desktop', nodes: [], links: [], nextId: 1, library: [], prds: [] };
  if (version === 3 || version === 4) design.detailDesigns = { schema: version - 2, nextId: 1, documents: [], ...(version === 4 ? { revisions: [] } : {}) };
  if (version === 5) design.visualDesigns = { schema: 3, nextId: 1, catalog: { id: 'nuxt-ui', version: 1 }, pages: [], components: [], layouts: [], revisions: [] };
  return { kind: 'obsidian-companion-project', schemaVersion: version, executable: false, project: { ...identity },
    settings: { codebaseFolder: 'src', testsFolder: 'tests' }, design, notes: [] };
}
export const retiredProjectText = version => JSON.stringify(retiredProject(version), null, 2) + '\n';
