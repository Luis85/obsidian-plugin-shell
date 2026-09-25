// The companion described with the same project model as a user's plugin.
// This is an editable design seed, never a second active project or hidden runtime.
function companionExampleProject() {
  const p = newPlanningProject({ id: 'plugin-companion', name: 'Plugin Companion', author: 'Luis Mendez',
    version: '0.1.0', description: 'Design one Obsidian plugin in its vault, describe its contracts and export a reviewed project to the independent shell.' });
  p.folders = { ...COMPANION_DEFAULT_FOLDERS };
  const d = p.design;
  d.blueprint = 'workspace';
  d.goal = 'Help developers turn a plugin idea into a consistent, reviewable design and portable handoff without requiring build tools during discovery.';
  const surfaces = {};
  function surface(key, label, layout, goal, kind = 'page') {
    const node = { id: 'node-' + d.nextId++, slug: key, label, kind, layout, placement: 'tab',
      parent: kind === 'page' ? surfaces.workbench.id : null, nav: kind === 'page', command: kind === 'view' || kind === 'modal',
      ribbon: kind === 'view', entry: kind === 'view', instance: 'reuse', patterns: kind === 'view' ? ['open-view'] : kind === 'settings' ? ['settings'] : [],
      goal, entity: '', intent: goal, goals: [goal], components: [], bricks: [] };
    d.nodes.push(node); surfaces[key] = node;
    if (kind !== 'settings') {
      const block = { schema: 1, id: 'brick-' + d.nextId++, kind: 'heading', title: label, purpose: goal,
        content: goal, region: 'content', component: null };
      attachBrickDefinition(block, brickDefinition(d, 'heading')); node.bricks.push(block);
      node.components.push({ id: 'status-notice', version: '1.0.0', slot: 'content' });
    }
    return node;
  }
  surface('workbench', 'Companion workbench', 'sidebar-left', 'Open the one-vault workspace and retain the selected design context.', 'view');
  const screens = [
    ['overview', 'Project overview', 'dashboard', 'Understand the next useful action, review blockers and advisory findings.'],
    ['requirements', 'Product requirements', 'list-detail', 'Describe outcomes and verifiable acceptance criteria, then map them to screens and components.'],
    ['storymaps', 'Storymaps overview', 'list-detail', 'Find, create, link and archive the project’s storymaps.'],
    ['storymap-detail', 'Storymap editor', 'canvas', 'Plan activities, steps, stories and outcome-oriented releases; connect existing sitemap items.'],
    ['sitemap', 'Sitemap & views', 'canvas', 'Arrange native containers and internal screens; keep containment, navigation and data flows distinct.'],
    ['pages', 'Pages overview', 'list-detail', 'Browse content-bearing surfaces and open their detailed composition without copying the sitemap.'],
    ['page-editor', 'Page editor', 'canvas', 'Compose regions, content, reusable instances, bindings, states and interaction contracts using Vue Flow.'],
    ['component-editor', 'Component editor', 'canvas', 'Design reusable internals while keeping page-instance overrides separate from the definition.'],
    ['entities', 'Entity relationships', 'canvas', 'Declare note-backed entities, properties and cardinalities with non-drag editing alternatives.'],
    ['sources', 'Data Sources', 'list-detail', 'Describe vault, API and database ports, operations and payloads without contacting live services.'],
    ['test-data', 'Test Data', 'list-detail', 'Configure seeded recipes, try isolated operations and export reviewed test tooling.'],
    ['design-system', 'Design System', 'list-detail', 'Edit fonts, typography, spacing, sizes, radii, colors and guidance; export Markdown or HTML.'],
    ['components', 'Component library', 'list-detail', 'Describe reusable component contracts, content and named variants; review pinned upgrades.'],
    ['blueprints', 'Blueprints', 'dashboard', 'Choose a layout starting point while retaining ownership of the current design.'],
    ['patterns', 'Action patterns', 'list-detail', 'Attach established actions to shared application behavior with accessible entry points.'],
    ['prepare', 'Prepare project', 'wizard', 'Review additive template preparation, trust and an isolated test vault before any native execution.'],
    ['generate', 'Generate a feature', 'form', 'Preview independent shell makers without equating scaffolding with implementation.'],
    ['develop', 'Development', 'dashboard', 'Keep source, built and installed revisions distinct through the first development loop.'],
    ['quality', 'Quality & verification', 'dashboard', 'Inspect scoped and revision-bound evidence; simulation does not qualify the native plugin.'],
    ['capabilities', 'Shell capabilities', 'list-detail', 'Discover CLI commands and shared shell services without requiring the companion.'],
    ['release', 'Release readiness', 'dashboard', 'Inspect publication prerequisites only after shell and native qualification.'],
    ['runs', 'Runs & recovery', 'list-detail', 'Inspect bounded execution history and preserve private recovery copies before reset.'],
  ];
  for (const args of screens) surface(...args);
  surface('preferences', 'Workbench preferences', 'form', 'Configure codebase and tests folders, appearance, import/export and explicit recovery.', 'settings');
  surface('import-project', 'Import project JSON', 'form', 'Validate and review a full project, then explicitly replace the current authoring project.', 'modal');
  surface('export-project', 'Export project JSON', 'form', 'Export all saved design data and folder settings without machine trust or execution receipts.', 'modal');
  surface('shell-handoff', 'Shell JSON handoff', 'form', 'Pass the export and a vault-relative target to the shell; version one returns JSON and writes nothing.', 'modal');
  function link(from, to, label) {
    d.links.push({ id: 'edge-' + d.nextId++, from: surfaces[from].id, to: surfaces[to].id, label,
      kind: surfaces[to].kind === 'modal' ? 'open' : 'navigate' });
  }
  for (const [from, to, label] of [
    ['requirements', 'storymaps', 'Browse linked storymaps'], ['storymaps', 'storymap-detail', 'Open a storymap'], ['requirements', 'storymap-detail', 'Open linked map'], ['storymap-detail', 'sitemap', 'Locate a linked surface'],
    ['sitemap', 'page-editor', 'Design surface details'], ['storymap-detail', 'page-editor', 'Design linked page'], ['pages', 'page-editor', 'Open page design'], ['components', 'component-editor', 'Design reusable internals'], ['page-editor', 'component-editor', 'Edit instance definition'],
    ['overview', 'requirements', 'Define the outcome'], ['requirements', 'sitemap', 'Shape the experience'],
    ['sitemap', 'entities', 'Describe meaning'], ['entities', 'sources', 'Bind a source contract'],
    ['sources', 'test-data', 'Try a source operation'], ['components', 'sitemap', 'Place a component'],
    ['design-system', 'components', 'Review component guidance'], ['overview', 'import-project', 'Import a project'],
    ['overview', 'export-project', 'Export the full project'], ['prepare', 'shell-handoff', 'Review CLI handoff'],
    ['shell-handoff', 'export-project', 'Save project JSON'], ['prepare', 'develop', 'Continue after preparation'],
    ['develop', 'quality', 'Inspect current evidence'], ['quality', 'release', 'Review publication gates'],
  ]) link(from, to, label);
  companionExampleComponents(d, surfaces);
  companionExampleRequirements(d, surfaces);
  companionExampleEntities(d, surfaces);
  companionExampleStorymaps(d, surfaces);
  companionExampleDetails(d, surfaces);
  d.designSystem = sgStarter(); d.designSystem.name = 'Companion workbench design system';
  d.designSystem.description = 'Host-friendly design declarations for the companion. Tokens are authored intent, not automatic component styling.';
  d.canvas = emptyCanvas();
  p.notes = ['# Companion implementation boundary\n\nShell qualification precedes native companion conversion. Publication is last. The first project-handoff script validates and returns JSON only; no boilerplate is generated by that script yet.\n'];
  return p;
}
function companionExampleRequirements(d, surfaces) {
  const groups = [
    ['Product & workspace', 'A plugin idea, its requirements and its implementation context are otherwise scattered across tools.', [
      ['One vault owns one project', 'overview', 'Opening this workspace exposes one project; loading another definition requires review and never adds a second active project.'],
      ['Capture requirements and acceptance', 'requirements', 'Create, revise, map and export PRDs with testable requirements, priorities and retained review baselines.'],
      ['Author screens and transitions', 'sitemap', 'Edit screens, containers, content sections and transitions with keyboard and pointer controls, Undo and Redo.'],
      ['Declare domain relationships', 'entities', 'Define properties and explicit cardinalities while keeping diagram arrangement separate from persistence semantics.'],
      ['Use reusable components', 'components', 'Place pinned component versions and variants with local content; preview and deliberately apply upgrades.'],
      ['Select blueprints and patterns', 'blueprints', 'Use a reviewed starter and shared action patterns without overwriting an existing design silently.'],
    ]],
    ['Data & visual contracts', 'Developers need explicit data and visual contracts before implementation can be safely generated.', [
      ['Describe every source port', 'sources', 'Vault, API and database declarations include operations and explicit input/output shapes; credentials remain symbolic.'],
      ['Reuse source operations', 'sitemap', 'A screen references a declared source operation through a named directional data flow, not a duplicate source definition.'],
      ['Generate deterministic test data', 'test-data', 'Equal seed, schema and fixed reference date yield equal fixtures. No operation contacts a live source as fallback.'],
      ['Exercise isolated operations', 'test-data', 'Run and cancel a simulation, retain focus and distinguish status announcements from result payloads.'],
      ['Export isolated test tooling', 'test-data', 'Export fixtures and adapters with a read-only plan and explicit ownership checks before applying or cleaning files.'],
      ['Author the design system', 'design-system', 'Persist font declarations, typography, sizes, spacing, radii, paired colors and usage guidance.'],
      ['Export a readable design guide', 'design-system', 'Markdown and offline HTML contain all saved declarations and disclose unevaluated contrast pairs.'],
    ]],
    ['Project JSON & shell handoff', 'A developer needs one complete portable definition that both the design tool and shell can read.', [
      ['Describe the companion itself', 'overview', 'The bundled companion project uses the same editable model, screens, requirements, entities, sources and design system as user projects.'],
      ['Export the complete saved project', 'export-project', 'The versioned JSON preserves identity, folder settings, PRDs, screen content, variants, arrangements, entities, source operations, test recipes, tokens and notes.'],
      ['Import a full project safely', 'import-project', 'File and pasted JSON are bounded and validated before review; invalid input, cancelled review or stale state leaves the project unchanged.'],
      ['Configure project folders', 'preferences', 'Codebase defaults to src and tests to tests. Valid custom folders persist and survive a JSON round trip; invalid or overlapping paths are rejected.'],
      ['Accept JSON at the shell boundary', 'shell-handoff', 'The v1 script accepts the export and a target inside an explicitly selected vault, prints original JSON bytes, and performs zero filesystem writes.'],
      ['Keep generation a separate stage', 'prepare', 'Full boilerplate generation requires a future reviewed compiler and apply plan; version one never claims to have generated source.'],
    ]],
    ['Storymaps & scope planning', 'A flat set of requirements loses the user experience and the intended scope of a useful release.', [
      ['Create and open storymaps from either entry point', 'storymaps', 'Navigation and linked PRD details open the same map; returning retains the originating context.'],
      ['Plan structured user experiences', 'storymap-detail', 'Activities, steps and stories keep semantic order across drag, form moves and shared Undo/Redo.'],
      ['Connect without copying artifacts', 'storymap-detail', 'Items link existing sitemap identities and requirements. Missing targets remain explicit; linked artifacts are never deleted.'],
      ['Plan outcome-oriented release slices', 'storymap-detail', 'Move stories between releases or Unplanned. Removing a release preserves its stories.'],
      ['Transfer storymaps without data loss', 'storymaps', 'Versioned project JSON preserves IDs, order, content, releases and references. Legacy projects are accepted without inventing stories.'],
    ]],
    ['Safety & qualification', 'A convincing prototype must not imply that simulated execution or stored data is native evidence.', [
      ['Preserve drafts and keyboard context', 'preferences', 'Closing dirty forms asks for confirmation; modal feedback is visible and focus returns to a meaningful control.'],
      ['Protect recovery copies', 'runs', 'A stale window cannot reset newer retained state; current and retained data can be exported separately before reload.'],
      ['Keep test-vault boundaries', 'prepare', 'Authoring files, host configuration and test-target data are preserved; no silent path migration or plugin activation.'],
      ['Keep verification scopes separate', 'quality', 'Build, browser, native and security evidence have explicit scope and revision. Import never grants trust or carries simulated passes forward.'],
      ['Teach the complete workflow', 'overview', 'A dismissible and resumable guided tour covers all main design, test and preparation stages.'],
      ['Publish only after native acceptance', 'release', 'Shell qualification comes first, then native companion conversion and acceptance, then publication. No design action publishes.'],
    ]],
  ];
  d.prds = groups.map(([title, problem, rows], index) => ({ id: 'prd-' + (index + 1), title, version: '0.1.0', status: 'draft',
    problem, audience: 'Obsidian plugin developers, product owners and designers.', goals: rows.map(row => row[0]).join('\n'),
    nonGoals: 'No native conversion, live service access or release authorization from the browser concept.', notes: 'Design specification, not implementation evidence.',
    revision: 1, nextReq: rows.length + 1, baselines: [], requirements: rows.map(([name, key, acceptance], i) => ({
      id: 'companion-' + (index + 1) + '-' + (i + 1), title: name, priority: 'must', status: 'designed', kind: 'functional', acceptance,
      nodes: [surfaces[key].id], components: key === 'preferences' ? [] : ['status-notice'], patterns: [] })) }));
}
function companionExampleEntities(d, surfaces) {
  const m = emptySemantic(), entities = {};
  const definitions = [
    ['plugin-project', 'Plugin Project', ['plugin_id', 'title', 'description', 'codebase_folder', 'tests_folder']],
    ['requirement', 'Requirement', ['title', 'acceptance', 'priority', 'status']],
    ['screen', 'Screen', ['title', 'code_name', 'layout', 'surface_kind']],
    ['component', 'Component', ['title', 'version', 'content', 'accessibility']],
    ['entity-definition', 'Entity Definition', ['title', 'code_name', 'note_folder', 'description']],
    ['data-source', 'Data Source', ['title', 'source_kind', 'locator', 'credential_ref']],
    ['source-operation', 'Source Operation', ['title', 'direction', 'input_shape', 'output_shape']],
    ['test-recipe', 'Test Recipe', ['title', 'scenario', 'dataset']],
    ['storymap', 'Storymap', ['title', 'purpose', 'audience', 'status']],
    ['storymap-item', 'Storymap Item', ['title', 'item_kind', 'description', 'acceptance']],
    ['design-token', 'Design Token', ['title', 'token_group', 'value', 'usage']],
  ];
  for (const [slug, name, keys] of definitions) {
    const entity = { id: semanticId(m, 'entity'), slug, name, folder: 'Companion/' + semanticPascal(slug),
      description: 'Authoring contract for ' + name.toLowerCase() + '; not an existing native repository.', section: null,
      properties: keys.map(key => ({ id: semanticId(m, 'property'), key, type: 'text', required: key === 'title' })) };
    m.entities.push(entity); entities[slug] = entity;
  }
  for (const [source, target, key, many] of [['requirement', 'plugin-project', 'project_ref', false],
    ['screen', 'plugin-project', 'project_ref', false], ['requirement', 'screen', 'screen_refs', true],
    ['screen', 'component', 'component_refs', true], ['source-operation', 'data-source', 'source_ref', false],
    ['test-recipe', 'source-operation', 'operation_ref', false], ['design-token', 'plugin-project', 'project_ref', false]]) {
    m.relationships.push({ id: semanticId(m, 'relationship'), name: source + ' → ' + target, source: entities[source].id,
      target: entities[target].id, key, sourceCard: '0..*', targetCard: many ? '0..*' : '0..1', onDelete: 'restrict' });
  }
  semanticArrange(m); d.semantic = m;
  for (const [key, entity] of [['overview', 'plugin-project'], ['requirements', 'requirement'], ['sitemap', 'screen'],
    ['components', 'component'], ['entities', 'entity-definition'], ['sources', 'data-source'], ['test-data', 'test-recipe'], ['design-system', 'design-token'], ['storymaps', 'storymap'], ['storymap-detail', 'storymap-item']]) surfaces[key].entity = entities[entity].id;
  const sources = emptyDataSources(); d.dataSources = sources;
  const source = { id: dsNext(sources, 'source'), slug: 'authoring-vault', name: 'Companion authoring vault', kind: 'vault', status: 'active',
    description: 'Proposed native adapter over project authoring notes. The HTML only declares this port.', locator: 'vault://active', auth: 'none', credentialRef: '', operations: [] };
  sources.sources.push(source); sources.positions[source.id] = { x: 900, y: 80 };
  sources.testing = { ...tdDefaults(), count: 5 };
  for (const [key, entity] of [['requirements', 'requirement'], ['sitemap', 'screen'], ['components', 'component']]) {
    const op = { id: dsNext(sources, 'operation'), slug: 'list-' + key, name: 'List ' + key, direction: 'read', method: 'adapter',
      resource: entities[entity].folder, description: 'Read the declared authoring records through the vault port.',
      input: dsNewShape('none'), output: { ...dsNewShape('entity'), entity: entities[entity].id, many: true } };
    source.operations.push(op);
    sources.flows.push({ id: dsNext(sources, 'flow'), source: source.id, operation: op.id, card: surfaces[key].id,
      direction: 'read', label: 'Load ' + key, trigger: 'on-open', notes: 'Declared native interaction. No live vault access in this prototype.' });
    sources.testing.recipes.push({ source: source.id, operation: op.id, enabled: true, behavior: 'list', dataset: entity,
      keyField: 'id', scenario: 'populated', latencyMs: 0, errorStatus: 503, rules: [] });
  }
}

function companionExampleComponents(d, surfaces) {
  const definitions = [
    ['workflow-rail', 'WorkflowRail', 'navigation', ['workbench'], 'Move between Define, Structure, Compose, Review and Prepare without losing context.'],
    ['review-findings', 'ReviewFindings', 'detail', ['overview', 'quality'], 'Show blocking and advisory totals with repair links to the owning editor.'],
    ['requirements-panel', 'RequirementsPanel', 'table', ['requirements'], 'Capture requirements, acceptance, priority and screen/component traceability.'],
    ['diagram-inspector', 'DiagramInspector', 'form', ['sitemap', 'entities'], 'Edit selected objects and relationships with precise controls and non-drag alternatives.'],
    ['source-operation-editor', 'SourceOperationEditor', 'form', ['sources'], 'Describe operations and payloads; never collect live credentials.'],
    ['test-operation-panel', 'TestOperationPanel', 'form', ['test-data'], 'Select an operation, run or cancel it, and separate live status from JSON results.'],
    ['design-token-editor', 'DesignTokenEditor', 'form', ['design-system'], 'Edit grouped visual tokens with scoped previews and coverage disclosure.'],
    ['component-contract-panel', 'ComponentContractPanel', 'detail', ['components'], 'Edit props, events, slots, variants and reusable content; review version changes.'],
    ['project-json-review', 'ProjectJsonReview', 'form', ['import-project', 'export-project'], 'Review portable project data and explicitly confirm replacement; preserve a backup first.'],
    ['shell-handoff-panel', 'ShellHandoffPanel', 'detail', ['shell-handoff', 'prepare'], 'Show the export path, target and source/test folder settings; disclose read-only v1 behavior.'],
  ];
  for (const [id, name, kind, keys, description] of definitions) {
    const component = { id, name, category: 'Companion', preview: 'brick', description,
      props: 'title:string\nbusy:boolean', events: 'select:string\ncancel:void', slots: 'content', variants: 'default, compact',
      a11y: 'Named region, visible focus, labelled controls and explicit loading/error/empty feedback.',
      version: '0.1.0', revision: 1, status: 'ready', origin: 'project', replacement: '',
      tokens: '--text-normal\n--background-primary\n--interactive-accent', contentSpec: brickSpec(kind, name, description),
      tags: ['companion', 'authoring'] };
    d.library.push(component);
    for (const key of keys) {
      const node = surfaces[key]; node.components.push({ id, version: component.version, slot: 'content' });
      const brick = { ...brickSpec(kind, name, description), id: 'brick-' + d.nextId++, component: id };
      attachBrickDefinition(brick, component); node.bricks.push(brick);
    }
  }
}
