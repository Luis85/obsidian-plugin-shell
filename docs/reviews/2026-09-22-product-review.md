# Product review and polishing pass

**Date:** 2026-09-22  
**Reviewed baseline:** `c62303e1d60a77b1496ed06f7142e1952dcf78c0` (PRD 0.4).  
**Review scope:** Repository requirements, architecture, developer workflows, testing, release/maintenance, and the new isolated stylesheet specimen. No existing plugin runtime was available to audit.

## 1. What was actually present

The baseline tree had 16 tracked text files: specification/guides, agent instructions, research, license, and scripts/README. There was no package.json, dependency lockfile, executable setup/maker/build script, runtime source, frontend harness, CI, or tests. Earlier statements about errors, notifications, and host styling were requirements, not implemented behavior.

The review does not assign a product-quality score to unimplemented code. Findings below identify specification and verification risks, followed by bounded changes. “Resolved in contract” does not mean the eventual implementation already passes its acceptance case.

## 2. Findings across product perspectives

| ID | Perspective | Finding / risk | Change in this pass | Evidence state |
| --- | --- | --- | --- | --- |
| REV-01 | Product truthfulness | Detailed requirements can look like a ready template while no runtime exists. | Capability/status table separates implemented fixture, specified services, and pending host proof. | Documentation corrected. |
| REV-02 | Developer experience | Growing specifications repeat whole workflows and obscure the first useful step. | Short current PRD; exact 0.4 baseline preserved rather than re-generated; focused companion contracts. | Requirements retained, new front door. |
| REV-03 | Product scope | A notification center, new retries framework, or complete theme emulator would expand a starter unnecessarily. | Small NotificationService and owned handles; no inbox/telemetry/OS push; finite host-style surfaces. | Scope clarified. |
| REV-04 | Architecture | Services might catch and notify independently at every layer. | Canonical failure data plus one presentation feedback owner; native/harness sinks share policy. | ERR-07–18 / NTF-01–12 specified. |
| REV-05 | Data integrity | Follow-up failure can be interpreted as failed creation, encouraging duplicate notes. | Effect state separate from severity; committed-with-follow-up-warning and no unsafe create retry. | Existing DOC guarantees connected to feedback policy. |
| REV-06 | Async/lifecycle | Closing a modal does not cancel a write; late handlers can update disposed views. | Explicit single-flight actions, owner disposal, guarded completion, uncertain outcome handling. | Contract strengthened; runtime pending. |
| REV-07 | UX | Toast-only validation or expiring recovery gives poor actionable feedback. | Field errors and persistent owner recovery; bounded optional notices; no focus theft. | Surface matrix and timing policy added. |
| REV-08 | Accessibility | aria roles/CSS alone cannot provide modal behavior, announcements or usable expiry. | Keyboard/focus/live-region/timing rules with manual/native evidence boundaries. | Specimen exercised; actual host pending. |
| REV-09 | Notifications | Multiview refresh/listeners can duplicate feedback and leave progress/timers behind. | Operation/owner-keyed handles, dedup/update/dismiss rules, queue bounds, cleanup observer. | Contract plus illustrative fixture, not runtime implementation. |
| REV-10 | Observability | Successfully catching a Vue error can hide it from browser pageerror tests. | Independent captured-defect ledger and exact expected-error counts. | Acceptance added; integration pending. |
| REV-11 | Privacy | Exceptions, event payloads, Markdown plans and screenshots can leak content. | Redaction before buffers/export; fixture-only data; no raw diagnostic serialization. | Policies integrated, runtime redaction tests pending. |
| REV-12 | Native fidelity | “Obsidian stylesheet” was a requirement without a concrete owned asset or provenance. | Original modular host-style fixture and manifest; no copied app.css or fonts. | CSS assets delivered. |
| REV-13 | Frontend validity | A well-styled static page can be mistaken for actual plugin behavior. | Three evidence modes: specimen, real-component harness, native candidate. | Visible fixture labels and documentation. |
| REV-14 | CSS/build | Host CSS could hide missing plugin styles or leak into installed assets. | Explicit order, negative missing-style tests, scope gating, separate candidate CSS/hash. | Fixture scope checked; production gate pending. |
| REV-15 | Maintainability | Reimplementing every host widget or analyzer would create a second platform. | Incremental declared host surfaces, existing Vite/fallow stack, small shared helpers. | Architecture decision retained. |
| REV-16 | Generators | Makers could scaffold unobserved promises, local new Notice calls, or permanent test bypasses. | Reuse canonical wrappers/sinks; generated negative and lifecycle tests remain required. | Maker acceptance strengthened, maker runtime pending. |
| REV-17 | Quality operations | A full Cartesian browser matrix or recursively generated qualification can make verification unusable. | Required core profiles plus risk-selected cases; explicit finite template-qualification boundary. | POL requirements added; no gate reductions. |
| REV-18 | Releases | A fixture test could be represented as accepted native assets. | Release accepts only fixed-commit JS/CSS/manifest with independent host evidence; fixture assets excluded. | No release created; contract retained. |
| REV-19 | Maintenance | A dated host-style snapshot can be “updated” without a real comparison. | Separate fixture version/provenance from native comparison date; unavailable evidence remains unverified. | Metadata added. |
| REV-20 | Test feedback | The initial fixture had an ineffective placeholder selector and an incomplete dialog Tab loop. | Corrected pseudo-element selector and fixture-owned keyboard wrapping; reran checks. | Fixed and checked in Chromium specimen mode. |

## 3. Decisions that remain unchanged

The stack, 400/450 physical-line rules, 100-line composition-only main.ts, domain/application isolation, single runtime bus, per-view Vue/Pinia ownership, safe fresh-checkout setup, source-generating makers, composed plugin CSS, create-only entity documents, latest-public host policy, reviewed dependency updates, and exact-artifact draft/promote releases remain required.

There is still no automatic migration of user notes, guaranteed cross-device exactly-once creation, unconditional undo, global host error suppression, or permission to overwrite a vault. Nothing in this pass replaces the Task-note source-of-truth rule with a second data.json database.

## 4. Concrete files and qualification performed

### Delivered fixture

`harness/styles/obsidian.css` imports five original modules. `harness/style-fixture/` contains an explicitly labeled gallery of inputs/settings/notices/modal/recovery surfaces. Its small script controls only the specimen; it writes no notes or storage. `scripts/harness/serve-style-fixture.mjs` serves a fixed allowlist on loopback. Focused tests are under `tests/harness-styles/`.

### Actual checks

| Check | Result and exact scope |
| --- | --- |
| `node --test tests/harness-styles/server.test.mjs` | Seven tests passed under Node 22.16.0/npm 10.9.2 in the editing environment. This is not the selected production toolchain matrix. |
| CSS parsing | Original CSS entry/modules/specimen CSS parsed with installed tinycss2; declaration syntax checked. This is not a complete selector-support or cascade proof. |
| Chromium render/interactions | Nine groups passed using installed Chromium 144.0.7559.96 through Python Playwright with the exact authored CSS/JS inlined into a page. |
| Narrow/themed layout | Light/dark; no page-level horizontal overflow at 320/390/900/1280 CSS px; placeholder colors checked. |
| Form/notice specimens | Localized English/German message behavior, aria-invalid/focus/clear, status notice replace/dismiss, routine-success preference. |
| Dialog specimen | Browser dialog plus fixture-owned Tab loop, Escape and focus return. Not the native Obsidian adapter. |
| Media/scope | Forced-colors/reduced-motion rendering and root-scope isolation checked. |
| Unexpected browser errors | None in the successful inline specimen run. This does not exercise the future captured-Vue-error observer. |
| Visual inspection | Desktop light/dark and narrow screenshots inspected; not committed as automatically accepted production baselines. |

### Environment limitations and unrun work

The container could not resolve github.com for a local clone; repository reads/writes used the authorized GitHub connector instead. Chromium blocked loopback HTTP navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. The browser checks therefore used inlined local fixture assets; Node tests separately exercised the actual HTTP server. Do not describe this as an end-to-end browser/CSP/import-loading pass against the server. Python Playwright was an available review tool, not a new dependency or required test runner added to the template.

No Obsidian instance, native Notice/Modal, Vue/Pinia application, actual DocumentCreationService, full Vite pipeline, real setup/maker, release workflow, screen reader, iOS/Android device, golden baseline comparison, or axe scan was run. Full template verification cannot run before the toolchain/runtime exists. The specimen and focused checks are the only implementation claims in this delivery.

## 5. Prioritized implementation follow-through

| Priority | Package / objective | Completion evidence |
| --- | --- | --- |
| P0 | WP-00/01: qualified stack, setup entry, real scripts and verifiable status | Fresh checkout executes the declared path with honest failures. |
| P0 | WP-02/03: canonical outcomes, feedback coordination, sinks and ownership | Unit/contract tests for deduplication, commit semantics, async cleanup and reporter failure. |
| P0 | WP-05/06: integrate original host CSS with real Vue/services and captured-defect observer | Deliberately caught defect fails a normal test; actual Task creation bytes and correct feedback. |
| P1 | Native current-host qualification | Notice capabilities, modal focus, pop-outs, properties, stylesheet parity and lifecycle evidence. |
| P1 | WP-07: makers reuse the shared patterns | Generated command/modal/entity/style/error paths pass the same verification. |
| P1 | WP-08/09: current dependencies and exact-candidate release rehearsal | Dependency upgrade still triggers negative gates; published candidate matches accepted hashes. |

A first working developer milestone may precede complete template qualification. It must be labeled as such; this does not remove any v1 requirement. Finish the existing baseline before expanding into additional product domains.

## 6. Review conclusion

The design contains useful safety and architecture decisions, but the primary remaining risk is the gap between a large specification and an executable developer workflow. This pass addresses concrete missing host styling and strengthens the failure/notification contracts. The next substantive improvement is implementing and proving the existing path, not adding another general-purpose subsystem.
