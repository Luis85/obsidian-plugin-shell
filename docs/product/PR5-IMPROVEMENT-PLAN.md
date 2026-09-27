# PR #5 — improvement and polishing plan

**Date:** 2026-09-27. **Baseline:** `ec70e2cee7d8aed6e794a15252b2b9cc48b05dcf`. **Status:** Proposed execution plan; only the documentation reconciliation is performed by this review update. No implementation package, qualification gate or release is marked complete merely by being listed here.

This is the tactical follow-up to the [integrated product review](PR5-PRODUCT-REVIEW.md). It supplements, rather than replaces, the [MVP implementation plan](../prds/MVP-IMPLEMENTATION-PLAN.md), [delivery strategy](DELIVERY-STRATEGY.md) and existing SH/CX/CP/PUB tasks. IP identifiers are review work-package IDs, not replacements for those task IDs. Assign accountable people before execution; the owners below are responsibility roles, not inferred assignments.

## 1. Outcome and sequencing

Deliver a coherent path from an exact developer kit through reviewed design, understandable generated output and safe continued development. Preserve the complete native companion as a separate required outcome of the full MVP. Maintain the existing order: framework technical readiness → separately authorized framework shipment → agreed native companion conversion → native acceptance → separately authorized companion publication.

Do not start a new compiler, alternate project format, parallel companion or generic workflow runtime. Do not count prototype behavior as native acceptance. Optional Hindsight and Jev work is outside the framework critical path unless the owner explicitly changes that decision.

| Increment | Work | Exit decision |
| --- | --- | --- |
| A — establish one current contract | IP-11 CI inventory repair first; IP-01 and IP-03; evidence reconciliation | Every entry identifies the correct artifact/model; supported schemas and status are unambiguous |
| B — complete the developer golden path | IP-02, IP-04, IP-05 | Blank and JSON users reach an independently built, useful clickdummy without manual source repairs |
| C — qualify focused authoring and consumer experience | IP-06–09, IP-11–13 | Applicable functional, accessibility, native-starter, safety and performance evidence supports the candidate |
| D — framework shipment | IP-15F after SH-022 and fresh approval | Approved bytes redownload and pass isolated first-use smoke; SH-034 recorded |
| E — native companion | IP-10 after SH-034 and CX-007; repeat applicable IP-08/11/12/13 | Actual generated companion edits, persists, reopens and regenerates through public shell capabilities |
| F — companion shipment / optional lanes | IP-15C after CP-010; IP-14 independently | Separate authorized publication; optional tooling never becomes a hidden default dependency |

There is no calendar commitment here. Before starting an increment, recheck the branch, reconcile concurrent work, select a bounded scope and agree effort from the actual remaining implementation. Native conversion is a larger capability program, not a cosmetic polish task.

## 2. Current MVP work-package reconciliation

These are observed boundaries at the reviewed source, not task-frontmatter changes.

| Original package | Current status | Remaining closure |
| --- | --- | --- |
| WP-01 baseline/provenance | Source and current artifact identities recovered | Keep the gap register and exact-candidate receipts current |
| WP-02 Journey Lens | Real integrated editor and 26-assertion authoring flow evidenced | Complete command/branching/contextual-navigation, accessibility and scale acceptance |
| WP-03 model/migrations | v6 authoring reader and compiler integration implemented | Public project schema discovery, shared fixture parity and full transition closure |
| WP-04 self-project | Modern v6 export exists and UI round trip is evidenced | Clarify retained checked-in v5 versus modern generated v6; reconcile complete capability inventory and golden publication convention |
| WP-05 generated output | Independent source install/verify/build and nine offline preview assertions passed in hosted evidence | Full intended interaction coverage, representative content and visual fidelity |
| WP-06 scopes/concepts | Project/feature/improvement data-only concept intake implemented | Selected-output dependency closure, remaining remap/reconciliation UX and full acceptance |
| WP-07 native companion | Generated declarations/scaffolds, not the complete native product | Implement actual editor capabilities and native persistence/self-hosting acceptance |
| WP-08 released-kit entry | Packaging, setup/new, import and install foundations exist | Unified starter/JSON/GitHub path, interruption/resume and exact-archive all-OS replay |
| WP-09 release workflow | Guarded preparation/operation foundations exist | Profile-specific complete evidence, authorized remote integration and recovery |
| WP-10 acceptance/shipment | Several targeted integrated workflows pass | Close applicable current-head cases, obtain separate approvals and replay published bytes |

## 3. Work packages

### IP-01 — current status and documentation contract

**Priority:** P0. **Owner:** Product/technical writing, with QA. **Findings:** R01. **Depends on:** no implementation dependency. **Trace:** MVP-24, A18.

Maintain one current review/status entry linked from the shell overview, MVP index, companion guide and compiler/clickdummy guides. Distinguish source checkout, compiled kit, v5 compatibility concept, current v6 authoring build, generated clickdummy and native plugin. Correct stale “not implemented” statements where later integrated source exists, while retaining historical execution records and their exact hashes.

**Acceptance:** each documented primary command matches the public catalog; each artifact has a purpose, schema/build identity and next action; dated records are clearly historical; no source generation, native acceptance or release is implied by an inspection command. Check relative links explicitly because the repository's broad docs checker excludes `docs/`. The present documentation update addresses these navigation/status corrections; automated ongoing drift checks remain work.

### IP-02 — one extracted-kit onboarding and recovery flow

**Priority:** P0, framework entry. **Owner:** CLI/distribution with UX. **Findings:** R02/R17. **Depends on:** IP-01 and the model decisions from IP-03. **Trace:** MVP-01–04/24, A01–A04/A18; SH-026/027/032.

Unify starter/blank and imported-JSON setup in the extracted folder, reusing the existing catalog, configuration and planner. Do not route through `new` in a way that rejects kit-owned files. Keep identity defaults from imported data and separately review changes. GitHub is optional; show a complete local path when skipped and preserve existing remotes. Make configuration, generation, install, verification and native installation separate reported outcomes.

**Acceptance:** exact ZIP, no checkout/global CLI/dependencies, tested on Windows/macOS/Linux; both setup branches succeed; wrong tools, modified kit, foreign content and identity conflicts fail intelligibly. Cancel before writes, interrupt after configuration, fail dependency installation, resume from verified state and reject changed inputs. Machine mode never prompts. A fresh user can follow the shipped README without maintainer-only instructions. Do not publish to obtain this evidence.

### IP-03 — authoritative v6 schema and compatibility seam

**Priority:** P0, contract. **Owner:** Shared contracts/compiler. **Findings:** R03/R16. **Depends on:** IP-01. **Trace:** MVP-09–12/23, A08/A09/A17; WP-03/04.

Publish/discover the complete project-v6 schema and version metadata through a defined CLI operation or schema artifact. Keep operation transport, concept transport, visual IR and project semantics separate. Reuse the current authoring reader; do not weaken bounded runtime validation. Decide and document how the modern self-project is retained without relabeling the v5 fixture as current.

**Acceptance:** the same positive/negative fixtures exercise browser and Node paths and JSON Schema where applicable. Include v1–v5 migrations, preserved revision pins/native integrations, unknown future data, unsafe keys, invalid references, collisions and bounds. Compare semantic round trips, not only successful parse. Preserve the documented historical geometry loss; migration never guesses routes or silently discards unknown saved content. One owner coordinates contract and generated-schema changes.

### IP-04 — selected feature/page/component generation

**Priority:** P0 for the scoped-generation promise. **Owner:** Compiler/generator. **Findings:** R10. **Depends on:** IP-03. **Trace:** MVP-13–15/18–20, A10/A13/A14; WP-06, SH-028.

Add explicit selection to the existing generation plan with dependency closure, shared-definition reuse, impact on owned artifacts and clear unsupported references. Build on reviewed canonical imports and existing makers; keep the refusal of an unimported in-place input. Clarify remapping/reuse versus refusal during concept intake; do not auto-merge changed IDs or stale improvements.

**Acceptance:** feature, page and component slices with shared dependencies generate exactly the reviewed set; incomplete or cyclic closure fails before writes. Identical replay is a no-op, authored extension files survive, managed-file conflicts block, retired outputs are named and not silently deleted. Test addition, improvement, conflicting base and repeated import against an independently edited consumer, not only pristine snapshots.

### IP-05 — generated clickdummy fidelity and useful default content

**Priority:** P1, but required for a credible prototype handoff. **Owner:** UX plus compiler/seed authors. **Findings:** R05. **Depends on:** IP-03; run full-project cases before IP-04 lands. **Trace:** MVP-14–16/23, A11/A17.

Isolate defects across design seed, lowering, styles and preview chrome. Improve the maintained sources so headings, content hierarchy, spacing, controls, navigation and intended states are useful in the generated result. Remove placeholder-like names from user-facing examples where actual sample copy is intended. Keep simulation labels and unavailable writes explicit.

**Acceptance:** small capture/task project plus companion fixture; generated source installs/builds/verifies outside the repository; exact HTML runs with network blocked from a file origin; intended links/local interactions and modal return work. Compare real output to approved semantic/visual expectations at desktop and narrow widths. No manual post-generation edits, iframe wrapper, fake successful persistence or automatic screenshot-baseline acceptance.

### IP-06 — focused authoring, vocabulary and first success

**Priority:** P1. **Owner:** Product/UX with presentation. **Findings:** R06/R17. **Depends on:** IP-01. **Trace:** MVP-05/08/24, A05/A07/A18.

Reduce competing navigation while retaining expert access. Provide a focused editor state, predictable contextual Back, an understandable save/draft indicator and one recommended next action. Keep the editor inside the existing companion rather than adding a nested shell. Clarify surface/page/component/journey/source vocabulary and transition from example data to the user's own project.

**Acceptance:** observed tasks with a small, deliberately recruited mix of developer and non-developer authors; record recruitment, sample size and limits rather than treating it as market proof. Tasks cover starting a project, adding a page, linking a journey, opening a component, exporting and recovering a rejected edit. Measure time, assistance, errors and confidence locally. All critical tasks are completable without undocumented maintainer guidance; report remaining assistance instead of inventing a pass rate.

### IP-07 — editor interaction completeness and deterministic arrangement

**Priority:** P1. **Owner:** Companion editor/domain. **Findings:** R07. **Depends on:** IP-03; coordinate with IP-06. **Trace:** MVP-05–08, A05–A07.

Complete the command/state matrix for selection, search, create, move/reorder, delete impact, route editing, navigation links, branching journeys and adjacent editors. Add explicit deterministic arrange/fit/focus behavior and inspect post-edit collisions. Keep saved geometry separate from semantic hierarchy and routes; user-authored positions are not overwritten without an explicit operation.

**Acceptance:** named fixtures for missing coordinates, deep/wide trees, saved positions and post-insert layout; identical arrangement is deterministic; explicit arrangement is undoable; moving/renaming never rewrites routes. Dirty/stale drafts, deletion blockers and immutable component revision constraints remain protected. Pointer, keyboard and non-drag paths reach equivalent supported outcomes.

### IP-08 — accessibility, localization and narrow-leaf qualification

**Priority:** P1, required before claiming supported accessible use. **Owner:** Accessibility/QA with UX. **Findings:** R08. **Depends on:** representative IP-05/06/07 surfaces; repeat for IP-10. **Trace:** A05/A11/A19/A20.

Audit actual rendered authoring and generated controls, then native surfaces when available. Cover keyboard focus order/return, no-drag operations, tree semantics, status/error announcements, target size/spacing, contrast, reflow, zoom and reduced motion. Audit supported-language text and fallback. Keep formal conformance and native mobile claims outside completed scope until evidenced.

**Acceptance:** record browser/host/assistive-technology versions and exact cases, including screen-reader operation and narrow native leaves. Resolve blocking focus loss, hidden errors and inaccessible actions; retain documented exceptions and open issues. Automated accessibility checks supplement manual tasks. Re-run the explicit accessible-label regression; do not replace it with a convenient CSS selector.

### IP-09 — real-host native starter behavior

**Priority:** P1; a blocker for any unsupported “native behavior qualified” claim. **Owner:** Host adapters/native QA. **Findings:** R09. **Depends on:** current native source; use only an approved isolated vault. **Trace:** A13/A19; native integration guide and existing starter workflow.

Retain current TextFileView/requestSave behavior. Test real editing/autosave, failed save, close/unload, reopen, malformed/raw text preservation, external edits, rename/delete, association conflicts and multiple leaves. Exercise context-menu availability and handlers after disposal. Resolve actual defects in public shell adapters and generated definitions, not disposable output.

**Acceptance:** two generated starter projects build independently, actual files contain expected bytes, failure never becomes a success notice, and unrelated files/associations/leaves survive. Record host version, artifact identity and supported platforms. No change to Restricted Mode or personal-vault deployment. A mocked lifecycle test remains a separate evidence layer.

### IP-10 — complete native companion through maintained capabilities

**Priority:** P0 for complete companion MVP, not a prerequisite to first framework shipment. **Owner:** Companion application/native integration. **Findings:** R04. **Depends on:** SH-022, SH-034/IP-15F and CX-007 under the retained delivery strategy; shared contracts from IP-03. **Trace:** MVP-11/12/17/23, A12/A19; WP-07, CP-001–010.

Create a capability inventory for every required companion interaction: declaratively compilable, trusted implemented module, or explicit missing capability. Implement actual sitemap/page/component authoring and project persistence through public shell contracts. One canonical project owner and per-view drafts consume native adapters. Companion-specific capabilities must not leak into unrelated consumers.

**Acceptance:** exact kit plus exported self-project, no maintainer checkout, no manual repairs: generate/install/build, import, edit sitemap and page/component data, save, close/reopen, open multiple leaves, provoke stale/failing writes, recover, export and regenerate. Required editor engines are real implementations, not adapter stubs or an embedded concept. Each of the 31 currently pending requirement records receives its own disposition and real evidence; counts are not automatically promoted.

### IP-11 — candidate-bound quality and evidence consolidation

**Priority:** P0, qualification. **Owner:** QA/DevOps with maintainers. **Findings:** R11/R16. **Depends on:** begins immediately; closure depends on the selected candidate's changes. **Trace:** MVP-23, A17, SH-022/032/033 and applicable inherited gates.

First fix the demonstrated `METRIC_UNCLASSIFIED_INPUT: scripts/hindsight/embedded.py` failure in the maintainability inventory. Explicitly classify the supported optional Python tooling and tests, retain exact source-byte inventory and separate language-appropriate verification; never add a broad directory ignore or count unmeasured Python as healthy JS/TS/Vue production. Add regressions proving supported files are inventoried while unknown languages/paths, changed bytes and production-Python substitutions still fail. Rerun the previously failing full verification path, not just the memory workflow.

Reconcile all workflows and A01–A20 outcomes against exact source/kit/input/output identities. Preserve separate contract, compiler, generated source, browser, real host, manual and release layers. Keep current suite inventory, negative controls, coverage floors, architecture/analyzer gates and source-size constraints intact. Document ownership for legacy assembly, real Vue integration, compiler adapters and optional tooling.

**Acceptance:** every claimed completed case links to an assertion/protocol and candidate; failed, skipped, blocked and unexecuted modes remain visible. Full current-head workflows finish without bypasses; re-run affected layers after integrations. Retain artifacts before expiry and prove independent consumer operation. Documentation-only tests do not substitute for actual behavior, and reported compiler `not-run` build fields are reconciled with later build receipts without rewriting the original receipt.

### IP-12 — scale and performance baseline

**Priority:** P1. **Owner:** Performance/QA with editor/compiler owners. **Findings:** R12. **Depends on:** IP-03 and representative IP-05/07 outputs. **Trace:** A20 and existing performance requirements.

Define fixtures at small, representative and bounded-large sizes, staying inside documented limits. Record cold/warm timings and memory for load, import/export, selection, typing, commit/undo, arrange, generation and repeated open/close. Inspect snapshot/validation costs before optimizing. Establish agreed budgets from measured baselines; no invented latency target is pre-approved by this plan.

**Acceptance:** reproducible machine/tool/artifact metadata, percentile/distribution rather than a single favorable sample where appropriate, bounded history, no retained-listener growth in repeated lifecycle cases, and no weakening of existing gates. Every optimization preserves deterministic output and recovery behavior.

### IP-13 — threat model, privacy-safe diagnostics and support

**Priority:** P1. **Owner:** Security/privacy plus developer support. **Findings:** R13/R17. **Depends on:** IP-01/03; repeat for new native/providers. **Trace:** MVP-04/11/18/21–24, A04/A13/A15/A18/A19.

Document data and authority boundaries across imports, authored literals, build dependencies, native writes, diagnostic/IR export and memory/AI providers. Improve recovery guidance by failure phase; retain explicit consent for process execution and sensitive resolved-request/trace exports. Create an opt-in local support bundle with identifiers and declared safe metadata, not raw notes or credentials.

**Acceptance:** hostile data and sensitive synthetic fixtures stay inert or are correctly blocked/redacted; unrelated project/client settings survive; uncertain writes never receive blind retry advice. A second person can reproduce a report from the minimal project and identify safe recovery. Verify current Obsidian policy/distribution disclosures separately from developer-CLI behavior; no hidden telemetry is introduced.

### IP-14 — qualify optional tools without widening the default product

**Priority:** P1 for advertised Hindsight behavior; P2 for live Jev integration. **Owner:** Agent tooling / decision-workbench product. **Findings:** R14/R15. **Depends on:** IP-13; independent of framework shipment.

For Hindsight, use synthetic data with the real supported SDK and selected provider. Exercise no-LLM CLI retain/recall and explicit reflection refusal, then a genuinely provisioned keyless full provider, actual desktop discovery, stopped-profile/restart behavior, worktrees, disable/disconnect and foreign-settings preservation. Record account/model route without secrets and distinguish real SDK behavior from fixtures.

For Jev, continue UX/domain refinement within the offline contract. Any proposed live Companion bridge first needs a separate approved design covering schema mapping, capability authorization, response validation, human review, cancellation, idempotency, retries and event durability. No new live execution is implicitly authorized here.

**Acceptance:** no memory install/provider requirement for normal shell use; actual advertised client/platform cases have receipts; optional failure is recoverable. Jev still labels synthetic results and cannot convert a probability/rule decision into unauthorized native effects. Preserve the distinct schemas and consumer-kit exclusions.

### IP-15 — separate authorized publication tracks

**Priority:** P0 for shipment. **Owner:** Release/maintainer with product approval. **Findings:** R18. **Trace:** MVP-21–23, A15–A17; SH-031/032/034, PUB-001–005.

**IP-15F, framework:** depends on SH-022 and applicable IP-02–09/11–13 evidence, not IP-10. Prepare/rehearse the retained kit and consumer release tooling. Exercise denial, changed candidate, network/rate failure, partial upload and foreign-asset conflicts using an explicitly approved disposable destination. Obtain fresh approval for the actual candidate/destination/actions, publish only approved bytes, redownload and replay clean entry. Without approval, retain a technically ready but unpublished candidate.

**IP-15C, companion:** depends on IP-10/CP-010 and its applicable evidence; repeat candidate approval and recovery. Distinguish GitHub assets from community-directory acceptance. Use current official directory instructions and disclosures. Neither a local submission check nor a GitHub release proves directory acceptance. No automatic tag overwrite, force push, foreign-asset replacement or permission escalation.

## 4. Acceptance ledger at the review baseline

No row below is blanket full-MVP acceptance. “Bounded evidence” identifies exercised cases whose complete original acceptance still needs reconciliation.

| Cases | Baseline evidence / gap | Primary closure |
| --- | --- | --- |
| A01 | Archive/launcher foundation and workflow coverage; final exact-archive/public-download path not closed | IP-02, IP-11, IP-15F |
| A02–A04 | Setup/new/import/install and safeguards exist; one starter-or-JSON/GitHub/resume journey remains partial | IP-02 |
| A05–A07 | Integrated authoring assertions; complete command, branching and adjacent-editor matrix still partial | IP-06–08 |
| A08 | Shared runtime migrations/validation tested; public schema parity incomplete | IP-03 |
| A09 | Actual modern JSON import/export and retained revisions evidenced; golden version/complete self-capability convention unresolved | IP-03, IP-10 |
| A10 | No selected-artifact compiler closure exposed | IP-04 |
| A11 | Nine actual generated-file browser assertions; not all intended transitions/local effects or design fidelity | IP-05, IP-08 |
| A12 | Full native generated companion not accepted | IP-10 |
| A13 | Existing safe writer/generator tests; selected-scope and current consumer replay still required | IP-04, IP-09, IP-11 |
| A14 | Data-only project/feature/improvement intake exists and focused tests pass; full remap/reconciliation acceptance remains | IP-04 |
| A15–A16 | Release foundations exist; no complete authorized remote execution evidence from this review | IP-15F / IP-15C |
| A17 | Current artifact/hash and targeted qualification evidence; all required modes not closed | IP-11 |
| A18 | Entry docs reconciled in this update; continuing command/onboarding/generated-guide parity remains | IP-01, IP-02 |
| A19 | Full companion native persistence/multiple-leaf evidence absent; starter host evidence separate | IP-09, IP-10 |
| A20 | Complete scale/manual-accessibility/native device evidence absent | IP-08, IP-12 |

## 5. Working agreement and definition of done

Start each package by inspecting the latest source and existing tests; reproduce the remaining gap rather than rebuilding completed capabilities. Implement narrow changes through shared contracts and safe planners. Add meaningful regression tests, including actual failure-path assertions, and validate an independent consumer where output changes. Coordinate schema, shared config, styles and migrations through an explicit owner. Preserve unrelated changes and use reviewed, task-focused PRs.

A package is done only when its named acceptance is evidenced on an exact candidate, relevant inherited gates pass, docs/help/generated guidance match, and unresolved modes are explicitly recorded. Screenshots supplement tests; stubs/TODOs do not implement business behavior; checksums are not signatures; no task or plan is a publication approval. Keep this plan synchronized without overwriting historical failed attempts or their provenance.
