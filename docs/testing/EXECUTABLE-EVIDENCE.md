# Executable evidence and acceptance reconciliation

The versioned adapters connect actual framework results to reviewed, case-specific
acceptance links. They supplement the finite [legacy plan](test-plan.json), whose
96 rows, normative modes and blocked release guard remain unchanged. The additive
[crosswalk](acceptance-crosswalk.json) retains every row. Most initial links are
partial: passing Items, event or evidence-control assertions do not
establish unrelated native, device, manual or administrative obligations.

## Commands

```sh
npm run evidence -- --help
npm run evidence -- run runtime
npm run evidence -- run tooling
npm run evidence -- run coverage
npm run evidence -- run artifact
npm run evidence -- run browser
npm run evidence -- run native --allow-download
npm run evidence -- check reports/evidence/<input-digest>/<run-id>/packet.json
npm run evidence -- report reports/evidence/<input-digest>
```

The underlying command is `node scripts/testing/evidence-cli.mjs`. `--root DIR`
selects a checkout/consumer/archive for run, check or report; it supplies no
executable hook. Production coverage must run with that root as the working
directory because the existing coverage gate resolves its business scopes there.
Native requires the explicitly provisioned launcher, isolated scratch host and a
validated retained candidate matching `dist`. A clean checkout defaults to
`reports/release/<version>-<HEAD>`. `--candidate DIR` explicitly selects another
root-contained retained packet, retaining its source commit separately from the
current driver's source identity. Native never inherits an arbitrary `GITHUB_SHA`.
No command rebuilds retained assets, publishes, installs packages or authorizes
release operations. Browser execution requires an already built harness and
provisioned Chromium.

Run commands execute fixed trusted JavaScript producers and write uniquely named
reports. Check and report only read files. Exit 0 means the selected implemented
scope passed, 1 means recorded execution/session failure, and 2 means malformed
input, missing prerequisite or infrastructure failure. An individual successful
`check` describes one execution; only `report` reconciles the complete session.

## Producers and scope

| Producer | Actual structured input | Evidence scope |
| --- | --- | --- |
| runtime | Vitest JSON plus public reporter diagnostics | Unit; explicitly named component test files have component mode. Synthetic host tests remain unit. |
| browser | Playwright JSON, every result and retry | Served browser integration, never native-host evidence. |
| tooling | Node's versioned real test-event reporter | Tooling/generated controls; the dedicated evidence-control suites are Node baseline. |
| coverage | Production Vitest output and actual coverage summary | Existing complete production inventory and unchanged production/business floors, separate from acceptance. |
| artifact | Existing artifact checker's structured asset report | Exact output hashes, ownership, notices and size checks; no host execution. |
| native | Existing isolated host driver's complete report | Exact reviewed check inventory for showcase/foundation, retained candidate hashes, installed hashes, host/installer/launcher identity and cleanup outcome. |

Vitest's built-in JSON omits retry counts. The additional checked-in reporter
records public `TestCase` retry/repeat/flaky/error diagnostics and independently
reported unhandled errors. Every case must match both outputs. A passing final
retry never becomes ordinary passing evidence. Playwright retains every result;
flaky, expected-failure, skipped or retried cases cannot qualify. Both fixed
commands reject focused tests. Complete suite-file inventories are derived from
the actual source tree, including generated consumer tests. Actual case names and
counts are retained and bound to those source bytes; the adapters do not infer
assertions by grepping human console output.

The four existing Windows-only tooling cases have exact file/name/platform
exceptions on other platforms. They remain `skipped`, with a separate
`expectedPlatformSkips` count, and never establish acceptance links. All other
skips fail. This preserves the platform scope without silently ignoring newly
skipped cases.

The native check inventory is reviewed data in
[native-evidence-checks.json](native-evidence-checks.json). The source-owned
`native-profile.json` selects the foundation inventory after example removal;
reports cannot choose arbitrary checks. The optional generated-view check has one
fixed identity. Removing the example does not invalidate a consumer: absent
example links remain visibly unobserved with their gaps. Native performance, when
present, is checked against the independent controlled-reference protocol and raw
sample validator; timing budget qualification remains separate from test counts.

Enhanced native ownership claims additionally require an independent live ledger,
closed nested schemas, exact fault counts, consecutive event sequences, zero lost
entries/subscriber failures and matching resource acquisition/release metadata
across immutable checkpoint prefixes. The real recovery example supplies delayed
progress and pending availability; public CDP retains its actual Notice listener
for invocation after closure. Protocol/parser fixtures alone cannot establish
native execution. See [the native ownership protocol](FRAMEWORK-LIFECYCLE-NATIVE.md).

## Packet and session integrity

Schema 1 packets record the producer, run UUID, UTC interval, actual exit/signal,
zero-retry command policy, complete suite inventory, normalized cases and counts,
raw-output file hashes, before/after execution identities and relevant assets.
The identity includes actual executable source/config/test files, exact lockfile,
installed producer versions, Node version, protocol implementation and additive
policy hashes, operating system, architecture, locale/timezone and the selected
Chromium executable's bytes/hash. Git metadata distinguishes clean and modified
checkouts from literal Git-free archives; a revision never substitutes for the
content digest. Native candidate source and current tooling source are separate.

Session directories use the complete input digest, including crosswalk/native
policy bytes. A run is appended to `runs.jsonl` **before** starting the child.
Session checks require every registered run and compare the directory inventory.
Interrupted or missing packets, earlier failed runs and duplicate IDs cannot be
removed by selecting only a later passing packet. Repeated invocations retain
all attempts; the report suppresses acceptance observations if any session run
fails. Historical sessions for changed inputs stay on disk and fail current-input
validation. Source, policy or asset changes during a run produce failed evidence.

Raw report tampering, stale source, asset drift, missing/empty suites, duplicate
cases, count disagreement, unknown schemas/fields, unexpected skips, retries and
incomplete native inventories fail closed. Framework-format changes require
reviewing adapters against the pinned tool. These checks establish consistency,
not cryptographic proof of honest execution: someone able to rewrite all inputs,
reports and their hashes can fabricate a packet. Packets are never credentials
for `release:operate`.

## Assertion audit and regression controls

The initial crosswalk links exact assertion names for Items CRUD/shared writer,
rendered invalid guidance, sibling drafts/projections, view ownership and event
order/once/reentrancy/error/snapshot behavior. The links explain their bounded
assertions. Whole extent denotes the named acceptance case in that evidence mode;
it never implies whole-template release readiness. Required modes are checked
against the untouched legacy plan on every report.

AC-06's unit link has whole extent: the assertion overlaps an item create with a
preference update, checks their exact combined stored envelope, preserves the
sibling draft and queries current state from a late view. The later AC-CLOSE-06
served assertion overlaps preference and item persistence and checks exact saved
envelopes plus restored UI. Both whole links established AC-06 in the prior
qualified session; any changed source requires a fresh complete session.
AC-03's two links now have whole extent after an assertion audit: the unit test
constructs independent services from saved data after create, rename and delete,
checks the expected stable IDs/labels or absence, and asserts zero initialization
writes/errors. The browser test reloads the page after each committed operation,
checks the durable row or empty collection and observes faults before every reload.
The targeted correction runs passed 16 unit cases across Items/document tests and
both Items browser cases. These executions justify the linkage review; AC-03 is
marked verified only when current-input runtime and browser producer packets pass
together with consistent repetitions. A test title alone cannot establish reload.
The selected rows describe concrete missing assertions or unlinked evidence rather
than treating every unqualified row as missing implementation.

`tests/tooling/evidence-cli.checks.mjs` executes actual child producers and checks
the real CLI, including a deliberately failing assertion, skipped case, overflowing
fault ledger, empty suite, source mutation, stale/missing reports and failed first
attempt followed by success. `evidence-adapters.checks.mjs` runs real Vitest and
Playwright reporters with pass/fail/retry/repeat/skip controls. The Playwright
reporter-only fixtures perform assertions without opening a browser; they qualify
the parser and cannot establish browser UI acceptance. They deliberately use an
identified fixture executable and placeholder assets. Production served/native
runs remain separately required. Execution records report which commands actually
ran; this guide makes no unexecuted qualification claim.
