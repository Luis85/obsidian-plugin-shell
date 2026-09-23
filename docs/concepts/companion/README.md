# Companion concept: Shell Workbench

> Concept 01 · 2026-09-23 · Complements [the companion PRD](../../product/COMPANION-PLUGIN-PRD.md) and [its research](../../research/2026-09-23-companion-plugin.md).
> **Interactive UX concept, not an implemented Obsidian plugin or a release candidate.**

## Open the concept

Save [index.html](index.html) locally and open it in a modern desktop browser. It is a single, editable HTML file with inline CSS, JavaScript and SVG icons. No build, npm install, CDN, font download, server or GitHub account is required to use the prototype. GitHub's file viewer displays source rather than running HTML.

All external connections are denied by the embedded Content Security Policy. The concept makes no network requests and has no filesystem, Obsidian, shell or package-manager adapter. Only explicitly requested text exports download a locally generated Markdown or JSON file.

The UI deliberately reconstructs an Obsidian-style host: vault title, ribbon, workspace tab, navigation, workbench content and contextual project information. It does not ship extracted host CSS, font binaries, Vue or Nuxt UI. The production companion must use the real template foundation; this visual prototype is not proof of dogfooding or Nuxt UI compatibility.

## Recommended walkthrough

1. Start at **Projects → Create a plugin**. Complete the eight-stage wizard: welcome, environment, source acquisition, identity, development-vault designation, trust/plan review, simulated setup, and the first working loop.
2. In the final step, use **Open demo settings → Enable in demo**. This is deliberately separate from installation. Open the project workspace, then **Generate** a note-backed feature.
3. Review its illustrative files and CLI equivalent before applying. Inspect **Runs & recovery**, then **Quality**: old verification becomes stale when the generated source changes. Run a separately reviewed simulated verification.
4. Explore **Develop**, **Capabilities**, the command palette, **Release preparation** and the resumable guided tour. No action publishes or certifies a real release.

**Explore example** opens a populated Field Notes fixture without walking through setup. **Attach project** creates another inspect-only fixture and demonstrates execution trust. These are not real directory scans.

## Screens and interactions

| Area | Working concept interactions | PRD relationship |
| --- | --- | --- |
| Projects / overview | Empty state, example project, attach/switch, next-step guidance and revision/evidence summary | FR-01, FR-13 |
| Creation wizard | Input validation, source/cache selection, explicit target designation, separate trust and approval, six simulated execution stages inside eight UX steps | FR-02–12 |
| Generate | Feature and entity-with-document recipes, presets, group/folder input, file selection, illustrative source/Markdown, approval, identical rerun and conflict paths | FR-14 |
| Develop | Start/stop fixture sessions, source/candidate/installed revisions, source-change fixture, build/deploy review and plugin preview | FR-17, FR-11–12 |
| Quality | Separate verify/browser/native/security scopes; passed, failed, stale and not-run outcomes; additional named tool workflows | FR-18 |
| Capabilities | Eight runtime-service explanations and searchable/filterable inventory of all 33 baseline package scripts | FR-15–16, FR-19 |
| Release preparation | Evidence checklist, permanent non-release-ready boundary and previewed concept-only Markdown export | FR-22 |
| Runs & recovery | Operation receipts, simulated output, cancelled/failed runs, reviewed setup resume and structural diagnostic export | FR-08–09, FR-21 |
| Preferences / tour | Dark/light theme, browser-local demo preference, reset, six-step dismissible/resumable tour | FR-20, FR-23 |
| Project note | Preview, explicit browser-state commit and duplicate protection for a development handoff note | FR-19 and document-service dogfooding concept |

The tool inventory is grounded in the PRD's inspected iteration-03 baseline. Available CLI commands and proposed companion integrations are labeled separately. In particular, **binding the current vault is proposed shared backend work**: the concept does not invent an existing CLI flag for it. `test-build` is described as an install alias, not a test suite.

The code snippets in maker previews are illustrative UI fixtures, not exact generated output or a second implementation of the real generators. They must not be copied as an authoritative API reference. Real setup/maker output remains the implementation source of truth.

## Failure and recovery review

Open **Review scenarios** in the persistent concept banner. Choose a fixture, close the dialog, and exercise the normal workflow. Scenarios cannot change during an active run.

| Scenario | Where to exercise it | Expected concept behavior |
| --- | --- | --- |
| Missing prerequisite | Wizard → Environment | Block progress; explain the external tool requirement; offer an explicitly named available-toolchain fixture. |
| Offline download | Wizard → Template | Remote fixture acquisition fails; selecting the cached fixture allows source acquisition. This does not imply real offline dependency availability. |
| Target collision | Wizard apply or Develop → deployment | Preserve existing fixture installation and refuse deployment. |
| Dependency failure | Wizard execution | Preserve completed identity stages, stop before deployment, retain a failed receipt. |
| Source changed | Wizard apply | Revoke the stale plan/approval before any simulated mutation. |
| Edited scaffold | Generate → apply | Refuse overwrite and leave the source revision unchanged. |
| Generated test fails | Generate → apply, or a verification run | Keep generated source and a failed test receipt; do not promote full verification. |
| Happy path | Any supported flow | Restore normal fixture behavior; all results remain simulations. |

For failure recovery, close the wizard, restore **Happy path**, reopen **Continue setup**, and choose **Review & resume**. Review and approve the fresh plan. The resume command is shown explicitly; old failures remain in history and verification runs again.

Cancelling a setup clears the browser timer and preserves completed fixture stages. A saved in-progress run is hydrated as interrupted rather than automatically resumed. Fixture development sessions are not restored as silently running processes after a page reload.

## Interaction decisions

The main navigation remains stable; creation uses a staged modal rather than a different application shell. Source location and target vault are distinct. On wide screens a contextual rail keeps this relationship visible; at smaller sizes the rail collapses and the workspace remains usable.

A primary next action is shown in context rather than surfacing every npm script as an equally prominent button. Advanced scripts remain discoverable through the catalog. Long-running behavior has one runtime-owned operation record and can be inspected outside its initial modal.

Approval is separate from browsing, trust and acquisition. The prototype exposes the practical consequence: a changed plan becomes invalid and must be reviewed again. Sample data and outputs carry persistent simulation labels; a successful build never marks browser, native, audit or public-release acceptance as passed.

Keyboard: **Ctrl/Command K** opens the searchable command palette; **Arrow Up/Down** selects an action; **Enter** activates; **Escape** closes a dialog or pauses the tour. Native HTML dialogs provide focus containment. Visible focus and reduced-motion styles are included, but full assistive-technology qualification remains pending.

## State and privacy

Demo state uses only the browser key `shell-workbench-concept-v1` when **Remember the demo** is enabled. It contains entered example project values, preferences, wizard state and bounded run history. Do not enter credentials or sensitive paths. No data is transmitted.

If browser storage is denied, the app displays a memory-only warning and remains usable. Unreadable or future state is preserved until an explicit reset rather than silently overwritten. **Reset demo** deletes only this concept's key, not other browser storage, project files or vault data.

The handoff export is visibly marked as concept-only and omits absolute paths, author names and raw logs. Diagnostic export contains only structural run IDs, kinds, statuses and stage counts. These limited fixtures are not qualification of the production redaction service.

## Implementation handoff

`index.html` is both the standalone entry and the editable concept. Its named inline sections separate model/catalogs, workspace views, wizard, dialogs, simulated operations and interaction routing. Changes should preserve the no-network policy and clear simulation boundary. This file is concept material, not a production component or a substitute for the proposed architecture.

The implementation should replace fixture behavior with the PRD's framework-free orchestration and shared contracts. Do not transplant DOM string rendering, synthetic results, browser trust storage or the fixture path validator into production. Real filesystem canonicalization, archive validation, process-tree control, source fingerprints, shared locks and CLI/UI parity need independent implementation and negative tests.

Production remains Vue/Pinia/Nuxt UI on the existing shell foundation. Reuse its public feature API, document repositories, events, preferences, modal/notice services, logging, styles and lifecycle. No current repository architecture, dependency policy, deployment permission or test threshold is changed by this concept.

Deliberately not implemented here: real template acquisition; actual setup/makers/builds; file or directory access; Node/npm discovery; native host activation; safe process cancellation; actual checksum verification; real repository inspection; English/German localization; template upgrades; marketplace submission; mobile execution; full keyboard/screen-reader conformance.

## Verification

See [VERIFICATION.md](VERIFICATION.md) and the [machine-readable check record](browser-checks.json). The [browser check script](../../../tests/concepts/companion.browser.py) runs separately from production verification and never runs template setup or launches Obsidian.

The recorded result is **52 browser-concept checks passed**, with no page/console errors or network requests in the exercised routes. The browser environment blocked direct file and loopback navigation, so tests injected the embedded HTML. Persistence cases use an explicitly controlled Storage stand-in; native file-origin storage and external browser compatibility remain unqualified.
