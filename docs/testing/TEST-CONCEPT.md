# Legacy test plan and baseline verification

> Type: reference · Part of the [docs index](../README.md)

**Policy:** [Test strategy](TEST-STRATEGY.md) · **Inventory:** [test-plan.json](test-plan.json) · **Adding a test:** [Test suites](TEST-SUITES.md#adding-a-test)

This page states the contract of the legacy machine acceptance plan and its
baseline verifier. Both are kept unchanged on purpose: every legacy acceptance
row and mode stays, and the release profile stays blocked. The plan is separate
from the suites in `tests/suites.json` and from newer test IDs; nothing is
promoted into it automatically. The original 2026-09-22 test concept (its design
rationale, planned designs and first CI notes) is archived as
[TEST-CONCEPT-2026-09-22](../_archive/testing/TEST-CONCEPT-2026-09-22.md).

## The plan: `test-plan.json`

`tooling/testing/test-plan.mjs` validates the bounded data shape, rejecting
unknown fields; it is not a general JSON Schema engine.

| Field | Contract |
| --- | --- |
| `schemaVersion` | `1`. |
| `baselineCommit` | A 40-character commit hash. |
| `retries` | `0`. Repetition is never retry. |
| `repeat` | Default repetitions, 2–10 (currently 3). |
| `suites` | `id`, `mode`, `state`, `file`, `testIds`, `scope`. `state` is `executable` (code exists, not that every environment can run it) or `planned` (no file and no test IDs; claiming either fails as `PLAN_FAKE_IMPLEMENTATION`). |
| `acceptance` | Exactly 96 cases, `AC-01`–`AC-96`, each with `summary`, `risk` (`critical`/`high`/`normal`), `owner`, `requiredModes`, `evidence` links and a `gap` statement. |
| `evidence` | `{ testId, extent }` links to an existing test ID; `extent` is `partial` or `whole`. |
| `releaseRequires` | Modes a release needs; must include `native`, `artifact` and `browser-integrated`. |

Evidence modes: `node-baseline`, `http-specimen`, `browser-specimen`,
`browser-inline-diagnostic`, `unit`, `component`, `browser-integrated`, `native`,
`device`, `artifact`, `tooling-generated`, `manual`, `security`, `performance`.

The plan currently declares nine executable suites (52 Node baseline and HTTP
specimen tests in eight files, plus 12 browser-specimen checks) and seven planned
suites. Test names start with their stable ID, for example `[HTTP-01]`. The
verifier compares the exact inventory, so a removed test, an unexpected extra test
or an unregistered `.test.mjs` baseline file (`UNREGISTERED_TEST_FILE`) fails.

An acceptance case is `verified` only when every link is `whole`, every linked test
passed and every required mode was observed; otherwise it is `partial` or
`not-run`. Summaries are navigation aids; normative details stay in the PRD and
its companion contracts. Newer evidence is linked additively through the
[acceptance crosswalk](acceptance-crosswalk.json); see
[executable evidence](EXECUTABLE-EVIDENCE.md).

## Baseline command

```sh
node tooling/testing/verify-baseline.mjs --repeat 3          # also: npm run test:baseline
node tooling/testing/verify-baseline.mjs --repeat 3 --json
node tooling/testing/verify-baseline.mjs --profile release --json
```

Options: `--repeat 2..10`, `--profile baseline|release`, `--json`. `npm run verify`
runs the baseline step with `--repeat 3`.

| Stage | Operation | Failure behavior |
| --- | --- | --- |
| Plan | Validate data shape, IDs, modes and trace links. | Infrastructure/configuration error. |
| Inputs | Read and hash the execution inputs; reject symlinks. | Missing or unsafe inputs fail. |
| Source policy | Count nonblank code lines (comments excluded, complete SFCs) and compare the test-file inventory. | Oversized or unregistered files fail. |
| Execution | Spawn the executable `node-baseline` and `http-specimen` suites with Node, UTC, one worker, strict unhandled rejections and a deadline. | Child failure, timeout, malformed evidence or missing cases fail. |
| Repetition | Re-run every suite in fresh processes without retries. | A failed repetition or a changed semantic outcome digest fails. |
| Final integrity | Rehash the inputs. | `SOURCE_CHANGED_DURING_RUN` fails. |
| Reports | Write `report.json`, `junit.xml` and `summary.md` to a new `reports/verification/run-*` folder. | No earlier report is reused. |

A passed run with an empty suite, or a required skip, todo or cancel, fails even
when Node exits zero. The reporter consumes Node's test events, not printed text.

| Exit code | Meaning |
| --- | --- |
| 0 | Every check in the selected baseline scope passed. |
| 1 | An executed assertion, gate or repetition failed. |
| 2 | Invalid configuration, unavailable prerequisite, infrastructure failure, or the intentionally blocked release profile. |

`--profile release` is a negative readiness probe: it always reports `blocked`
(`RELEASE_NOT_IMPLEMENTED`) and exits 2. Supplying passed modes cannot enable a
release through this tool, and it never publishes or tags.

## Browser specimen

```sh
node tooling/testing/check-browser-specimen.mjs --mode served --repeat 2
node tooling/testing/check-browser-specimen.mjs --mode inline --repeat 2
```

Options: `--host extracted|simulated` (default `extracted`), `--mode served|inline`,
`--repeat 2..5`, `--driver /absolute/preprovisioned/playwright/index.mjs`; the only
browser override is `SHELL_CHROMIUM=/absolute/chromium`. Browser provisioning is
explicit; a missing browser is a provisioning failure, never a fallback to Node
evidence. `inline` mode is reported as `browser-inline-diagnostic` and does not
establish HTTP navigation, stylesheet requests or server CSP. Screenshots are
diagnostic artifacts, not golden baselines.

## Evidence identity

- `inputDigest` binds the execution inputs listed in
  `tooling/testing/source-inputs.mjs` (`src`, `harness`, `scripts`, `tests`,
  `configs`, `bin`, `templates`, `plugins`, `.github/workflows`, the token catalog,
  `test-plan.json`, the root package, manifest and TypeScript files and a few
  optional concept and skill inputs), including uncommitted files. It is not a
  whole-repository or source-control attestation.
- Durations, ports, temporary paths and report folder names do not enter the
  semantic outcome digest; source bytes and policy are hashed separately.
- The report states scope, mode, environment, repetitions, retries (zero),
  acceptance states and the blocked release decision. Production code coverage is
  not measured by this baseline; it belongs to the Vitest coverage gates.
- On a failed or unstable run, acceptance is not promoted from an earlier passing
  repetition, and inline browser results are never merged into served or native
  evidence.
