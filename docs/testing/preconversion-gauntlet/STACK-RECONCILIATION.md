# PR #16 / #17 stacked-branch reconciliation

## Source identities and scope

PR #17 remains stacked on PR #16. The repair preserves these exact parents:

- Implementation: `040f63ad29c94771380a24df0ef12504e8cef8c1`, tree `925e578c3e55593f86ef46c19d3dc7a7125b3819`.
- Updated planning base: `a6dd8e46cd208880550f8f49409b8a681665a17d`, tree `4aa086ce80517f165b6be5af096dfca8a31c3806`.
- Original planning baseline used for the three-way source comparison: `2cadc495d5989760b09f257289b33e9d7c356e70`, tree `85cb73db5a720344a2015c60de9e37061bcbee3d`.

Downloaded source archives were reconstructed from their exact bytes and modes;
all three Git trees matched their remote identities. The containing commit is the
repair identity. This is a branch-local integration, not a merge of either PR.

## Resolution decisions

Retain PR #17's runtime, harness, package/lockfile, workflows, task states, capability
protocol, makers, shared contracts and complete ownership manifest unchanged.
Preserve both archived requirements versions, both retained template guides and
all existing implementation evidence. The unpushed SH-015 handoff is not imported.

Import the complete newer concept from PR #16, including its maintained sources,
assembled HTML, shared controls/focus fixes and consistency tests. Its source,
builder, runner, 105-input analyzer inventory and boundary assertion move together.
Every concept file matches the incoming base; none is reconstructed from an older
HTML file. Preserve both PRD extension sections and the three README regressions.

The planning README and implementation README are different legitimate reviewed
files. PR #17 must retain its own README SHA-256:
`f2bf82f5b06adb71b9569453851a3dc282a2dd69614f89901f7bff4bc68bf017`.
Blindly taking PR #16's ownership hash would reproduce its original CI failure.
All 85 retained ownership entries were checked against the integrated source.

## Executed verification

Supplemental environment: Linux, Node 22.16.0, npm 10.9.2, TypeScript 5.8.3 from the
preinstalled toolchain, Python Playwright 1.57.0 and system Chromium 144.0.7559.96. No package, lockfile,
global installation, quality threshold or execution policy was changed. This is
not the qualified Node 24.21.0/npm 11.19.1/TypeScript 6.0.3 environment.

| Check | Result |
| --- | --- |
| Original PR #16 actual removal CLI | Expected failure: `EXAMPLES_EDITED_FILES: README.md` |
| Repaired PR #16 and integrated PR #17 actual removal CLIs | Read-only previews passed |
| README/removal/file-plan/discovery/task tests | 37 passed, two existing Windows-only skips, zero failures |
| Executable test-data kit tests | 27 passed, zero failures or skips |
| Source verification tests | Three passed |
| Assembly/inventory/tamper tests | Ten passed |
| Maintained concept JavaScript syntax | All 75 files passed `node --check` |
| Code-line limits and locale parity | Passed: 497 inputs, 191 translated keys |
| Full-source removal in an isolated Git-free copy | 86 actual writes; every non-plan file preserved; identical rerun writes zero |
| Wrong-branch hash, edits before planning and edits after preview | Rejected; complete before/after source snapshots unchanged |
| Exact concept reconstruction | 1,490,957 bytes; SHA-256 `c77e4e45e640b58e0008722f49ff1afe58a3e2cc5f6c371c150130a543f44f0e` |
| Exact-artifact browser run | 766 assertions passed across 14 suites; aggregate exit 1 because real HTTP-origin storage was blocked before its first assertion |
| Standard repository checker | Blocked locally: installed `yaml` dependency unavailable |

Commands:

```sh
node scripts/examples/cli.mjs --dry-run --json
node --test tests/tooling/readme-ownership.checks.mjs tests/tooling/example-removal.checks.mjs tests/tooling/file-plan.checks.mjs tests/tooling/capability-discovery.checks.mjs tests/tooling/preconversion-tasks.checks.mjs
node --test tests/tooling/test-data-*.checks.mjs
node --test tests/verification/source.test.mjs
node scripts/quality/check-source.mjs
python tests/concepts/companion-assembly.test.py
python scripts/concepts/build-companion.py --check
python scripts/concepts/run-browser-checks.py --real-storage
node scripts/quality/check-repository.mjs
```

The storage navigation failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR` on the
loopback HTTP origin. No policy setting, browser flag, alternate host or test
assertion was changed to bypass the restriction. The failed aggregate is retained
in the [browser summary](stack-reconciliation-browser.json); its storage suite
ran zero assertions. Hosted storage qualification remains required.

Browser counts describe named assertions, including model and controlled-state
cases, not distinct physical-user journeys. Review was sequential, not independent.
Full pinned-toolchain CI, generated-consumer builds, native host, security and
platform/accessibility qualification must be read from their own exact-head runs;
these supplemental checks do not establish them. Pending CI is not a pass.

**PRE-CONVERSION BLOCKED.** No task state or acceptance row is promoted, no PR is
merged, and no force push, tag, release, native companion conversion or personal
vault operation is included. The shell installer's `.dev-vault` default is retained.
