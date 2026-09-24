# Shell capability inventory — SH-001

## Exact baseline and interpretation

Inspected 2026-09-24. Main: `9a56505ee3af90583d5e057774705078d6e99aff`.
Concept PR #5: `6a39dd03947e4f8da40c03dc42f4a8b5e34065b4`.
Planning PR #16: `2cadc495d5989760b09f257289b33e9d7c356e70`.
The downloaded main/concept merge snapshot `8be4fd03b6cadc3185f0010042d2ee5f323c12ab`
reconstructed tree `821eaa4595a04537de698db8dd4c39a5ceff979d` exactly; the planning
archive reconstructed tree `85cb73db5a720344a2015c60de9e37061bcbee3d` exactly.
These trees establish source identity, not fresh runtime qualification.

PR #15 (`codex/framework-lifecycle`, inspected `d8826fd3bf6a58ac06c171f8cf508ceab28dc48a`)
is open parallel work on action scopes, precise storage recovery, UTF-8 bounds,
public feedback ownership and native diagnostics. It is not silently incorporated
or duplicated. Its eventual integration must reopen affected qualification.
No prerequisite PR is merged or modified by this work.

The [parent PRD](../product/PRD.md), retained [full specification](../product/SPECIFICATION-0.7.md),
[readiness ledger](TEMPLATE-READINESS-LEDGER.md), [authoring contract](AUTHORING-TOOLS.md),
[test strategy](../testing/TEST-STRATEGY.md), [test concept](../testing/TEST-CONCEPT.md),
[task traceability](../tasks/TRACEABILITY.md), and [shell-first strategy](../product/DELIVERY-STRATEGY.md)
remain normative. The original and current root guides are both retained, as are
companion requirements 0.3 and the newer 0.4 source. New concept test-kit code and
all existing native/runtime code are preserved from the inspected current source.

## Capability-to-source and remaining-work audit

Each row names its owning task, actual source and test entrypoints. Existing source
means implementation can be reused, not that every task criterion is qualified.
The task files, not this inventory, own execution status. Paths are repository-relative.

| Task / capability | Existing symbols or source | Relevant verification | Evidence boundary / remaining work |
| --- | --- | --- | --- |
| [SH-001](../tasks/shell/SH-001.md) — Inventory and evidence | `docs/development/TEMPLATE-READINESS-LEDGER.md`<br>`docs/testing/acceptance-crosswalk.json` | `tests/tooling/preconversion-tasks.checks.mjs` | **Scope:** Static source/requirement coverage; not runtime acceptance.<br>**Gap:** This record maps every task and retained acceptance ID; qualification remains in the linked task files. |
| [SH-002](../tasks/shell/SH-002.md) — Product composition | `src/features/api.ts`<br>`src/bootstrap/features.ts`<br>`src/bootstrap/authoring.ts`<br>`src/bootstrap/plugin-runtime.ts` | `tests/runtime/feature-extension.test.ts`<br>`tests/runtime/identity.test.ts` | **Scope:** Existing explicit registrations and real-service tests; old consumer results remain historical.<br>**Gap:** Requalify minimal and richer identities through public APIs, no generic service edits. PR #15 overlaps public API/lifecycle. |
| [SH-003](../tasks/shell/SH-003.md) — Multi-view lifecycle | `src/bootstrap/mount-ui.ts`<br>`src/infrastructure/obsidian/showcase-view.ts` | `tests/runtime/mount-lifecycle.test.ts`<br>`tests/runtime/native-lifecycle.test.ts` | **Scope:** Synthetic lifecycle tests are not native host evidence.<br>**Gap:** Requalify multiple/restored/pop-out leaves, failed mounts, late completions and owned resources; reconcile PR #15. |
| [SH-004](../tasks/shell/SH-004.md) — Durable persistence | `src/application/document-service.ts`<br>`src/application/note-repository.ts`<br>`src/application/plugin-data-store.ts`<br>`src/application/plugin-data-repository.ts` | `tests/runtime/plugin-data-preservation.test.ts`<br>`tests/runtime/persistence-outcomes.test.ts` | **Scope:** Real application services; explicitly doubled host/storage boundaries in runtime tests.<br>**Gap:** Preserve Markdown/body/frontmatter, schema versions, IDs, falsy values, concurrency and uncertain outcomes; PR #15 improves precise recovery/byte limits. |
| [SH-005](../tasks/shell/SH-005.md) — Settings, paths, migrations | `src/application/preference-service.ts`<br>`src/domain/paths.ts`<br>`scripts/setup/migration.mjs` | `tests/tooling/setup-identity.checks.mjs`<br>`tests/runtime/preferences.test.ts` | **Scope:** Current writer/identity tooling, not proof of every native migration scenario.<br>**Gap:** Requalify shared settings, path configuration, corrupt/future state, isolated identity migration and actual host config-directory discovery. |
| [SH-006](../tasks/shell/SH-006.md) — Events, errors, feedback, locale | `src/infrastructure/events/typed-event-bus.ts`<br>`src/application/modal-service.ts`<br>`src/application/notification-service.ts`<br>`src/application/logging.ts` | `tests/runtime/events.test.ts`<br>`tests/runtime/feedback.test.ts` | **Scope:** Typed facts, owned policies and real-service tests; manual native accessibility remains separate.<br>**Gap:** Keep one event/error/notice implementation; complete PR #15 ownership/recovery and qualify isolation/locale/failure paths. |
| [SH-007](../tasks/shell/SH-007.md) — Design tokens and exports | `src/styles/tokens.css`<br>`docs/design/obsidian-tokens.json`<br>`docs/concepts/companion/src/style-guide-export.js` | `tests/tooling/identity-styles.checks.mjs` | **Scope:** Shell scoped CSS exists. Concept exports are not reusable shell exporters.<br>**Gap:** Implement shared alias/default/theme token validation plus deterministic safe Markdown/HTML exports; do not copy host CSS or font binaries. |
| [SH-008](../tasks/shell/SH-008.md) — Data-source contracts | `src/application/note-repository.ts`<br>`src/infrastructure/obsidian/document-storage.ts`<br>`docs/concepts/companion/src/data-source-model.js` | `tests/runtime/repository.test.ts` | **Scope:** Active-vault repository exists; source-operation taxonomy remains concept-owned.<br>**Gap:** Define shared schema/operations, explicit modes and unsupported reports; adapt the actual vault repository without fake live fallback. |
| [SH-009](../tasks/shell/SH-009.md) — Deterministic fixtures | `docs/concepts/companion/test-kit/engine.mjs`<br>`docs/concepts/companion/test-kit/adapters.mjs` | `tests/tooling/test-data-engine.checks.mjs` | **Scope:** Real concept test-kit engine, not independent shell support.<br>**Gap:** Move/qualify a shared schema-driven service: versions/seed/clock/locale, constraints, references and all declared source modes. |
| [SH-010](../tasks/shell/SH-010.md) — Fixture materialization/reset | `docs/concepts/companion/test-kit/storage.mjs`<br>`scripts/shared/file-plan.mjs` | `tests/tooling/test-data-storage.checks.mjs`<br>`tests/tooling/file-plan.checks.mjs` | **Scope:** Real temporary-filesystem kit tests and existing source planner; not shell fixture integration.<br>**Gap:** Shared reviewed .dev-vault materialization/reset must verify ownership and edits and protect config/plugins/authoring records; resolve .test-vault concept mismatch explicitly. |
| [SH-011](../tasks/shell/SH-011.md) — Data-only operations | `scripts/makers/cli.mjs`<br>`scripts/makers/load-catalog.mjs`<br>`scripts/operations/catalog.mjs`<br>`scripts/operations/protocol.mjs` | `tests/tooling/capability-discovery.checks.mjs` | **Scope:** Existing maker/catalog listing may evaluate trusted JavaScript. New discovery is a separate read-only implementation.<br>**Gap:** Qualify actual maker/operation parity, protocol versions, denied execution and independent discovery; CLI writes remain SH-012 integration work. |
| [SH-012](../tasks/shell/SH-012.md) — Shared execution/recovery | `scripts/shared/file-plan.mjs`<br>`scripts/shared/process.mjs`<br>`scripts/setup/journal.mjs` | `tests/tooling/file-plan.checks.mjs`<br>`tests/tooling/setup-identity.checks.mjs` | **Scope:** Existing operation-specific planners and journals, not a unified UI/CLI operation owner.<br>**Gap:** Bind exact tool/input/artifact/preimage plans, approvals, shared locks, cancellation and uncertain outcomes; no arbitrary subprocess forms. |
| [SH-013](../tasks/shell/SH-013.md) — Independent source export | `scripts/release/candidate.mjs`<br>`scripts/examples/plan.mjs`<br>`.github/workflows/template-authoring.yml` | `tests/tooling/archive-command.checks.mjs`<br>`tests/tooling/example-removal.checks.mjs` | **Scope:** Git-free archive testing exists; a release source archive is not a curated shell-only export.<br>**Gap:** Implement explicit source inventory/export excluding concept/approvals/host profiles/credentials while retaining standalone tooling/tests/licenses. |
| [SH-014](../tasks/shell/SH-014.md) — Additive populated-project preparation | `scripts/setup/identity.mjs`<br>`scripts/shared/file-plan.mjs` | `tests/tooling/setup-identity.checks.mjs` | **Scope:** Existing setup identity plan is not template merge/preparation over a populated authoring vault.<br>**Gap:** Implement review of additive source acquisition separately from dependency execution/deploy/enable; preserve identity/config/unrelated files. |
| [SH-015](../tasks/shell/SH-015.md) — Design interchange | `docs/concepts/companion/src/design-model.js`<br>`docs/concepts/companion/src/semantic-model.js`<br>`docs/concepts/companion/src/data-source-model.js` | `tests/concepts` | **Scope:** Concept structural validation and semantic snapshots exist; not framework-free shared interchange.<br>**Gap:** Version durable module schemas and refs, preserve draft/invalid originals, scope generation and exclude layout/local authority from semantic projection. |
| [SH-016](../tasks/shell/SH-016.md) — Field-aware maker/container semantics | `scripts/makers/entities-recipe.mjs`<br>`scripts/makers/ui.mjs`<br>`scripts/makers/plan.mjs` | `tests/tooling/makers.checks.mjs`<br>`tests/tooling/maker-catalog.checks.mjs` | **Scope:** Fourteen existing working built-ins; not arbitrary field-aware design compilation.<br>**Gap:** Keep catalog and safe structural registration; support declared fields and separate native containers from internal screens/embedded components. |
| [SH-017](../tasks/shell/SH-017.md) — Shared compiler/feasibility | `scripts/makers/plan.mjs`<br>`docs/concepts/companion/src/semantic-generation.js` | `tests/tooling/makers.checks.mjs` | **Scope:** Maker source generation exists; concept semantic generation is not a shared compiler.<br>**Gap:** Implement validated selected-scope dependency closure, explicit actions and four feasibility classes before exact maker plans. |
| [SH-018](../tasks/shell/SH-018.md) — Ownership and semantic drift | `scripts/shared/file-plan.mjs`<br>`scripts/examples/ownership.json`<br>`docs/concepts/companion/src/design-plan.js` | `tests/tooling/file-plan.checks.mjs`<br>`tests/tooling/example-removal.checks.mjs` | **Scope:** Existing preimage/additive protections; no shared design revision-to-output ownership contract.<br>**Gap:** Record exact compiler receipts, idempotent/additive reruns and semantic drift; preserve custom business code and external edits. |
| [SH-019](../tasks/shell/SH-019.md) — Independent generated reference | `src/features/tasks`<br>`src/features/projects`<br>`.github/workflows/template-authoring.yml` | `tests/tooling/makers.checks.mjs` | **Scope:** Worked examples and renamed consumer workflow exist; no shared design-to-code Tasks pipeline is qualified.<br>**Gap:** Generate Tasks from independent source export through shared operations; consume real seeded notes and qualify second non-Task consumer. |
| [SH-020](../tasks/shell/SH-020.md) — Native/a11y/performance | `scripts/testing/check-native.mjs`<br>`docs/testing/NUXT-UI-ACCEPTANCE.md`<br>`docs/testing/PERSISTENCE-LIFECYCLE-NATIVE.md` | `tests/e2e/accessibility.spec.ts`<br>`tests/runtime/resource-qualification.test.ts` | **Scope:** Historical scoped native/timing/automated-browser records; no new host, screen-reader or participant evidence in this inventory.<br>**Gap:** Run exact candidate native matrix with contained configuration, real consumers, calibrated performance and manual accessibility; keep historical unresolved failures visible. |
| [SH-021](../tasks/shell/SH-021.md) — Dependencies/security | `package.json`<br>`package-lock.json`<br>`scripts/security/dependency-policy.json`<br>`docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md` | `tests/tooling/dependency-roles.checks.mjs`<br>`tests/tooling/security.checks.mjs` | **Scope:** Exact lock and policy remain unchanged; support and live audit are separate criteria.<br>**Gap:** Recheck primary support/peer matrix, nested ESLint exception and live all-category audit; outages are blocked, not clean. |
| [SH-022](../tasks/shell/SH-022.md) — Consumer-readiness gate | `docs/tasks/shell/SH-022.md`<br>`docs/testing/acceptance-crosswalk.json` | `tests/tooling/preconversion-tasks.checks.mjs` | **Scope:** Dependency coverage is structural evidence only.<br>**Gap:** All applicable SH criteria, current consumer/export/native/security outcomes and accepted prerequisites must pass; otherwise gate remains blocked. |

## Retained acceptance coverage, with no promoted statuses

The [routing crosswalk](preconversion-acceptance-tasks.json) contains every AC-01–96
and NUI-01–34 exactly once. It adds task routing only. Original text, required modes,
assertion links and current historical outcomes remain in the [machine plan](../testing/test-plan.json),
[assertion crosswalk](../testing/acceptance-crosswalk.json), [closure ledger](ACCEPTANCE-CLOSURE-LEDGER.md)
and [Nuxt UI matrix](../testing/NUXT-UI-ACCEPTANCE.md). No acceptance row, gap or floor
is removed, and no historical assertion counts are added together.

The latest merged persistence record's **2 verified / 55 partial / 39 not-run**
remains historical, not this candidate's result. Baseline fixture passes cannot
promote native, whole-product or generated-consumer acceptance. Every task acceptance
row still has to be evaluated against the exact candidate. The structural graph
check confirms all 21 preceding SH tasks are reachable prerequisites of SH-022.

Publication-only execution (remote releases, tags, listing submission, approval of
public destinations) remains PUB work and is excluded here. AC-34's remote mutation
and AC-35's listing steps are routed accordingly. Source/artifact integrity,
independent export, dependency support, path safety, actual runtime behavior and
current evidence freshness stay in SH-013/SH-020/SH-021/SH-022 even when the old PRD
also described them as release requirements. Existing release tooling is retained,
not invoked for publication and not treated as a reason to waive shell safety.

## Hard restrictions retained at the shell gate

The exact lockfile and installed policy must remain matched. Qualified environment:
Node 24.21.0 and npm 11.19.1; local container observation is Node 22.16.0/npm 10.9.2,
so dependency-free local probes are supplemental, not pinned-environment qualification.
Direct network/DNS access is unavailable here; source acquisition used the connected
GitHub artifact API. No local registry audit or native-host result is claimed.

Coverage thresholds remain core lines 95%, statements/functions/branches 90%;
whole-production lines/statements/functions 90%, branches 85%, with all source inputs
accounted for. Code-line limits remain main 100, other source 400, tests 450;
production complexity 10 cyclomatic / 15 cognitive and duplication 3% remain unchanged.
These are configured thresholds, not measurements from this inventory.

The documented nested ESLint 9.39.5 support exception is still unresolved in the
inspected source; root ESLint 10 and a clean historical audit do not close it.
SH-021 must recheck current upstream releases and support before adopting any change.
Historical Windows Appearance, Linux pop-out and interrupted/cleanup failures remain
unresolved; later scoped passes did not explain their root causes. Required supported
platform/native, manual screen-reader, device/theme and calibrated performance evidence
must be performed or left blocked. No participant or independent human review is invented.

## Concept implications and conversion boundary

CX-001–007 remain an evolving browser concept. The current maintained source/build
inventory, editor review, source operations, test kit and design-system documents
are inputs to those tasks, not proof of SH services. Do not replace authored modules
with edits only to generated HTML. The .test-vault default in the newer concept kit
is a recorded integration discrepancy: shell work preserves .dev-vault and actual
host configuration discovery. No data is moved or installer target changed here.

SH-022 and CX-007 remain blocked. CP-001 and all PUB tasks are excluded. The next
executable slices after this inventory are SH-011's data-only catalog/protocol and
SH-015's shared interchange contract; they do not depend on unfinished runtime edits
in PR #15. Ready generic shell work takes precedence over concept feature work.

## Review scope

Inventory construction and a separate adversarial review were performed sequentially
in this session. No separate worker or independent human reviewer was available.
The review checked live heads, archive trees, source paths, graph coverage, unchanged
acceptance files/lock/thresholds, publication separation and the concept/native boundary.
This is an inventory review, not independent product approval or shell certification.
See the [execution checkpoint](PRECONVERSION-GAUNTLET.md) and linked evidence for actual
commands, negative controls, failed attempts and subsequent implementation qualification.
