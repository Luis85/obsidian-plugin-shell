# Project Starters: research, selection and product requirements

Research date: **25 September 2026**. Scope: the companion concept on PR #5 and the independent Obsidian plugin-shell generator. Research concerns reusable developer starting points, not a collection of cloned community plugins.

## Executive decision

Ship **Start Blank plus eight focused starters**: Command Utility, Quick Capture, Tasks & Projects, Knowledge Collection, Daily Journal, Vault Dashboard, Note Inspector, and Import & Integration. Package every starter as an ordinary version-4 companion project JSON. Keep a small separate catalog for discovery metadata and source integrity. Do not invent a second generator format, embed executable scripts in templates, install dependencies during selection, or turn the gallery into a remote marketplace.

The strongest observed demand signals concern capturing information, structuring it with metadata, finding or querying it, and managing work. These use cases also map well to the shell's existing commands, views, modals, settings, typed entities, source ports, Pinia stores, composition compiler and generated tests. Higher-complexity capabilities such as custom editors, sync engines and authentication should not masquerade as ready-to-use starter functionality.

A **runnable boilerplate** means the generated project can install its locked dependencies, build its manifest/JavaScript/CSS, type-check and execute scaffold tests. It does not mean a note was safely written in Obsidian, an external service was authenticated, a task recurrence engine exists, or a PRD requirement passed acceptance. That distinction must be visible before selection as well as in the generated implementation guide.

## Method and strength of evidence

The research triangulates three primary-source groups: Obsidian's official core/community catalogs for established use cases; maintained product documentation for actual user workflows; and official developer documentation/policies for feasibility and safety. Existing PR #5 compiler and prototype contracts constrain what can honestly be generated today.

Rounded cumulative download counts observed in the official community catalog are useful **directional evidence**, not active-user numbers, market share, developer demand, conversion rates, or a statistically valid ranking of plugin-development intentions. Historical downloads can remain high after maintainers archive a project. We do not claim a survey was conducted, that every listed plugin was installed, or that a statistically exhaustive ecosystem census was performed.

The shortlist prioritizes breadth of reuse, time saved before the first useful implementation, fit with the current generator, minimal dependencies, and understandable remaining work. This is a reasoned product decision informed by evidence, not a measured market-size forecast.

## Demand patterns and competitive precedents

| Pattern | Primary evidence | Implication for a starter |
| --- | --- | --- |
| Repeatable capture and templating | Templater's catalog entry showed approximately 5.7 million cumulative downloads. QuickAdd showed approximately 2.1 million. QuickAdd documents template, capture, macro and multi-choice workflows. [1–3] | A short form, capture dialog, inbox, explicit output contract and cancellation path provide a useful first increment. Avoid shipping a general-purpose script/macro execution engine. |
| Note-backed queries and dashboards | Dataview showed approximately 5 million cumulative downloads. Its documentation centers on metadata indexing and list/table/task/calendar results. Homepage showed approximately 1.3 million. [4–6] | Generate an overview, results and drill-down shell around a read-only port. Do not require Dataview or imply that a query expression is executable merely because it appears in JSON. |
| Work and project organization | The widely used Markdown-backed Kanban catalog entry showed approximately 2.6 million downloads. Tasks documents task searches and source-note updates, including due dates and recurrence. [7–8] | A task/project model, relationship, list and detail editor are broadly reusable. A complete Kanban drag engine, recurrence semantics and source Markdown task rewriting are separate features. |
| Structured-note collections | Dataview and Metadata Menu demonstrate a strong combination of structured properties, collections and typed editing. Metadata Menu's catalog entry showed approximately 344,000 cumulative downloads. [4–5,9] | A generic record/category starter covers research libraries, reading lists, assets and simple CRM without shipping four nearly identical templates. |
| Dated notes and review | Daily notes are a core Obsidian capability. Calendar-oriented plugins demonstrate adjacent journaling, dated-event and habit workflows; Full Calendar's catalog entry showed approximately 464,000 cumulative downloads. [10–11] | Teach dated records and review navigation. Make timezone, duplicate-date, recurrence and external-calendar concerns explicit implementation decisions. Do not call a simple entry list a complete calendar engine. |
| Contextual note assistance | Metadata Menu demonstrates typed metadata access and editing. Official plugin guidance distinguishes editor updates, frontmatter updates and safe vault operations. [9,13–14] | A note-inspection/review shell is valuable, but active-note subscriptions, pane placement and stale-file checks must be designed and tested in the host. |
| Import and integration | Obsidian's official Importer moves information from other formats into the vault. Its customization documentation illustrates title, property and content mapping. [12] | Start with preview, mapping and result surfaces. Use synthetic data and no credentials by default; make parsing and idempotent writes explicit rather than suggesting that a source URL implements an integration. |

Templater's and QuickAdd's breadth is also a caution: their power comes from mature execution models, conventions and integrations, not merely a capture screen. Similarly, the success of Tasks or Kanban does not justify implying that status columns and a task schema amount to a complete task manager. The gallery should advertise **the reusable pattern and generated boundary**, not functional equivalence to these products.

Some referenced community projects disclose archival or maintenance constraints. They remain evidence of historical demand, but not blanket dependency recommendations. Starters use original authoring data and the existing shell, not copied third-party implementations. Review licenses before any future code reuse; a public repository is not a permission-free source of template code. [7,9,11,15]

## Shortlist and intended first implementation

| Starter | Included starting point | Valuable next business increment | Principal risk |
| --- | --- | --- | --- |
| **Start Blank** | Minimal workspace entry and settings surface, design tokens, no sample domain or requirements | Define one user outcome and add its first page | Confusing an empty domain with a project that cannot open |
| **Command Utility** | Text input, preview, command/ribbon/settings entry, local input reset, acceptance TODOs | One transformation with correct editor-selection behavior | Destroying selection or undo history |
| **Quick Capture** | Inbox, capture modal, detail, typed capture-item contract, source port, fixtures | Create or append one validated note safely | Duplicate filenames, unintended writes, lost drafts |
| **Tasks & Projects** | Task list/detail, project overview, task/project relationship and date/status fields | Persist a status change through one well-tested application action | Recurrence/date assumptions and relationship integrity |
| **Knowledge Collection** | Collection, details, capture form, record/category relationship | Create and revise a structured note with field validation | Overly generic fields and unreviewed metadata mutation |
| **Daily Journal** | Today, history, entry detail, dated record and fixtures | Open-or-create today's note under an explicit date policy | Timezones, daylight-saving changes, duplicate-day records |
| **Vault Dashboard** | Overview, results, detail, read-only source port and fixture states | Query a bounded note subset and invalidate its cache correctly | Vault-wide indexing cost and stale results |
| **Note Inspector** | Property display/review, note-record schema and local draft | Follow the active note and safely apply a reviewed property edit | Editing a different note after focus changes |
| **Import & Integration** | Preview, mapping review, result, declared read port, synthetic API fixture | Parse a bounded input and propose an idempotent write plan | Untrusted input, credentials, partial writes and accidental networking |

Command Utility is the smallest focused learning path. Quick Capture is the strongest general-purpose recommendation for developers starting a note-writing feature. Knowledge Collection is the best reusable application-style starting point. Tasks & Projects and Daily Journal are deliberately bounded derivatives, not promises of specialized scheduling engines. Import & Integration is visibly advanced and fixture-first.

All starters retain the same TypeScript/Vue/Pinia/Nuxt UI shell. The catalog should not proliferate variants by frontend framework, deployment platform or optional external plugin. Those choices would fracture maintenance and test coverage before the core developer workflow is proven.

## Valuable candidates intentionally deferred

**Custom Bases views** are a particularly relevant next extension. Obsidian now documents registration of custom Bases view types, data-change callbacks, view configuration and efficient rendering for large result sets. This could support a Kanban, timeline, calendar or specialized collection-view starter. However, that is a distinct native adapter contract. Do not label an ItemView-based collection as a Bases view. Add it when the framework has a real Bases host adapter and native lifecycle/data-update tests. [16]

**CodeMirror/editor extensions**, rich canvas editors and graph tools require specialized interaction, performance, accessibility and lifecycle work. Existing source-code templates help at the wiring level, but the JSON model must first represent the relevant behavior honestly. A visual placeholder is not a usable editor.

**AI, synchronization, OAuth and collaboration** introduce secrets, remote data disclosure, costs, conflict semantics and trust decisions. They are not appropriate defaults for an offline starter catalog. A fixture-only external-source contract gives users a safe design boundary without making those integrations look finished. Obsidian's developer policies emphasize privacy, disclosure and restrictions on telemetry and automatic dependency installation. [15]

**Separate CRM, book tracker, recipe library and asset manager templates** are initially unnecessary duplication. The Knowledge Collection pattern provides the common architecture; later catalog additions should demonstrate a meaningfully different interaction or data contract rather than change labels alone.

## Product and interaction requirements

The gallery must be available before project initialization and remain accessible afterward. Search should operate on names, outcomes and use-case tags; categories must combine with search. A no-results state must offer a clear reset and preserve a direct Start Blank action. Cards must show purpose, scope, difficulty and a preview of actual declared surfaces rather than an unrelated marketing image.

Preview and configuration are non-mutating. Users may change plugin name, portable ID, author, version, description and generated source/test folders. Domain terms and internal design IDs must not be globally string-replaced when the plugin name changes. Each resulting project is a deep copy. Catalog updates must not silently modify an already created project.

The confirmation step must show the actual configured identity, surfaces, requirements, entities, sources and folder settings. It must distinguish generation readiness from a valid authoring draft. Existing projects require explicit replacement confirmation and an option to download the current project first. Merely clicking an export button is not proof that a user retained a backup.

Reuse the existing project's validation, stale-review checks, Project.md ownership guard, active-operation guard, storage-conflict checks and durable-save rollback. No catalog action should bypass them. Unsubmitted form changes need normal discard protection. Editing the JSON after starter review must invalidate the reviewed candidate and the built-in provenance label.

The distinction from existing **Blueprints** must be explicit. Blueprints change a surface outline inside a project. Project Starters create a complete independent project definition, including identity, requirements and contracts, through the replacement boundary. Neither action installs or enables a plugin.

The handoff must show the real compiler's plan/hash/apply workflow. Keep the existing `companion:generate` read-only inspector distinct from `companion:scaffold` / `shell generate`. Generated plugins must be independently buildable. The gallery must never display scaffold tests or designed acceptance statements as passed business outcomes.

## Architectural, safety and native requirements

Use a versioned, bounded, locally packaged catalog. Every catalog entry identifies a checked-in full project JSON and its SHA-256. Assembly and tooling must reject missing/unlisted files, duplicate IDs, path traversal, altered bytes and unsupported versions. Embedded JSON must be escaped so authored text cannot close its script element. No template download, eval, lifecycle hook or imported JavaScript is allowed in the browser selection path.

The shared project validator and compiler remain the authority for project data. Provenance belongs in informational project notes, not execution permissions. Runtime trust, verification receipts, machine paths and active operations never travel from a starter. Source adapters remain explicit implementation points; fixture examples never trigger a live fallback.

Native implementations should follow official APIs: use editor-aware operations for active editing, safe vault read-modify-write patterns for note updates, and frontmatter-specific APIs for metadata. Cleanup must release event subscriptions and UI resources. Avoid default hotkeys and unscoped styles. Desktop-only dependencies must be explicitly guarded and disclosed; a narrow preview is not mobile qualification. [13–15]

A dedicated development vault is an important boundary, not optional marketing text. Official getting-started guidance warns that plugin development can affect notes. Dependency installation, building, development-vault installation, activation and publication remain separate user actions. [17–18]

## Verification and evolution

Require exact assembly/inventory checks, catalog negative tests, all-starter round trips, independent-copy checks, actual configuration/review/export interactions, replacement cancellation and failure proofs, and generator plan/apply/replay tests. Qualify each built-in with a separate generated dependency install, build, type-check and scaffold-test run on the pinned toolchain. Retain per-starter output hashes and logs instead of showing one catalog-wide success badge based solely on JSON validation.

A future template should be admitted only when it has a distinct use case, honest scope, no new hidden execution boundary, stable exported contracts, a complete small happy path through generation, and isolated qualification evidence. Add optional recipes within a known pattern before multiplying entire projects. Community contribution and remote catalog signing can be considered later; they should not precede the local format, ownership model and test discipline.

## Primary sources

1. Templater, official community entry: https://community.obsidian.md/plugins/templater-obsidian
2. QuickAdd, official community entry: https://community.obsidian.md/plugins/quickadd
3. QuickAdd documentation: https://quickadd.obsidian.guide/docs/ and https://quickadd.obsidian.guide/docs/Choices/CaptureChoice
4. Dataview, official community entry: https://community.obsidian.md/plugins/dataview
5. Dataview documentation: https://blacksmithgu.github.io/obsidian-dataview/
6. Homepage, official community entry: https://community.obsidian.md/plugins/homepage
7. Kanban, official community entry: https://community.obsidian.md/plugins/obsidian-kanban
8. Tasks documentation: https://publish.obsidian.md/tasks/
9. Metadata Menu, official community entry: https://community.obsidian.md/plugins/metadata-menu
10. Obsidian core plugins: https://obsidian.md/help/plugins
11. Full Calendar, official community entry: https://community.obsidian.md/plugins/obsidian-full-calendar
12. Obsidian Importer: https://obsidian.md/help/plugins/importer
13. Obsidian Vault API guide: https://docs.obsidian.md/Plugins/Vault
14. Obsidian plugin guidelines: https://docs.obsidian.md/oo/plugin
15. Obsidian developer policies: https://docs.obsidian.md/community-directory/developer-policies
16. Obsidian custom Bases views: https://docs.obsidian.md/plugins/guides/bases-view
17. Obsidian Build a plugin guide: https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin
18. Official sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin

Catalog counts above are a dated observation; consult the linked live entries for changed counts or maintenance status. Scope and qualification results are documented separately in PROJECT-STARTERS.md and the retained test evidence.
