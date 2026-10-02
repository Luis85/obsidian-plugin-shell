# PR #5 — integrated product review

**Review date:** 2026-09-27. **Reviewed source:** `ec70e2cee7d8aed6e794a15252b2b9cc48b05dcf`, tree `221a4ef3c80117a501912a99f94bd2e06e92da2e`, branch `docs/companion-plugin-prd`. This is a risk-based review of the integrated product, selected implementation seams, retained artifacts and current hosted evidence—not an exhaustive line-by-line audit, user study, penetration test or release approval.

Read the [evidence record](../testing/PR5-REVIEW-EVIDENCE.md) for commands, hashes and limits, and the [improvement and polishing plan](PR5-IMPROVEMENT-PLAN.md) for executable follow-up work. The [MVP PRD](../prds/MVP-JSON-TO-CLICKDUMMY.md), its A01–A20 [acceptance crosswalk](../prds/MVP-IMPLEMENTATION-PLAN.md#5-acceptance-and-test-crosswalk), existing task frontmatter and [delivery strategy](DELIVERY-STRATEGY.md) retain authority. This review reconciles observed status; it does not silently change scope or mark tasks done.

## 1. Executive assessment

**PR #5 now contains a substantial developer platform and a working design-to-generated-prototype pipeline. It is not yet the complete, natively accepted companion or the completed download-to-publication MVP.** The right next investment is integration and productization, not another generic compiler rewrite or another parallel companion prototype.

The strongest result is real vertical integration: the current companion build contains the Vue 3/Pinia/Nuxt UI/Vue Flow sitemap editor; v6 JSON preserves hierarchy, routes and journeys; the dedicated compiler emits independent source; that source installs, verifies and builds an offline clickdummy. The current hosted artifact has 26 authoring assertions and nine generated-clickdummy assertions. Those are bounded successes, not proof that every declared business requirement works.

The main qualification boundary is explicit in the generated receipt: `scaffold-qualified`, `requirementAcceptance: not-implemented`, **31 pending requirements**, **33 acceptance TODOs**, **two business TODOs**, and `nativeAcceptance: not-run`. These counters describe different things and must not be added or converted into a completion percentage. The generated preview also remains visually and functionally much simpler than the authoring workbench.

There are two independent delivery decisions. The standalone framework may qualify and ship before native companion conversion under SH-022/SH-034. The requested whole-companion MVP still requires its native functionality and A12/A19 acceptance; a framework release does not close those requirements. Neither outcome is authorized by this review. The repository release endpoint returned no releases. The broad CI run subsequently failed at the maintainability classification of `scripts/hindsight/embedded.py`; setup-policy was still running at the last recorded check. This integrated-tree failure is the first technical blocker, despite successful targeted workflows.

## 2. What exists now

| Product surface | Implemented and evidenced | Boundary that remains |
| --- | --- | --- |
| Reusable shell | Host adapters, typed features/events, Markdown and plugin-data services, scoped presentation, lifecycle ownership, makers and diagnostics | Applicable legacy/native/performance/dependency acceptance remains separate from new generator tests |
| Framework CLI and kit | Shared typed operations, help/schema/doctor, reviewed plans, new/setup/import/generate, archive packaging, ownership-preserving regeneration, explicit process/release boundaries | The requested single extracted-kit starter-or-JSON/GitHub/resume journey is not closed; no published kit was found |
| Current companion authoring | Actual Journey Lens editor integrated into the existing concept; guarded v6 transactions, routes/journeys, adjacent page editing and real export/import | Other concept surfaces are not all native or implemented in the same production UI stack; the concept is not an installed plugin |
| Visual page/component system | One reusable visual IR, typed contracts, slots/events, immutable component revisions, dependency declarations, migration and validation | Concept previews are not universal proof of real generated component behavior; external adapters can still be explicit implementation stubs |
| Dedicated compiler | Parse/migrate/validate/resolve/lower/emit core, source diagnostics, immutable input snapshots, deterministic fingerprints and separate workspace planning | Compile success is not dependency execution, browser/native acceptance or authorization |
| Generated plugin and clickdummy | Same generated Vue pages/contracts/local effects; separately installed/verified workspace; single-file preview with synthetic reads, modal return, reset and JSON export | No complete generated editor engine or undeclared business logic; synthetic data and disabled writes are not persistence |
| Starters and native boilerplate | **11 starters:** blank, eight original examples, custom-file view and file context menu; native contracts/makers and lifecycle-owned registrations | Basic text/JSON custom-file editing is not a domain-specific visual editor; real-host save/conflict/lifecycle qualification still matters |
| Concept intake | Data-only project/feature/improvement inspection/import, exact-base guards and reviewed canonical changes | Scoped intake is not selected-feature/page/component compiler output; automatic remapping and broader UX acceptance are not established |
| Prototype tooling | Claude source-of-truth skill, Codex pointer, design agreement, concept-board option, shared build/validation/packaging helpers | Tool availability and actual agent/desktop execution are environmental; a skill document is not execution evidence |
| Hindsight tooling | Explicit opt-in CLI, provider selection, staged launchers, configuration preservation, Git/worktree handling and offline contract tests | Real SDK/model/desktop and cross-platform installation acceptance has not been established by those fixtures |
| Jev Studio | Separate offline prompts, rules, typed processes/events, bounded flow simulation, versions, JSON schemas and exports | No live inference, native automation or durable workflow engine; its JSON is not Companion project JSON |

The current self-project contains **28 surfaces, 23 routes, three journeys, three features, 27 visual page designs, 54 component definitions and 54 published revisions**. The generated inventory reports **131 visual interactions** and 2,063 files. Counts demonstrate exercised scope, not usability or acceptance.

## 3. Strategy, value and scope

The clearest product promise is: **turn an inspectable design into developer-owned, independently buildable source, without hiding unsupported behavior or taking ownership away from the developer**. The differentiating hypothesis is the continuity between requirements, navigation, visual contracts, generation, tests and regeneration—not merely having many editors. This review does not establish competitive superiority, demand or willingness to pay; no customer study or market experiment was performed.

Three primary users need different entrances. A developer needs a short CLI golden path and maintainable output. A product owner/designer needs fast authoring, understandable boundaries and a prototype suitable for feedback. A maintainer or coding agent needs deterministic contracts, actionable diagnostics and safe changes. The companion-as-reference-consumer is valuable but unusually complex; it must not be the only evidence that simpler customer projects work.

Jev and Hindsight are useful adjacent capabilities, but neither should become a prerequisite to create a blank plugin, export JSON or build a clickdummy. Keep the framework, companion authoring, generated consumer, optional memory and decision-workbench concepts independently explainable, testable and distributable. No new pricing or monetization model is assumed by this review.

## 4. Journey review

| User job | Current assessment | Next proof |
| --- | --- | --- |
| Download and start without knowing the repository | Archive foundations exist, but no published release; setup and starter discovery are split | A01–A04 on the exact retained archive, then approved shipment and redownload |
| Create a small project from blank or a relevant starter | Strong developer entry through `new`; 11 original/integrated choices are discoverable | One wizard in the extracted folder; scope labels that distinguish examples, fixtures and implemented host behavior |
| Design navigation and inspect a journey | Real integrated editor, stable IDs, explicit structural moves and route preservation | Full command coverage, branching journeys, keyboard/no-drag paths and large-graph readability |
| Design pages and reusable components | Broad shared IR and revision protections already exist | Representative real generated rendering, contract-change impact and accurate design-to-output parity |
| Import a prototype or improve an existing feature | Reviewed data-only intake is implemented | End-user conflict/remapping/replay cases; no implied execution of arbitrary HTML |
| Generate and present a clickdummy | Independently built offline output works in current hosted evidence | A polished representative project, all intended transitions/local effects and reviewer-friendly navigation |
| Continue development and regenerate safely | Ownership and stale-plan protections are valuable | Feature/page/component output scope, dependency closure and developer-edited consumer replay |
| Use the full companion inside Obsidian | Not established by generated scaffold or shell-host tests | Real generated editor capabilities, Markdown ownership, save/reopen, multiple leaves and failure recovery |
| Publish and support a product | Candidate/release boundaries exist; no publication was performed | Separate framework/consumer/companion evidence profiles, authorized remote rehearsal and support material |

## 5. Information architecture, onboarding and content

The authoring workbench offers a meaningful progression from Define through Structure, Compose, Review and Prepare. It also has a project sidebar, host-like header, workflow steps, editor tabs, graph controls and inspector. The retained narrow screenshot at 880 pixels still dedicates substantial width to navigation while the inspector overlays the canvas. This is a credible heuristic finding about competing controls, not a measured usability failure or a claim that the existing containment assertion failed.

Make one recommended next action dominant. Keep expert navigation available, but collapse secondary navigation for focused editing and narrow native leaves. Use consistent nouns: a surface is the host destination, a page design is its visual content, a component is reusable content, a journey is an ordered path, a source is a data contract. A diagram position must never imply a route or hierarchy change.

The current entry points are confusing. `docs/concepts/companion/index.html` and its adjacent JSON are a retained **v5 compatibility pair**. `npm run companion:build` creates the current **v6** authoring HTML/JSON under `reports/companion-mvp`. This is intentional compatibility architecture, but the old default link can send a reviewer to the wrong milestone. Every guide and artifact should identify its purpose/version and next supported action.

Error copy should consistently answer: what failed, what was preserved, what changed, and what the user can safely do next. Existing diagnostics already contain much of this information; the improvement is coherent presentation, not weakening validation. A stale plan, unsaved draft, conflicting generated file and uncertain durable save must remain distinct states.

## 6. Editor interaction and visual quality

The sitemap's separation of hierarchy, navigation, routes and arrangement is a strong foundation. Explicit Move, adjacent-page navigation, dirty-input guards and transactional Undo/Redo should be preserved. The graph projection currently uses a simple depth/row fallback when coordinates are absent; it is not a collision-aware layout. The retained post-edit screenshot contains overlapping nodes, but it was captured after test mutations and is not proof that the initial layout is always broken. Add intentional arrange/fit/focus behavior with deterministic fixtures and manual verification rather than silently rearranging saved work.

Page and component authoring share an IR and protections around published revisions, pins, invalid references and cycles. This is preferable to separate formats for preview and generation. The next interaction pass should concentrate on first insertion, selecting deeply nested elements, moving without dragging, inspecting bound values, identifying the editing scope, and explaining affected usages before contract/revision changes. Pattern insertion must remain ordinary expanded IR; it should not introduce another persistence format.

The generated clickdummy screenshot shows repeated page headings, placeholder-like component copy and many equally prominent full-width actions. It is materially less polished than the authoring workbench. The cause must be isolated across authored seed, compiler lowering, generated styles and preview chrome; the screenshot alone cannot establish that a particular layer is defective. Correct the maintained definition or generator, never patch only the disposable HTML.

Use at least two golden review projects: a small task/capture workflow and the companion self-project. Compare intended layouts, text, hierarchy, component states, navigation, local actions and modal return against actual compiled output. Pixel comparisons should support semantic assertions and design review, not normalize regressions by accepting new baselines automatically.

## 7. Accessibility, localization and platform fit

Existing focus, explicit-label, modal and narrow-layout assertions are positive evidence. They do not establish screen-reader behavior, keyboard completeness, touch/pen support or WCAG conformance. In particular, successful graph dragging does not replace a no-drag alternative, and an element fitting within the viewport does not prove that it remains easy to operate.

Use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) as the review target, including [dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) and [target size/spacing](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). The latter is a 24-by-24 CSS-pixel minimum with documented exceptions, not a blanket claim that every icon must be 44 pixels. Evaluate focus visibility/return, labels and live status, validation summaries, tree navigation, zoom/reflow, contrast and reduced motion against actual rendered surfaces.

Test narrow Obsidian leaves as well as full desktop windows. Browser mobile width is not native mobile qualification; retain the current desktop-only support boundary until real device evidence exists. The shell's English/German support does not mean every newly added concept or generated message is localized. Audit user-facing strings and allow translated text to grow without clipping. Start with supported locales and documented fallback rather than promising broad localization.

## 8. Model, interoperability and compiler

The shared authoring adapter deliberately accepts v6 while retaining legacy v1–v5 normalization and the historical detail-layout loss report. The visual schema remains separate. Starter bytes retain their hash-bound format and configured copies migrate; blindly rewriting every v5 reference would break this contract. Native integration definitions are additive and must survive the v6 path.

There is a concrete public-discovery gap: `scripts/framework/schemas.ts` describes operation requests/results, while `concept schema` describes concept intake. That does not publish the complete Companion project-v6 schema required by MVP-09. The runtime reader is not a substitute for a discoverable, versioned schema with shared positive/negative fixtures. Transport-valid design and generation-ready design must continue to be distinguishable.

The dedicated compiler is the correct abstraction: pure phases receive snapshot data and return artifacts/diagnostics; CLI and filesystem adapters own orchestration; the safe writer owns mutation. Existing lowerers were retained behind adapters rather than rewritten wholesale. Preserve this seam and extend targeted tests around source mappings, deterministic fingerprints, template updates, external dependency resolution and hostile input. Hashes prove identity, not authenticity or approval.

Feature/page/component makers, scoped concept import and scoped project compilation are different capabilities. The public `generate` operation currently selects input/target/output kind, not a selected artifact dependency closure. Close MVP-13–15 with deliberate slice semantics, ownership effects and replay tests. Do not advertise ordinary boilerplate makers or whole-project generation as equivalent completion.

## 9. Native behavior and persistence

The generic shell already provides meaningful persistence and lifecycle services; native companion conversion should consume them, not create a second framework. A real companion needs one canonical project owner, Markdown/document adapters, guarded writes, per-view drafts, committed facts and cleanup. JSON describing a sitemap editor or generated adapter signatures does not implement that editor.

The new native custom-file view is more advanced than an older explicit-save design: current source extends `TextFileView`, routes input through `requestSave`, preserves the raw buffer, and surfaces save failure. Do not reopen a stale finding that assumes edits are only manually saved. What remains to prove is actual host behavior: debounce, close/unload, failed save, external edits, reopen, multiple leaves and conflict handling. In-memory Obsidian test doubles and generated starter builds are useful but not that evidence.

Preserve the distinction between browser storage, note-backed canonical Markdown and plugin-data envelopes. Do not promise cross-process atomicity where the host does not provide it. Invalid/future content, unrelated frontmatter/body and developer-owned files must remain recoverable. Native context-menu and custom-extension registration need conflict, rename/delete and disposal checks without detaching unrelated leaves or overwriting another plugin's association.

## 10. Security, privacy and trust boundaries

Observed strengths include bounded inert JSON, explicit concept extraction instead of script execution, ownership-aware plans, stale-hash refusal, explicit installs, offline preview CSP, local diagnostics and separation of release approval. Preserve these as product behavior, not only internal implementation details.

The main remaining security work is a joined threat model across imported project/concept data, dependency declarations, developer-approved build code, native filesystem access, memory providers and exported diagnostics. A JSON file cannot authorize package execution; checksums are not signatures; a selected local directory is not automatically an authorized personal vault. Compiler IR/debug reports and authored literal/sample values can contain sensitive content even when runtime credentials and snapshots are excluded.

Jev's resolved requests and traces can include note bodies, paths and payloads and therefore require a separate disclosure/acknowledgment path. Hindsight's localhost binding and bank names are not authentication or access-control boundaries. Review consent, provider routing, staged launcher provenance, source allowlists, redaction and uninstall/data-retention behavior using realistic but synthetic fixtures.

For a future directory-listed native plugin, [Obsidian developer policies](https://docs.obsidian.md/community-directory/developer-policies) prohibit client-side telemetry and self/dependency installation, and require disclosures for network use and outside-vault access. Those policies apply to directory plugins; do not misapply them as a ban on separately approved developer CLI installs. Product learning should use voluntary studies and explicit local diagnostic exports, not hidden telemetry. This review is not legal advice or a completed security certification.

## 11. Developer and agent experience

The shared command catalog, deterministic plans, structured diagnostics, generated developer instructions and test inventory are strong assets. Improve their connection: `doctor` should lead to a safe next action; generated READMEs should clearly separate ordinary development from framework maintenance; error messages should link a stable code to an affected artifact and remediation.

Keep Claude as the prototype skill's source of truth and Codex as a reference rather than a drifting copy. Exercise both against the same task: inspect a project, obtain design agreement, produce a compatible concept, validate, preview import and preserve unrelated work. Actual subagents are useful only when available; documentation must not imply they were run.

The maintenance cost is now substantial: compiler adapters, legacy concept assembly, a real Vue island, generated runtime, two schema generations, starter inventories and optional tooling. Avoid another large rewrite. Name seam ownership, retain compatibility fixtures, and move shared behavior toward typed domain/application services incrementally. Keep concept-only assets out of consumer kits and inspect generated projects for accidental dependency or documentation leakage.

## 12. Quality, observability and evidence

This review reproduced **464 Node tests** across five focused groups, **24 Python tests**, **20 Jev schema/example checks**, and two deterministic legacy concept checks. The local runtime differs from the qualified repository toolchain. Local authoring and clickdummy file-origin browser attempts were blocked before navigation by administrative browser policy; neither is reported as passed. Current hosted evidence supplies the 26/9 browser results instead.

The reviewed head has successful dedicated concept, compiler, native-starter and memory workflows, but its broader CI failed. Windows Showcase stopped at `METRIC_UNCLASSIFIED_INPUT: scripts/hindsight/embedded.py`: the maintained inventory only recognizes the existing concept-Python paths. The new optional integration therefore breaks full verification even though its own tests pass. Explicitly inventory supported Python tooling/tests, retain exact bytes, keep unsupported-language metrics separate and add negative controls; do not ignore the folder or dilute production thresholds. Windows Framework CLI and the shell Real Obsidian E2E jobs passed separately. Setup-policy was still running at the last recorded check. See the [job-level evidence](../testing/PR5-REVIEW-EVIDENCE.md). Verify every applicable mode against the exact candidate before closing SH-022; a targeted workflow or an earlier green branch is not the whole gate.

Test breadth is not the same as product acceptance. Keep distinct records for contracts, generated-source verification, browser interaction, real native behavior, accessibility/manual work and authorized release operations. Preserve failed/blocked attempts. Make evidence status discoverable without requiring users to reconcile many dated files or infer what a pending requirement means.

## 13. Performance, scalability and operability

The current artifact sizes are measured, not proposed budgets: authoring HTML **3,887,705 bytes**, v6 JSON **2,248,937 bytes**, generated clickdummy **4,167,429 bytes**. They say nothing by themselves about input latency or acceptable scale. Whole-document validation, snapshot history, large visual trees, graph layout and repeated generation are priority profiling targets; no unmeasured bottleneck is asserted here.

Establish small, representative and bounded-large fixtures within existing validator limits. Measure cold/warm launch, import/export, selection, typing, commit/undo, layout and generation; include heap growth and listener cleanup through repeated open/close. Set initial budgets after baseline measurement and product agreement. Existing source-size, artifact, coverage and analyzer policies remain; do not raise thresholds to make a new fixture pass without an explicit reviewed decision.

Support should include source/schema/kit/host/toolchain versions, a privacy-safe diagnostic export, recovery by failure phase, known limitations, and a reproducible minimal project. A failed install should not be described as a failed design; a rejected stale write must not suggest blind retry. Keep last-good artifacts and document manual escalation for uncertain durable outcomes.

## 14. Optional memory and decision-workbench capabilities

Hindsight's keyless modes require precise language. An authenticated coding-agent provider or a provisioned local model is different from `none`; no-LLM storage/CLI recall does not imply reflection or every MCP feature. Desktop sign-in alone is not proof that the toolchain can access the intended provider. The existing 67 Node/24 Python tests use explicit external doubles; complete synthetic live acceptance separately and keep optional failure out of the default build path.

Jev Studio already models reusable rules, processes, flows and publisher-specific events; it is no longer just a prompt form. Safe local mapping, bounded loops, event causality and explicit review/end states are valuable. Real Jev response correctness, accuracy/calibration, external process idempotency, retries, durable execution and native authorization are not implemented or qualified by its synthetic runner. Its separate workspace schema must not be silently treated as the Companion schema. Any later bridge needs a reviewed adapter and capability boundary.

## 15. Prioritized finding register

Priority is scoped: **P0 blocks the named promised outcome**, not necessarily every other product lane. P1 is required productization or qualification work; P2 is a later extension. “Observed” means source/artifact evidence; “unverified” means missing acceptance, not a proven runtime defect.

| ID | Priority / lane | Finding and evidence type | Closure package |
| --- | --- | --- | --- |
| R01 | P0 / all claims | Stale milestone, version and implementation statements; observed in PR body and entry docs | IP-01 |
| R02 | P0 / framework entry | No published kit; setup asks JSON-or-blank while starter selection is in `new`; complete entry/resume/GitHub journey not closed | IP-02 |
| R03 | P0 / shared contract | Project-v6 public schema discovery/parity incomplete; operation schemas are not project schemas | IP-03 |
| R04 | P0 / complete companion MVP | Native companion editor capabilities and A12/A19 acceptance absent from generated scaffold evidence | IP-10 |
| R05 | P1 / generated UX | Compiled preview visibly lacks authoring-level hierarchy and content polish; observed artifact, cause to isolate | IP-05 |
| R06 | P1 / authoring UX | Competing navigation layers and narrow-canvas space; heuristic artifact review | IP-06 |
| R07 | P1 / editor behavior | Graph arrangement/readability and full interaction parity need stronger acceptance; simple fallback and post-edit overlap observed | IP-07 |
| R08 | P1 / accessibility | Manual assistive-technology, no-drag, zoom, localization and real-device evidence incomplete | IP-08 |
| R09 | P1 / native starters | Actual TextFileView save/failure/external-edit/disposal behavior unverified in the real host | IP-09 |
| R10 | P0 / scoped-generation promise | Makers and scoped intake exist, but selected artifact compilation/dependency closure is not exposed | IP-04 |
| R11 | P0 / integrated CI | Confirmed full-CI failure: Hindsight Python is unclassified by maintainability; full workflow/case crosswalk also remains open | IP-11 |
| R12 | P1 / supported scale | No current maximum-scale latency/memory acceptance established | IP-12 |
| R13 | P1 / security and support | Cross-surface threat model, export disclosure and recovery guidance need integrated qualification | IP-13 |
| R14 | P1 / opt-in memory | Real provider/SDK/desktop and cross-platform lifecycle acceptance unverified | IP-14 |
| R15 | P2 / future automation | Jev is an offline simulator, not live Companion business orchestration; preserve that boundary | IP-14 |
| R16 | P1 / maintainability | Parallel legacy/modern/generated/optional seams require explicit ownership and compatibility tests | IP-03, IP-11 |
| R17 | P1 / adoption | No observed user-task baseline or support cost/first-success measurements | IP-02, IP-06, IP-13 |
| R18 | P0 / publication | Exact-candidate approval, remote rehearsal and downloaded-asset replay remain separate, not implied by tooling | IP-15 |

## 16. Recommended decision

Accept the integrated architecture and continue from the existing source. First repair the demonstrated CI inventory integration without relaxing any gate, reconcile status and contracts, close the extracted-kit golden path and qualify a polished representative generated workflow. In parallel, improve authoring focus, accessibility, native-starter evidence and performance measurement. Preserve the framework-first release gates; then implement and qualify the complete native companion through those same public capabilities. Keep optional memory and Jev integration out of that critical path unless an explicit product decision changes it.

Success is not “more screens” or “all tests green.” It is a new user reaching the promised outcome with understandable boundaries, a developer retaining ownership after regeneration, and an exact candidate whose implemented behavior is supported by the required evidence.
