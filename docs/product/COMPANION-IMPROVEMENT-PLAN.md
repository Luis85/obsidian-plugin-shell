# Shell-first companion improvement plan

**Revision:** 1.2 · **Date:** 2026-09-24 · **Status:** Planned work, not implementation evidence.

**Controlling decision:** Qualify and ship the standalone framework developer kit containing shell, shared TypeScript CLI and JSON project generator first. Continue concept design secondarily; convert its agreed scope on the shipped framework; publish the companion only after native qualification. See the [detailed implementation plan](../development/FRAMEWORK-CLI-GENERATOR-PLAN.md).

This revises the supplied `COMPANION-IMPROVEMENT-PLAN.md` (SHA-256 `7c8236b401ca4d3c9c8530dcd8ffecd37b52007546b40e21f16bcfde5c6cdad8`). Its product outcomes are retained, but its companion-first investment order and immediate root-identity recommendation are superseded by the owner's subsequent shell-first instruction. Baseline inspected: PR #5 at `e413ec628b4227c4b8dc8b6ec3d12b8487533557`. That is the historical planning baseline. The [current bounded review](../development/PR5-FRAMEWORK-READINESS-REVIEW.md) inspects PR #5 at `e71c655fe376e51a520fb8f194800e9294eb8e4e`, including Windows CI failures and missing PR #17 discovery integration; this revision is documentation, not their implementation.

Read the [delivery strategy](DELIVERY-STRATEGY.md), [task index](../tasks/README.md), [traceability crosswalk](../tasks/TRACEABILITY.md) and [companion architecture contract](../architecture/COMPANION-ON-SHELL.md).

## Integration update — 2026-09-25

PR #20's TypeScript project compiler and `shell.mjs` entry now exist in the base and are preserved by the PR #18 reconciliation. [SH-035](../tasks/shell/SH-035.md) retains that compiler task, formerly a colliding SH-023, under verification; SH-028 extends its existing behavior. The [generator guide](../development/COMPANION-GENERATOR.md) describes commands available now. Earlier pending descriptions below specify the complete framework target, not a request to discard or recreate the implemented compiler. A compiled developer-kit release and native companion readiness remain unqualified.

## 1. Product relationship

Plugin Shell is the reusable foundation: services, safe persistence, host integration, styles, generators, tooling and tests. It must be usable directly by a developer without installing the companion.

The companion is a future shell-based product and a demanding reference consumer. Its concept remains under active feature development. It must not privately reimplement missing shell capabilities or convert a browser simulation into a release claim.

The generated plugin is developer-owned source and independently built runtime assets. It must not depend on an installed companion, the maintainer repository or a remote service to continue ordinary development.

The primary entry is a downloaded framework release archive, not an installed plugin. An install-companion-first experience remains an optional later route; it does not delay standalone framework shipment.

## 2. Baseline and limits

The [parent PRD](PRD.md), [authoring guide](../development/AUTHORING-TOOLS.md) and [readiness ledger](../development/TEMPLATE-READINESS-LEDGER.md) already describe substantial implemented shell services and makers. Do not rebuild them because an older companion baseline listed fewer capabilities.

The [single-vault contract](../concepts/companion/SINGLE-VAULT.md) and [Data Sources contract](../concepts/companion/DATA-SOURCES.md) distinguish modeled behavior, virtual source previews and real execution. The later [editor review](../concepts/companion/EDITORS-REVIEW.md) is a regression source, not proof that native conversion happened.

Each task starts by reconciling its scope with current source and exact evidence. Historical test counts, a successful concept build and a clean dependency audit are not blanket native, compatibility or release qualification. Preserve all applicable legacy requirements and existing quality thresholds.

## 3. Delivery lanes and gates

| Lane | Priority | Completion boundary |
| --- | --- | --- |
| Framework capabilities and shipment | P0, highest | SH-022 technical readiness; SH-034 separately authorized shipment of shell, CLI and generator. |
| Continuing concept development | P1, secondary/parallel | CX-007: bounded conversion scope reviewed, not whole-product feature completion. |
| Native companion | P2 | CP-010: agreed features implemented on shell and natively qualified. |
| Companion publication | P3, last | Explicitly authorized native companion artifacts compatible with the shipped framework. |

Native conversion requires SH-022, SH-034 and CX-007. Companion publication requires CP-010; first framework shipment does not. Generated-plugin release tooling belongs in SH-031 before framework shipment. Technical readiness never replaces explicit approval for public actions. A new concept requirement can reopen an affected shell task before native adoption.

## 4. Shell capability target

The shell must cover reusable product composition; lifecycle and multiple views; safe generic Markdown and plugin-data repositories; validated settings and paths; typed events; errors, notifications and logging; localization; scoped modular styles; tokens/exporters; source-operation contracts; deterministic test-data generation; machine-readable operations; safe planning/apply/recovery; standalone export; additive template preparation; generators; and qualified consumers.

These are capabilities, not mandatory new packages. Preserve the current architecture and small public feature API. Extend only demonstrated gaps. Product-specific designers belong to the companion, while general contracts and export/generation behavior must work in a standalone consumer or CLI.

## 5. Developer journeys

**Primary standalone journey:** download framework release asset → extract into new project folder → dependency-free compiled CLI bootstrap → configure → import project JSON → resolve differences → review/generate boilerplate → develop/build/test → explicitly publish the generated plugin → maintain. Direct Node and npm entry points share handlers. The companion is never required.

**Future companion:** install native companion → define one project → design without external developer tools → optionally add shell source to the same vault → generate a reviewed implementation → test in an isolated vault → continue with an editor/CLI.

A design-only user must not receive persistent missing-Node warnings. An experienced developer can use a minimal design. Selected generation scope and its dependencies determine readiness; an unrelated draft does not block a valid feature.

## 6. Continuing concept feature work

Maintain a feature inventory covering requirements, actions, sitemap, native containers/internal screens, entities/relationships, components/variants, source operations/usages, test data and design-system authoring. Record unresolved semantics and deliberately deferred capabilities.

Improve the concept's lifecycle and editor coherence, but do not declare the concept complete to justify conversion. CX-007 selects the native increment and its acceptance scenarios. Further features may be designed afterward through reviewed scope changes. Every concept side effect and receipt remains labeled simulated unless separately implemented.

## 7. Information architecture and interactions

Use Overview, Design, Code, Verify & release, and Runs & recovery as a proposed simplified hierarchy. Validate it through concept tasks; it is not a demand to remove existing capabilities. Keep help/preferences as utilities and advanced catalogs contextual.

Unify outline/canvas/inspector selection, drafts, Edit/Locate/Remove actions, used-by and impact inspection. Keep containment, navigation, entity relationships and data flows distinct. Selection and viewport state are not domain mutations. No-ops preserve Redo; moving a card does not invalidate generated code.

Preserve the recent editor fixes with explicit regression scenarios. Provide non-drag and keyboard alternatives, visible focus, intelligible errors, narrow-pane layouts, theme compatibility and focus restoration. Do not require a tour for essential operations.

## 8. Canonical records and configuration

The native UI projects Markdown design records with durable IDs, record kinds, schema versions, project ownership and explicit references. Preserve human text and unrelated frontmatter. Complex schemas need a bounded owned serialization, not an unsupported claim about native Properties editing.

Generic serialization, revision checks and recovery belong in shell services. Companion settings select safe project-relative authoring paths; they do not create a second design database or allow imported notes to authorize execution. Multiple leaves share committed state, not drafts.

The standalone development project root is independent of any Obsidian vault. The companion may retain its same-vault authoring route; imported data cannot choose an arbitrary host root. Preserve existing `.dev-vault` projects; the new-kit `.test-vault` default is introduced only with qualified configuration/migration behavior. `codebaseFolder` and `testsFolder` default to `src` and `tests`; propagate custom paths through all generated build/test tooling.

## 9. Shared design-to-code compiler

Implement the compiler as shared standalone tooling over existing makers:

```text
validated design → selected dependency closure → normalized input
→ capability check → composed source plan → review → apply
→ actual checks → ownership/evidence receipt
```

Version the design schema, template, operation protocol and generator contract independently. The companion consumes a data-only catalog rather than scanning or executing arbitrary project code to render forms.

Map identity to manifest/package namespaces; features/use cases to registrations and actions; native containers to native views; internal screens to components/navigation; entities to schemas/repositories; components to props/events/styles; operations to typed ports; usages to explicit bindings and mappings. A component or internal screen must not accidentally become another native view because a generic maker defaults that way.

Classify outputs as supported scaffold, contract only, manual implementation required or blocked. Never silently drop unsupported design elements or present placeholder behavior as implemented.

## 10. Behavior and initial executable reference

Add a small action contract: trigger, inputs, validation, use case/operation, read/write intent, success, failure and feedback/navigation. Button captions alone do not specify business behavior.

Prove one bounded Tasks plugin: native container, internal list and editor, Task schema, vault-backed operations, create/read/update actions, configurable note path, opening command and tests. It must compile and create/read actual notes in the isolated test vault, preserve drafts on failure and survive companion removal.

First prove this through the shell CLI/fixture pipeline; then make the companion drive the same behavior. The native companion does not get a separate generator just to achieve the demonstration.

## 11. Data sources and test data

Preserve Source → Operation → Usage separation. Input enters a source; output leaves it. Request parameters or write responses do not automatically imply synchronization. Persisted entities, create/update inputs and external DTOs are distinct when their contracts differ.

Vault adapters are the initial executable reference. External API/database contracts may initially produce typed ports, fake providers and explicit implementation obligations. Unsupported production adapters fail explicitly; no hidden fake fallback or successful no-op writes.

Every supported source kind needs a declared test mode: real contained vault fixtures, in-process operation simulation, or a supported isolated adapter fixture. Define seed, clock, locale, schema/generator version, counts, relationships and edge scenarios. Faker is an implementation option, not a substitute for constraints or deterministic tests.

Preview fixtures before writing. Only owned test records may be reset, and only after exact review. Never populate the authoring vault or a live external service by default. Preserve partial outcomes and receipts. Exclude test-only providers/data from production unless intentionally declared.

## 12. Design system and exports

Start with shell-owned, versioned tokens for typography, spacing, sizing, colors and component semantics, mapped to host theme variables. Reuse the modular CSS pipeline without global resets, remote fonts or companion-only theme ownership.

Provide deterministic Markdown and self-contained HTML documentation export from the shared token model, with safe text rendering and theme-aware examples. Both exporters must be callable without the companion. Unsupported token shapes remain validation errors rather than silently disappearing.

The concept then designs the authoring UI; the native companion later implements it using the same token/export APIs. Token editing must distinguish the generated project's design system from the companion's own host-integrated UI. Do not claim accessibility merely from generated documentation.

## 13. Safe preparation, operations and recovery

The primary setup prepares an extracted standalone project. Optional companion-driven additive preparation starts from a vault already containing notes, host configuration and the companion. Inspect a pinned template artifact in bounded staging, derive exact create/update/unchanged/conflict entries, protect the actual host profile, Git metadata, existing design and unrelated files, and recheck preimages before writes.

Share plan/apply, locks, cancellation, journals and receipts across CLI and UI. Review downloading, source writes, dependency execution, builds, deployment and activation separately. Receipt freshness depends on relevant input and tool identities. Imported approval is never local execution permission.

Exercise traversal, symlinks/reparse points, case aliases, unsafe archives, shell-like text, large output, partial writes and concurrent external edits. Recovery only restores bytes still owned by the operation. Multi-file and package-manager operations are not universally atomic or reversible.

The earlier research identified a community-policy question around in-plugin installation. Resolve current rules and the concrete workflow before publication. Preserve a user-run CLI handoff rather than assume an exemption. No policy decision or security sandbox is asserted by this plan.

## 14. Ownership and safe iteration

Record design IDs, generated files, template/compiler versions, original generated hashes and actual checks. Missing targets may be created; identical outputs are no-ops; approved managed files may be updated only under a supported ownership contract; customized and unrelated files are preserved.

Separate semantic fingerprints from layout, selection and viewport state. Explain affected source/tests when an entity or action changes. Keep first generation, additive generation, template upgrade and runtime-data migration distinct. The first release does not promise arbitrary bidirectional source/design synchronization.

## 15. Native conversion on shell

CP-001 must create a genuine product composition using the same maintained shell services and public extension points, initially proving native mount, persisted project data and cleanup. CP-002 through CP-008 implement the remaining selected workflows. CP-009/CP-010 qualify the complete native increment.

Do not embed the HTML as a production iframe/webview, fork generic services or import the companion into standalone templates. Replace concept globals, virtual filesystem, fabricated runs and localStorage authority with typed native services and durable records. Preserve accepted interaction behavior while respecting the existing architecture and quality gates.

## 16. Quality, performance and product validation

Track model/contract, real-filesystem, generated-consumer, browser, real-host, manual accessibility and performance evidence separately. Test IDs and counts are not interchangeable user journeys. Keep failed, stale, skipped, externally blocked and unexecuted results visible.

Qualify startup, first-open, declared-scale graph interaction, log bounds and repeated open/close resource behavior. Record hardware, host/tool versions, fixture sizes, sample method and limitations. Calibrate budgets before asserting them; no new numeric service-level claim is established here.

Run three native acceptance journeys: design without external tooling; design to a working plugin; and developer ownership after customization and companion removal. Also run standalone shell acceptance independently. Use formative studies, voluntary feedback and user-reviewed diagnostic exports rather than client-side telemetry. Proposed study targets are not observed product metrics.

## 17. Task breakdown and change control

The [57 individual tasks](../tasks/README.md) contain purpose, baseline, scope, acceptance, verification, evidence and dependencies: 35 shell/framework, seven concept, ten native companion and five companion-publication tasks. SH-023–SH-034 capture the CLI/archive/generator refinement. Task frontmatter is authoritative; SH-022 is blocked and no implementation is completed by this revision.

The [crosswalk](../tasks/TRACEABILITY.md) accounts for the supplied plan's 18 sections and E01–E12 packages. Phase priority overrides their original P0/P1 labels. Scope additions are allowed; append stable IDs, update dependency links and reopen impacted gates instead of renumbering existing work.

Each implementation PR should close one coherent task or a justified tightly coupled slice. Reconcile current implementation before editing; record evidence for existing capabilities instead of treating the entire task as greenfield work. Retain owner approval separately from technical readiness.

## 18. Companion publication last

After native readiness, decide and rehearse companion distribution against the already shipped framework kit, including root metadata, version compatibility, licenses/notices, checksums/provenance, documentation, privacy/network disclosures, support and update/recovery guidance.

Do not switch the root manifest merely to match the future product narrative. Select and qualify the standalone framework distribution through SH-026/SH-032/SH-034 before companion conversion. Select the later companion topology against that compatible shipped foundation after native qualification. A nested manifest alone is not an assumed solution; publication tasks recheck current primary-source requirements.

PUB-004 requires new, explicit owner approval for the exact release candidate and destinations. No automatic tags, releases, listing submissions, permission changes or activation are authorized. PUB-005 validates installation and recovery after an authorized release.

**Priority conclusion:** ship the qualified shell, project generator and TypeScript CLI first; concept work remains open; native conversion uses that shipped framework; companion publication is last. No publication is authorized by the roadmap.

## Source and document provenance

Repository baseline: [PR #5](https://github.com/Luis85/obsidian-plugin-shell/pull/5), commit `e413ec628b4227c4b8dc8b6ec3d12b8487533557`. The full previous companion requirements remain in [COMPANION-REQUIREMENTS-0.3.md](COMPANION-REQUIREMENTS-0.3.md). The prior root guide is preserved in [TEMPLATE-GUIDE.md](../../TEMPLATE-GUIDE.md).

The supplied plan cited official Obsidian developer policies, submission/Vault/security documentation, Nx Console and W3C accessibility guidance. Those are retained research leads, not newly verified external facts in this documentation change. Publication and platform tasks must recheck the applicable primary sources when executed; no acceptance guarantee is inferred.
