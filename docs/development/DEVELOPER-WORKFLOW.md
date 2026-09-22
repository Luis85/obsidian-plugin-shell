# Developer workflow

**Current version:** PRD 0.5. Read the [capability matrix](../product/PRD.md#3-scope-and-capability-status) before running commands. The repository currently has an original host-style specimen and focused tests, not the complete plugin/setup/maker/toolchain.

## 1. What you can run now

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node --test tests/harness-styles/server.test.mjs
```

Inspect light/dark controls, settings, notices and a modal in the printed loopback URL. These are isolated appearance/interaction specimens; they create no notes and do not run Vue or native Obsidian. See [host-style documentation](../testing/HARNESS-STYLES.md) and the [review evidence](../reviews/2026-09-22-product-review.md).

## 2. Intended complete-template first run — pending implementation

After obtaining the template and installing the documented Node/npm prerequisites:

```sh
npm run setup
npm run make -- feature tasks
npm run make -- entity task --feature tasks --document
npm run dev:ui
```

Setup starts with checked-in Node-only code before node_modules exists, reviews identity/profile/downloads, installs the qualified lockfile, builds/checks the selected scope, and exits with next steps. No prerequisite npm ci, lifecycle-recursion trap, global install or silent machine configuration. CI/reinstall can explicitly use npm ci.

Makers provide discoverable help, dry runs, explicit integrated source/tests and noninteractive JSON. A maker does not implement a complete Todo application, overwrite developer edits, or write Task notes into a vault. The [setup/maker contract](SETUP-AND-MAKERS.md) defines the details.

## 3. Make a small real feature change

The first-change example remains an optional Task/item description. Add domain validation, extend the existing use-case input/output, update persistence decoding/migration deliberately, expose a labeled Vue field, add locale keys, edit owned CSS, and cover success/failure/reload in real tests. Most feature changes do not need main.ts changes or new infrastructure.

For note-backed entities, define fields/defaults/validation separately from document destination/frontmatter/body. Use DocumentCreationService rather than assembling YAML in a button callback. [Entity recipe](ENTITY-DOCUMENTS.md)

```ts
// Intended API: not currently implemented in this repository.
const result = await documentCreationService.create({
  entity: 'task',
  values: { title: 'Prepare release checklist', due: '2026-09-30' },
  requestId: submissionId,
});
```

The caller then uses the shared feedback policy. It must not infer from a caught exception that nothing was written, or notify success independently from multiple event subscribers.

## 4. Show correct feedback

Use field-associated errors for validation and retain drafts. Use one updating progress state for an operation. Put essential write/recovery information in the owning view; optional notices are a secondary convenience, not the only place to recover.

A confirmed creation followed by failed opening is still created. Retry opening from the receipt. An uncertain create result requires reconciliation, not another ID/filename. Cancelling before a write is normal; closing a modal during a write does not necessarily cancel the host operation.

The [error/notification contract](../architecture/ERRORS-AND-NOTIFICATIONS.md) defines normalization, adapters, timing, deduplication, actions, privacy and cleanup. Do not duplicate catch/new Notice code or serialize raw exceptions into user text.

## 5. Events and styles

Use the existing runtime-scoped typed bus for facts and owned subscribers, not command requests or global state. Late views load current state; closing one view does not dispose the shared bus. Add events/listeners through the maker/catalog contract, and publish committed facts only after confirmed persistence. [Event semantics](../architecture/EVENT-BUS.md)

Author small ordered CSS modules and compiled Vue component styles. The native plugin outputs one dist/styles.css; do not edit it. Original harness/styles/obsidian.css supplies simulated host styling and is never installed with the plugin. The integrated harness will load host CSS before the actual plugin CSS, with exact-candidate tests. [Style contract](../architecture/STYLES.md)

Native modal/settings roots need their own owned namespace/tokens. CSS does not implement focus trapping, notifications, or native actions.

## 6. Verification and evidence

The future dev:ui/verify/test:e2e/test:obsidian commands are not available yet. When implemented, run targeted checks during changes and full required checks before handoff. Source/CSS/tooling ≤400 physical lines, tests/helpers ≤450, composition-only main.ts ≤100; count complete SFCs/comments/blanks.

Browser checks must observe caught Vue/application errors in addition to console/pageerror. Negative scenarios assert exact expected codes/counts and no extras. A rendered fallback is not enough to pass. Screenshots and static Markdown specimens do not prove persistence or native APIs.

Use the declared scenario/theme/locale/seed and owned readiness signals. Record source/build/style identity, actual commands, and missing environments. Never accept baselines or suppress errors just to complete a task.

## 7. Native work and release

The intended dev:local path uses .dev-vault and safe staged matching JS/CSS/manifest. Preserve data.json, user notes, other plugins, and security settings. Restricted Mode is a deliberate human decision; the setup does not disable it. Optional CLI actions confirm the exact fixture vault and fall back safely.

Real host/device checks remain separate from specimen and real-component harness evidence. Confirm native Notice/Modal behavior, pop-outs, created Task frontmatter, no-overwrite writes, and claimed mobile functionality using the exact candidate.

The [maintenance/release guide](MAINTENANCE-AND-RELEASE.md) retains reviewed dependency updates and fixed-commit draft/promotion. No dependency update auto-publishes; no native acceptance based solely on fixture tests. First directory submission is separate.

## 8. Troubleshooting principles

| Symptom | Correct investigation |
| --- | --- |
| npm command is missing today | The full toolchain is not implemented; use the available fixture commands or the bounded implementation plan. |
| Setup later needs a missing package to start | Repair dependency-free bootstrap; do not add an undocumented preinstall requirement. |
| A service failed but no pageerror appeared | Inspect the independent captured-defect ledger. |
| Two notices appeared for one create | Fix operation/owner reporting, not broad notification suppression. |
| Note exists but UI reports failed create | Separate commit outcome from opening/listener/sink failure. |
| Missing native styling | Check real plugin CSS, host-root namespace, scope identifiers and installed hashes; do not hide it in the shim. |
| Generator conflicts or reports unused output | Preserve existing work and repair real registration; no blanket force/fallow ignore. |
| Host unavailable | Report not run; fixture screenshots cannot substitute. |

A handoff describes actual behavior, exact checks and limitations. Extensive generated code or a polished specimen is not a completed template.
