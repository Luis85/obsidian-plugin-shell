// Deterministic self-project examples exercise pages, internals, bindings and states.
function companionExampleDetails(d, surfaces) {
  const store = emptyDetailDesigns(); d.detailDesigns = store; d.schema = 3;
  function doc(kind, owner, notes) { const value = dtNewDocument(store, kind, owner); value.notes = notes; return value; }
  function node(document, kind, label, parent = null, text = '') {
    const value = dtNewNode(store, kind, parent?.id || null); value.label = label; value.text = text;
    const index = document.nodes.filter(n => n.parentId === value.parentId).length;
    value.position = parent ? { x: 24 + index % 2 * 286, y: 82 + Math.floor(index / 2) * 180 } : { x: 32, y: 24 };
    document.nodes.push(value); return value;
  }
  const c = d.library.find(c => c.id === 'project-json-review');
  const internal = doc('component', c, 'A reusable review panel. The title and busy props are consumer inputs; content is a named slot. This is an authored design, not a tested native component.');
  const root = node(internal, 'region', 'Review panel'); root.size = { width: 660, height: 480 };
  node(internal, 'text', 'Review summary', root, 'Review the project before replacing this workspace.');
  const content = node(internal, 'slot', 'content', root, 'Project identity, counts and validation findings'); content.size.width = 270;
  const confirm = node(internal, 'button', 'Confirm replacement', root, 'Replace project'); confirm.a11y = 'Require explicit confirmation; announce validation or persistence errors without discarding the draft.';
  internal.edges.push({ id: dtNext(store, 'edge'), source: confirm.id, target: content.id, event: 'click', label: 'Confirm reviewed project', notes: 'Only request replacement after validation and explicit confirmation. Emit select to the owning page.', acceptance: 'Given a reviewed project and confirmation\nWhen replacement is requested\nThen the page receives the selection event and retains recoverable errors.', targetSurfaceId: null });
  const page = doc('page', surfaces['import-project'], 'Review a portable project, preserve current work, and confirm replacement. Loading and error states remain visible without executing an imported template.');
  const region = node(page, 'region', 'Import workspace'); region.size = { width: 780, height: 650 };
  const input = node(page, 'input', 'Project JSON file', region, 'Choose a local .json file'); input.a11y = 'Visible label, JSON file hint and inline error description. Keyboard-accessible file selection.';
  const instance = dtNewNode(store, 'component', region.id, c); instance.label = 'Project review'; instance.props = { title: 'Review imported project', busy: false }; instance.position = { x: 322, y: 82 }; instance.size = { width: 350, height: 150 }; page.nodes.push(instance);
  const error = node(page, 'text', 'Import error', region, 'The project could not be loaded. Your existing work is unchanged.'); error.visibleIn = ['error'];
  const loading = node(page, 'text', 'Reading project', region, 'Reading and validating the selected JSON…'); loading.visibleIn = ['loading'];
  page.edges.push({ id: dtNext(store, 'edge'), source: input.id, target: instance.id, event: 'change', label: 'Review selected file', notes: 'Validate a bounded local JSON document before presenting replacement confirmation.', acceptance: 'Given an existing project\nWhen valid JSON is selected\nThen show a review without replacing current data.', targetSurfaceId: null });
  const libraryPage = doc('page', surfaces.components, 'Read component definitions through the declared source port. Open the reusable internals from an instance or library entry.');
  const area = node(libraryPage, 'region', 'Library content'); area.size = { width: 760, height: 380 };
  const list = node(libraryPage, 'text', 'Component results', area, 'Component names, versions, variants and usage');
  const source = d.dataSources.sources[0], operation = source.operations.find(o => o.slug === 'list-components');
  list.binding = { sourceId: source.id, operationId: operation.id, field: '' };
  const open = node(libraryPage, 'button', 'Open component details', area, 'Design internals');
  libraryPage.edges.push({ id: dtNext(store, 'edge'), source: open.id, target: list.id, event: 'click', label: 'Open selected component', notes: 'Resolve the selected reusable definition by its stable ID. Do not duplicate it.', acceptance: '', targetSurfaceId: surfaces['component-editor'].id });
  validateDetailDesigns(store);
}
