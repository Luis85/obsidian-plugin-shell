# Full companion project JSON: verification and delivery receipt

Date: 2026-09-24. Scope: standalone companion authoring concept and read-only shell handoff v1.

## Delivery status

**Implemented and verified locally; not committed or pushed to GitHub.** Repository write attempts were blocked by the tool's safety checks, including a direct UTF-8 source-file write. No alternative write mechanism was used after that block. PR #5 was last read at `63e2589eaae79d715e6561e5704a46bda0053bb6`, open and mergeable. This receipt does not assert current remote CI success or publication of these changes.

The supplied patch is based on the archived PR merge snapshot `d1b42667a7019ff98006aa22e0dba4028ac345b5` for branch head `63e2589eaae79d715e6561e5704a46bda0053bb6`. Every changed existing source preimage matched the recovered implementation's SHA-256 before application. The source ZIP digest is `0ca88563e08a95ff6ed45c9e3414624ed166901f8028c9af96eb1224fb0d4053`. The local Git baseline used to produce the patch is an archive reconstruction, not a new remote commit.

## Exact artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Standalone `index.html` | 1,540,936 | `30032f20093f6eeb120ec701ee37bd379714f06f3f76293ad3bf2417d2000f0d` |
| Built-in example `companion-project.json` | 147,928 | `c33f1892d47734e516429c7425b6a3afd1d06799c664dc22b4081463b00ac4d6` |

The standalone HTML was rebuilt from the authoritative modules. All 24 recovered authored-file hashes and the generated HTML matched the recovered candidate. The shared envelope validator is embedded from the same source used by Node. Golden JSON equality against the built-in project is tested; no manually abbreviated export replaces it.

## Executed checks

Local environment: Linux, Node v22.16.0, Python 3.13.5, Playwright 1.57.0, `/usr/bin/chromium`. Chromium version: Chromium 144.0.7559.96 built on Debian GNU/Linux 13 (trixie). This is not the repository's pinned Node 24.21.0 qualification environment.

| Check | Observed result |
| --- | --- |
| Maintained browser suites | **899 passing named assertions across 16 suites** |
| New project-transfer suite | **65 passed**, included in 899 |
| New full-project contract/CLI tests | **12 passed** |
| Existing executable test-data tooling | **27 passed**; 39 Node tests total |
| Assembly, shared-input inventory and tamper rejection | **12 passed** |
| Authored JavaScript syntax | **77 concept JS modules + 3 shell MJS modules passed** |
| Python syntax parsing | **28 concept script/test files passed** |
| Offline reconstruction | Exact bytes and hash above |
| Direct CLI echo | Exact source JSON bytes; future target directory remains absent |
| `git diff --check` | Passed |

The project-transfer browser suite performs an actual download and invokes the real shell CLI with those exported bytes in an isolated temporary vault. It checks byte-preserving stdout and no file writes, full semantic import/export round trips, built-in project structure, folder validation, guarded replacement, save-failure rollback, and editor/responsive rendering. Assertion totals also include controlled-state, model and geometry checks: they are not 899 independent user journeys. No page/console errors or unexpected requests were recorded by the 16 passing UI suites.

## Explicit blockers / unexecuted qualification

The full command requested `--real-storage`. Its separate actual-origin Storage suite failed **before its first assertion**, because managed Chromium refused loopback navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. The aggregate report deliberately remains `status: failed`, with 899 successful assertions and one blocked suite; it is not a fully green browser run. The 15 planned real-origin storage assertions, including the added import/folder multi-window checks, are **not counted as passed**. A controlled Storage adapter is not equivalent evidence. Raw logs and the failed storage report are retained in the handover.

GitHub CI on this candidate did not run because repository publication was blocked. Full root runtime, dependency-backed maintainability/coverage, pinned-toolchain qualification, native Obsidian, file-origin persistence, physical devices and assistive technologies were not qualified. Existing CI definitions are extended in the patch to run the new shell tests and maintained browser suites; that is configuration, not evidence that CI executed.

## Product boundary

The companion can load its own editable authored design, export/import a full saved authoring document, and retain codebase/tests folders (`src`/`tests` by default). Import requires review and replacement confirmation, preserves host files and does not import execution trust or test receipts.

`scripts/companion/generate.mjs` v1 validates the envelope, bounded input and vault-relative target, then returns the original input bytes on stdout. It **does not generate boilerplate or create any directories**. Folder changes describe future target-relative locations; they do not rename existing source or modify current build configuration. No imported code is executed, template acquired, plugin installed or native companion converted.

Exports intentionally exclude unsaved form drafts, machine paths, generated files, execution approvals and transient sessions. They may contain private authored information. The full export is a portable authoring definition, not a raw browser-state recovery backup. Filesystem and stale-storage checks are best-effort checks, not atomic concurrency guarantees.

## Reproduction

```sh
node --test tests/tooling/companion-project.checks.mjs tests/tooling/test-data-*.checks.mjs
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
CHROMIUM_EXECUTABLE=/path/to/chromium python -B scripts/concepts/run-browser-checks.py --real-storage
```

The last command needs an environment that permits the test's loopback origin. Do not remove that CI check to mask the local blocker. See the handover `APPLY.md`, `manifest.json`, raw reports, and patch-application record for delivery integrity checks. See [PROJECT-JSON.md](PROJECT-JSON.md) and [the shell contract](../../development/COMPANION-PROJECT-JSON.md) for feature behavior and future writer obligations.
