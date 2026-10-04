# Iteration 04 — executed verification record

Integration base: `d755745668974820ff4dbcdd0b9f8bfeec307ec3`, confirmed merged PR #3.
Qualified candidate: `94da3ef97d8d3d570e444b092ea0a70380e5ad4b` on
`build/template-foundation`, development version 0.4.0. [PR #4](https://github.com/Luis85/obsidian-plugin-shell/pull/4).
The final evidence-only documentation commit follows this frozen candidate;
it does not rebuild or change the retained artifacts. Main stayed clean and its
integration revision was rechecked before delivery.

## Fixed source, build and retained assets

[Candidate qualification 35853580266](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35853580266)
ran the actual `release:rehearse` CLI with the full source SHA and version 0.4.0.
It required clean source, exact Node 24.21.0/npm 11.19.1 and a fresh strict-policy
lockfile install; ran `verify`; built once; and retained those bytes. Qualified
Node subsequently passed the read-only `release:rehearse --check` validation.
The immutable packet has exactly five files: the three assets below, committed
release notes, and `candidate.json`. No public release or tag was created.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 573567 | `0063e7032123818bdc378672be054e6ea18c6b87a0c999526b26fea723553c02` |
| styles.css | 88547 | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |
| manifest.json | 280 | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |

The retained manifest keeps the existing 1.13.7 minimum application version and
desktop-only declaration. `candidate.json` SHA-256 is
`cc29ba2d82486c880381a6a6a145acca19c6c6efa91dfe9313f5189b56ee646e`;
the committed lock hash is `a4b3b8c22434a1bf89a71fc9d8c4f3a67885b3bb7ef6429b396838236be38b45`.
The installable ZIP hash is `65667f201645a3f1ced5781abc498b0517ce44ea467507bb3bd62c5f71faf113`.

The packet's own qualification scope remains offline verification. Later browser
and native evidence is separately bound to its unchanged hashes; the immutable
packet was not rewritten to claim those later steps. Windows installation used
a copy-only complete-directory promotion of this retained Linux-built packet.
Earlier Windows rebuilds had four tiny Lab-number serialization differences;
no cross-platform build-byte reproducibility is claimed or needed for this one
retained packet. No font binaries were found across 296 downloaded files and
442 entries in the nested source/plugin ZIPs.

## Complete base qualification

| Scope | Actual result |
| --- | --- |
| Tooling, Linux | 113 checks: 109 passed, four Windows-only cases skipped, zero failures. |
| Tooling, local Windows runtime checkpoint ab002c9 | 113 checks: 112 passed, one unavailable file-symlink case skipped; actual junction, case-alias and 8.3 cases passed. The later workflow-only change also passed repository assurance. |
| Runtime | 291 tests in 49 files, including three fresh repeated hosted processes without retries. |
| Production coverage | All 81 TS/Vue inputs: lines 99.545%, statements 97.352%, functions 97.597%, branches 94.889%. |
| Domain/application/features coverage | All 34 inputs: lines 99.905%, statements 97.747%, functions 98.645%, branches 96.192%. |
| Selected core coverage | Lines 99.82%, statements 97.74%, functions 98.73%, branches 96.16%. |
| Legacy baseline | 52 machine cases in each of three runs; its separate “Release blocked” status remains. No automatic promotion of all historical acceptance IDs. |
| Served Chromium | 31 passed, zero skipped/failed/flaky, every retry count zero. |
| Native Linux | Three fresh sessions, 24 checks each, exact installed hashes and cold restart. |
| Native Windows | Three fresh sessions, 24 checks each, using the exact same retained CI assets as Linux; installed and cold-restart hashes match, zero renderer errors. |
| Security | Zero vulnerabilities, all installed root dependency categories. |

The production inventory exactly matches the TS/Vue file set in the retained
source ZIP. Existing floors remain 90/90/90/85 for production, 95/95/95/90 for
domain/application/features, and 95/90/90/90 for selected core
(lines/statements/functions/branches). TypeScript, both linters, full analyzer,
architecture, source limits, locales, tokens, repository assurance, artifacts
and harness-build gates passed. Native app and installer were 1.13.7, launcher
3.2.1 and Electron 43.3.0. Native checks include exact-title note creation,
Markdown equality, CRUD/user-content preservation/trash recovery, dialogs,
headers, split panes, pop-outs, themes, zoom, unload/re-enable and cold restart.

Windows/Linux showcase and baseline jobs and the independent Node/npm setup
matrix passed. The matrix includes Node 24.21.0/npm 11.19.1 and the separate
Node 24.15.0/npm 12.0.2 setup-policy case; it does not change the qualified build
toolchain. The template-authoring workflow passed distinct identity setup and
complete verification plus served checks with Bookmarks, after example removal
preserving Bookmarks, and after adding Reading.

## Generated consumer and example removal

The separately installed Field Notes 1.0.0 consumer removed the reviewed examples,
preserved its pre-removal Kept Notes feature, then added Research, plugin-data
settings, a typed event and an actual runtime listener. Kept Notes entity bytes
remained `c8019b230b5352d9e8dca1ac124c2d59064774f5fbd465046511d687e17e7a2a`.
The earlier zero-business-feature profile was separately built and checked; it
is not inferred merely from an extended consumer passing.

Both consumer coverage runs passed 287 tests in 63 files. The complete production
inventory contains 95 inputs, all represented and above the unchanged aggregate
and business-layer floors. Production coverage is 99.37% lines (1910/1922),
97.34% statements (3012/3094), 97.38% functions (671/689), and 94.99% branches
(1880/1979). Selected-core coverage is 99.83/97.65/98.79/95.84% in that same order.
Types, source/test/harness lint, test quality, repository checks, source limits,
presentation, architecture, analyzer, entity catalog, tokens, artifacts and the
52-case baseline repeated three times passed. Harness build passed; both served
foundation scenarios passed and exercised the two distinct generated note panels,
verbatim filenames and duplicate-title preservation.

The initial complete consumer command retained one bounded maker-child timeout.
The same catalog passed 5/5 when run alone with its original 120-second bound;
all remaining verification stages then ran sequentially on the final consumer.
This is cumulative complete-gate evidence, not a claim that the first interrupted
command passed. The two added native-file polling checks passed separately.
Final artifact hashes still match the accepted consumer native run.

Actual Windows consumer qualification passed 12 checks with zero renderer errors:
no initialization writes, held real writes disabling the control, one write per
action, focused native checkbox/palette synchronization, hidden command changes,
cached-tab reopen, unchanged record identity/preferences, both host themes,
generated native views, unload/re-enable and cold restart without extra writes.
Its exact assets are separately identified because this is a different plugin:

| Consumer asset | SHA-256 |
| --- | --- |
| main.js | `87a065035a1d61095d32484f3d662840a3971545b1775da35680d835e4861c2d` |
| styles.css | `a33bddcfe6f3d4a2af54b9d00c102ddae09ce3c7478d1906c94945a1ff970e5e` |
| manifest.json | `dd0d3b3bfd75bd317bd4ee356e509c7d8271fca69d583f451a7e5e39617ce539` |

## Source archives and focused assurance

The final CI source ZIP (`117d75996c10921a7b81fc88df22de61c2e04ea53cd1598e2f4728e402c07465`)
contains the exact full candidate commit in its archive comment; lock/notes bytes
and the production inventory were independently compared with it. Supplemental
literal transport at runtime checkpoint `ab002c9` verified all 439 extracted files
against Git blobs, blocked ancestor Git discovery with a ceiling (exit 128), and
ran a dependency-free distinct-identity dry run without changing the source
fingerprint. Its ZIP hash is `cc7f6b2c48df9c4026cb81bad62a8faf23a58157c28b24ec5db03e3e5d16ceaa`.

An earlier literal archive at `6c2c163` separately passed fresh strict installation,
distinct identity, feature/local custom-maker creation, unchanged reruns, nine
generated tests, build, types, boundaries and artifact gates. This supplemental
archive authoring result predates the native-setting corrections and is not
current native acceptance. Exact source checkpoints and limitations are retained.

Seeded real-service data properties use 100 cases per property. Targeted domain
mutation baseline passed and all three selected unknown-field, Gregorian-century
and finite-number corruptions were detected; source hash, seed 23092026 and
shrinking paths are retained. This is a bounded check, not a whole-program score.
The [review record](../development/ITERATION-FOUR-REVIEW.md) documents independent
findings, actual-host contract inspection and corrections.

## Failures, retained evidence and remaining scope

Failed contrast, Windows path, legacy packaging, consumer-selector, native theme,
partial-file polling and focused/cached native-control attempts were preserved.
They exposed concrete runtime or test-driver defects; acceptance followed the
documented corrections, without raising timeouts, suppressing accessibility rules
or accepting screenshots. The local consumer maker catalog also hit its existing
120-second child bound during host memory contention; the unchanged-bound isolated
rerun passed. Interrupted local rehearsals produced no accepted candidate.
The final actual rehearsal completed in read-only CI, and its retained bytes were
validated and installed locally without rebuilding.

Playwright's automatic local browser installation failed its cache-lock heartbeat;
the pinned Chrome-for-Testing 153.0.8010.12 archive was provisioned in the codebase
and selected explicitly. Windows archive extraction used `tar -m` after timestamp
restoration failed, followed by byte verification. No personal vault, global
package, existing security preference, permission or automerge setting was changed.

Evidence lives in the linked workflow artifacts and local ignored reports:
`reports/ci-94da3ef-evidence-audit.json`, `reports/ci-94da3ef-linux/`,
the qualification checkout's `reports/`, and
`.qualification/consumer/reports/qualification/final/`. Prior failures remain
separate from accepted packets. Workflow artifacts have seven-day retention;
the committed hashes and this record remain durable.

The upstream nested ESLint 9 support exception remains unresolved independently
of the clean audit. No macOS, physical mobile, third-party-theme or manual
screen-reader acceptance is claimed. Browser and host-double results are not
native/device evidence. No public release/tag/listing operation was authorized
or performed; this milestone does not claim the entire release-ready template
contract.
