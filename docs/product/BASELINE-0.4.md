# Product requirements: Obsidian Plugin Shell

> **Version:** 0.4.0  
> **Updated:** 2026-09-22  
> **Owner:** Luis85  
> **Status:** Implementation specification; the repository remains documentation-only.  
> **Product goal:** Obtain the template, run guided setup, generate a first feature, develop confidently, create entity-backed Markdown safely, keep dependencies current, and release a tested Obsidian plugin.

## 1. Product direction

Obsidian Plugin Shell is a GitHub template for maintainable TypeScript/Vue 3/Pinia plugins. It provides a removable example, native integration, a real-component frontend harness, enforceable architecture, a typed event bus, modular composed CSS, guided setup, development makers, an entity-driven DocumentCreationService, and an explicit GitHub release workflow.

```text
Get template → npm run setup → npm run make → browser/native development
→ verify → release candidate → accept exact artifacts → publish
```

Node and npm are prerequisites. Installing project dependencies is part of setup; starting the wizard must not require a separate npm ci. CI and explicit locked reinstalls still use npm ci directly.

Target latest **public/stable** Obsidian and current compatible dependencies through reviewed updates. Normal use does not require Catalyst, an AI account, a personal vault, or paid tooling/release services.

### 1.1 Owner requirements

| Area | Required outcome |
| --- | --- |
| Stack | Vite, Vitest, Oxlint, fallow, TypeScript, Vue 3, Pinia, and eslint-plugin-obsidianmd. |
| Foundation | Native settings, plugin data, local preferences, view shell, commands/ribbon, modals/notices, multilingual UI, error handling, logging. |
| Architecture | Domain-oriented clean architecture, enforced imports, composition-only main.ts. |
| File size | At most 400 physical lines per handwritten source file; 450 per test/helper. |
| Installation | Fresh-checkout npm run setup, dependency-free bootstrap, guided configuration/install/checks. |
| Scripts | Executable tooling, shared helpers, maker implementations/templates under scripts/. |
| Makers | Symfony-inspired discoverable generators producing readable integrated code and tests, with custom extensions. |
| Events | Typed extensible plugin-scoped bus and supported Obsidian bridge with owned cleanup. |
| Styles | Modular CSS and Vue component styles composed into one complete styles.css. |
| Documents | Easy-to-use DocumentCreationService creates Markdown with a defined frontmatter projection based on registered entities; Task is the reference recipe. |
| Agent readiness | Bounded tasks, finite noninteractive tooling, deterministic frontend evidence, truthful results. |
| Maintenance/release | Current-host policy, active dependency upkeep, safe local installation, explicit tested releases. |

### 1.2 Normative contracts

MUST requirements are necessary for the complete template; SHOULD permits a documented exception; MAY is optional. Defaults such as npm, English/German, Vue I18n, Playwright, the example recipes, a 100-line main.ts ceiling, and numeric budgets are chosen policies, not measured facts or vendor requirements.

This revision retains AC-01–49 and adds AC-50–62. The following companion requirements are part of the PRD:

| Contract | IDs |
| --- | --- |
| [Guided setup and makers](../development/SETUP-AND-MAKERS.md) | TOOL-01–06, SETUP-01–12, MAKE-01–12 |
| [Typed event bus](../architecture/EVENT-BUS.md) | EVT-01–16 |
| [Modular CSS composition](../architecture/STYLES.md) | CSS-01–12 |
| [Entity document creation](../architecture/DOCUMENT-CREATION.md) | DOC-01–20 |

The setup/maker/event/style decisions introduced in v0.3 remain. V0.4 adds note creation on an explicit requested action, not unsolicited note seeding. The original data.json-backed example and the note-backed Task recipe illustrate different persistence categories; they do not store the same Task twice. The entity maker extends the existing catalog rather than creating a separate generator system.

Start with the [developer workflow](../development/DEVELOPER-WORKFLOW.md), [entity recipe](../development/ENTITY-DOCUMENTS.md), and [maintenance/release guide](../development/MAINTENANCE-AND-RELEASE.md). R01–R35 reference the [baseline research](../research/2026-09-22-template-research.md), S01–S14 the [tooling/events/styles supplement](../research/2026-09-22-setup-makers-events-styles.md), and D01–D05 the [document-creation research](../research/2026-09-22-entity-documents.md).

## 2. Users, outcomes, and developer experience

The primary user is a developer starting a plugin. Agents and reviewers support that developer. A first useful feature must not require reading the entire specification or configuring every underlying tool.

**SUC-01:** A differently named generated repository initializes, installs, builds, verifies, and prepares valid release assets without manual path repairs.

**SUC-02:** The reference feature exercises UI → application → validation → persistence → committed fact → projection/feedback, including failures.

**SUC-03:** Browser development/verification requires neither Obsidian nor a personal vault/AI subscription/API key.

**SUC-04:** Real-host compatibility is proved separately, not inferred from browser tests.

**SUC-05:** Isolated negative fixtures prove important gates reject their intended defects.

**SUC-06:** Setup/generation/rebuilds preserve user data, unrelated files/plugins, configuration, and security decisions.

**SUC-07:** Registered entity values produce a valid Markdown note through the shared service; invalid values, preview/cancel, and conflicts do not produce unintended documents or overwrite existing ones.

**DX-01:** Promote setup, make, dev:ui/dev:local, verify, and release:prepare. Help is one command away; specialized commands do not crowd first-run guidance.

**DX-02:** Setup starts without installed project dependencies and offers validated inputs, dry run, noninteractive mode, safe resume, and next actions. No global package tooling, Docker, GitHub CLI, native compiler, or extra package manager is a standard browser prerequisite unless proven unavoidable and documented.

**DX-03:** Provide maker-based first-feature and manual first-change recipes, plus a short define-entity/create-document recipe. Proposed measured target: first visible change within 15 minutes of active work after prerequisites/downloads are ready; no unmeasured claim.

**DX-04:** Explain the failure, evidence, and narrow recovery. Distinguish environment, identity, generator, style, installation, validation, path, document conflict, and uncertain-write errors.

**DX-05:** Generated documentation uses the new product's identity, not stale upstream names/badges. Keep template-maintenance detail separately discoverable.

## 3. Scope and exclusions

The complete baseline includes plugin/example and explicit Task-note recipe, typed events/native bridge, composed styles, setup/makers, DocumentCreationService, quality/tests/harness, safe local deployment, dependency maintenance, CI/releases, and documentation.

Runtime is mobile-compatible by design; actual mobile support requires device evidence. Track desktop/mobile public releases separately.

Excluded: an in-plugin AI runtime, telemetry, authentication, ERP features, full Todo management, whole-vault entity database/ORM, automatic note migration/synchronization, bulk document transactions, arbitrary executable templates, Bases views, canvas engine, reflection/DI framework, generic repository hierarchy, distributed/durable/replaying messaging, SSR, npm-library publication, mandatory Storybook/Histoire/MCP, or universal old-host support.

Use direct service calls for requests/results and typed events for facts. Parent/child Vue communication uses its normal mechanisms. Makers generate source; entity/document definitions describe validation and representation, not a second runtime workflow language.

## 4. Research-informed decisions

| Area | Decision |
| --- | --- |
| Host | Latest public/stable; optional Catalyst canary. |
| Settings | Current declarative native definitions with shared application storage. |
| Dependencies | Exact versions/lockfile plus reviewed compatible-family updates; one updater. |
| Setup | Checked-in Node-only bootstrap, locked install after consent, no lifecycle recursion. |
| Makers | Planned safe edits, explicit registration/tests, local custom extensions. |
| Bus | Typed transient notifications, mapped host inputs, startup/lifecycle safeguards. |
| CSS | Ordered source imports and compiled SFC styles, one shared Vite pipeline. |
| Entity documents | Separate entity schema and document projection, real YAML serialization, complete create-only host write, plain typed receipt. |
| Property types | Local schemas cannot silently redefine vault-wide host property types. |
| Quality | Supported tool enforcement plus real negative fixtures, not parallel custom frameworks. |
| Releases | Fixed-commit candidate, retained JS/CSS/manifest, native acceptance, explicit promotion. |

Reference-project files informed patterns, not a full audit or wholesale copy. Research does not prove package/host compatibility; exact versions and runtime behaviors remain qualification work.

## 5. Technology, compatibility, and updates

### 5.1 Responsibilities

| Tool | Responsibility |
| --- | --- |
| TypeScript/vue-tsc/checkJs | Strict runtime, SFC, harness/test/tooling/generated-code checks. |
| Vite/Vue plugin | Native CommonJS/browser builds and compiled/composed CSS. |
| Vue 3/Pinia | Presentation and explicitly owned view state. |
| Vitest/Vue Test Utils | Domain, application, adapter, component, bus, document, and tooling contracts. |
| Playwright Test | Real-browser flows, accessibility, reviewed visuals, failure evidence. |
| Oxlint | Fast supported correctness/quality checks. |
| ESLint/Obsidian/Vue plugins | Complementary host, template, and typed rules. |
| fallow | Reachability/dependencies/duplication/complexity/resolved boundaries. |
| Vue I18n | Shared native/Vue localization. |
| yaml, proposed qualified runtime dependency | One shared Markdown frontmatter serializer behind the renderer port. |
| Node scripts/npm | Setup, makers, safe orchestration, reproducible installation. |
| GitHub Actions | CI, freshness, and approved release stages. |

Use one formatter and one initial browser runner. Entity validation reuses the template's chosen shared validator rather than a second schema engine. Qualify the serializer's exact version/bundle impact; do not import host-only helpers into application code just to avoid a port.

### 5.2 Host contract

**TEC-01:** Record exact tested tools, Node/npm, app/API/installer/runtime, browser binaries, platforms, date, and evidence in a machine-readable compatibility record.

**TEC-02:** A fresh baseline selects current public desktop Obsidian. The earlier dated snapshot was 1.13.7; resolve again during qualification. Compilation is not older-host support. [R01, R02]

**TEC-03:** Current stable declarative settings; no unnecessary pre-1.13 fallback. New declarations do not authorize beta-only calls. [R05, R06]

**TEC-04:** Bundle needed runtime libraries, externalize host-provided modules, and exclude scripts/makers/fixtures/agents from the production graph.

**TEC-05:** No Node/Electron runtime requirement when claiming mobile. Scripts may use Node; normal note creation uses a host Vault adapter.

**TEC-06:** Separate syntax and runtime API compatibility, desktop engine and mobile WebViews. No hidden remote assets/polyfills.

**TEC-07:** Test latest public desktop and a different deliberately retained minimum. Baseline changes are explicit; ordinary dependency PRs do not silently raise established support floors.

**TEC-08:** Optional isolated Catalyst checks do not require entitlement for ordinary development or block public-host support except for defects affecting that scope.

### 5.3 Dependency upkeep

**UPD-01:** Qualified latest compatible stable candidates, exact direct versions, one lockfile, npm ci; no floating latest in normal builds/setup. [R22]

**UPD-02:** Tested patched Active LTS Node track; prior dated selection Node 24. Align engines/version files/npm/CI and assess new LTS deliberately. [R15]

**UPD-03:** Dependabot npm/Actions, frequent checks/bounded PRs/compatible groups and visible major reviews. Renovate replaces rather than duplicates it. [R23, R24]

**UPD-04:** Proposed three-day patch/minor and seven-day major cooldown; security remediation expedited after review. Waiting alone is not safety.

**UPD-05:** Updates run relevant complete checks, including gates, maker output, styles and document serialization when affected. Automerge initially disabled; any later narrow patch policy excludes host/schema/release/policy changes and never publishes automatically.

**UPD-06:** Weekly/on-demand freshness reports current/cooling-down/available/incompatible/blocked/source-unavailable for relevant host/dependencies/Node/actions. Discovery failure is not clean status.

**UPD-07:** Reason/owner/review date for blocked upgrades. Proposed targets: routine review within seven days after eligibility, major assessment within fourteen. No perpetual broad ignores or weakened checks.

**UPD-08:** Online discovery separated from normal offline-capable verification after provisioning. Review transitive/security changes. Setup may report updates, not silently apply them.

## 6. Architecture and extensibility

### 6.1 Direction

```text
presentation → application → domain → shared
infrastructure → application contracts / domain / shared
bootstrap → concrete adapters and presentation factories
main.ts → minimal host lifecycle and bootstrap
```

Feature folders live inside these layers; harness/tests/scripts are separate. Add exercised modules, not empty architecture decoration.

**ARC-01:** main.ts is lifecycle/composition only, ≤100 physical lines; no feature logic, persistence transformations, dictionaries, or markup.

**ARC-02:** Bootstrap constructs dependencies/registers capabilities/owns lifecycle, not relocated business logic.

**ARC-03:** Domain/application import no Obsidian/Vue/Pinia/browser/Node/Electron or concrete infrastructure. Inject nondeterminism. Entities/payloads/receipts are values, not native objects.

**ARC-04:** Inner capabilities own narrow necessary ports; explicit injection, no service locator/ceremonial pure-function interfaces.

**ARC-05:** Presentation calls application contracts, not Vault/storage/native notices. Events arrive through scoped facades; document creation through DocumentCreationService.

**ARC-06:** Host adapters receive application/mounting contracts; bootstrap wires them. Makers update explicit registries, never business logic in main.ts.

**ARC-07:** Small application interfaces or declared facts for cross-feature work; no sibling-internal imports or business dumping into shared.

**ARC-08:** Resolve aliases/re-exports/type/dynamic/SFC imports and classify all runtime source. Prefer qualified fallow coverage; custom checks only for demonstrated gaps. [R12]

**ARC-09:** Runtime cannot import harness/tests/scripts/makers/fixtures/agent tooling; artifact checks independently reject leakage.

**ARC-10:** Cohesive names/modules, concise TSDoc, small contracts. No speculative generic repository/reflection framework. A reusable document renderer is not a universal ORM.

### 6.2 Typed bus

EVT-01–16 in the [bus contract](../architecture/EVENT-BUS.md) require a bus per runtime, correlated literal event types, explicit catalog, publish/on/once, owned disposal, and narrow facades. Notification begins synchronously without awaiting async listeners. No replay/durability/command-result guarantee. Test errors, reentrancy, startup create suppression, nullable/file-folder mappings, and unload. [S06–S09]

### 6.3 DocumentCreationService

DOC-01–20 in the [document contract](../architecture/DOCUMENT-CREATION.md) require an entity definition, an explicit frontmatter/body/destination definition, one application service, shared YAML renderer, and host writer port. The service is generic over registered entities; Task/Meeting/Project do not require service-core edits.

Creation validates and prepares full content before a complete create-only write. Preview is side-effect-free. Managed fields cannot be overwritten by arbitrary input. A plain result and documents.created event report confirmed creation; opening/cache/listener work is separate. No whole-vault scan or second authoritative Task store is introduced.

## 7. Lifecycle and state

**LIF-01:** One runtime owns services/repositories/bus/bridge/document service. Partial initialization is disposed honestly.

**LIF-02:** Per-view Vue/Pinia/drafts/selection/disposables; closing a view cannot destroy shared services or another view.

**LIF-03:** Canonical data belongs to its declared persistence boundary: plugin document for plugin data, Markdown for note-backed entities. Events invalidate projections; late views query state. Snapshot/subscription initialization handles intervening changes.

**LIF-04:** Every effect/listener/timer/mount has an owner, including post-await work. Unsubscribe stops future calls; already-running work requires cancellation/late-result handling. [R17]

**LIF-05:** Supplied app, supported registration/EventRefs, no retained singleton views or detached leaves on unload. [R07, S06]

**LIF-06:** Owning documents/windows for pop-outs/modals/theme/resize. Native roots receive their style namespace/tokens.

**LIF-07:** No eager scans, unsolicited note seeding, hidden mounts, startup event floods, or unload-only durability. Guard deferred readiness callbacks after disposal. Closing a modal during an in-flight create is not authorization to delete a created note.

## 8. Reference examples and native UI

### 8.1 Examples

**EXA-01:** The original small plugin-data item supports create/rename/delete with stable ID and trimmed 1–120-character label.

**EXA-02:** Real empty/populated/pending/invalid/failed-write/recovered states, never false success.

**EXA-03:** Exercise actual UI/use-case/domain/persistence/outcome/event behavior. Add a separately labeled Task-note creation recipe using the real DocumentCreationService.

**EXA-04:** The generic item example performs no network or vault-note writes. The Task recipe writes a note only after an explicit creation request; no startup/setup seeding. Cancel before commit writes nothing; in-flight cancellation reports the real outcome.

**EXA-05:** Tested removal recipes remove each example's code/registrations/catalog entries/style imports/fixtures/tests/locales while retaining reusable infrastructure. Do not retain duplicate authoritative Task records in data.json.

### 8.2 Native surfaces

| ID | Capability | Required behavior |
| --- | --- | --- |
| UI-01 | Shell | Small actions/content, clear loading/empty/error/help states, no unnecessary dashboard chrome. |
| UI-02 | Commands | Open/focus, item creation, diagnostics, and explicit Task-note recipe; localized stable IDs/correct callbacks/no default hotkeys. |
| UI-03 | Ribbon | One accessible localized entry to the same shell action. |
| UI-04 | Settings | Searchable declarative controls, shared validated writer, truthful save results; configured entity destination where needed. |
| UI-05 | Modals | Typed native form/cancel/focus/pending/errors/disposal and composed owned styles. |
| UI-06 | Notices | Outcome policy, inline validation, deduplicated failures, no false failed-create after open failure. |
| UI-07 | Leaves | Focus existing by default; explicit/restored independent views. |
| UI-08 | Styles | Namespaced modules, semantic variables, light/dark/narrow; no global reset. |
| UI-09 | Accessibility | Keyboard/focus/labels/semantics, non-color-only errors, touch targets, reduced motion. |
| UI-10 | Task-note flow | Title/due/status/tags, read-only path/Markdown preview, deliberate create/cancel, accurate receipt and optional open action. Not a full Todo app. |

**SET-01:** Cheap I/O-free native getSettingDefinitions and supported update/search behavior. [R05, R06]

**SET-02:** Allowlisted typed control hooks use shared validation/ordering/persistence, not competing autosave or arbitrary dot-path mutation. [R05]

**SET-03:** Native full settings editor is canonical; contextual Vue preferences reuse its service. Entity property type declarations do not silently mutate vault-wide host property settings.

Use typed Composition API/SFCs; tests deliberately select real versus stubbed Pinia actions. Helper-default stubs are not application evidence. [R18]

## 9. Persistence and entity documents

| Category | Owner | Example |
| --- | --- | --- |
| Durable plugin data | Versioned loadData/saveData repository | Preferences and generic example items. |
| Local preferences | Namespaced host local-storage adapter | Nonessential view choices. |
| Ephemeral | Per-view Vue/Pinia | Drafts, selection, modal state. |
| Entity documents | Markdown notes through document-writer port | A Task's frontmatter/body; not duplicated in plugin data. |

**DAT-01:** Unknown stored/external payloads validated before typed construction; casts are not validation.

**DAT-02:** Explicit schema versions and ordered tested migrations for plugin data; no older overwrite of future schemas. Document schema version does not authorize automatic migration of existing notes.

**DAT-03:** One coordinated writer for the combined plugin document. Concurrent settings/item changes cannot overwrite successful work. Note writes use their own scoped host contract, not that document as a second Task database.

**DAT-04:** Distinguish absent/corrupt/inaccessible/future data; preserve it and make reset/recovery explicit, never silent defaults over existing data.

**DAT-05:** Durability/success facts only after confirmed persistence; invalid/cancelled-before-write input produces none.

**DAT-06:** Persist normally, test debounce ownership when justified, no unload-only flush reliance.

**DAT-07:** No claim of encrypted secret storage; baseline requires no credentials.

**LOC-01:** Versioned plugin-prefixed App.loadLocalStorage/saveLocalStorage production port. [R09]

**LOC-02:** Direct browser storage only in isolated harness adapter.

**LOC-03:** Test absent/malformed/serialized/quota/denied/migrated/deleted/fallback behavior and actual host value semantics.

**LOC-04:** Reset only owned keys.

**LOC-05:** Two plugin/vault namespace isolation and explicit local versus portable/synced data distinction.

### 9.1 Document requirements

DOC-01–20 specify: correlated entity inputs/output; managed identity/defaults; explicit property allowlist/mapping; simple Obsidian-friendly types; date-only calendar semantics; one real serializer; framework-free service ports; prepare/create/commit reuse; body-only safe templates; contained path/folder policy; one complete native create call; no overwrite; bounded confirmed-collision handling; session-scoped duplicate request handling; uncertain-write/cancellation outcomes; cache/navigation separation; canonical documents.created; Markdown source of truth; privacy; entity makers and a real Task vertical slice.

Supported native APIs do not imply filesystem-wide atomicity or global exactly-once creation. The contract requires truthful boundaries and testing, not invented guarantees. Obsidian property types apply by name across a vault; local schema metadata is not native type registration. [D01–D05]

## 10. Localization

**I18N-01:** English/German with fallback; all owned visible/accessibility/native/form error text cataloged.

**I18N-02:** One Vue I18n service for native/Vue, not competing engines. [R35]

**I18N-03:** Explicit plugin locale, supported host mapping, fallback via supported API.

**I18N-04:** Check keys/parameters/plurals/formatting. Do not translate entity IDs, property keys, enum values, or user content automatically.

**I18N-05:** Mounted UI refreshes; host labels only through supported mechanisms or disclosed reload. Changing UI language does not rewrite existing Markdown.

**I18N-06:** Both locales/long text/fallback/pseudo-localization, appropriate language-aware lint, logical CSS. Generated locale skeletons remain pending review. A chosen body-creation locale is captured in the prepared document plan.

**I18N-07:** Safe initialization fallback, no recursive error/translation loop.

## 11. Errors and privacy

**ERR-01:** Typed expected validation/cancel/storage outcomes; normalize unexpected unknown exceptions at real boundaries, not every trivial function.

**ERR-02:** Stable code/category/operation/recoverability and safe localized text, not arbitrary exception strings.

**ERR-03:** Observe async commands/settings/modals/startup/document/subscriber errors. void alone is not handling.

**ERR-04:** Relevant recovery and only known-safe retries; uncertain document writes are reconciled, not blindly retried with a new filename.

**ERR-05:** Vue boundaries supplement explicit async/host handling; never suppress other plugins' errors.

**ERR-06:** One primary notification. Listener/open/cache follow-up failure cannot relabel an already created document as failed or trigger silent duplication.

**LOG-01:** Inject logger; raw console only in approved sink/scripts.

**LOG-02:** Error-only production default, opt-in diagnostics. [R07]

**LOG-03:** Proposed retained buffer 200 entries/256 KiB with field bounds.

**LOG-04:** Allowlisted safe fields; no note content/titles/paths/secrets/property values/full plans/raw payloads by default. Redact exported stack/cause.

**LOG-05:** Explicit local previewable export; no network/telemetry sink.

**LOG-06:** Narrow expected-error fixtures, unexpected browser errors fail, bus errors go directly to sink rather than recursive events.

Render text safely. Neither user note/frontmatter nor template input is executable code. [R31]

## 12. Frontend harness

Use actual components, services, stores, bus, entity validation, YAML renderer, and style sources. Substitute only declared host ports. A fake document writer retains actual Markdown, not a fabricated success object.

**HAR-01:** Vite dev and built preview; required browser tests against built harness.

**HAR-02:** Loopback/synthetic fixtures, no personal vault, network exposure, or forced GUI in headless mode.

**HAR-03:** Shared contracts with explicit fake scope/omissions and adapter tests.

**HAR-04:** Declared scenario/locale/theme/viewport/seed and observable readiness, not sleeps.

**HAR-05:** Controlled IDs/clock/faults/storage/native inputs/collisions/cache delays, isolated tests and explicit reload scenarios.

**HAR-06:** Typed local test controls only; no arbitrary eval/filesystem/shell endpoint.

**HAR-07:** Artifacts exclude fake host/fixtures/faults/harness/maker/agent code.

**HAR-08:** Shared style graph, separately owned host shim, no unjustified vendored assets, exact-candidate stylesheet scenario.

**HAR-09:** Browser native adapters test contracts; actual native behavior needs host tests.

**HAR-10:** Real multi-view/state/bus/disposal cases; closing one view leaves shared services valid. Document submission during disposal follows actual write outcome.

Required scenario groups include normal/invalid/pending/failure/reload/settings/localization/multi-view/lifecycle/responsive/focus, event mapping/errors, generated features/styles, document preview/validation/full content/conflicts/uncertain writes/cache lag/created-but-open-failed.

**E2E-01:** Playwright CLI, robust roles/names/test IDs, observable outcomes and auto-wait.

**E2E-02:** Real actions for behavior claims, not stubbed persistence or YAML success.

**E2E-03:** Small reviewed visual set with pinned OS/browser/fonts/viewport; no CI self-acceptance. [R20]

**E2E-04:** Automated accessibility plus keyboard/focus/manual scope, no certification claim.

**E2E-05:** Bounded sanitized readable/JSON reports/screenshots/traces/logs on failure.

**E2E-06:** Source/worktree/assets/tools/browser/scenario/locale/theme/seed identify evidence, including CSS hash and actual fixture document content where appropriate. No stale/missing evidence as success.

**E2E-07:** Intentional isolated failures prove runner behavior; own/check the server, reject unrelated stale processes. [R19]

MCP remains optional with limited fixture context and reviewed mutation rights; CLI is authoritative. [R34]

## 13. Test strategy and native proof

| Layer | Required evidence |
| --- | --- |
| Domain/application | Validation/defaults/migrations/concurrency/results and committed facts. |
| Components/adapters | Narrow native contracts, intentional store action mode, owned subscriptions/forms. |
| Bus/bridge | Types/order/errors/once/disposal/startup/null/file-folder mappings. |
| Documents | Entity correlation, real serialization, preview, safe full write, conflicts/request tracking/cancellation/follow-up boundaries. |
| Browser/styles | Real workflows/focus/layout/a11y/scoped parity and generated entity/feature. |
| Tooling | Fresh setup, safe generation, real negative gates, definition/catalog checks. |
| Artifact | Native CJS, one complete CSS, all assets, no dev leakage. |
| Host/device | Registration, native Properties/Source content, modals, lifecycle/pop-outs, data preservation and claimed mobile paths. |

**HST-01:** Latest public desktop and differing retained minimum with exact source/assets/host/installer/platform/result.

**HST-02:** Prove/pin native runner; wdio-obsidian-service is a candidate, not official guarantee; manual acceptance remains. [R21]

**HST-03:** Normal verify needs no Obsidian. Missing native provisioning is not run; promotion needs candidate-bound evidence.

**HST-04:** Native registration/settings/forms/notice/multi-view/pop-out/reload/persistence/event cleanup/composed styles/local-install checks, plus actual created Task source/Properties and no-overwrite behavior.

**HST-05:** iOS/Android evidence before claims, recorded separately; browser emulation/Linux CI is insufficient.

**HST-06:** Disposable fixture vault, explicit lawful provisioning, no personal data/binary redistribution. Synthetic test Task notes remain inside an explicitly selected test vault; human setup does not silently change security preferences.

## 14. Quality policy

### 14.1 Lines

**QLT-01:** Count physical lines including comments/blanks/full SFC; trailing newline adds no extra content line; CRLF/LF equivalent, empty zero. Include new/uncommitted relevant files.

| Category | Limit |
| --- | ---: |
| main.ts | 100 |
| Other handwritten runtime/CSS/harness/tooling/definitions | 400 |
| Test specifications/helpers | 450 |

Generated application/entity scaffolds become normal maintained source and obey the limit. Composed dist/styles.css is generated output with size/provenance checks instead. Machine data/Markdown/lockfiles/generated declarations have explicit treatment, never a hiding place for executable source. Runtime may not import test-classified modules.

**QLT-02:** Actual 400/450 boundary/excess fixtures including full SFC, comments, blanks, CRLF, terminal newline, and separate output exemption.

### 14.2 Checks

**QLT-03:** Strict runtime/Vue/tests/harness/tooling with explicit optional/indexed handling; no unsafe casts or public any to erase event/entity/adapter typing.

**QLT-04:** Complementary Oxlint and typed Vue/Obsidian ESLint, no unapproved warnings or disabled-in-both gaps. [R10, R11]

**QLT-05:** Proposed cyclomatic 10/cognitive 15 where supported, documented scope, no metric-driven fragmentation.

**QLT-06:** Fixtures verify actual parser/template/script/extension/async/settings coverage and generated event/entity type correlation.

**QLT-07:** Proposed production coverage including untested files: global lines/statements/functions 90%, branches 85%; domain/application 95%, branches 90%. Explicit type/generated exemptions, narrow evidenced native limits, no whole-layer exclusion.

**QLT-08:** Behavior cases mandatory regardless of percentages: failure/concurrency/corruption/cancel/cleanup/namespaces/validation, safe scripts, event errors, document round trips/conflicts/uncertain outcomes.

**QLT-09:** Pinned fallow/installed schema, genuine process entries and template data consumers. No all-source entry or maker/entity subtree suppression. [R32]

**QLT-10:** Whole repository and production scope; block unjustified unused runtime files/exports/dependencies, cycles, boundaries, configured errors. Tests alone do not justify dead shipped code. [R13]

**QLT-11:** Complete scope for full verification; changed-only feedback is additional.

**QLT-12:** Proposed duplication 3% production, initial clone minimum 50 tokens/5 lines when supported; validate metric/denominator, separate fixture/template reporting without hiding duplicated runtime scaffolds.

**QLT-13:** Respect analyzer limits/dynamic native registrations, investigate before changes, no destructive autofix/deletion during verification. [R33]

**QLT-14:** Prefer qualified boundary coverage and explicit zone rules; test aliases/re-exports/unclassified/external/test imports. Add custom checks for demonstrated gaps only. [R12]

**QLT-15:** Narrow scope/reason/owner/review for exceptions; no copied legacy baseline, broad suppression, or quiet threshold/snapshot changes.

**QLT-16:** Passed/failed/not-run/infrastructure-error, actual command/tool/scope/exit. Crash or unknown report schema cannot mean no findings.

**QLT-17:** Negative fixtures run in isolated child projects, with no graph contamination or recursive full checks; generated-repository qualification is explicit.

## 15. Builds, setup, makers, styles, and documents

### 15.1 Artifacts

**BLD-01:** Dedicated dist with actual host-loadable CJS main.js, manifest.json, and one fully composed styles.css; native export proof.

**BLD-02:** Required runtime deps/owned assets bundled, native modules external, no CDN/dev server/source paths/unintended chunks; preserve licenses.

**BLD-03:** Debug maps in development, explicit release policy, no secrets/sensitive paths.

**BLD-04:** Identity/version/minimum/package-lock-manifest/mapping/hashes validated. Plugin application, not npm library/declaration publication. Note fixtures, catalogs' explanatory metadata, and user documents are not plugin-release payloads unless explicitly intended.

### 15.2 Local installation

**DEP-01:** Repository-contained .dev-vault and configured config-dir/plugins/id target.

**DEP-02:** Explicit safe repository-root mode/custom config directory; host uses actual configDir.

**DEP-03:** Allowlisted assets only; preserve data.json, user notes/unknown files/other plugins/config/security. No vault/repo-root cleaning.

**DEP-04:** Validate containment/IDs/symlinks/approved targets, not normalization alone; dry run.

**DEP-05:** Stage/validate matching full JS/CSS/manifest; failed builds keep last good set; detect concurrency and report recovery.

**DEP-06:** Additive explicit developer-vault enabling; malformed config is error; no automatic Restricted Mode disablement.

**DEP-07:** Resolved destination/identity/hashes/human actions; generated builds/vault artifacts ignored.

**DEP-08:** Optional official CLI target-checked to fixture vault, fallback when missing, never personal-vault inference. [R08]

### 15.3 Commands

These are future implemented commands. Root package scripts are short entrypoints into scripts, not working capabilities of today's documentation-only repository.

| Command | Contract |
| --- | --- |
| setup | Node-only guided bootstrap/plan/identity/locked install/provision/check/resume. |
| make -- <kind> | Safe discoverable integrated scaffolds, including entity --document. |
| help / doctor | Discover/diagnose safely before dependency installation. |
| template:init | Focused shared identity operation. |
| dev:ui / harness:dev | Same loopback real-component HMR without Obsidian. |
| dev | Native build watch, no implicit deployment. |
| dev:local | Successful matching assets into approved local vault, optional opted-in CLI. |
| build / build:dev | Qualified production/debug output including compiled CSS/YAML renderer. |
| build:local / test-build | Same safe local build/install. |
| typecheck / lint / format:check | Finite non-mutating complete configured scope. |
| lint:fix / format | Explicit targeted edits only. |
| test / test:watch / test:coverage | Finite default, explicit watcher, enforced coverage. |
| test:setup | Explicit prerequisite provisioning reused by setup. |
| test:gates / test:tooling | Isolated negative checks and fresh setup/maker qualification. |
| harness:build / harness:preview / harness:shot | Build/serve/capture declared scenarios/evidence. |
| test:e2e | Required real browser/visual/a11y/style/generated-document scenarios. |
| test:obsidian | Provisioned native checks or truthful not-run. |
| check:loc / check:architecture / check:i18n / check:docs | Focused checks composed into verify. |
| events:catalog / events:check | Derived typed catalog and validation, including documents.created. |
| entities:catalog / entities:check | Derived entity/document catalog and schema/mapping/default/property-type consistency checks. |
| styles:build / styles:check | Shared complete CSS/SFC pipeline, not isolated raw concatenation. |
| analyze / analyze:production / analyze:changed | Full/production/optional incremental fallow. |
| verify:fast | Clearly partial finite feedback. |
| verify / check | Same complete ordinary static/coverage/fixtures/docs/build/browser/event/style/entity/tooling verification; no native claim. |
| quality:report | Actual evidence/status, including missing results. |
| deps:status / security:audit | Explicit online maintenance/security. |
| release:prepare -- --version X.Y.Z | Consistent metadata/changelog/dry run, no implicit commit/tag/push/publish. |
| verify:release -- --candidate <path> | Retained candidate and host evidence validation, not a rebuild. |
| release:check | Release/listing prerequisites and explicit optional online checks. |

### 15.4 Installation/tooling

TOOL-01–06 and SETUP-01–12 require dependency-free start, disclosed consent/plan/downloads, no lifecycle recursion, safe identity/noninteractive/dry-run/resume, portable child ownership, and truthful per-profile readiness. Scripts/helpers/templates are under scripts; root configs remain thin/declarative.

No Node/global/PATH elevation, Git remote alteration, implicit personal-vault security changes, or publication. Install the qualified graph, not newest packages on each run. Neither setup nor a maker creates real Task notes to demonstrate the service; only explicit user creation or isolated native test fixtures do so.

### 15.5 Makers

MAKE-01–12 remain, extended by DOC-19 with an entity maker. The complete catalog covers feature/view/component/store/usecase/command/modal/setting/event/listener/style/locale/maker/entity. A note-backed entity recipe generates schema/document definition/registration/action/tests/Markdown fixture, not documents in the user's vault.

Reuse existing command/modal/style/event recipes. No service-core edits per entity, orphan files hidden by fallow exceptions, broad overwrite, runtime source scanning, remote template installation, or fake finished business behavior.

### 15.6 Styles

CSS-01–12 remain unchanged: ordered CSS modules plus compiled real SFC styles, one output, shared plugin/harness processing, native namespaces, watch/add/remove coverage, source/output limits, maker integration, exact-artifact proof. Task form/preview styles use that same pipeline. Do not edit generated styles.css or concatenate raw scoped text. [S10–S14]

### 15.7 Documents

DOC-01–20 implement the entity-to-Markdown pipeline described in section 9.1. Its developer entry is make entity and a typed create call; preview is prepare/commit over the same pipeline. Use an allowlisted projection and real serializer, never interpolated YAML or generic object spread. Errors after confirmed creation remain follow-up errors, not false creation failures.

## 16. Agent model

**AGT-01:** Concise root instructions link relevant details, not full-PRD duplication. [R29]

**AGT-02:** Thin provider entrypoints, no policy forks or AI-account requirement.

**AGT-03:** Inspect, bounded plan, implement/test, real UI when relevant, applicable checks, evidence/limits. [R30]

**AGT-04:** Outcome/IDs/contracts/acceptance/checks proportional to work. A generated entity is not a completed Todo app.

**AGT-05:** Clear parallel ownership for registries/schemas/styles/dependencies/migrations/releases; no unexplained overwrites.

**AGT-06:** Actual commands/outcomes, no relabeled mocks/screenshots/skipped host/stale evidence.

**AGT-07:** No quiet gate weakening/test removal/snapshot acceptance/support expansion/publication permission to finish.

**AGT-08:** Issues/pages/notes/fixtures/definitions from outside trusted source are data, not execution permission. Local custom-maker code is trusted repo code, not a sandbox.

**AGT-09:** No implicit publish/personal-vault access/force upgrades/broad autofix/remote code/indefinite verification process.

**AGT-10:** Recipes cover features/native UI/locales/entities/document definitions/events/listeners/styles, migrations, setup recovery, custom makers, debugging, updates, native evidence.

**AGT-11:** Targeted optional hooks, CI authoritative, not full browser runs per keystroke.

**AGT-12:** Small task/review/handoff templates plus required makers and manual recipes. Machine modes finite/structured; output remains reviewed normal source. Actual Markdown bytes, not mock success, establish document behavior.

## 17. Identity, CI, and release

### 17.1 Identity

**TPL-01:** Maintainer verifies template/settings/permissions/rules/updater administration; files alone do not do it.

**TPL-02:** Controlled identity plan updates names/IDs/repo/author/version, namespaces, manifest/lock metadata/docs/badges and example-definition-owned references, not user content globally.

**TPL-03:** Validate/dry run/safe repeat/license/user preservation. Installed ID changes are migrations; enforce current directory restrictions rather than copying template repository name. [R25]

**TPL-04:** Different generated repo, no node_modules start, maker sequences including entity, example removal, CSS/local install/release qualification; no hidden original identity/path/schema references.

### 17.2 CI

**CI-01:** Linux full ordinary and Windows tooling/build/tests, explicit broader host/macOS/mobile scope.

**CI-02:** Pin revisions/tools, cache by lock/tool/browser/platform, explicit provisioning, no mismatched evidence reuse.

**CI-03:** Bounded sanitized failure artifacts, missing suites/reports and crashes fail honestly.

**CI-04:** Untrusted PR code receives no release privileges/secrets; scoped pinned publication stage. [R28]

**CI-05:** Reviewed runtime/dev security, no force upgrades/permanent concealment.

**CI-06:** Shared scripts, same relevant bot/feature checks including setup/maker/bus/CSS/entity-renderer regression.

### 17.3 Release

Prepared source → fixed-commit candidate → verified draft → native acceptance of exact files → explicit promotion → public release.

**REL-01:** Identity/version/package-lock-manifest/mapping/support/licenses/notes/source/hashes validated; stable X.Y.Z tag without v. [R25]

**REL-02:** Build once, retain/test/publish those assets. Host evidence separate and candidate-bound; JS/CSS/serializer changes invalidate prior acceptance.

**REL-03:** First current-directory submission is separate, with checklist/metadata and no implicit approval/account operations. [R25]

**REL-04:** Document breaking template/workflow/storage/event/entity-contract changes. Downstream repos do not inherit upgrades automatically; new document definitions do not migrate old notes implicitly.

**REL-05:** Actions/scoped token/optional CLI, no mandatory npm credentials/commit convention/release SaaS; prepare is not publish.

**REL-06:** Explicit reviewed source/draft, individual tested main.js/manifest/styles assets, optional ZIP/checksum; source archives insufficient.

**REL-07:** Promotion checks approval/host evidence/commit/tag/hashes and publishes retained files. Honest manual native records permitted when automation absent; incomplete upload remains draft.

**REL-08:** Matching-identity draft retries only; never move/overwrite public versions/assets/tags. Forward-fix, with schema/downgrade compatibility considered.

**REL-09:** Direct/reusable/dispatch stages, no assumption of a GITHUB_TOKEN-created tag triggering another push workflow. [R27]

**REL-10:** Optional beta distribution separate from stable manifest convention; no mandatory Catalyst/BRAT.

**REL-11:** Rehearse first/subsequent/partial-upload/evidence/hash/commit/duplicate/permission/retry cases before claiming easy release.

## 18. Non-functional targets

Numbers are proposed until measured in a stated reference environment.

| ID | Target |
| --- | --- |
| NFR-01 | Offline runtime, no account/remote asset/telemetry dependency. |
| NFR-02 | Warm initialization p95 ≤200 ms over 30 controlled runs, excluding host startup; no eager scan. |
| NFR-03 | Shell readiness p95 ≤500 ms for 100 items on reference environment. |
| NFR-04 | Initial main.js ≤1 MiB, composed CSS ≤100 KiB minified uncompressed; measure serializer impact and compressed sizes. |
| NFR-05 | Owned resources return to baseline after 20 open/close cycles, bus/bridge/in-flight UI included. |
| NFR-06 | Safe actionable outcomes for data/schema/storage/startup/script/document failures. |
| NFR-07 | Keyboard/focus success, reviewed scanner findings, explicit manual accessibility scope. |
| NFR-08 | Standard Windows/Linux workflows and evidence-based wider support. |
| NFR-09 | Executable code/architecture/style/event/entity/tooling gates and reviewed exceptions. |
| NFR-10 | Reproducible source/tool/schema/template/fixture/artifact identity. |
| NFR-11 | Measured setup/maker/first-change usability. |
| NFR-12 | Visible freshness, blocked and outage states. |
| NFR-13 | Bounded document inputs/body/request records/collision attempts; no whole-vault scan per create or hidden duplicate database. |

Do not weaken correctness for budgets or present noisy CI timing as universal performance proof.

## 19. Acceptance and traceability

| ID | Required outcome | Trace |
| --- | --- | --- |
| AC-01 | Different identity installs/builds/verifies, dry run changes nothing. | TPL-02–04 |
| AC-02 | Native command/ribbon opens/focuses without duplicate registration. | UI-01–03, HST-04 |
| AC-03 | Generic example create/rename/delete survives reload through real services. | EXA-01–03, DAT-05 |
| AC-04 | Invalid label localized inline, no write. | EXA-01, ERR-01 |
| AC-05 | Failed persistence preserves data/no false success/safe recovery. | DAT-03–05 |
| AC-06 | Concurrent settings/items lose nothing; drafts independent. | DAT-03, LIF-02–03 |
| AC-07 | Corrupt/future data preserved. | DAT-01–04 |
| AC-08 | Local denial nonfatal, namespaces isolated. | LOC-01–05 |
| AC-09 | Locale/long text/fallback/host label behavior correct. | I18N-01–07 |
| AC-10 | Modal cancel/submit/reopen/focus/cleanup correct. | UI-05, ERR-06 |
| AC-11 | Lifecycle restores resource baseline, other views valid. | LIF-01–07 |
| AC-12 | 400/450 pass, excess fails including full SFC/CRLF. | QLT-01–02 |
| AC-13 | Real architecture rejects alias/re-export/unclassified violations. | ARC-08–09, QLT-14 |
| AC-14 | Real Vue/async/native lint and locale checks reject defects. | QLT-03–06, I18N-04 |
| AC-15 | Tests cannot hide unused production code. | QLT-09–13 |
| AC-16 | Browser failures produce failure/current artifacts. | E2E-05–07 |
| AC-17 | Correct CJS/composed assets, no unintended chunks/dev leakage. | BLD-01–04, HAR-07 |
| AC-18 | Install preserves notes/data/other plugins/security. | DEP-01–07 |
| AC-19 | Unsafe path/config/build failure causes no destructive replacement. | DEP-04–06 |
| AC-20 | Crash/unavailable host is not pass. | QLT-16, HST-03 |
| AC-21 | Bounded/redacted/local diagnostics, no upload. | LOG-01–06 |
| AC-22 | Keyboard/narrow/light/dark usable. | UI-08–09, E2E-04 |
| AC-23 | Claimed iOS/Android has candidate-bound evidence. | HST-05 |
| AC-24 | Removal leaves no orphan wiring/catalog/styles/locales/dependencies. | EXA-05, TPL-04 |
| AC-25 | New developer completes short first-change path without entire PRD. | DX-01–05 |
| AC-26 | Public/beta discovery distinct, no silent beta-only API. | TEC-02–08 |
| AC-27 | Searchable native settings share validated writer including failure. | SET-01–03 |
| AC-28 | Locked installation and update families execute relevant checks. | UPD-01–05 |
| AC-29 | Freshness reports blocked/cooldown/outage honestly. | UPD-06–08 |
| AC-30 | Optional CLI only targets configured fixture vault. | DEP-08 |
| AC-31 | Release prepare consistent, no implicit commit/tag/push/publish. | REL-01, REL-05 |
| AC-32 | Fixed-commit first/subsequent draft has individual installable assets. | REL-06, REL-11 |
| AC-33 | Promotion rejects missing/mismatched evidence/assets, no rebuild. | REL-02, REL-07 |
| AC-34 | Retry/permission/upload/duplicate failures preserve public versions. | REL-08–11 |
| AC-35 | Listing rejects invalid identity/versions/missing docs/assets and describes current route. | TPL-03, REL-01–03 |
| AC-36 | Fresh no-node_modules npm run setup reaches selected-profile readiness. | SETUP-01–05 |
| AC-37 | Dependency-free dry-run/help, no side effects/TTY hangs/lifecycle recursion. | SETUP-02, SETUP-08–10 |
| AC-38 | Setup failure/interruption/rerun preserves edits, valid-only resume, explicit skipped scope. | SETUP-06–07, SETUP-11–12 |
| AC-39 | Scripts/helpers/templates in scripts, root configs/workflows thin, source limits active. | TOOL-01–06 |
| AC-40 | Built-in/composed makers generate registered real code/tests/events/styles. | MAKE-01–04, MAKE-10–12 |
| AC-41 | Maker plan/rerun/collision/concurrency/failure preserves work. | MAKE-05–07 |
| AC-42 | Custom/machine maker uses same validated plan without remote code/install. | MAKE-08–09 |
| AC-43 | Typed event keys/payloads/unions/duplicates checked; extensible without bus-core edit. | EVT-04–06, EVT-15 |
| AC-44 | Event order/once/reentrancy/errors/disposal/snapshots match contract. | EVT-07, EVT-09–11, EVT-16 |
| AC-45 | Native bridge startup/null/file-folder/rename/unload-before-ready safe. | EVT-12–14 |
| AC-46 | No success fact for failed write, two-view refresh, runtime isolation. | EVT-01–03, EVT-08, EVT-15–16 |
| AC-47 | Ordered CSS plus SFC output is complete/single/scoped/self-contained. | CSS-01–07 |
| AC-48 | Style maker/HMR/removal/failure/last-good/candidate parity correct. | CSS-08–10, CSS-12 |
| AC-49 | CSS/SFC source limits versus output budget correct, no native/pop-out leakage. | CSS-06–07, CSS-11–12 |
| AC-50 | Registered entity/input/output types correlate; unknown fields and duplicate definitions/mappings fail. | DOC-01–03, DOC-07 |
| AC-51 | Task defaults/required values/date-only validation/false-zero-null rules are correct. | DOC-02, DOC-04–05 |
| AC-52 | Real YAML round-trip preserves scalar meanings; internal/managed overrides and unsupported values are rejected. | DOC-03–05, DOC-09 |
| AC-53 | Prepare writes nothing; accepted commit uses same ID/content/path; stale plans do not silently change. | DOC-08 |
| AC-54 | One complete create call includes frontmatter/body; failed write emits no created fact or empty-note workaround. | DOC-11, DOC-16 |
| AC-55 | Unsafe paths/folder-file/case/race conflicts are handled without overwrite or unsafe cleanup. | DOC-10–12 |
| AC-56 | Duplicate submission coalesces within scope; mismatched keys/uncertain writes do not cause blind duplicate retries. | DOC-12–13 |
| AC-57 | Confirmed creation remains success despite cache lag/open/listener failure; host/service observations do not double count. | DOC-15–16 |
| AC-58 | A second entity uses the same service; Markdown remains canonical, no auto-seed/duplicate Task database. | DOC-06, DOC-17, DOC-20 |
| AC-59 | Entity maker creates integrated definitions/action/tests/fixture, preserves safety and never creates actual user notes. | DOC-19, MAKE-01–12 |
| AC-60 | Versioned schemas/type hints do not rewrite existing notes or silently mutate vault-wide property types. | DOC-04, DOC-17 |
| AC-61 | Harness inspects actual emitted Markdown, native Properties/Source behavior verified on claimed platforms. | DOC-05–06, DOC-20, HST-04–05 |
| AC-62 | Cancellation before/during write reports actual outcome, preserves created note, protects disposed UI/privacy/bounds. | DOC-14, DOC-18 |

Requirement coverage and code coverage are different. Tests cite relevant IDs; native/manual cases retain honest evidence.

## 20. Work packages

Dependency-ordered slices; WP-00 is a focused proof, not indefinite research before any working shell.

| Package | Outcome | Exit evidence |
| --- | --- | --- |
| WP-00 — Current baseline | Current qualified packages/host/Node, Vite native+CSSL, native settings, analyzer/runner/bootstrap, shared YAML/native-parser probe. | Exact matrix and small real host/build/serialization proofs. |
| WP-01 — Tools/bootstrap | scripts layout, strict projects, locked checks/negative fixtures, setup/help/doctor, safe file-plan engine, CI. | Dependency-free start/help and useful failures. |
| WP-02 — Runtime/bus/styles | Composition/ports, typed bus/bridge, Vue/Pinia, shell, modular CSS/SFC pipeline, first harness. | Visible shell and type/lifecycle/style contracts. |
| WP-03 — Data/documents/settings | Versioned plugin writer, local prefs, declarative settings, locale/errors/logs, entity/definition contracts, DocumentCreationService and writer/renderer. | Storage concurrency plus actual Task Markdown, validation/no-write-preview/collision/failure tests. |
| WP-04 — Examples | Generic example, explicit Task-note modal/preview/action, committed events, responsive styles/removal recipes. | Real end-to-end behavior, no Task duplication or unsolicited notes. |
| WP-05 — Harness | Deterministic host/file/event/storage faults, actual Markdown capture, real services, readiness, shim/style fidelity. | Reproducible native-independent scenarios. |
| WP-06 — Evidence | Playwright/visual/a11y/bus/document/negative runner, native/manual Properties/no-overwrite, exact assets. | Separate honest browser/native results. |
| WP-07 — Setup/makers/local | Full wizard/resume/install/CLI, identity, built-in/custom/entity makers, generated-repo tests. | Fresh setup and generated entity/feature/event/style functioning under safety checks. |
| WP-08 — Maintenance/release | Updater/freshness, secured shared workflows, catalogs/checks, draft/promote/submission/agent guidance. | Upgrade and release failure recovery. |
| WP-09 — Qualification | Fresh differently named repo, full wizard/makers/Task create/example removal, usability/budgets/platforms, release rehearsals. | AC-01–62 accounted for; no hidden unmet MUST. |

The maker catalog is implemented in bounded slices, including the entity/document recipe; unfinished intermediate releases must not claim complete qualification. Existing work-package ordering remains; document creation extends data/example/testing packages rather than adding a separate platform.

Ready work has outcome, affected contracts/IDs, acceptance, data/error/migration/lifecycle implications, and evidence. Done means actual intended-layer behavior/checks/current UI/native evidence where needed, docs/catalog updates, preserved user work, and truthful handoff—not volume or expected future tests.

Use concise lasting ADRs for host/settings, persistence/event/document identity, style pipeline, maker mutations, tool roles, deployment/release/update policy. Routine feature changes do not each require an ADR.

## 21. Risks

| Risk | Mitigation |
| --- | --- |
| Bootstrap needs missing dependencies or recurses through npm hooks. | Node-only entry and fresh-install/lifecycle tests. |
| Makers overwrite work or produce unreachable boilerplate. | Planned preconditions, explicit registrations, isolated qualification, no blanket force. |
| Bus hides commands or leaks resources. | Typed facts/direct requests/scoped owners/no durable guarantees. |
| Native startup events look like new activity. | Readiness/guard/initial query contract. |
| CSS splitting loses identifiers or deploys with old JS. | Shared compiler, exact parity, matching staged set. |
| Document creation corrupts frontmatter or overwrites a note. | Strict projection/real serializer/full create/no-overwrite/error distinction. |
| Duplicate retries create multiple Tasks or follow-up failures claim write failure. | Stable bounded request handling, plain receipt, uncertain-outcome reconciliation, separate opening. |
| Local schema changes global property behavior or creates duplicate authority. | No private type mutation, Markdown canonical, explicit future migration contract. |
| Latest packages/API/host differ. | Exact qualified matrix, reviewed updates, visible exceptions. |
| Analyzer silently loses coverage. | Parser/zone/production/report negative fixtures. |
| Release doesn't trigger or rebuilds after acceptance. | Direct staged orchestration/fixed commit/retained hash-bound assets. |
| Baseline becomes too complex. | Short workflow, small reused services, ordinary generated code, progressive docs; no ORM/workflow platform. |

## 22. Sources and delivery boundary

The baseline R sources, S tooling/events/styles sources, and D entity-document sources are linked in section 1.2. Primary public declarations were used where generated API documentation URLs were unavailable. Source inspection does not establish package compatibility, race guarantees, complete host behavior, or measured performance.

This delivery updates requirements/guides only. It does not implement or execute setup/makers/DocumentCreationService/bus/styles/harness, install dependencies, enable updater/admin settings, create real user Tasks, or publish a plugin. Those capabilities require their implementation and acceptance evidence. Previously unverified package-matrix and benchmark details remain explicitly unverified.
