# Full companion project JSON: verification and delivery

**Date:** 2026-09-24. **Scope:** standalone companion concept and the read-only shell handoff v1.

## Delivered source

This increment implements the previously supplied handover on PR #5, based on reconciled head `63e2589eaae79d715e6561e5704a46bda0053bb6`. That baseline already incorporates current-main framework lifecycle work; the earlier product-audit conflict notice is historical.

The handover's 26 source/artifact paths were checked against their before/after hashes. Direct source writes and readable Git patches reproduced the entire candidate from a clean checkout. The committed implementation was then rebuilt on a staging branch and verified before PR advancement. Temporary patch/manifest/workflow files are removed from the final tree. No force push, PR merge, release or native conversion is part of this delivery.

A separate integration correction updates the concept-boundary test's exact inventory from 105 to **107 concept inputs**, with an explicit assertion that the shared `scripts/companion/project-contract.mjs` is also registered. Thus the full assembly inventory is 108 inputs including that shared module. This updates an obsolete count, not a production quality threshold, suppression or boundary rule. It is not included in the staging handover's original 26-file identity claim.

## Exact artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `index.html` | 1,540,936 | `30032f20093f6eeb120ec701ee37bd379714f06f3f76293ad3bf2417d2000f0d` |
| `companion-project.json` | 147,928 | `c33f1892d47734e516429c7425b6a3afd1d06799c664dc22b4081463b00ac4d6` |

The JSON is exported through the same `companionJson(companionExampleProject())` browser codec used by the product, not manually abbreviated. The browser suite also downloads an actual full export and passes it to the real CLI. Both artifact hashes remain identical to the local handover.

## Executed staging CI

[Staging verification run 36054991844](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36054991844) passed and created implementation commit `508075345ef4cc9973d110d31228112f4f7636e5`. The entire resulting Git tree matched the independently assembled local tree, not only selected file hashes.

| Check | Observed result |
| --- | --- |
| Browser regressions | **914 named assertions passed across 17 suites** |
| Project transfer | **65 passed**, included above |
| Actual HTTP-origin/two-window Storage | **15 passed**, included above |
| Read-only CLI and test-data contracts | **39 Node tests passed** |
| Assembly, inventory and tamper rejection | **12 tests passed** |
| JavaScript syntax | **77 concept modules and three shell modules passed** |
| Offline HTML and golden JSON | Exact artifact identities above |

Source checks used Node 24.21.0; browser tooling was isolated and pinned to Playwright 1.57.0. The [retained evidence](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36054991844/artifacts/10831594143) was downloaded and independently reopened. ZIP SHA-256: `95dddefdb269939620d3e268f01a48aa62a7358b27a444dcc99d5c50bb55f533`. Both artifact identities and all 17 raw reports were verified. All reports contain passing named assertions and no observed page/console errors, fatal errors or unexpected network requests in their exercised scope.

The successful real-origin suite resolves the earlier local storage-execution gap for this candidate. It does not establish native Obsidian or file-origin persistence. Counts include controlled-state, model, geometry and actual-input assertions, not 914 independent end-to-end user journeys.

This is exact-candidate staging evidence. The inventory-test correction and final documentation cleanup are separately checked by the normal PR workflows after publication. Full root/template and merged-PR results must be read from the runs attached to the delivered PR head; the staging results do not substitute for them. The PR description records the observed final-head results.

## Local evidence retained

Before publication, the local Linux environment (Node 22.16.0, Python 3.13.5, Playwright 1.57.0, Chromium 144.0.7559.96) passed **899 assertions in 16 browser suites**, **39 Node tests**, and **12 assembly tests**. The shell consumes the actual browser download, returns exact original bytes and performs zero writes in isolated temporary vaults. The 65 new transfer assertions are included in the 899, not added to them. This environment is distinct from the repository's pinned Node qualification.

The earlier local `--real-storage` run was blocked before its first assertion by managed-browser loopback policy. Its failed aggregate remains historical evidence; no controlled Storage substitute is treated as real-origin proof. Local and CI counts are not added together.

## Product and qualification boundaries

The built-in companion is an editable authored model containing 22 surfaces, four PRDs and 25 mapped requirements, component definitions/content/variants, nine entities, relationships, source operations, test recipes, design tokens and notes. It is not evidence that the native companion exists or that those requirements are implemented.

Full JSON export/import preserves saved authoring fields and project-owned codebase/tests settings (`src` / `tests` by default). Replacement requires review and confirmation, protects observed stale state and modified owned records, and rolls back after save failure. Execution trust, approvals, generated files, machine paths, receipts and unsubmitted form drafts are not portable authoring fields. Recovery snapshots are a different format. Exported authored information may be private.

`scripts/companion/generate.mjs` v1 accepts `--input`, `--target` and optional `--vault`, validates bounded input and target containment, and returns the **original input bytes** on stdout. It does not create target directories, generate boilerplate, fetch source, install dependencies, activate a plugin or execute imported content. Codebase/tests settings describe future target-relative output locations; they do not relocate existing files or change current build configuration.

Filesystem and storage precondition checks are best-effort rather than atomic cross-process guarantees. Native Obsidian, file-origin persistence, assistive technologies, physical devices, production compiler behavior and full native recovery/migration remain separate qualification gates. Shell qualification still precedes native companion conversion and publication.

## Reproduction

```sh
node --test tests/tooling/companion-project.checks.mjs tests/tooling/test-data-*.checks.mjs
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
CHROMIUM_EXECUTABLE=/path/to/chromium python -B scripts/concepts/run-browser-checks.py --real-storage
# Requires the repository's pinned dependencies:
node --test tests/tooling/companion-boundaries.checks.mjs
```

See [PROJECT-JSON.md](PROJECT-JSON.md) and [the shell contract](../../development/COMPANION-PROJECT-JSON.md) for the full interaction and command contracts.
