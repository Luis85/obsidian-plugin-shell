// Companion self-description: editable authoring data, never native completion evidence.
const CP_PAGE_CONTENT = {
  overview: ['Project overview', 'Choose the next authoring or delivery step.', 'list', ['Project identity', 'Design questions', 'Recent authoring changes'], 'Open product requirements', 'requirements'],
  requirements: ['Product requirements', 'Connect product intent to verifiable acceptance and designed surfaces.', 'table', ['Requirement', 'Priority', 'Acceptance'], 'Open storymaps', 'storymaps'],
  storymaps: ['Storymaps', 'Find a journey and inspect its activities, stories and releases.', 'table', ['Storymap', 'Outcome', 'Status'], 'Open storymap', 'storymap-detail'],
  'storymap-detail': ['Storymap editor', 'Arrange activities and steps; slice stories by release without losing requirement links.', 'tabs', ['Map', 'Outline', 'Review'], 'Design linked page', 'page-editor'],
  sitemap: ['Sitemap & views', 'Define native containers, pages, modals, settings and navigation.', 'tabs', ['Map', 'Outline', 'Review'], 'Open page designs', 'pages'],
  pages: ['Pages', 'Search existing sitemap surfaces and continue their detailed composition.', 'table', ['Surface', 'Kind', 'Detail design'], 'Open page editor', 'page-editor'],
  'page-editor': ['Page editor', 'Compose regions, instances and local slot content; review responsive states and UI effects.', 'tabs', ['Canvas', 'Outline', 'Preview', 'Review'], 'Open component library', 'components'],
  'component-editor': ['Component editor', 'Design reusable internals, public properties and named slots. Publish immutable revisions deliberately.', 'tabs', ['Canvas', 'Outline', 'Preview', 'Review'], 'Inspect component contracts', 'components'],
  entities: ['Entity relationships', 'Specify entity properties and relationships before generating storage contracts.', 'table', ['Entity', 'Property', 'Type'], 'Configure data sources', 'sources'],
  sources: ['Data Sources', 'Define operations, result contracts and simulation boundaries.', 'table', ['Source', 'Operation', 'Mode'], 'Prepare test data', 'test-data'],
  'test-data': ['Test data', 'Author deterministic fixtures and review owned output before generation.', 'table', ['Recipe', 'Seed', 'Record count'], 'Review source contracts', 'sources'],
  'design-system': ['Design System', 'Declare typography, spacing, colors and component-facing tokens for both themes.', 'table', ['Token', 'Value', 'Usage'], 'Inspect component designs', 'components'],
  components: ['Component library', 'Find public contracts, inspect reusable internals and review their consumers.', 'table', ['Component', 'Version', 'Usage'], 'Design selected component', 'component-editor'],
  blueprints: ['Blueprints', 'Choose a starting outline without silently replacing the current design.', 'list', ['Blank plugin', 'Record workspace', 'Dashboard and details'], 'Review sitemap', 'sitemap'],
  patterns: ['Action patterns', 'Inspect command and navigation patterns before applying them to a surface.', 'list', ['Review before replace', 'Save with recovery', 'Open existing detail'], 'Inspect sitemap', 'sitemap'],
  prepare: ['Prepare project', 'Review identity, paths, permissions and the portable project handoff.', 'table', ['Prerequisite', 'Current value', 'Action'], 'Open generator', 'generate'],
  generate: ['Generate project', 'Review the exact generation plan before approving file writes.', 'table', ['File', 'Operation', 'Ownership'], 'Continue development', 'develop'],
  develop: ['Development', 'Work through implementation points with the generated services, stores and tests.', 'list', ['Implement business behavior', 'Run focused tests', 'Review source ownership'], 'Inspect quality', 'quality'],
  quality: ['Quality', 'Review actual verification evidence without confusing authored acceptance with passing tests.', 'table', ['Check', 'Scope', 'Observed result'], 'Review capabilities', 'capabilities'],
  capabilities: ['Capabilities', 'Inspect supported shell features and their explicit qualification boundaries.', 'table', ['Capability', 'Available adapter', 'Qualification'], 'Review release readiness', 'release'],
  release: ['Release', 'Inspect retained candidate evidence before explicit release operations.', 'table', ['Gate', 'Evidence', 'Decision'], 'Inspect execution history', 'runs'],
  runs: ['Execution history', 'Inspect actual run scope and retained errors. Do not infer success from configuration.', 'table', ['Run', 'Scope', 'Result'], 'Return to overview', 'overview'],
  preferences: ['Preferences', 'Configure project-relative source and test folders without moving existing files.', 'form', ['Codebase folder', 'Tests folder'], 'Review project preparation', 'prepare'],
  'import-project': ['Import project JSON', 'Validate and review a local project before explicit replacement.', 'textarea', ['Project JSON'], 'Review imported project', 'overview'],
  'export-project': ['Export project JSON', 'Export the complete saved design while excluding transient approvals and drafts.', 'list', ['Portable authoring data', 'Referenced immutable revisions', 'Fixture scenarios'], 'Review project handoff', 'shell-handoff'],
  'shell-handoff': ['Shell handoff', 'Copy a reviewed CLI invocation; JSON is data and never execution authority.', 'textarea', ['CLI invocation'], 'Open project preparation', 'prepare']
};
function cpCompleteSelfProject(d, surfaces) {
  const store = cpUpgradeStore(d.detailDesigns); d.schema = 4;
  const add = (doc, kind, label, parent = null, text = '') => {
    const n = dtNewNode(store, kind, parent?.id || null); n.label = label; n.text = text; n.size = { width: kind === 'region' ? 740 : 300, height: kind === 'table' ? 180 : 90 };
    n.ui = compositionDefaultUI(); n.ui.padding = ['region', 'component'].includes(kind) ? 16 : 0;
    if (kind === 'region') n.ui.tokens.gap = 'md';
    if (kind === 'heading') n.ui.tokens.typography = 'section-title';
    n.a11y = ['input', 'textarea', 'number', 'checkbox', 'select'].includes(kind) ? 'Visible label; preserve entered values and show field-specific validation.' : '';
    doc.nodes.push(n); return n;
  };
  const effect = (doc, source, target, type, value, label, event = 'click') => {
    const e = { id: dtNext(store, 'edge'), source: source.id, target: target.id, event, label, notes: 'Local UI effect only; no business or source write is implied.', acceptance: '', targetSurfaceId: null, effect: { type, value } }; doc.edges.push(e); return e;
  };
  const scenario = (doc, name, values = {}, state = 'default', width = 'wide', bindings = []) => ({ id: 'scenario-' + store.nextId++, name, state, width, values, bindings });
  for (const c of d.library) {
    let doc = dtFind(store, 'component', c.id);
    if (doc) { for (const n of doc.nodes) n.ui = compositionDefaultUI(); continue; }
    doc = dtNewDocument(store, 'component', c); doc.notes = c.description || 'Reusable ' + c.name + ' with an explicit public contract and consumer-owned slots.';
    const root = add(doc, 'region', c.name + ' internals'); const title = add(doc, 'heading', 'Title', root, c.name);
    if (parseMembers(c.props, 'props').some(p => p.name === 'title')) title.contentProp = 'title';
    const id = c.id;
    let kind = /table|permissions|review-findings|requirements-panel/.test(id) ? 'table' : /form|property|capture|source-operation|contract-panel|token-editor/.test(id) ? 'input' : /tab-strip/.test(id) ? 'tabs' : /filter|search|newsletter/.test(id) ? 'input' : /list|board|timeline|conversation|navigation|sidebar|workflow-rail/.test(id) ? 'list' : /notice|empty|progress/.test(id) ? 'alert' : /media|image|gallery/.test(id) ? 'image' : /code-editor/.test(id) ? 'textarea' : 'text';
    const body = add(doc, kind, /filter|search/.test(id) ? 'Search query' : c.name + ' content', root, c.description || 'Content supplied by the owning page.');
    if (['list', 'table', 'tabs'].includes(kind)) body.options = kind === 'table' ? ['Name', 'Status'] : kind === 'tabs' ? ['Overview', 'Details', 'Activity'] : ['Primary content', 'Context and supporting information'];
    if (parseMembers(c.props, 'props').some(p => p.name === 'message')) body.contentProp = 'message';
    for (const name of c.slots.split(/[\n,]/).map(s => s.trim()).filter(Boolean)) add(doc, 'slot', name, root, 'Consumer content: ' + name);
    const action = add(doc, 'button', 'Show feedback state', root, 'Preview feedback'); effect(doc, action, body, 'state', 'error', 'Show local error state');
    const values = kind === 'table' ? { [body.id]: [{ Name: c.name, Status: 'Fixture only' }, { Name: 'Secondary record', Status: 'Needs review' }] } : {};
    doc.scenarios = [scenario(doc, 'Default example', values), scenario(doc, 'Narrow example', values, 'default', 'narrow'), scenario(doc, 'Error feedback', values, 'error')];
  }
  for (const surface of d.nodes.filter(dtPageEligible)) {
    let doc = dtFind(store, 'page', surface.id);
    if (doc) { for (const n of doc.nodes) n.ui = compositionDefaultUI(); continue; }
    const config = CP_PAGE_CONTENT[surface.slug] || [surface.label, surface.goal || 'Review this surface.', 'list', ['Primary content'], 'Return to overview', 'overview'];
    doc = dtNewDocument(store, 'page', surface); doc.notes = config[1];
    const root = add(doc, 'region', config[0] + ' layout'), heading = add(doc, 'heading', config[0], root, config[0]);
    heading.ui.tokens.typography = 'page-title'; add(doc, 'text', 'Purpose', root, config[1]);
    const search = add(doc, 'input', 'Find within ' + config[0].toLowerCase(), root, 'Search saved authoring data');
    let body;
    if (config[2] === 'form') {
      body = add(doc, 'input', 'Codebase folder', root, 'src'); add(doc, 'input', 'Tests folder', root, 'tests');
    } else { body = add(doc, config[2], config[0] + ' content', root, config[2] === 'textarea' ? 'Authored content or reviewed handoff text' : 'No fixture records yet.'); if (['table', 'tabs', 'list'].includes(config[2])) body.options = config[3]; }
    const values = config[2] === 'table' ? { [body.id]: [Object.fromEntries(config[3].map((key, i) => [key, i === 0 ? config[0] + ' example' : i === 1 ? 'Authored design' : 'Review required']))] } : {};
    const c = d.library.find(c => c.id === ({ 'page-editor': 'diagram-inspector', 'component-editor': 'component-contract-panel', 'design-system': 'design-token-editor', sources: 'source-operation-editor', 'test-data': 'test-operation-panel', requirements: 'requirements-panel', quality: 'review-findings', 'shell-handoff': 'shell-handoff-panel' }[surface.slug] || 'status-notice'));
    if (c) {
      const instance = dtNewNode(store, 'component', root.id, c); instance.label = c.name; instance.props = Object.fromEntries(parseMembers(c.props, 'props').filter(p => ['title', 'message'].includes(p.name)).map(p => [p.name, config[0] + ' context'])); instance.ui = compositionDefaultUI(); instance.size = { width: 500, height: 180 }; doc.nodes.push(instance);
      const slot = c.slots.split(/[\n,]/).map(s => s.trim()).find(Boolean);
      if (slot) { const content = add(doc, 'text', 'Page-owned context', instance, config[1]); content.slotName = slot; }
    }
    const actions = add(doc, 'region', 'Page actions', root); actions.layout = 'row'; actions.ui.padding = 0;
    const next = add(doc, 'button', config[4], actions, config[4]);
    doc.edges.push({ id: dtNext(store, 'edge'), source: next.id, target: body.id, event: 'click', label: config[4], notes: 'Open the existing target surface; do not create a copy.', acceptance: '', targetSurfaceId: surfaces[config[5]]?.id || surfaces.overview.id });
    const focus = add(doc, 'button', 'Focus search', actions, 'Find content'); effect(doc, focus, search, 'focus', '', 'Focus the search field');
    const feedback = add(doc, 'alert', 'Recoverable error', root, 'This operation did not complete. Your saved design is unchanged.'); feedback.visibleIn = ['error'];
    const retry = add(doc, 'button', 'Reset preview state', root, 'Return to default state'); effect(doc, retry, body, 'state', 'default', 'Reset local preview state');
    doc.scenarios = [scenario(doc, 'Default example', values), scenario(doc, 'Narrow example', values, 'default', 'narrow'), scenario(doc, 'Recoverable error', values, 'error')];
  }
  // Preserve the original three designs and their business intent; add concrete fixtures.
  for (const doc of store.documents) {
    if (!doc.scenarios) {
      const table = doc.nodes.find(n => n.binding); if (table) { table.kind = 'table'; table.options = ['name', 'version']; table.binding=null; }
      const values=table?{[table.id]:[{name:'ProjectJsonReview',version:'1.0.0'}]}:{};
      doc.scenarios = [scenario(doc, 'Default example', values), scenario(doc, 'Error feedback', values, 'error', 'narrow')];
    }
    cpArrange(doc);
  }
  const requirements=dtFind(store,'page',surfaces.requirements.id),table=requirements.nodes.find(n=>n.kind==='table');
  const manifest=tdManifest(d),generated=createFixtureEngine().generate(manifest),output=generated.operations.find(op=>op.slug==='list-requirements');
  if(table&&output){const source=d.dataSources.sources.find(s=>s.operations.some(o=>o.id===output.id));table.binding={sourceId:source.id,operationId:output.id,field:''};table.options=['title','priority','status'];for(const fixture of requirements.scenarios){delete fixture.values[table.id];fixture.bindings=[{sourceId:source.id,operationId:output.id,value:output.outputValue}];}}
  // All reusable internals exist before freezing dependency closures.
  for (const c of d.library) cpPublish(store, c.id, d);
  for (const doc of store.documents) for (const n of doc.nodes) if (n.component) {
    const revision = [...store.revisions].reverse().find(r => r.ownerId === n.component.id); if (revision) { n.component.revisionId = revision.id; n.component.version = revision.version; }
  }
  validateDetailDesigns(store);
}
