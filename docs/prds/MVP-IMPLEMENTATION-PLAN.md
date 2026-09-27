# MVP implementation plan: JSON to clickdummy

| Field | Value |
| --- | --- |
| Status | Planned; no work package is marked implemented by this document |
| Date | 2026-09-27 |
| Parent PR | #5, `docs/companion-plugin-prd` |
| Inspected baseline | `6178b1025336941ad6fb10eae4e26930622363f9` |
| Product contract | [MVP PRD](MVP-JSON-TO-CLICKDUMMY.md) |

## 1. Delivery sequence

**Preserve the requested sequence: integrate the sitemap editor into the companion concept → update the shared model and complete companion JSON → import/edit/export that JSON in the companion → generate the complete companion plugin and offline clickdummy from those exact bytes.** Finish the released-kit setup, scoped/concept generation and release journey against that foundation.

Do not begin with another standalone mockup, a parallel companion, a wholesale framework rewrite, or a generated scaffold presented as the finished product. Existing shell qualification must pass before native companion acceptance and publication. Prototype integration can happen first without claiming native readiness.

| Milestone | Packages | Exit evidence |
| --- | --- | --- |
| M1: Journey Lens in the companion concept | WP-01, WP-02 | Integrated editor using existing entities, tested interactions and retained source provenance |
| M2: One model and self-project | WP-03, WP-04 | Versioned contracts/migrations and full imported/exported self-project equality |
| M3: JSON produces real outputs | WP-05, WP-06, WP-07 | Offline clickdummy, scoped generation and complete native companion generated without manual repair |
| M4: First-download-to-release workflow | WP-08, WP-09 | Extracted-kit setup, optional GitHub, prepared candidate and authorized publication integration evidence |
| M5: Merge and shipment qualification | WP-10 | Exact candidate acceptance; after approval, merged-source publication and downloaded-asset smoke |

Contract tests are written before behavior in each package. Add failing behavioral tests for every identified gap; generated TODO files are backlog, not completed tests. Work may be parallelized after contracts stabilize, but the above product acceptance order remains.

## 2. Baseline, ownership and constraints

Read the current [repository rules](../../AGENTS.md), [CLI](../development/FRAMEWORK-CLI.md), [project contract](../development/COMPANION-PROJECT-JSON.md), [generator](../development/COMPANION-GENERATOR.md), [visual editors](../concepts/companion/VISUAL-EDITORS.md), [architecture](../architecture/COMPANION-ON-SHELL.md) and [release contract](../development/RELEASE-EXECUTION.md). Recheck PR #5's head at implementation start. The inspected transfer is v5, not the older v4 described in parts of the PR body.

Assign accountable owners by responsibility: product/acceptance, shared contracts/compiler, companion UI/native adapters, CLI/distribution and QA/release. One shared-contract owner coordinates schema, migrations, identifiers and dependency changes. Do not let simultaneous editor/CLI work introduce incompatible copies of a model.

| Existing seam | Change responsibility |
| --- | --- |
| `docs/concepts/companion/src/` and assembled `index.html` | Replace the sitemap editor in-place, retain the rest of the companion |
| `src/companion-project.js` within the concept | Self-project authoring seed, not runtime implementation |
| `docs/concepts/companion/seeds/visual-self-project.json` | Page/component visual seed and capability references |
| `docs/concepts/companion/companion-project.json` | Generated golden export, never independently hand-maintained |
| `scripts/companion/project-contract.mjs`, `scripts/companion/visual/` | Shared transport/semantic validation and migrations |
| `scripts/companion/compiler/` | Normalize/lower definitions, generate source/tests/traceability |
| `scripts/framework/operations.ts`, `shell.mjs` | Shared typed operations and public CLI; keep launch bootstrap small |
| `scripts/shared/file-plan.mjs` | Reuse locking, preconditions, ownership and recovery |
| `src/features/api.ts`, `src/bootstrap/`, presentation/adapters | Native companion composition through the existing shell APIs |
| Concept/browser/tooling/project-generator workflows | Add named behavior tests, inventory entries and exact-artifact evidence |

A native diagram module may depend on Vue Flow; domain/application contracts may not. Use plain Vue/Vite with Nuxt UI, not Nuxt framework routing. Preserve scoped styles, local icons, qualified dependencies, source-size/coverage/analyzer gates, Markdown ownership and the explicit process/publication boundaries.

## 3. Work packages

### WP-01 — Establish the integration baseline and source provenance

**Requirements:** MVP-05, MVP-09, MVP-12, MVP-23. **Dependencies:** none.

Locate the prior `sitemap-editor-vue3-nuxtui-vueflow.zip` source and record its hash, source/build instructions, license inputs and observed interactions. This PRD preparation did not recover that artifact's bytes; its existence in prior design work is not proof that it is checked into PR #5 or already qualified. Add the retained source/reference under an explicitly named `docs/concepts` location when available. Otherwise implement from the approved Journey Lens behavior and clearly record that it is reconstruction, not a verified source port.

Record current concept HTML, golden JSON, schemas, starter catalog, framework kit and workflow source hashes. Inventory every current surface, page/component definition, published revision, transition and required capability. Inventory existing test failures without relabeling them as caused by this MVP. Produce a small baseline/gap register with evidence links, owner and blocking status.

**Exit:** the chosen source is traceable, the gap register distinguishes implemented/failing/unverified work, and there is a concrete old-to-new surface/interaction mapping. No user-design data has been overwritten.

### WP-02 — Port Journey Lens into the companion concept

**Requirements:** MVP-05–08. **Dependencies:** WP-01.

Integrate the editor-only Vue 3/Nuxt UI/Vue Flow surface into the existing companion's sitemap location. Use TypeScript services and Pinia projections, adapting existing surface/link identities rather than importing a second app store. The current companion shell supplies navigation; contextual parent/sibling/child/related-page panels are inside the editor's boundary. Do not add another app shell or simulated destination screens.

Implement selection, searchable outline, create/edit/move/reorder, explicit hierarchy connection, separate navigation links, Journey Lens, page-editor deep links and contextual Back. Keep drag coordinates separate from parent changes, route values and generated order. Add delete-impact review, undo/redo transactions, cycle/ref checks, draft protection and keyboard alternatives. Use the existing model for the initial integration and a narrow contract seam for additions completed in WP-03; do not ship an incompatible editor-only export format.

Rebuild the offline concept through its assembly pipeline; do not patch only the output HTML. Preserve existing PRD/Storymaps/page/component/entity/source/design-system editors and their cross-links. Validate host theme containment and narrow-panel behavior.

**Exit:** a user creates a page, moves it without route mutation, adds a journey, opens its existing page design, returns, undoes/redoes and exports the project. Existing editor suites still pass. Screenshots supplement behavioral tests; they do not replace them.

### WP-03 — Evolve shared schemas, domain types and migrations

**Requirements:** MVP-06–11, MVP-13–20. **Dependencies:** WP-02's integration seam.

Specify transfer/design v6 and the proposed feature/sitemap subsystem schema 1 from the PRD. Retain `design.nodes` and `design.links` as authoritative surfaces/transitions, with references from route/journey/feature records. Preserve visual-design schema 3 unless separately justified. Write field-level schemas, cardinality/ownership rules, bounds, defaults, reference resolution, error codes and migration behavior before enabling export.

Update the framework-free types, shared runtime validators, JSON Schema outputs, CLI `schema`/capabilities and browser/native adapters together. Keep transport validation separate from generation-readiness findings, but ensure neither browser nor CLI accepts unsafe nested data. Do not replace bounded validators with permissive `any` or allow unknown executable fields.

Migrate v1–v5 fixtures. Preserve legacy IDs, authoring content, component revision pins and unresolved planning links. Default new feature/journey collections to empty; derive route records only from an existing explicit route source. Never guess routes from node positions or rewrite them during migration. Report the documented legacy detail-layout loss when that pre-existing migration applies.

**Exit:** identical positive/negative fixtures run through browser and Node validators; v6 round trips preserve all semantics; every legacy fixture has an explicit expected result; future/unsafe input fails with zero writes. Documentation and generated schema discovery agree.

### WP-04 — Regenerate and import the complete companion self-project

**Requirements:** MVP-08, MVP-11–12, MVP-17. **Dependencies:** WP-03.

Update the self-project seed and visual seed to describe the integrated sitemap, Journey Lens controls, adjacent-editor links, generator scopes, compatible concept import, setup/handoff and release states. Preserve or explicitly reconcile the baseline 28 surfaces, 27 pages, 54 components and 54 revisions. Replace stale read-only-generator guidance where the intended user action is real scaffold generation, without changing the legacy read-only command itself.

Assign stable feature groupings and route/journey references. Add typed action/source contracts, default/error/empty scenarios and acceptance mappings for MVP behavior. Inventory every rich editor/capability as implemented catalog module, declaratively compilable content, or an explicit gap. An unresolved module on the MVP path blocks WP-07, not a checkbox hidden behind “scaffold complete.”

Generate `companion-project.json` through the real exporter. Import that file through the actual companion UI, review/confirm, edit, export and reimport. Record semantic comparison and the exact input/output hashes. Regenerate every affected starter and its integrity catalog; retain previous golden fixtures for migration tests.

**Exit:** the checked-in JSON matches its executable seed; every eligible surface has its intended design; all executable references resolve; the companion can author its own definition without a special importer or manual JSON correction.

### WP-05 — Compile source projects and offline clickdummies

**Requirements:** MVP-14–18, MVP-23. **Dependencies:** WP-04.

Extend the existing compiler with explicit output targets while retaining native scaffold compatibility. Normalize the same project into page/component/route/state/action IR, resolve trusted capabilities, then render source, test fixtures and a generation inventory. Preserve authored layout/token/slot/event semantics and pinned dependencies.

Add browser composition and a single-file build from that same generated source. Use local/hash-safe navigation that works under `file://`, explicit modal return, fixture adapters, deterministic reset and visible simulation labels. Embed all runtime scripts/styles/assets and license notices. Browser mode may not import Node/Obsidian adapters or access a live vault/network. Unsupported business operations remain visibly unavailable.

Prove sitemap-only generation uses honest generic page templates, while authored pages/components compile their actual designs. Test route collisions, inaccessible entries, missing action targets and incompatible bindings before writes. Extend file-plan ownership to new outputs; changing only diagram positions must not cause semantic source churn.

**Exit:** a generated independent project installs/builds/tests; its single HTML operates with network disabled; all expected navigation and local interactions execute; no maintainer checkout or manual copying is required. The framework quality gates relevant to native adoption pass.

### WP-06 — Add JSON-scoped generation and concept integration

**Requirements:** MVP-13–16, MVP-18–20, MVP-24. **Dependencies:** WP-03–05.

Expose full-project/feature/page/component selection through the shared operations, compute dependency closure and produce one deterministic plan. Reuse existing makers; generate shared components once. A slice may only reference existing compatible artifacts or explicitly included dependencies. Import approved changes to the canonical project before in-place generation; do not bypass the existing refusal of an unimported `--input`.

Implement concept inspection/import with these proposed conventions (final schemas ship in this package):

```text
docs/concepts/<concept-id>/
  README.md            # intent, scope, behavior and known limitations
  prototype.html       # optional-to-import, self-contained visual/interactive reference
  project.json         # complete project envelope for whole-project replacement
  concept.json         # required for scoped feature/improvement intake
  src/                 # source reference when provided; never executed by import
  package.json         # build reference when provided; not install authorization
```

The concept manifest uses a distinct kind/version, mode `project | feature | improvement`, target project ID, artifact IDs, explicit external references and a canonical-model payload. Improvement mode requires a base design hash and identified changes. Include content/provenance hashes and an exact file inventory. The complete project envelope remains the one compiler input; the manifest is an import transport, not a competing design format.

Also support extracting a recognized inert JSON payload from HTML, using a documented marker such as `<script type="application/json" id="companion-project">`; parse its text only, never evaluate scripts or infer app semantics from rendered DOM. Invalid, ambiguous, oversized or data-free HTML is refused for generation with a reference-only explanation. A user-opened preview remains untrusted and isolated from native/process capabilities.

Full-project import explicitly replaces; feature import adds; improvement import updates reviewed stable IDs. Preview collisions and dependency/capability changes, allow explicit remapping/reuse, and reject stale bases without silent merging. Keep source HTML/source references intact. Apply through shared safe plans and export a fresh canonical project before generation.

**Exit:** all three modes work, identical reimport is a no-op, conflicts are reviewable, custom code survives and no import executes code or installs dependencies.

### WP-07 — Generate the complete native companion and prove self-hosting

**Requirements:** MVP-09, MVP-11–12, MVP-17–18, MVP-23. **Dependencies:** WP-04–06 and applicable shell qualification.

Implement and ship the trusted companion capability modules missing from WP-04's inventory. This includes the actual sitemap and page/component editor behavior required by the MVP, not just an external-library adapter signature. Register/dispose native views, settings and commands through shell APIs. Use canonical Markdown/document persistence, injected native services and one committed project owner, with per-view drafts and guarded concurrent writes.

The companion product may use its own catalog modules, but the generic shell must not import companion product code, and unrelated generated projects must not acquire companion-only dependencies. Select capability implementations by trusted catalog identity; JSON cannot name arbitrary executable paths. Retain a user-run CLI handoff for tooling; direct in-plugin process execution is not a hidden prerequisite.

Generate the companion into a clean workspace using only the exact kit and WP-04 export. Remove access to the maintainer checkout, install the generated lockfile and run its checks/build. Open only an explicitly provisioned isolated Obsidian vault. Exercise real import, sitemap editing, page/component changes, save, close/reopen, multiple leaves, failure recovery and export. Feed that export back to shell-cli and regenerate. Correct defects in maintained modules/compiler/definitions, not by patching the disposable generated output.

**Exit:** complete required companion functionality is generated and independently runnable. Every MVP action maps to an implemented capability and passing behavior; no stub/TODO is accepted as completion. Retain a parity/gap report for broader deferred scope.

### WP-08 — Complete the extracted-release setup experience

**Requirements:** MVP-01–04, MVP-24. **Dependencies:** WP-03–05; final replay after WP-07.

Extend the current compiled framework-kit setup instead of forwarding blindly to `new <dir>`. Recognize kit-owned bootstrap/template files already present in the target folder. Preserve other content and reject unsafe overlaps. The starter and JSON branches must share validation, configuration, planning and generation.

Implement the explicit starter/import question, catalog search/selection, identity/folder review and optional existing-GitHub association. GitHub can be skipped or configured later. Keep imported identity unchanged by default; explicitly review any release-compatible identity change (the baseline `plugin-companion` ID must not silently become another ID to pass submission rules). Never rewrite stable design IDs during identity customization.

Keep generation, dependency installation and verification as separately approved/reported steps. Persist non-secret progress with source/kit/plan hashes; expose reliable resume after cancellation or failed install. Noninteractive mode requires necessary inputs and returns a versioned result without prompts. Include exact Node/npm prerequisites, license notices, schema/starter inventory and clear help in the kit.

**Exit:** both setup choices succeed from the exact extracted ZIP on Windows/macOS/Linux before dependencies exist. Skip-GitHub, existing-remotes, wrong-toolchain, modified-kit, cancellation and resume paths behave honestly. A generated consumer cannot repack itself as the framework.

### WP-09 — Prepare and publish through the existing release boundary

**Requirements:** MVP-21–24. **Dependencies:** WP-05, WP-07, WP-08.

Reuse release prepare/check/rehearse/operate services. Preparation reviews identity/version/notes and creates a local candidate with exact assets, hashes, commit/tree identity and applicable evidence. Keep ordinary generated-project, companion and shell-cli-kit profiles distinct without relaxing inherited gates.

Provide a discoverable “publish” user path, backed by the existing candidate digest and explicit execution authorization. A friendly alias is acceptable; a second release implementation is not. Review repository/tag/source/notes/assets, preflight remote state, stage assets as a draft when appropriate, verify inventory, then finalize. Test auth denial, rate/network errors, partial upload, existing tag/release, changed candidate and safe retry. Never overwrite foreign assets or force tags as an automatic recovery.

Perform negative/simulated adapter tests first. Actual GitHub write integration requires an explicitly approved disposable repository and separate operation authorization; lack of that evidence remains visible. No implementation or documentation prompt implicitly authorizes publishing the real project.

**Exit:** preparation has zero remote side effects; the publish path is integrated and qualified under authorized conditions; recovery is evidenced. Real shipment remains separately approved in WP-10.

### WP-10 — Run acceptance, close gaps and qualify shipment

**Requirements:** all. **Dependencies:** WP-01–09.

Run the matrix below against exact source/kit/JSON hashes. Retain commands, toolchain/host versions, logs, named assertions and artifact checksums. Update the gap register and source-of-truth docs/help. Existing release blockers remain blocking; do not change a “required” check to advisory to close this milestone.

The actual PR #5 merge revision may differ from the pre-merge candidate. Rebuild/requalify changed inputs before publication. After separate owner authorization, publish the exact shell-cli release asset and download that asset into a fresh folder for the final setup smoke. This is the evidence for the user's first step, not a locally assembled ZIP relabeled as a public release.

**Exit:** all MVP Musts pass with no hidden TODO, the source tree and outputs are traceable, and merge/publication/actual-download verification have separately recorded status.

## 4. CLI compatibility and proposed operation surface

The table distinguishes existing entry points from MVP extensions. Proposed syntax is not runnable documentation until implemented and reflected in help/capabilities.

| User intent | Existing seam | MVP extension / contract |
| --- | --- | --- |
| Setup in the extracted folder | `node shell.mjs setup` | Add first-class starter-or-JSON choice; preserve safe kit ownership and resume |
| Create another project elsewhere | `node shell.mjs new <dir> --starter <id>` or `--from <file>` | Keep compatibility; do not substitute this target policy for extracted-kit setup |
| Inspect/import JSON | `project inspect`, `project import` | Shared v6 validation and explicit migration/reconciliation |
| Generate code | `node shell.mjs generate` and makers | Add reviewed scope selectors such as `--scope feature:<id>`, page/component/full-project |
| Build offline clickdummy | Shared compiler/build services | Proposed `clickdummy build`; explicit source-generation and process approvals |
| Import a concept | Shared project import + file planner | Proposed `concept inspect` / `concept import`; versioned data-only transport |
| Prepare/check a release | `release prepare`, `release check`, `release rehearse` | Complete profile-specific candidate/evidence path |
| Publish | `release operate --execute --authorize <digest>` | Discoverable publish alias/handoff retaining the same authorization, not `--yes` alone |

Do not change the legacy `companion:generate` byte-exact read-only behavior. Read operations and dry runs write nothing; source plans and install/build/publish approvals remain distinct. Human/JSON CLI and any companion adapter call the same typed operation handlers, not parse each other's terminal text.

## 5. Acceptance and test crosswalk

Each case becomes named tests/retained protocols in the existing test inventory; the IDs below are product acceptance IDs, not claims that executable files already exist.

| Case | Required assertion | PRD coverage |
| --- | --- | --- |
| A01 | Launch actual kit without dependencies on all three desktop OSes; wrong toolchain and corrupt kit fail clearly | MVP-01, MVP-24 |
| A02 | Starter/blank and imported companion setup converge; existing kit files are accepted while foreign conflicts are preserved | MVP-02, MVP-04 |
| A03 | Identity/folder review, GitHub skip/connect, preserve remotes, no leaked credentials or implicit push | MVP-03 |
| A04 | Cancel before writes, fail install, resume by verified state, reject changed inputs; no false verified status | MVP-04 |
| A05 | Integrated editor has no nested shell; create/select/search/move/delete/undo work by pointer and keyboard | MVP-05, MVP-06 |
| A06 | Drag/move does not rewrite routes; cycle checks, branching journeys and modal return use correct semantics | MVP-06, MVP-07 |
| A07 | Parent/sibling/child links and page/component/Storymaps Back retain stable identities and context | MVP-08 |
| A08 | Browser/Node schema parity, supported migrations, future versions, unsafe keys, invalid references and bound failures | MVP-09–11 |
| A09 | Full seed-to-file equality and actual UI import/edit/export/reimport, including retained revisions and scenarios | MVP-11, MVP-12 |
| A10 | Feature/page/component scopes compute dependencies, generate reusable contracts/tests, and do not duplicate definitions | MVP-13–15 |
| A11 | Single HTML runs offline/from file; every declared entry/transition/local effect works; fixtures are explicit and resettable | MVP-16 |
| A12 | Kit + exported self-project independently generate the complete companion; native save/reopen and export/regeneration work | MVP-17 |
| A13 | Deterministic no-op replay, custom extension preservation, edited managed-file conflict, stale plan and no implicit deletion | MVP-18 |
| A14 | Project/feature/improvement concepts, base-hash conflict, remapping, repeated import and reference-only HTML handling | MVP-19, MVP-20 |
| A15 | Release preparation never tags/pushes/publishes; missing or mismatched evidence blocks readiness | MVP-21 |
| A16 | Authorized publish, denied auth, changed candidate, partial-upload retry and foreign-release protection | MVP-22 |
| A17 | Source/kit/model hashes, dependency independence, correct evidence scopes and no TODO counted as passing | MVP-23 |
| A18 | CLI help/capabilities, release README, setup and companion handoff agree; non-TTY/JSON never prompt | MVP-24 |
| A19 | Native multiple leaves, failed persistence, draft conflict, disposal, isolation and host styling | MVP-11, MVP-17, MVP-23 |
| A20 | Full companion + bounded scale fixture meet measured performance/accessibility protocols | MVP-05, MVP-16, MVP-23 |

Maintain unit/contract tests, filesystem/generator integration, independent generated consumers, real browser tests and real native tests as separate layers. Native tests use actual services; no default mocked stores for behavior claims. Release integration and manual accessibility evidence remain separately identified.

## 6. Evidence and completion record

Create a dated MVP verification record in `docs/testing` during implementation, containing baseline/final commit and tree, input JSON/schema hashes, kit and output hashes, tool versions, commands, each A01–A20 outcome, warnings, unresolved obligations and explicit approvals for external operations. Link it from the gap register and PR #5.

The current PR contains only the PRD, plan and index. None of the work packages, proposed schemas/commands, end-to-end tests, native conversion or publication are claimed executed by adding these files.
