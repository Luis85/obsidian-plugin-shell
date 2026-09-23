# Test concept and execution design

**Version:** 1.0 · **Date:** 2026-09-22  
**Policy:** [Test strategy](TEST-STRATEGY.md) · **Inventory:** [test-plan.json](test-plan.json)

## 1. Current system under test

**Applicability update (iteration 03):** The paragraphs below describe the retained
pre-runtime baseline, not today's complete executable surface. Iteration 02
introduced and qualified real Vue/application/native code. See the
[iteration 03 plan](../development/ITERATION-THREE-PLAN.md) for the new entity,
repository and production-coverage work, and the [iteration 02 evidence](ITERATION-TWO.md)
for the last qualified candidate. Keep baseline results separate from runtime,
served-browser and native-host results.

The executable baseline consists of the original host-style specimen, its allowlisted HTTP server, and the verification utilities added with this concept. No production Obsidian plugin, settings service, DocumentCreationService, event bus, NotificationService, setup/maker runtime or native candidate exists yet.

Do not write a pretend Task database or mock service that only returns success to fill those gaps. Mark planned suites explicitly. The baseline verifies its actual files, not the product described by the larger specification.

No package.json or dependency lockfile is introduced solely for this bridge. The Node test runner is already available and can verify the existing code without a registry. The planned implementation still uses Vitest and Playwright Test after a compatible toolchain is installed. Browser checks here use reusable Playwright API assertions, not a second permanent UI test framework.

## 2. Files and ownership

```text
docs/testing/
  TEST-STRATEGY.md
  TEST-CONCEPT.md
  test-plan.json
scripts/testing/
  verify-baseline.mjs
  test-plan.mjs
  source-inputs.mjs
  run-node-tests.mjs
  node-reporter.mjs
  report.mjs
  fault-ledger.mjs
  check-browser-specimen.mjs
  browser-input.mjs
tests/
  harness-styles/server.test.mjs
  verification/{policy,ledger,source,runner,styles,report}.test.mjs
  browser-specimen/specimen.checks.mjs
reports/                         # ignored generated evidence
```

All executable orchestration lives in scripts; assertions live in tests. Source
and helpers stay below their 400/450 code-line limits. Under the owner's iteration
03 amendment, comments and blanks are excluded, while physical counts remain
diagnostic. The long JSON inventory is data, not executable code hidden from the
limit. The original CSS remains modular.

## 3. Machine-readable plan

`test-plan.json` version 1 declares suites, execution modes, implementation state, test file, exact test IDs, scope, the 90 acceptance items and release prerequisites. `test-plan.mjs` validates this bounded data shape, including unknown fields; it is not presented as a general JSON Schema engine.

Suite states are `executable` and `planned`. Executable means code exists, not that every environment can run it. Planned suites cannot claim a file or passing test. A missing browser produces a provisioning failure, not automatic downgrade to Node evidence.

Every acceptance item has an ID, summary, risk, owner, required evidence modes, explicit partial/whole links and a remaining-gap explanation. Summaries are navigation aids; normative details remain in the PRD/companion contracts. Count/range checks reject a dropped/duplicate AC, duplicate test ID, invalid file path or link to a nonexistent test.

Test names begin with stable identifiers such as `[HTTP-01]` or `[ERR-04]`. Exact inventory comparison rejects removed tests and unexpected extra tests. A new test is added by updating both code and plan in the same reviewed change, not by silently absorbing an arbitrary glob. New Node test files must also be registered. This makes scope changes visible without preventing normal extension.

## 4. Baseline command

```sh
node scripts/testing/verify-baseline.mjs --repeat 3
node scripts/testing/verify-baseline.mjs --repeat 3 --json
```

The command performs the following stages:

| Stage | Operation | Failure behavior |
| --- | --- | --- |
| Plan | Validate data shape, IDs, allowed modes and trace links. | Nonzero infrastructure/configuration error. |
| Inputs | Read/hash harness, scripts, tests and machine policy; include new files and reject symlinks. | Missing/unsafe inputs fail. |
| Source policy | Count nonblank code lines, excluding comments across full SFCs, and check test-file inventory. | Too-large/unregistered files fail. |
| Execution | Spawn the explicit suites with Node, UTC, one test worker, strict unhandled rejection policy and deadline. | Child failure, timeout, malformed evidence or missing cases fail. |
| Repetition | Re-run all suites in fresh processes without retries. | Any failed repetition or changed semantic digest fails. |
| Final integrity | Rehash execution inputs. | Input edits during the run fail; old evidence does not match changed bytes. |
| Reports | Write unique JSON/JUnit/Markdown output with actual scope and gaps. | No stale report is reused as a new execution. |

The default is three full runs, selectable from two through ten. Repetition is not “try until one passes.” A passed run with an empty suite is rejected. Required skip/todo/cancel is rejected even if Node returns exit zero.

The event reporter consumes Node's real test events and checks its schema/counts. It does not grep a printed success phrase. Node's human reporters may change across versions, which is why this adapter has tests and must be qualified on upgrades. Nested negative-fixture runs remove the inherited Node test-worker context so they execute as independent runners, not recursive parent workers. [Strategy T10]

Timeout cleanup targets the owned process group on POSIX and uses the Windows process-tree termination path. The latter is implemented but not claimed locally verified on Linux. Temporary fixtures are unique, synthetic and cleaned by the owning test. No personal vaults are opened.

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | All checks required by the selected implemented baseline scope passed. |
| 1 | Executed assertion/gate/repetition failed. |
| 2 | Invalid configuration, unavailable prerequisite, infrastructure failure or intentionally blocked release profile. |

Run failures retain machine evidence when the report infrastructure is functioning. Invalid preflight input produces a machine-readable error on stderr rather than a fabricated empty success report. Abrupt process/OS termination may prevent final reporting; CI then treats missing reports as an error.

## 5. Browser specimen execution

Default path after explicit browser provisioning:

```sh
node scripts/testing/check-browser-specimen.mjs --mode served --repeat 2
```

It imports the local `@playwright/test` browser API; it never invokes an unpinned download. The normal future dependency installation will provide that package. In a pre-provisioned diagnostic environment, `--driver /absolute/path/to/playwright/index.mjs` and `--browser /absolute/path/to/chromium` select trusted local overrides. Version/override information is recorded. These options load local code/binaries and are not a sandbox for untrusted paths.

The runner owns a loopback server on an ephemeral port, creates a fresh context per scenario, fixes locale/timezone/date, blocks other network origins, and records console/page/request faults. It waits for the fixture's readiness attribute and meaningful DOM states rather than arbitrary delay. Its fixed-date setting does not freeze all timers or guarantee scheduling determinism; this specimen does not have a timer-expiry service to verify.

Eight assertions cover tokens/theme transitions; four widths; German validation/clear/focus; notice replace/dismiss/opt-out; modal keyboard loop/Escape/focus return; forced colors/reduced motion/root scope; deliberately missing host CSS; and a controlled console error reaching the independent observer. They do not certify production notifications, native dialogs, screen-reader announcements, complete accessibility, or all possible CSS behavior.

### Explicit inline diagnostic mode

```sh
node scripts/testing/check-browser-specimen.mjs --mode inline --repeat 2
```

This inlines the known fixture CSS/JS into the specimen using the exact current source files. It is allowed only as a explicitly labeled diagnostic where served navigation is unavailable. The output mode becomes `browser-inline-diagnostic` and always says that HTTP navigation, stylesheet import requests and server CSP were not established. There is no automatic fallback from failed served mode.

Both modes retain traces and bounded screenshots under reports/browser-specimen. Screenshots are current diagnostic artifacts, not golden baseline comparisons. A missing-style negative control verifies that the positive token invariant fails after removing its actual stylesheet. The console negative control proves a received unexpected fault would fail the ordinary zero-error assertion before matching the exact expected count. Production caught-Vue-error integration remains unimplemented.

## 6. Evidence and identity

Reports include actual test cases/statuses, retries, repetitions, semantic digests, environment, input byte hashes, scope/mode and the remaining release gaps. JUnit is for execution results; it does not assert line coverage or release readiness.

`inputDigest` binds the executable roots and test plan, including uncommitted files. It is deliberately **not** a whole-repository/source-control attestation: unrelated historical research text is outside the execution input set. Source changes/new files change the fingerprint; wall-clock durations and temp paths do not change the semantic outcome digest. The report names the collected inputs explicitly.

Acceptance requires every linked whole test and every required mode. Partial source tripwires cannot satisfy a full native requirement. On a failed or unstable verification run, acceptance is not promoted from an earlier passing repetition. Inline browser reports remain separate and are not silently merged into normal baseline/HTTP or native evidence.

`--profile release` is a negative readiness probe:

```sh
node scripts/testing/verify-baseline.mjs --profile release --json
```

It exits 2 and writes a blocked report. Even manufactured lists of “passed” modes cannot enable publication through this baseline tool; the real native-candidate release validator is not implemented. Once release functionality exists, a reviewed implementation replaces this guard with real artifact/source/host checks. This command never publishes or mutates a tag.

## 7. Detailed future deterministic designs

### Entity document creation

Use the real validator, serializer and application service with a recording writer. Supply fixed ID/clock providers and complete initial Markdown fixtures. Assert prepare causes no file/folder/event; commit uses identical values; a changed destination makes the plan stale. Confirm no created fact on failure and exactly one canonical fact on confirmed create. Hold writes behind deferred promises to exercise cancel-before-start, close-during-write, same-request replay, concurrent conflict and created-but-open-failed. Independently read writer contents—not the service's claimed receipt alone.

Add table-driven calendar partitions, leap days, reserved paths, separators, Unicode and scalar lookalikes. Add bounded property-generated strings once fast-check is pinned, with recorded seed/shrink path. Real host contract tests verify property parsing/no-overwrite; the fake cannot establish those by itself.

### Notifications and events

Inject a scheduler for expiry/dedup/progress tests. Advance virtual time to just before/at/after a threshold. Assert explicit owner resource counts at cleanup; a `clearAllTimers()` cleanup must not conceal that the service leaked timers. Reject extra error counts even when the notification looks correct.

Hold one async subscriber unresolved while another succeeds; verify delivery semantics and no rejected promise leakage. Test nested once/unsubscribe and native startup readiness using explicit barriers. Closing one view must not clear another owner's notifications or shared bus. Request success, listener failure and notification-sink failure remain independent effect facts.

### CSS and frontend fidelity

Use Vite's actual CSS/SFC graph. Verify scoped/class identifiers and one artifact; run a candidate mode with the exact packaged CSS. Deliberately omit host CSS, plugin CSS and one compiled component style to prove the corresponding assertions fail. Pin screenshot OS/browser/font/viewport; risk-select scenarios rather than all combinations. Keyboard and semantic checks stay separate from screenshot equivalence.

### Makers, setup, quality and releases

Copy a minimal source tree to a unique temp directory; never run generation over the developer's checkout. Generate one configured repository per declared scenario. Generator-of-generators qualification has explicit depth one and cannot invoke the parent qualification profile recursively. Check byte hashes of preexisting files after collisions/failures.

Invoke real Oxlint/ESLint/fallow/type/style checks over isolated deliberately invalid inputs once those tools exist. Exercise both sides of 400/450, alias/re-export violations, unclassified files, missing translations and reporter crashes. Release tests use a controlled fake GitHub boundary plus a separate fixture-repository rehearsal; ordinary PR tests have no publishing rights.

## 8. CI and promotion

The supplied `baseline-verification.yml` calls the same Node baseline command on Linux and Windows. Official actions are pinned by full commit and credentials are not persisted; permissions are read-only. Reports upload even on failure, missing evidence is an error, and retention is seven days. It installs no unqualified npm graph.

The workflow's exact Node 24.21.0 target is a declared CI qualification target, not a claim that the editing environment ran it. Local execution used Node 22.16.0. The real plugin's WP-00 version matrix remains outstanding. Windows process handling and hosted action execution must be confirmed from actual workflow results.

No browser suite runs in this baseline CI until its supported Playwright/browser dependencies are provisioned explicitly. Do not add `npx ...@latest` to make a missing environment disappear. Add the pinned browser job with the actual toolchain.

## 9. How to add a test

Choose the lowest level that can detect the defect, then add an integration/native case only for what the boundary contributes. Give it a stable ID and actual assertions, register file/ID/mode in the plan, and link it to an acceptance case with honest partial/whole extent. Add or revise required modes only through review.

Run the targeted file, then repeated baseline verification. For frontend changes run the appropriate served browser command; an inline result must stay diagnostic. Review the report's gaps as well as green test counts. On a tool upgrade, deliberately break a known invariant to verify the checker still catches it.

The [execution record](2026-09-22-verification-record.md) lists current results and limitations; it is not a timeless passing badge.

## Native stylesheet profile update — PRD 0.7

The current inventory has 96 acceptance cases, 52 baseline Node tests, and 12 browser checks per selected host profile. Earlier counts above describe the preceding baseline. `--host extracted` is now the default; `--host simulated` remains explicit and separate. The extraction is pinned and verified, not fetched during tests. See [the token contract](../design/OBSIDIAN-TOKENS.md) and [current verification](2026-09-22-token-verification.md). Source hashing now includes `src/` and the token reference. The qualified vendor archive is the only new immutable upstream-input exception; handwritten limits remain unchanged.
