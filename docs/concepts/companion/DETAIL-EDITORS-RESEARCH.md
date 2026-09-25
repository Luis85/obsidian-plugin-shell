# Page and component editors: competitive research, needs and requirements

> Current composition increment: [Layout, tokens, slots, revisions, scenarios and complete self-project](COMPOSITION.md). [Verification scope](COMPOSITION-VERIFICATION.md). Earlier increment-specific version/count statements below retain their historical scope.
Research date: **25 September 2026**. Product baseline: PR #5, commit
`552a9449e0814322dc67fbe8d452214fb3b0e6a2`.

## 1. Decision and scope

Build a **structured, reusable design specification workspace**, not a second general-purpose drawing application. Preserve the chain from requirements and Storymaps to sitemap surfaces, page composition, reusable component definitions, and an explicit implementation handoff. The useful output is a design whose ownership, structure, overrides, states and behavioral intentions can be understood and safely transferred—not merely a convincing screenshot.

This is a product-direction recommendation based on the comparisons and audit below. It is not a claim of market uniqueness, validated demand, competitor superiority, or measured productivity improvement. The companion still operates as an offline browser concept. Native Obsidian integration and generation of executable detail layouts remain separate work.

### Method and evidence strength

The research combines three different kinds of evidence:

1. **Documented product capabilities:** official documentation from ten reference products/tools, plus Vue Flow and W3C. These establish relevant patterns, not independent proof of usability or adoption. The comparison is documentation-based; no claim is made that ten competing applications were operated and usability-tested.
2. **First-person public feedback:** two historical Penpot community discussions about overrides and component changes. These illustrate failure modes but do not establish prevalence. One thread later reports its issue fixed; it must not be presented as a current competitor defect. [S21–S22]
3. **Direct companion audit:** the actual baseline was exercised in Chromium during this work, with screenshots saved before changes. Its existing 50 detail-editor assertions passed. Source inspection and new actual-control tests then identified risks that those tests had not covered.

No customer interviews, representative survey, pricing comparison, market-share measurement, accessibility certification or controlled time-on-task study was conducted. User roles and needs below are working hypotheses grounded in this product's intended workflow. Public documentation can change; this report reflects the pages retrieved on the research date.

## 2. Competitive and adjacent reference landscape

These references solve different jobs. Figma, Penpot, Balsamiq and Axure are useful design/prototyping comparisons. Webflow, Framer and Plasmic inform reusable composition and layout workflows. UXPin Merge informs code-aware property editing. Storybook and GrapesJS are adjacent testing/architecture references, not equivalent Obsidian products.

| Reference | Documented pattern | Implication for this companion |
| --- | --- | --- |
| Figma | Consolidated component controls expose text, boolean, variant, swap and slot properties. Auto layout describes adaptable composition. [S01–S02] | Expose intended configuration explicitly. Keep primitive values, variant selection and structural content slots distinct. |
| Penpot | Variants group related components; retaining overrides depends on corresponding layers. Flexible layouts use flex/grid concepts. [S03–S04] | Preserve compatible instance data and make composition relationships explicit rather than infer them from visual proximity. |
| Webflow | A dedicated component canvas supports isolated editing and contextual variant frames. Properties and Quick find support reusable configuration and navigation. [S05–S07] | Make shared-definition editing distinguishable from local instance editing; support quick navigation into and out of exact usages. |
| Framer | Its library guidance emphasizes naming, discoverability, responsive components and reviewing shared updates. [S08] | Treat finding, configuring and maintaining a reusable component as one workflow. |
| UXPin Merge | The properties panel can hide irrelevant implementation props, provide friendly labels/descriptions and select suitable controls. [S09] | The component contract should drive a usable form, not force every author to edit raw JSON. Its documented React integration is not a claim of drop-in Vue integration. |
| Balsamiq | Component editing distinguishes shared changes from local overrides, with explicit reset behavior. [S10] | Low-fidelity rendering is compatible with precise reuse semantics; reduced visual fidelity must not mean vague ownership. |
| Axure | Adaptive views model layouts for differing viewport conditions. [S11] | A narrow preview is useful, but it is not equivalent to an authored breakpoint/inheritance contract. |
| Plasmic | Slots allow instance-specific content within reusable components. [S12] | Slots eventually need typed ownership and content mapping, not only a label on a canvas node. |
| Storybook | Controls expose typed arguments; play functions execute specified interactions. [S13–S14] | Separate configuration, examples, acceptance intentions and actual execution evidence. |
| GrapesJS | Traits offer model-bound property controls, categories and custom inputs. [S15] | Keep the persisted semantic model independent from its editor representation. |

### Patterns worth adopting, without copying entire products

**Make the reusable contract the authoring interface.** A component's intended public configuration should be discoverable in the editor, rather than requiring knowledge of its internal node tree. Names, types, defaults and descriptions are more useful than an unrestricted object editor for common changes. An advanced data view still has value for repair and expert use. This conclusion draws on component-property and trait patterns, not a claim that one vendor implementation is the required solution. [S01, S09, S13, S15]

**Treat inheritance as a visible relationship.** An author must be able to answer whether a value comes from a selected variant, a local override, or no declared value. Resetting one property should not reset unrelated content. Shared internals and local configuration have different consequences and need different navigation and language. [S03, S05–S06, S10]

**Use layout semantics where they matter.** Regions and relative reading order are closer to an implementable page than unconstrained coordinates alone. However, adding the word “grid” does not provide a complete grid contract: track sizing, gap, padding, wrapping and responsive behavior still need definitions. The comparison supports developing those deliberately rather than equating the Vue Flow canvas with the final screen. [S02, S04, S11]

**Make references navigable.** Search is not a cosmetic addition once a project has many surfaces and nested instances. A useful result must open the exact thing, preserve its ancestry, and permit return to the previous context. Webflow's Quick find and Framer's library organization guidance provide relevant reference patterns. [S07–S08]

**Keep specification and execution separate.** An acceptance paragraph, a symbolic preview and an executed interaction test answer different questions. Storybook's executable play-function model is an appropriate future verification reference; a text field containing Given/When/Then is not equivalent evidence. [S14]

### Feedback that informs the risk model

In an April 2025 Penpot thread, users discussed whether component style changes could propagate without resetting customized text. The discussion includes differing initial observations, and a September 2025 follow-up reports the issue fixed in 2.10. A separate May 2025 discussion describes customized button text being lost when swapping component state. These are historical, self-selected reports, not a reliable count of affected users or a statement about Penpot today. [S21–S22]

The transferable need is nevertheless specific: **changing a reusable component must not silently destroy instance content**. In our own baseline, selecting another definition cleared `propsText` and the instance props in the draft. That was a directly observed source/control risk in this product, independent of the external anecdotes, and is corrected in this pass.

## 3. User needs and jobs to be done

The following are design hypotheses, not completed interview findings. They define what a later formative study should test.

### Plugin author composing a page

“When I open a surface from the sitemap or Storymap, I need to understand its purpose and compose its detailed content without recreating the concept or losing its links.” Success means the same owner ID is retained, region containment is explicit, and later export retains semantic structure. Authors should not need to understand Vue Flow's internal graph representation to describe a form, toolbar, empty state or confirmation modal.

“When I insert a reusable component, I need to change its local content without changing other pages.” The editor must expose declared configuration, distinguish defaults from overrides and explain which changes affect shared internals. A missing or outdated definition should produce a recoverable reference, not automatic substitution or data deletion.

### Component author or maintainer

“When I change reusable internals, I need to know where they are used.” At minimum, direct usage must show the containing page/component and the precise instance, with a working route back. Transitive impact and immutable historical versions are different, more demanding capabilities and must not be implied by a direct-use count or version string.

“When I evolve a contract, I need incompatible values preserved long enough to review and repair them.” A draft should hold the old values, explain incompatibility and block invalid persistence. Optional future migrations should propose a field-by-field transformation with an explicit approval boundary.

### Reviewer and implementer

“When I review a page, I need to inspect its non-default states, intended behavior and unanswered questions without hunting through every canvas node.” Findings should point to the exact editable object. A state summary should explain what it counts, including parent visibility and whether reusable internals are included.

“When I take a design into implementation, I need stable IDs, component references, declared bindings, interaction intentions and acceptance notes in an understandable artifact.” A diagram-only export is insufficient for this job. A Markdown brief is useful for reading; full-project JSON remains necessary for editable transfer. Neither constitutes proof that the designed behavior works.

### People using keyboard, pointer alternatives or narrow leaves

“When dragging is difficult or the Obsidian leaf is narrow, I still need to find, select, arrange and edit objects.” Outline, parent/order controls, explicit zoom controls and visible focus provide alternatives. Keyboard operation and a single-pointer alternative to dragging are separate requirements; one must not be substituted for the other. [S17–S20]

### Need-to-design synthesis

The editor should optimize for **finding the correct owner, understanding change scope, making a valid edit, reviewing relevant states and handing off trustworthy intent**. More drawing tools should not displace those tasks. Richer layout, slots and fixture-driven states are important subsequent additions, but the current reliability and discoverability issues come first.

## 4. Direct audit of the baseline

Screenshots were captured during this work, not taken from product marketing or an earlier conversation. Baseline captures are retained in the accompanying evidence package under `baseline/capture/`. The revised suite captures its actual UI under `reports/concepts/detail-polish/`.

| Step | Observed baseline health and risk | Implemented response |
| --- | --- | --- |
| 1. Find a page and open its details | Owner navigation worked, but the overview did not filter by title, kind or slug. Finding an element required visual scanning. | Page search; structure search that retains matching ancestors; explicit no-results feedback without mutating saved data. |
| 2. Select a nested element | Selection worked, but ancestry was not directly navigable and Outline duplicated the tree. | Clickable ancestor trail; one main tree in Outline; search preserves focus. |
| 3. Configure an instance | A raw JSON field was the primary property interface. It did not reveal value origin. Definition selection cleared local props. | Typed text/boolean/number controls, default/local/not-set provenance, per-property reset, retained incompatible values and explicit repair. |
| 4. Inspect shared internals | Drill-down existed, but an author could not readily inspect direct consumers or restore all prior presentation context. | Used-by panel opens the precise instance; Back restores editor representation, filtering and preview context. |
| 5. Review states and warnings | States could be previewed, but no consolidated visibility summary or targeted review route existed. | Advisory Review view; ancestor-aware local state counts; precise element/interaction repair links. |
| 6. Inspect canvas connections and handoff | Edge labels were hard to read; only broader project export existed for transfer. | Short event labels with explicit text/background styling; pointer-free zoom controls; deterministic saved-design Markdown brief. |

Baseline screenshot files include `01-component-editor.png`, `03-page-editor-dark.png`, `04-page-editor-light.png`, `05-mobile-outline.png` and `06-mobile-element-form.png`. Revised captures include the search, typed property form, component review, error preview, both canvas themes and narrow-screen review/form.

### Prioritized findings

**High: silent override loss.** Selecting a different definition erased local values. Retention plus explicit repair is safer than automatic reset, even when the new contract is incompatible. New control tests verify the draft retains text, invalid Save leaves canonical data unchanged, and repairing values permits a later save.

**High: misleading inheritance across contract versions.** Current variant defaults must not be silently borrowed by an instance pinned to an older contract. Defaults are now displayed only when both the version and selected variant resolve. This does not create a historical snapshot store; that limitation is stated in the editor and brief.

**Medium: authoring required syntax knowledge.** Typed scalar controls reduce the amount of JSON authors must write. Empty numeric input remains invalid input rather than becoming zero; `false`, `0` and empty text remain legitimate literal values. Complex objects and expressions are intentionally unsupported instead of being silently evaluated.

**Medium: warnings interrupted review without shortening repair.** New findings carry a precise node or edge identity. Their action opens the relevant draft rather than sending the reviewer back to a broad overview. Missing owners still require restoration in their owning subsystem and are not automatically replaced.

**Medium: impact and navigation context were underexposed.** Direct used-by links now show where an instance appears. Return restores the prior review/outline/preview context. The panel explicitly excludes transitive usage and warns that contract pins are not immutable archives.

**Medium: visual affordances and density.** Active modes have a persistent border/underline, inputs and buttons have recognizable treatments, connection labels have explicit readable styling, and duplicated tree content is removed. Desktop and narrow layouts were inspected in actual screenshots. These observations do not establish assistive-technology compliance.

**Release-quality regression: stale source inventory.** The prior PR's broader setup/showcase/template workflows failed at the exact concept-asset inventory assertion: 123 actual inputs versus 115 expected. The new four modules bring the correct exact count to 127. The count and shared detail-validator assertion are updated; extra/unapproved-file rejection remains enabled.

## 5. Requirements and acceptance criteria

Status distinguishes **retained**, **implemented in this pass**, and **next**. “Implemented” describes the browser concept only. A future native implementation must qualify the same behavior with real host services.

| ID | Priority / status | Requirement and observable acceptance |
| --- | --- | --- |
| DTE-01 | P0 / retained | One detail document references one eligible surface or library definition. Opening an editor does not silently create a second owner. |
| DTE-02 | P0 / retained | Parent identity, sibling order, canvas position and interaction edges are independent. Dragging changes geometry without changing semantic generation intent. |
| DTE-03 | P0 / implemented | Selecting another component definition preserves local props in the draft. Invalid combinations cannot save; cancellation leaves saved design unchanged. |
| DTE-04 | P0 / implemented | Property controls derive from declared scalar types. Preserve false, zero and empty text; reject blank/non-finite numeric input instead of coercing it. |
| DTE-05 | P0 / implemented | Show local/default/not-set origin. Reset only the selected override. Do not inherit defaults across a missing variant or mismatched contract version. |
| DTE-06 | P0 / retained | Every write validates before persistence. Failed saves restore canonical state/history and retain the draft; stale/foreign-storage writes remain blocked. |
| DTE-07 | P0 / retained | Bounded JSON is data, never execution authority. Reject unsafe keys, internal dangling references, excessive nesting and composition cycles. |
| DTE-08 | P1 / implemented | Find pages by title/kind/slug and elements by relevant content. Keep ancestors visible and preserve keyboard focus and saved project bytes. |
| DTE-09 | P1 / implemented | Inspect direct reusable-component usage, navigate to the exact instance and restore the prior context on Back. State that transitive impact is excluded. |
| DTE-10 | P1 / implemented | Review findings open the exact element, interaction or design-intent draft. Repair removes the corresponding finding after save. |
| DTE-11 | P1 / implemented | State counts respect hidden ancestors, distinguish visible and state-specific local nodes, and link to the selected symbolic preview. Never label this runtime test coverage. |
| DTE-12 | P1 / implemented | Export deterministic escaped Markdown containing stable IDs, reading order, values/origins, bindings and acceptance intent. Export performs no design write. |
| DTE-13 | P1 / retained and polished | Provide non-drag parent/order/connection editing, explicit zoom, visible focus and narrow-screen routes. Qualify actual assistive technologies separately. |
| DTE-14 | P1 / implemented | Active representation and state remain visibly selected in both themes. Connection labels remain readable without inheriting edge strokes. |
| DTE-15 | P1 / next | Author a real layout contract: gap, padding, sizing, wrap, alignment, columns and overflow. Preview and compiler lowering must agree through shared fixtures. |
| DTE-16 | P1 / next | Link detail styles to named Design System tokens with missing-token diagnostics and explicit fallback. Do not silently hard-code unresolved values. |
| DTE-17 | P1 / next | Map declared slots to permitted instance content, cardinality and fallback. Prevent cycles and distinguish slot content ownership from shared internal nodes. |
| DTE-18 | P1 / next | Introduce explicit reusable revisions and reviewable contract diffs before offering immutable historical rendering or bulk migration. Preserve old values. |
| DTE-19 | P1 / next | Compare variants and responsive states side by side using multiple views of the same definition, not duplicated canonical components. |
| DTE-20 | P1 / next | Attach existing deterministic test-data recipes to review scenarios with explicit fixture/provider scope and no implicit external requests. |
| DTE-21 | P1 / next | Lower supported interaction contracts to executable tests with stable semantic locators, setup, expected outcomes and provenance. Unsupported behavior remains a visible gap. |
| DTE-22 | P2 / next | Multi-selection, alignment, grouping and copy/paste operate as guarded transactions; geometry-only actions preserve semantic identity/history correctly. |
| DTE-23 | P1 / native gate | Real Markdown/frontmatter persistence, multi-leaf edits, restart, migration and native notifications meet the shell's ownership and recovery requirements. |
| DTE-24 | P1 / native gate | Measure actual interaction latency, memory and cleanup on representative/maximal documents and supported hosts; publish observed distributions, not invented performance scores. |

### Important design decisions

Do not make every state-specific count greater than zero a requirement. Some components legitimately have identical content across states. A future scenario catalog should allow a reviewed “not applicable” with rationale, while keeping missing decisions distinguishable from a successful test.

Do not serialize review findings, search queries or derived usage counts as canonical design data. They should be recomputed from the saved model so import/export cannot conceal a broken reference behind an old green flag. The new review is deliberately advisory and has no readiness percentage.

Do not interpret freeform binding paths, acceptance text or imported property strings as code. Future automation must use a validated supported intermediate representation and an explicit execution boundary. The existing generator should continue retaining unsupported design information with honest warnings.

## 6. Interaction and architecture specification

### Canonical model and views

The persisted detail model remains the authority. Canvas, Outline, Preview and Review are different representations, not separate editable copies. Reparenting and sibling-order edits change semantic composition; node coordinates only arrange the diagram. Interaction arrows describe behavior rather than hierarchy.

Vue Flow's controlled-flow approach permits validation before applying changes. Retain explicit handling and the existing transaction/history boundary instead of serializing the graph library's entire renderer state. Selection, zoom, search and navigation history remain transient. [S16]

### Property editing rules

A property row resolves the current declaration, matching-version variant default and local override separately. Local values win, including false, zero and empty text. Unresolved definitions and incompatible values remain visible; ordinary save must not guess a replacement. Reset removes one local key and reveals a valid default or “not set.” Advanced JSON is an opt-in repair surface, not a script field.

Changing definitions retains authored values, updates the selected definition reference in the draft and explains the need for repair. The existing validator prevents incompatible saved configuration. Changing an instance never rewrites the reusable contract. Editing shared internals remains an explicitly different route with direct usage inspection.

### Review and handoff rules

Review questions are derived from unresolved references and missing descriptive decisions. Action targets contain stable design element identities. State counts apply local containment visibility but explicitly do not recursively count reusable internals. The symbolic preview can still expand those internals under its existing bounded rules.

A design brief exports saved intent in deterministic reading order. It includes source-operation declarations but never invokes providers. It includes acceptance notes but never claims they passed. Geometry is omitted because it is not implementation layout. Editable transfer remains full-project JSON v3; older supported versions retain their existing compatibility behavior.

## 7. Accessibility, safety and quality requirements

W3C's dragging criterion calls for a single-pointer alternative that does not require dragging; keyboard support alone does not satisfy that particular requirement. Its minimum target-size criterion uses 24 CSS pixels with specified exceptions, not a blanket 44-pixel rule. Visible focus and text identification of invalid inputs are additional requirements. [S17–S20]

For this editor, retain forms for containment, order and interactions; keep the current object discoverable in Outline; avoid moving focus on every search keystroke; and make mode selection visible beyond a color change. Larger coarse-pointer targets are useful, but scaled canvas handles and actual touch devices still need qualification. Screenshots and headless tests are not a conformance certificate.

Performance should be measured on small, typical and maximum supported models, including nested reuse and large text values. The current model caps remain unchanged. Proposed future qualification should record input-to-visible-response latency, preview expansion, memory after repeated mount/unmount, and export duration. No p95 result or improvement percentage is claimed in this research.

Storage and history tests must retain stale-write, rollback and imported-data defenses. Display-only search, preview, review, zoom and brief export must not create history entries or change generation intent. A new feature is not qualified merely because a screenshot looks correct: actual persistence and navigation outcomes must be checked.

## 8. Validation plan and sequence

The delivered pass addresses the directly observed high-risk issues without expanding the portable schema. The next feature increment should focus on DTE-15 through DTE-19: actual layout/token/slot semantics and reviewable reusable revisions. These should be designed together because they determine whether later generated Vue components represent the same composition as the editor.

Before claiming the broader workflow is easier, run a small formative study with approximately five to eight plugin authors, including people who do not routinely edit JSON. This is a proposed recruitment target, not an existing sample. Give participants the same realistic project and ask them to locate a page, change only one instance, swap a definition without losing content, inspect consumers, repair a missing description, and explain an error state from the exported brief.

Record task completion, wrong-owner changes, silent-loss incidents, requests for help, invalid-save recovery, navigation reversals and time. Compare the baseline and revised workflow with order balanced where practical. Treat timings as exploratory with a small sample; do not claim population-level gains from it.

Then qualify keyboard and single-pointer alternatives independently, followed by screen-reader and touch-device sessions in the actual native Obsidian implementation. Test narrow leaves, pop-outs, both themes, simultaneous edits and restart recovery. Run generated-code acceptance only after the compiler implements a defined subset; keep unsupported contracts visible.

Delivery sequence remains **shell qualification → companion conversion on the shell → native acceptance → publication last**. The browser polishing pass does not bypass those gates.

## 9. Source register

Official documentation was retrieved on 25 September 2026. Product claims above are attributed to their documentation; recommendations and requirements are this report's synthesis.

- **S01 — Figma, component properties:** https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties
- **S02 — Figma, auto layout:** https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout
- **S03 — Penpot, variants:** https://help.penpot.app/user-guide/design-systems/variants/
- **S04 — Penpot, flexible layouts:** https://help.penpot.app/user-guide/designing/flexible-layouts/
- **S05 — Webflow, component canvas:** https://help.webflow.com/hc/en-us/articles/49505240420755-Component-canvas
- **S06 — Webflow, component properties:** https://help.webflow.com/hc/en-us/articles/33961219350547-Component-properties
- **S07 — Webflow, Quick find:** https://help.webflow.com/hc/en-us/articles/33961382093587-Quick-find
- **S08 — Framer, component library guidance:** https://www.framer.com/help/articles/best-practices-for-setting-up-a-component-library/
- **S09 — UXPin Merge, properties panel:** https://www.uxpin.com/docs/merge/configuring-the-properties-panel/
- **S10 — Balsamiq, editing components:** https://balsamiq.com/support/creating-and-editing/components/editing/
- **S11 — Axure, adaptive views:** https://docs.axure.com/axure-rp/reference/adaptive-views/
- **S12 — Plasmic, slots:** https://docs.plasmic.app/learn/slots/
- **S13 — Storybook, controls:** https://storybook.js.org/docs/essentials/controls
- **S14 — Storybook, play functions:** https://storybook.js.org/docs/writing-stories/play-function
- **S15 — GrapesJS, traits:** https://grapesjs.com/docs/modules/Traits.html
- **S16 — Vue Flow, controlled flow:** https://vueflow.dev/guide/controlled-flow.html
- **S17 — W3C, dragging movements:** https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- **S18 — W3C, target size minimum:** https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- **S19 — W3C, focus visible:** https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- **S20 — W3C, error identification:** https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- **S21 — Historical user report and later fix follow-up:** https://community.penpot.app/t/updating-component-style-shouldnt-require-reseting-text/8480
- **S22 — Historical user report on component overrides:** https://community.penpot.app/t/components-overrides/8800
