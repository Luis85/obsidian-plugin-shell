# Isolated reporter transport regression (2026-09-28)

Continuation of the [PR5 implementation record](PR5-IMPROVEMENT-EXECUTION.md).

Resumed at `b05506d4dfde7bdeaeb06f0c2eb36a75a6919654` (GitHub test-merge source
`cfc1715f597776654d6a48c61bfea766ccf0a025`). At inspection, CI `36361019769`, compiler
`36361019696`, companion `36361019709`, native-starter `36361019744` and optional
memory `36361019790` workflows had succeeded. Setup compatibility `36361019708`
failed only on Windows/Node 24.15.0/npm 12.0.2, job `108738153552`. Its dependency
installation succeeded; full verification reached the real Playwright reporter
regression, where a `GitCommitInfo` console diagnostic preceded JSON and made
`JSON.parse(raw.stdout)` fail. This is a report transport defect, not evidence of
an npm installation-policy or browser-UI failure. The original failed run is retained.

The browser producer now uses the official JSON reporter's owned output-file
transport, retains stdout/stderr verbatim and binds the independent raw report.
New evidence packets use version 2; historical version 1 parsing stays explicit
and strict, with no missing-report fallback. Files are bounded, UTF-8 validated
and checked for nonregular/linked substitution. Windows-cased ambient output
variables cannot redirect the report. The parser still rejects bad counts,
failed/retried cases, framework errors and nonzero exits. No quality floor,
assertion, retry policy or release guard was relaxed.

Seven new dependency-free transport tests include a synthetic parser reproducer;
six failed before the implementation (including the original stdout-contamination
case). After the change, all seven and three existing failure-preservation tests
passed. Nine actual child-process CLI evidence tests also passed: 19 distinct
passing tests total, no skipped/TODO cases. Suite inventory reports 292 files in
31 suites with 32 helpers; whitespace checks pass. These local results use
Node 22.16.0, not the qualified hosted toolchain.

The real Playwright regression now emits deterministic configuration stdout and
stderr, checks their retention, and rejects malformed/removed/downgraded reports
even when raw hashes are rewritten. The existing Windows/macOS/Linux Framework
CLI jobs run real Vitest/Playwright adapters and evidence controls early and retain
their transcript with the exact source revision, before longer consumer journeys.
Local execution of those real-framework cases is blocked by absent pinned Node
dependencies; hosted current-head results must be inspected separately. Reporter
fixtures do not launch a browser and do not establish served/native UI acceptance.

This increment closes a demonstrated IP-11 transport defect, not the whole product
plan. Full native companion, manual accessibility, real optional-provider/desktop
acceptance and publication remain open. No release, tag, merge, personal-vault
operation or real-provider call was performed.
