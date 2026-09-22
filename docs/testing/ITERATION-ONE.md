# Iteration 01 — verification record and remaining scope

**Date:** 2026-09-22. **Plugin:** 0.1.0. Read with the [installation and implementation guide](../development/ITERATION-ONE.md).

## Qualified first-view candidate

Hosted workflow [35752636784](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35752636784) completed successfully for source commit **`edaa5081d524a76d1c1edf1331ce0550b2595f09`**. Both Windows and Ubuntu started from fresh checkouts with no project dependencies and ran the actual **`npm run setup -- --yes --no-interaction`** path before independent verification. The workflow did not publish a release or change a personal vault.

This candidate demonstrates the requested first Nuxt UI showcase in an actual Obsidian view. It does not complete all PRD acceptance cases. The retained machine acceptance inventory, iteration test IDs, code coverage and native checks remain separate scopes.

| Scope | Actual result |
| --- | --- |
| Windows clean-checkout setup, build/local install, service tests | Passed. |
| Ubuntu clean-checkout setup, build/local install, service tests | Passed. |
| Independent `npm run verify` on both operating systems | Passed: build, types, configured linters, source/locale/architecture checks, runtime tests, artifact/token checks, retained baseline, and browser build. |
| Vitest domain/application/feedback/events/tooling suite | 32 tests passed; not added to the retained baseline's count. |
| Retained verification baseline | 52 distinct Node tests, three complete executions = 156 passes per verification, zero retries. |
| Served Chromium real-component harness on Ubuntu | Eight tests passed; zero skipped, unexpected or flaky results. This is served execution, not inline fallback. |
| Actual Obsidian 1.13.7 on Ubuntu | Five named native checks passed with zero observed page errors. |
| Selected-core coverage on Windows and Ubuntu | Measured; values and exclusions below. No complete-production coverage claim. |
| Windows-native Obsidian, macOS-native, mobile devices | Not run. Windows build/service success is not Windows-native host evidence. |

### Five native checks

1. Open **Open capability showcase** through the actual command palette and see the Vue/Nuxt UI view.
2. Preview and create a Task, read its real Markdown from the isolated vault, and compare it byte-for-byte to the displayed preview.
3. Publish a real typed event and observe it in the view.
4. Open and dismiss the native modal, verifying that it is removed.
5. Open native Settings through the command palette, select the plugin's declarative settings tab, change the Task folder, and confirm both the native input and persisted plugin data show `Native/Tasks`.

The native run records Obsidian **1.13.7**, Electron **43.3.0**, and Chrome **150.0.7871.212** on Linux. App and installer were resolved separately; the report records both as 1.13.7. Build/setup verification used Node **24.21.0** in hosted runners.

## Recovery of the interrupted run

The implementation survived on `build/iteration-one`. Earlier native runs already exercised opening, documents, events and modals, but the added settings scenario failed because a broad settings selector chose the hidden **Search settings** control. That failure was not counted as a pass or removed from the required scenario.

The test now follows the documented user workflow: command palette → Open settings → visible plugin settings tab, with detection across native windows. It observes page errors in both the original and subsequently opened pages. The completed workflow above verifies the corrected path.

The resumed work also strengthened CI: it now invokes guided setup directly from a clean checkout rather than installing dependencies before the command under test. This qualifies the noninteractive setup path; manual terminal usability and the full future rename/resume wizard remain separate concerns.

Local recovery checks used the available Node **22.16.0**: repeated dependency-free baseline, setup dry run without dependencies, source-size/link checks, and installation of the retained prebuilt files into a disposable directory while preserving a pre-existing `data.json` and note. The full current package graph, served UI and actual native host were verified in hosted runners, not claimed as installed in that offline local environment.

## Test families

| Family | Implemented assertions | Related target scope, not blanket completion |
| --- | --- | --- |
| Domain/paths | Calendar dates, title/tags, unsafe paths, invalid/unknown preferences. | AC-04, AC-07, AC-51, AC-55 |
| Document service | Actual YAML serializer, preview/no-write, one complete write, duplicate request, write failure, stale folder/plan, preserved opening failure. | AC-50–57, AC-62 |
| Bus | Literal payload type checking, ordering, once/reentrancy, unsubscribe, synchronous/asynchronous failures, disposal/snapshot isolation. | AC-43–46 |
| Preferences | Queued concurrent saves, invalid/corrupt/future data protection, persistence failure. | AC-05–08, AC-27 |
| Feedback/diagnostics | Owner replacement, bounded history, native-handle cleanup, sink errors, post-dispose guards, safe observed codes. | AC-21, AC-65, AC-67, AC-71 |
| Tooling | Dependency-free setup help/dry run, contained installation preserving data, unsafe-path rejection, real forbidden architecture fixtures. | AC-13, AC-18–19, AC-37 |
| UI-I01–08 | Real Nuxt rendering, CSS containment, actual Markdown, known write/open failures, persisted German preferences, events/feedback/modal focus, responsive/live-theme layouts, independent view IDs/disposal. | Selected AC-03–11, AC-22, AC-61 and NUI cases |

Wrong event/entity payload declarations are compile-time assertions, not extra runtime tests. Browser tests use real application services and the production serializer, with explicit browser-only persistence and host adapters. A toast is not the oracle for whether a file was written.

The initial served run found an incorrect host sentinel: the chosen button was fixture toolbar chrome with its own CSS. The corrected test inserts a neutral native button outside plugin/toolbar roots and compares its computed font/radius with plugin CSS enabled and disabled. Theme tests compare rendered backgrounds through dark → light → dark rather than only reading an unresolved token string.

## Coverage is scoped

The configured measured set includes domain, application, event implementation, diagnostics and Markdown serialization. Both qualified operating systems reported:

| Metric | Selected-core result |
| --- | ---: |
| Lines | 98.27% |
| Statements | 90.59% |
| Functions | 88.52% |
| Branches | 92.68% |

Vue components, native adapters and tooling are outside that measured set. These values do **not** establish the full PRD production thresholds, which remain an outstanding qualification requirement. `test:coverage` currently measures rather than pretending those broader gates are implemented. Broader fallow dead-code/complexity/duplication qualification also remains pending; resolved architecture is blocking now.

## Candidate identity

The installable handoff uses the **Ubuntu-built files that passed the native checks**, unchanged:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `main.js` | 436520 | `22c7e4299ebcdb257d5ffd246c95ce6cd1afd4a9128806e59ed8db94102b24da` |
| `styles.css` | 90847 | `b0cc99057ccab569679c2ec7129738a0da75b4a35fb0d549080131771f1ebbf0` |
| `manifest.json` | 280 | `25743743ed800b90ade6f3dcc91fb08ae438ef9fa4761e5ab1865e6e1cc84175` |

Source ZIP, installable plugin ZIP, and evidence are different deliverables. The plugin ZIP contains the three assets under `plugin-shell/`, ready to place under a test vault's `.obsidian/plugins/`. No Task data, harness stylesheet, font binary, browser executable or test report belongs in that installed directory.

The Windows build passed its own checks but produced different bytes. Cross-operating-system byte reproducibility is not claimed, and its files do not inherit the Ubuntu candidate's hash-bound native acceptance. A subsequent changed build needs its own relevant evidence. Documentation-only handoff commits do not retroactively change the recorded candidate source SHA.

The bundle is CommonJS with the Obsidian host API external and one composed stylesheet. Nuxt UI 4.11.2 uses source-hash-guarded replacements for two global-style modules, local icons, no router/color-mode ownership and no Preflight. Dependency notices are retained. Only the exercised component subset is qualified, not every Nuxt UI widget.

## Reproduction

```sh
# First run: no prior npm ci is required.
npm run setup

# Independently check this iteration.
npm run verify
npm run test:coverage
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

Optional Linux native reproduction additionally needs Xvfb and explicit provider provisioning:

```sh
npm install --prefix .native-runner --save-exact obsidian-launcher@3.2.1
xvfb-run -a npm run test:native -- --allow-download
```

This downloads/runs a host only inside the runner's temporary vault/config. Ordinary setup does not enable Community plugins or alter Restricted Mode. The optional native provider dependency graph is separate from the core lockfile and must be fully locked before becoming a permanent release prerequisite.

## Remaining qualification

Pending: full setup identity migration/resume and makers; complete entity/event catalogs; all notification timers/actions/queues; complete component/native/tooling coverage and production thresholds; broader analyzer enforcement; expanded Nuxt UI widgets; pop-out/theme and device matrices; full accessibility assessment; update/release automation and public submission.

The manifest is desktop-only. No public release or directory submission was performed. The first working view is delivered; the full GitHub-template product remains incrementally implemented under its unchanged requirements.
