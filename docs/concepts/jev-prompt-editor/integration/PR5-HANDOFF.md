# PR #5 integration handoff — Jev Studio

## Delivery status and exact baseline

The live PR was read from `Luis85/obsidian-plugin-shell`, PR #5, branch `docs/companion-plugin-prd`, at head `b66200e2f43cd0682028f0151f9bdffc853cd2bf` on 27 September 2026. The PR body contained an older advertised head; the live `head_sha` was used.

This package is a **standalone, PR5-aligned product prototype**, not a native feature installation. The prototype is now retained under `docs/concepts/jev-prompt-editor/` in a separate change stacked on PR #5 at `e540157e63c9b81fdadb7bd84eca4aa56a8809b0`. No authoring model was imported and no compiler/generator/native compatibility is claimed. The original design inspection below remains tied to `b66200e2f43cd0682028f0151f9bdffc853cd2bf`.

The browser build uses the locally available Vue 3.5.13 bundle and TypeScript 5.8.3 on Node 22.16.0. These are recorded actual tools, not substitutes advertised as the PR’s qualified pins. It does not contain Pinia or Nuxt UI. Port presentation to the actual checked-out pins before native qualification.

## Additive placement

Recommended design-working-directory destination:

```text
docs/concepts/jev-prompt-editor/
  jev-studio.html
  src/
  scripts/
  tests/
  docs/RESEARCH.md
  integration/
  examples/
  evidence/
  vendor/                       browser-only Vue and its license
```

Use a new branch based on the inspected PR5 branch after checking its current head. Reinspect consequential changes before rebasing the concept. Do not replace the existing companion project or treat `integration-map.json` as an importable project file.

A Jev prompt recipe is NOT `kind: obsidian-companion-project`, schemaVersion 5. The companion importer’s complete-project semantics remain separate. Its read-only `companion:generate` inspection command must not be represented as a generator. No generator command was executed for this package.

## Core already exercised by this prototype

| Source | Responsibility | Native disposition |
|---|---|---|
| `src/domain/types.ts` | Recipe, binding, question, snapshot, response, revision types | Convert namespace exports to ordinary project modules |
| `validation.ts` | Fail-closed authoring import and semantic checks | Preserve tests; adapt to shared validation conventions |
| `context.ts` | Pure bounded state projection and request compilation | Keep projection/compiler; replace browser Markdown parsing with native metadata input |
| `policy.ts` | Typed response validation and review decisions | Keep framework-free; fixture producer belongs to test infrastructure |
| `fixtures.ts` | Synthetic recipes and vault | Browser/test-only; never treat as personal data |
| `application/service.ts` | Single canonical library owner, transaction-before-commit | Adapt to actual feature repositories/services |
| `adapters/browser.ts` | File chooser, JSON download, browser storage | Browser-only; do not enter plugin bundle |
| `presentation/workbench.ts` | UI drafts, interactions, local projections | Split into focused project composables and per-view Pinia stores |
| `presentation/*.html` | Precompiled standalone Vue views | Convert to Vue SFCs under project presentation/components |
| `bootstrap/main.ts` | Composition only | Wire actual feature registration and injected host capabilities |

The browser’s one large view model is convenient for this self-contained concept, not the recommended final native component boundary. Split Library, QuestionEditor, ContextPicker, PolicyBench, VersionHistory, and JsonReview. Keep canonical persistence in application services, not Pinia, and do not import host classes into domain/application.

## Native context adapter contract

Capture a reviewable snapshot from an explicit scope. The scope contains active-note identity, requested body/metadata projections, selected references, link-depth cap, exclusion rules, per-note limits, and selection opt-in. Never expose an arbitrary JavaScript or Dataview evaluator through an imported prompt.

The adapter should:

1. Enumerate only eligible Markdown files using the host Vault API. Apply exclusion policy before reading content. Generated prompt/version/evaluation folders should be excluded from context by default to prevent feedback loops.
2. Determine the active Markdown view and distinguish its current editor buffer from the saved file. Read the buffer/selection only when the respective binding is enabled. A missing Markdown editor is an explicit empty/error state, not an implicit choice of another leaf.
3. Read selected saved notes through host APIs and obtain frontmatter, tags, headings, and link resolution from MetadataCache. Treat incomplete metadata as pending. Do not silently use the prototype’s YAML subset as native truth.
4. Resolve unique links through host semantics. Do not guess between duplicated basenames. Bound expansion and list omitted references.
5. Attach capture time, source identifiers/revisions, buffer-versus-file origin, clipping information, and a strong content digest to a local provenance manifest. Do not send that manifest by default merely because it exists.
6. Invalidate the review when a source, recipe, policy, or model selection changes. Register/unregister relevant host events with feature lifetime. Cancel stale asynchronous completions.

Official reference: [Vault](https://docs.obsidian.md/Plugins/Vault), [Editor](https://docs.obsidian.md/Plugins/Editor/Editor). The offline capture is intentionally narrower and is tested only as file import, not these host behaviors.

## Persistence and configurable paths

Recommended initial settings are `AI/Jev/Prompts`, `AI/Jev/Versions`, and `AI/Jev/Evaluations`, configurable as contained non-overlapping relative folders. These are proposed defaults, not folders created by the prototype.

Choose exactly one canonical authoring representation. A note-backed repository can store identity/lifecycle in frontmatter with a validated recipe JSON block, preserving unrelated user Markdown and fields on update. Revisions are immutable recipe snapshots. Evaluation records are separately scoped and must not include personal input text by default.

Use the companion’s existing service/repository facilities and uncertainty rules rather than creating a second saveData owner. Validate the complete candidate before writing. Guard updates by revision/content and preserve corrupt or future data. Snapshot restoration checkpoints the current draft rather than mutating a historical record.

Do not put API keys, execution approvals, resolved local note paths, or personal state snapshots in shared recipe exports. Authored instructions can still contain private text; the export review must say so.

## Live provider adapter: explicit second increment

A production call must cross an explicit adapter with: request budget checks, reviewed payload, named-secret retrieval, cancellation, timeout, response-model recording, typed response validation, and bounded retry. TypeSafe’s documented errors include 401, 422, 429, and 529; invalid credentials/schema should not be disguised as a successful synthetic response. Rate/overload retry must respect bounded policy and available Retry-After guidance. [API](https://docs.typesafe.ai/api)

Use host-managed secret selection where the installed host supports it. Store only the secret’s name in plugin settings. Feature-detect and respect the project’s host compatibility floor; do not silently raise it. Do not claim SecretStorage is an OS keychain. [Obsidian secret storage](https://docs.obsidian.md/plugins/guides/secret-storage)

Network consent is different from request-file export consent. Re-review if the resolved snapshot changes. Never write the vault directly from a choice label. A future action adapter needs separate allowlisted operations, path validation, human confirmation, current-state checks, and conflict-safe persistence. The first native increment should remain read-only regarding evaluated notes.

## Style/runtime migration

The standalone HTML has a browser-only reset and host-like rail. Neither belongs in the plugin’s native stylesheet/bundle. Map design tokens to Obsidian variables, use the repository’s reviewed scoped style pipeline, and compose native surfaces with actual pinned Nuxt UI components and local icons. Do not introduce Nuxt framework/router ownership, remote fonts, or a global toast owner.

Retain the distinction between authored state and display state. For example, a mobile inspector drawer is a per-view preference, not a prompt field. An export acknowledgement is transient permission, not data that can be imported later. The FNV-1a value shown by this concept is only a display/change hint; it must not become an authorization or integrity digest.

## Suggested implementation work packages

| Package | Outcome | Acceptance boundary |
|---|---|---|
| JP-01 Core extraction | Typed, tested domain/application modules registered through the existing feature API | Existing project boundary/coverage/maintainability gates preserved |
| JP-02 Native authoring | Actual SFC/Nuxt UI/Pinia views and note-backed recipe repository | Native editing, invalid-state retention, round-trip and rollback tests |
| JP-03 Read-only context | Active editor, selection, MetadataCache, bounded links, source invalidation | Scratch-vault tests including unsaved buffers, missing/renamed notes and disposal |
| JP-04 Provider connection | Explicit consent, secret lookup, typed adapter, budgets, cancellation, retry | Fake-transport negative cases followed by opt-in real API qualification |
| JP-05 Evaluation | Labeled datasets, immutable recipe/model/policy provenance and comparisons | No promotion based on fixture replay; held-out evidence required |
| JP-06 Release readiness | Host/theme/mobile/performance/privacy qualification and documentation | Independent artifact, native and release gates; no automatic publication |

## Open acceptance gates

This delivery does not qualify the PR5 compiler closure, generator-compatible project JSON, Nuxt UI rendering, native Obsidian APIs, native SecretStorage, real Jev authentication/inference, exact tokenization, model accuracy/calibration, concurrent native writers, Safari/iOS file handling, screen-reader conformance, or large-vault performance. “Marked ready” remains an authoring status only.

The included browser evidence loaded the exact HTML bytes through Playwright `set_content`, because this environment’s managed Chromium blocks file and localhost navigation. Browser tests used an explicitly documented in-memory Storage adapter for persistence paths. Direct file:// launch and actual persistent localStorage remain manual target-browser checks; the fallback to memory-only mode was exercised separately.
