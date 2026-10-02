# Generator-boundary baseline patch: integration record

Part of PR #21 / [SH-035](../tasks/shell/SH-035.md) (formerly the colliding SH-023). This records how the local `pr21-generator-boundaries-baseline.patch` was integrated into the current PR branch. It does not describe completed business or native acceptance.

## Inputs

| Item | Value |
| --- | --- |
| Patch SHA-256 | `53b18d53617d2f82efb2f251f42f6dba28d31f9aec98dee080e432e5371d52db` (kit checksums verified) |
| Baseline commit / tree | `dcbddabab5ebabde5f4d41f9f4f415960ba70d1e` / `aee7178c61a741bd6dfed4d8bb52c8ae832bd381` |
| Reconstructed tree | `f24bd2518c2dd664445ec249c0d6745eeffd78df`, matched exactly in an isolated worktree with `core.autocrlf=false` |
| Local review commit | `992ae4f6c2708d0784d2544c603fc0ddb0d6a051` (not pushed; it is the reconstruction, not the integration) |
| Integrated PR head | `7d8775470d44c2c115ec5ab14bf412a5e1e5da77`. Work began on `7d2b671` and was moved onto `7d87754` (Project Starters) after the remote advanced. |

The patch was ported by hand rather than cherry-picked. Commits `f852de8` and `7d2b671` had already absorbed most of it, so a cherry-pick would only have produced conflicts that resolve to the current files.

## Patch areas

| Patch area | Result |
| --- | --- |
| Workflow `--provider-fixture` qualification, `generator-provider-project.mjs`, test-kit `engine.mjs`/`adapters.mjs`, browser `test-data-model.js` | Already identical on the PR head. |
| `test-data-manifest.mjs` shared translator | Retained as the one translator. **Corrected:** it deep-copied the whole design, and the current 80-design self-project in live browser state exceeded the 120,000-node budget. As a result, recipe preview/capture threw `Input limit exceeded` and the composition browser suite failed on the unmodified head. It now validates top-level members shallowly and copies only `dataSources`/`semantic`. The limit is unchanged. |
| `test-data-code.ts` | Superseded by the existing `fixture-code.ts` (`fixtureManifest`/`fixtureCode`). A duplicated engine/simulator validation pass was removed. |
| `fixture-notes-code.ts`, canonical note metadata, `noteEntity` mapping | Already present; retained. |
| `test:data:*` commands | Replaced by the PR's existing `testdata:*` family. No alias was added, and no remaining `test:data:` references exist. |
| `source-overrides.ts` | The PR's stricter `validateSourceOverrides` (exact method set, prototype checks) is retained. Generated `createSources` now validates overrides before constructing the relationship session or any fallback adapter. Tests now also cover explicit `undefined`/`null`/string providers. |
| `relationship-guard.ts` | Superseded by the existing `relationship-session.ts` (one implementation). Ported the patch's missing behavior: cross-adapter idempotent creation (see below), duplicate/unsafe rule-definition refusal, and tests for fresh graph re-reads and non-poisoning queue failures. |
| `relationships.ts` | The PR's strict whole-graph implementation is retained. Added refusal of duplicate rule IDs and of empty or prototype-named keys, at runtime and in `relationship-model.ts` at generation. The patch's control-character rejection was already met, because such links resolve to no target. |
| `note-operations.ts` | Ported: `Reflect.ownKeys` input checks, so non-enumerable or symbol accessors on a record or on its `values` never execute. Adapter request IDs now match the canonical `DocumentService` contract (`[a-zA-Z0-9:-]{1,100}`). |
| `contract.ts` | Ported the patch's own-property schema lookup. Previously an additional property named `toString`/`valueOf` resolved to a prototype function and a valid object was rejected. |
| `relationship-code.ts` generated tests | **Corrected a pre-existing failure:** the generated native relationship test registered only its own repository, but the session reads the whole connected audit graph. The boundary qualification failed on the unmodified head. The test now composes real repositories for every in-scope entity and also retries a creation through a second adapter. |
| Docs, `model.ts` warnings, `build-companion.py`, `run-browser-checks.py`, `.fallowrc.json` | The current PR text and inventory are retained. The browser summary scope wording now states that reviewed generation runs. |
| `index.html` | Rebuilt from source with `build-companion.py` and verified with `--check`. No old assembled HTML was taken. |

## Relationship policy decision

The current PR's strict policy stays the default. Every committed candidate graph must satisfy all declared cardinalities, including required inverse minimums. The patch's exception, which let a new target temporarily lack a required incoming source, was **not** adopted. Mandatory two-way cycles reject both creation orders with zero writes, and a test pins this as explicitly unsupported until a batch transaction exists. Audits stay read-only.

A repeated creation that uses the same canonical request (the same prepared plan) through another adapter or view sharing the session no longer re-runs preflight against its own committed note. It waits for the first attempt, and the canonical repository returns the recorded outcome with no second write. An uncertain first outcome is returned as uncertain; it is never retried. If the first attempt was rejected before any write, its unused plan is discarded and the retry receives the repository's `stale` result, again without writing; the caller then prepares a fresh request. A direct `create` of an already-existing record is still refused as `RELATIONSHIP_RECORD_STALE`.

## Windows test portability

- The `.test-vault` writer compared `realpath(root)` with the resolved root. That rejected real directories reached through 8.3 short names (`LUISME~1`) or a differently cased drive letter, which blocked every fixture plan under the default Windows `%TEMP%`. It now `lstat`s each path component. Linked roots and linked ancestors are still refused (new junction-ancestor test), and a drive-letter alias test runs on Windows.
- File symlinks need Developer Mode or `SeCreateSymbolicLinkPrivilege` on Windows. The two file-link cases (`[COMPANION-LINKS] input file links`, starter `symlink source`) go through `tests/tooling/file-symlink.mjs`. When Windows refuses the link with `EPERM`, the case is reported as an explicit skip with that reason. It runs on Linux CI and privileged Windows, and every other error still fails. Directory-link cases already use junctions and run everywhere.
- `qualify-project.mjs` and `qualify-starter.mjs` canonicalize their temporary vault with `realpath`. Under an 8.3 `%TEMP%`, Vitest in the generated workspace could not resolve its own test modules (`Cannot find module '/tests/project/...'`).
- Windows checkouts with `core.autocrlf=true` (the GitHub Windows runner default) converted the SHA-256-pinned starter JSON to CRLF. As a result, `project-starters.checks.mjs` failed with `STARTER_INVALID: Source integrity mismatch` in the Windows setup/showcase jobs, already on `7d87754`. `.gitattributes` now pins `docs/concepts/companion/starters/**` to LF. The stored bytes were already LF, and the integrity check is unchanged.
- The `[ANALYZER-ARCHIVE]` gate fails under Git Bash's GNU tar (it reads `C:` as a remote host). It passes when Windows' `System32\tar.exe` is first on `PATH`. This was not changed.

## Verification

Tests used Node 24.21.0 (SHASUMS-verified) and npm 11.19.1, both provisioned outside the repository, with `npm ci` against the unchanged lockfile. Commands ran on Windows 11. The generator steps mirror `.github/workflows/project-generator.yml`. The PR's hosted runs are the Linux evidence.

Per-command results for the final tree are in the PR integration comment. Scope limits:

- Controlled-Storage and real-origin Storage browser suites are reported separately.
- The provider fixture and boundary fixture are synthetic and are not companion business acceptance.
- In the companion workspace, 31 pending PRD requirements (34 generated acceptance `it.todo` entries) remain unimplemented.
- No native Obsidian host was launched.
