# PR #18 framework CLI implementation record

Date: 2026-09-25. Scope: merge reconciliation, central TypeScript CLI, shared plans/intake/generation/lifecycle, deterministic compiled kit, fixtures and qualification tooling. This is not native companion conversion or public framework shipment.

## Source reconciliation

The PR branch was merged without force with base `851c7ff0e44b7a5da36fbe0e956d4bf5282cf35d` in commit `cc06a46d3c921064c509a0f83384894d092ccca9`, tree `1d9a61b1b61f6bc41fae543532e77fb60d1b4094`. Both the roadmap and current v3 Storymap/Page/Component handoff contract were retained. Native/concept source and compiler changes from the base were not replaced by an older baseline.

PR #17's JSON-data validator, operation catalog/protocol, maker descriptor/dispatch/argument/planner extraction, capability tests and inventory/protocol documentation were selectively recovered from `7b02821269f4286f4c3f0031f0bd4af4b4b83fe9`. Old runtime, package/lock, README ownership and task-completion states were not copied. This is selective integration, not a claim that every historical gauntlet record has been reconciled.

## Implemented surface

See [CLI workflow](../development/FRAMEWORK-CLI.md). Authored orchestration and distribution modules are TypeScript. Existing makers, compiler, binary-safe file plan, fixture engine and guarded release services remain shared implementations. The source launcher and compiled kit execute the same CLI handlers.

The archive excludes prototype UI/vendor/assembly assets and their maintainer-only checks. Shared fixture-library modules and reference documents/design fixtures remain explicit kit inputs. Root quality thresholds are unchanged. The original full-source Python maintainability test is retained as `concept-metrics.checks.mjs`; the consumer keeps a separate self-contained unsupported-language fixture test with the same stale/tamper checks. Readme adaptation verifies the original reviewed hash before rebinding distribution-only ownership metadata.

The compiler still produces implementation obligations for free-form business behavior and rich detail designs. Framework internals keep their original directories. Runtime RPC, native companion persistence/UI, arbitrary source/data migrations, complete legacy-to-TypeScript extraction, token exporter integration and full release qualification are not completed by this increment.

## Local evidence and limits

Supplemental environment: Linux, Node 22.16.0, npm 10.9.2, TypeScript 5.8.3. These are not the repository-qualified versions. Temporary ignored links exposed the container's existing TypeScript and Node declarations for local typechecking; the repository dependency pins/lockfile were not changed to obtain a local pass.

Executed checks include strict framework TypeScript checking; direct/npm and headless API agreement; parser/JSON/no-interaction and poisoned-discovery checks; setup/import/blank-design/ownership/stale-plan checks; actual deterministic ZIP extraction with independent Node zlib CRC verification; compiled CLI bootstrap before dependencies/Git; full v3 intake, custom product folders, generation/reimport/edit preservation; fixture apply/reset; bounded subprocess output, split UTF-8, nonzero exits, timeout/cancellation and recovery details. Exact final totals belong to the final implementation commit/PR report rather than earlier intermediate runs.

An earlier integrated snapshot passed 202 tests with two platform skips. This historical result does not qualify later changes. One subsequent local foreground test invocation was interrupted by the tool timeout; its partial log was retained and not counted as a pass. A separate completed kit run passed all three cases. Focused process/fixture cases passed seven tests. Final source is rerun separately.

Full pinned dependency installation, production analyzer/coverage, real browser/Obsidian, Windows/macOS and public release qualification were not executed locally. Missing dependencies prevent the complete repository checker; no substitute was called equivalent. ZIP bootstrap/generation tests do not prove an independent dependency install/build.

## Hosted qualification

The read-only `Framework CLI and release archive` workflow selects the exact repository Node/npm versions and exercises Linux/Windows/macOS. It typechecks and tests the CLI, assembles the ZIP, extracts its actual bytes, configures two independent consumers, installs locked dependencies, builds/tests them, installs into isolated marked test vaults and confirms that release readiness remains blocked without evidence. It preserves source/archive hashes and logs. It does not launch a native host, enable a plugin, create a public release or claim PRD TODOs passed.

The existing full repository, generator and concept workflows remain separate. Pending or cancelled hosted runs are not passing evidence. Do not close SH-022/SH-034 or begin native conversion until their remaining criteria are actually met.
