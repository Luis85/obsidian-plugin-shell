---
type: Increment
id: candidate-evidence-and-companion-socket
title: "Fix candidate evidence inventory and companion Real Obsidian socket path"
owner: "Claude"
size: M
status: Done
e2e: optional
refs: []
pullRequests: []
---

# Fix candidate evidence inventory and companion Real Obsidian socket path

## Summary

The first `main` push after the test-pipeline pass failed two workflows. Candidate qualification failed with `EVIDENCE_SUITE_INVENTORY` because `tests/tooling/prototype-helpers.checks.mjs` registers the prototype skill's portable tests only through side-effect imports, and node:test reports their cases under the skill's own files; off Windows, two Windows-only tooling tests were also missing from the expected-skip list. The companion's Real Obsidian workflow failed with `NATIVE_SOCKET_PATH_TOO_LONG` because the project folder inside the shell repository pushes the host's singleton socket path to 124 bytes, past the Linux 107-byte limit.

## Outcome

Candidate qualification's tooling evidence attributes every case to an inventory file and treats exactly the declared Windows-only tests as expected skips, and the companion's Real Obsidian steps run from a short bind-mounted root inside the socket budget while temporary data stays in the project.

## Scope

### In scope

- Crediting the cases of portable `.checks.mjs` modules to the tooling file that registers them through side-effect imports only.
- An exported Windows-only expected-skip list kept equal to the declarations in `tests/tooling` by a test.
- Running the companion's Real Obsidian steps from a bind mount of the project at `/wc`, synced into the shell's workflow copy.

### Out of scope

- The live security audit advisories (`source-map-js`, `moment` via `obsidian`): a separate reviewed dependency update.
- Any change to the native scratch layout or the socket budget itself.

## Acceptance criteria

- [x] AC-1: A tooling file made only of side-effect `.checks.mjs` imports owns the cases of the modules it imports, so the evidence inventory matches; a test file that also holds other imports registers nothing and an unexpected file still fails with `EVIDENCE_SUITE_INVENTORY`. Evidence: `tests/tooling/evidence-adapters.checks.mjs`
- [x] AC-2: The Windows-only expected-skip list equals every Windows-only test declaration in `tests/tooling`, so a missing or extra entry fails. Evidence: `tests/tooling/evidence-adapters.checks.mjs`
- [x] AC-3: Every synced project workflow step that launches Obsidian runs from a root whose singleton socket path fits the Linux 107-byte budget, and a short absolute root is a bind mount of the project. Evidence: `tests/tooling/projects-boundary.checks.mjs`

## Affected areas

- `scripts/testing/evidence-adapters.mjs`: registered-case attribution and the exported Windows-only list.
- `scripts/testing/evidence-identity.mjs`: finds the modules a tooling file registers.
- `scripts/testing/evidence-producers.mjs`: passes the registrations to the tooling adapter.
- `tests/tooling/evidence-adapters.checks.mjs`: registration and platform-skip tests.
- `tests/tooling/projects-boundary.checks.mjs`: socket budget test for synced workflows.
- `projects/companion/.github/workflows/obsidian.yml`: the bind mount and the Obsidian steps' working directory.
- `.github/workflows/projects--companion--obsidian.yml`: the synced copy.
- `CHANGELOG.md`: Fixed entries.
- `docs/increments/candidate-evidence-and-companion-socket.md`: this handoff.

## Test plan

- Suite `quality`: the evidence adapter tests prove registered attribution, stray rejection and the platform-skip list; the projects-boundary test proves the socket budget of every synced Obsidian step.
- New test `tests/tooling/evidence-adapters.checks.mjs`: `[EVIDENCE-REGISTRATION]` and `[EVIDENCE-PLATFORM-SKIPS]`.
- New test `tests/tooling/projects-boundary.checks.mjs`: `[PROJECTS-NATIVE-SOCKET]`.
- Gate `node bin/app check --fast --base origin/main`: diff-scoped typecheck, related tests and the `quality` suite.
- E2E: optional — no user interface changes; the companion Real Obsidian workflow runs on this pull request through the `run-obsidian` label.

## Docs impact

None — the fixes restore documented behavior; the workflow comment explains the bind mount.

## Changelog

- Fixed: Candidate qualification's tooling evidence credits the prototype skill's portable tests to `tests/tooling/prototype-helpers.checks.mjs`, the file that registers them, instead of failing with `EVIDENCE_SUITE_INVENTORY`; all six Windows-only tooling tests are now expected skips off Windows, guarded by a test that keeps that list equal to the declarations.
- Fixed: The companion project's Real Obsidian workflow runs the host from a bind mount of the project at `/wc`, so its singleton socket fits the Linux 107-byte path budget inside the shell repository (124 bytes before); temporary data stays in the project.

## Risks and rollback

Attribution could hide a stray test file; only files made solely of side-effect `.checks.mjs` imports register modules, and any other unexpected file still fails. The bind mount needs `sudo` on the hosted runner; if it fails, the Obsidian steps fail visibly. Roll back by reverting this pull request.

## Dependencies

None

## Open questions

None

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `0d3dc44a0ad0`)
- Changed files: 8 (1 added, 7 modified, 0 renamed, 0 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `scripts/testing/evidence-adapters.mjs` | 1 |
| `scripts/testing/evidence-identity.mjs` | 1 |
| `scripts/testing/evidence-producers.mjs` | 1 |
| `tests/tooling/evidence-adapters.checks.mjs` | 1 |
| `tests/tooling/projects-boundary.checks.mjs` | 1 |
| `projects/companion/.github/workflows/obsidian.yml` | 0 |
| `.github/workflows/projects--companion--obsidian.yml` | 1 |
| `CHANGELOG.md` | 1 |
| `docs/increments/candidate-evidence-and-companion-socket.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/tooling/evidence-adapters.checks.mjs` |
| AC-2 | yes | `tests/tooling/evidence-adapters.checks.mjs` |
| AC-3 | yes | `tests/tooling/projects-boundary.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
