# Release execution qualification

Baseline: merged main `386353f5ef3bc6ec94d19057bef159e4efa6e7a1`.
Qualified code commit: `4f9b3b13825c7e2fbfca414611cc7aa0143a4812`, branch
`build/release-operations`, development version 0.4.0. [PR #8](https://github.com/Luis85/obsidian-plugin-shell/pull/8).
This milestone changes tooling, qualification workflow inputs and documentation;
it does not change production TS/Vue, runtime assets or dependency selections.
The evidence-only documentation commit follows that frozen code commit and does
not rebuild it. Prior iteration-four evidence is not promoted to this source.

## Frozen candidate and hosted qualification

[Candidate run 35860456990](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35860456990)
passed the actual fixed-source rehearsal, strict install and complete `verify`;
retained the five-file packet; then qualified its unchanged assets. A local
independent audit reran packet validation, matched the downloaded `dist`, checked
the exact coverage inventory and native asset bindings, and found no font binaries
among 296 files or within the nested source/plugin archives.

| Asset | SHA-256 |
| --- | --- |
| main.js | `0063e7032123818bdc378672be054e6ea18c6b87a0c999526b26fea723553c02` |
| styles.css | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |
| manifest.json | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |

`candidate.json` hashes to `abd8f74fa9a2364a31bfa21d32df065994a1828c72b78608cf3b8e415127066e`;
lock hash is `a4b3b8c22434a1bf89a71fc9d8c4f3a67885b3bb7ef6429b396838236be38b45`;
installable ZIP hash is `4c28839a563838060990a7216e50bf7b7e525993b131203e66acb2a11f1d238b`.
The freshly produced plugin assets match prior runtime bytes because production
source did not change; this new source/provenance and these executions remain
distinct from prior acceptance. Host floor stays 1.13.7, desktop-only.

| Scope | Executed result |
| --- | --- |
| Linux tooling | 142 cases: 138 passed, four explicit Windows-only skips, zero failures. |
| Runtime | 291 tests in 49 files; also three fresh repeated processes, no retries. |
| Production coverage | All 81 inputs: lines 99.545%, statements 97.352%, functions 97.597%, branches 94.889%. |
| Domain/application/features | Lines 99.905%, statements 97.747%, functions 98.645%, branches 96.192%; unchanged stricter floors. |
| Legacy baseline | 52 tests in each of three runs; separate release status remains blocked. |
| Served Chromium | 31 passed; zero skipped, failed, flaky or retried cases. |
| Native Linux | Three fresh sessions, 24 checks each, matching installed/cold-restart assets; host/installer 1.13.7. |
| Security | Live all-category audit passed with zero vulnerabilities; support exception remains separate. |
| Windows/Linux CI | Showcase, baseline and all four exact Node/npm setup matrix jobs passed. |

[Showcase verification](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35860512956),
[setup matrix](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35860513006)
and [baseline](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35860512978)
are separately scoped checks. The alternate Node 24.15.0/npm 12.0.2 matrix does
not change the selected build toolchain. All implementation-commit PR checks passed.

## Independent generated consumer and archive

[Template authoring 35860456955](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35860456955)
passed fresh Field Notes 1.0.0 setup, Bookmarks generation, a consumer edit changing
its title maximum to 100, a local Reminder maker and its integrated command,
complete verification/served checks, example removal preserving that source,
then Reading generation and complete verification/served checks again. The
[PR-triggered run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35860513007)
independently passed the same sequence.

The final consumer passed 283 runtime tests in 59 files and all 86 production
inputs. Its coverage is 99.41% lines, 97.47% statements/functions and 95.28%
branches, above unchanged production and business-layer gates. Both foundation
browser scenarios passed without skip/failure/retry. The edited Bookmarks entity
was independently rehashed after removal: `ba9b3f20d82192311eb7b409a36ef65037ac07a45fdaa87900f6d8dbff51fced`,
identical to the pre-removal record. Custom-maker composition ran in final tooling
verification. This is fresh consumer evidence, not the older consumer's native
acceptance; no current consumer-native run is claimed.

The literal source ZIP contains 450 files, each matched against its Git blob.
ZIP hash: `1cbe4f212c54bd03ec1e23cf5224bf58cbfcbde31591caff771a69973ccae2a1`.
A no-Git, dependency-free, distinct-identity archive setup dry run exited zero
and left every source blob unchanged. Its first diagnostic attempt found parent
Git discovery; setting the ceiling to the normalized archive parent corrected the
test environment, and Git then exited 128 as expected. This archive result does
not claim a second full install/verify from that extracted ZIP.

## Local checks completed before the candidate

Node `v24.21.0`, npm `11.19.1`, Windows x64. A fresh
`npm ci --strict-allow-scripts` installed 693 packages from the unchanged lockfile.
The separate `npm run check:security` passed with zero vulnerabilities across all
installed categories. The nested ESLint 9.39.5 support exception remains open.

Targeted commands use the qualified Node binary:

```sh
node --test tests/tooling/release.checks.mjs tests/tooling/release-plan.checks.mjs tests/tooling/release-cli.checks.mjs tests/tooling/release-execution.checks.mjs tests/tooling/release-remote.checks.mjs
node --test tests/tooling/example-removal.checks.mjs
node scripts/quality/check-source.mjs
node scripts/quality/check-repository.mjs
node scripts/quality/check-analyzer.mjs
```

The initial release run passed 41 checks before independent-review corrections;
the corrected final targeted run passed **44/44** checks. Reviewed example-removal checks
passed 10/10 after updating the exact README ownership hash and replacement
template. Source limits/locales and the full zero-finding analyzer passed.
Repository links initially failed while the readiness ledger was being written;
the completed ledger then passed the same repository gate.

Actual read-only GitHub discovery confirmed the baseline on the default branch,
authenticated draft visibility, and absent target tag/releases. No remote draft,
upload, tag or public release was created. Injected HTTP/child-process tests are
synthetic transport evidence, not successful real publication.
The actual CLI also rejected the retained unmerged source with
`SOURCE_NOT_ON_DEFAULT_BRANCH` before any mutation. This is an expected negative
result, not a failed public-release attempt.

## Independent findings and corrections

| Finding | Correction |
| --- | --- |
| First draft response ID was not pinned before readback | Require the returned positive release ID and reject a replacement draft before uploads. |
| Historical assets could block an unrelated subsequent candidate for lack of digests | Validate target assets only; retain stable public-version/tag checks and ignore unrelated declared prereleases. |
| Promotion confirmation did not bind platform/evidence scope | Include a canonical hash of platforms, native acceptance and review in the authorization binding; changed scope rejects the old confirmation. |
| Local cleanup could mask an already verified remote outcome | Attempt every cleanup independently and attach incomplete-cleanup recovery details without relabeling publication or an uncertain write. |

The engine and transport owners reviewed each other's implementation. A third
agent independently reviewed the actual integrated diff and author-facing
workflow after producing the requirement inventory. Reviews are bounded source
and adversarial-test checks, not an assertion of an atomic remote transaction.

## Qualification boundary

The same CI-retained bytes were copied without rebuilding into an isolated Windows
native run. It completed 16 checks with zero renderer errors, then failed the
unchanged five-second assertion that the main host body becomes light. The real
Appearance window visibly selected Light and rendered light, but the main host
body remained dark; plugin roots correctly mirrored their owner. The existing
active-Appearance guard and foreground/paint waits were present. This run is
**failed**, not current full Windows native acceptance.

A separate contained, plugin-free host probe passed dark/light transitions with
zero renderer errors. That does not explain the full split-window session or prove
a focus/environment cause. Independent read-only diagnosis found no supported
product correction; contemporaneous per-window focus/visibility/config-event
diagnostics are needed to resolve it. No timeout increase, assertion suppression,
driver change or retry was used to manufacture acceptance. Earlier Windows native
passes remain historical evidence only.

Local preserved evidence: `reports/ci-4f9b3b1/`,
`reports/candidate-evidence-audit.json`, `reports/consumer-4f9b3b1/`,
`reports/source-archive/`, `reports/native/` (failed Windows attempt),
`reports/native-theme-probe/` and `reports/live-source-preflight.json`.
Hosted artifacts have seven-day retention; this source/hash record is durable.

Real remote publication, the privileged Actions interface, tag creation,
macOS/physical devices/manual screen readers and the upstream dependency-support
exception remain unqualified or externally blocked. The [readiness ledger](../development/TEMPLATE-READINESS-LEDGER.md)
accounts for all 96 legacy acceptance conditions; its old release guard remains
blocked and is not overridden by this milestone.
