# MCP discovery shutdown regression (2026-09-28)

Continuation of the [PR5 implementation record](PR5-IMPROVEMENT-EXECUTION.md) and
[reporter transport correction](EVIDENCE-TRANSPORT-REGRESSION.md).

At head `3a70a09c8b31d9ea21c4caacd393351cbdc47350` (test-merge source
`fc866c2daeb6e90fb6c893e88387177e47b2c855`), optional-memory workflow
`36364717020` failed on Windows job `108748728209`. The Node suite recorded
66 passing cases and one failing cleanup hook: `EPERM` when removing the owned
scratch directory after a successful MCP initialize/tools-list handshake. Its
Linux and macOS jobs passed. This is retained as a failed run, not silently retried
or reclassified. The same head's macOS Framework CLI job `108748801696` passed the
new real-reporter step after the linked-launcher fix; longer qualification was
still running at inspection.

## Defect and correction

`discoverTools` resolved or rejected immediately after `child.kill()`. Sending a
termination request did not establish child exit or closure of its stdio. The
caller could attempt scratch cleanup while the owned process still held its
working directory, especially on Windows.

Discovery now retains ownership until the child's `close` event on success,
malformed output and timeout alike. It closes stdin, requests termination, and
escalates to `SIGKILL` after 250 ms for an unresponsive owned child. A separate
2-second shutdown watchdog rejects instead of claiming successful discovery when
closure cannot be confirmed; local stream handles are disposed in that failure
path. Timers are released when the outcome settles. The parser keeps its existing
bounded UTF-8/JSON checks, and response parsing stops once shutdown begins.

No tools are invoked, no daemon is started, and no live Hindsight package or
inference provider is needed for these regressions. Provider configuration,
installation consent, snapshot integrity and discovery's read-only boundary are
unchanged. This is a child-process lifetime correction, not proof of cleanup of
arbitrary descendants or every possible Windows filesystem lock.

## Executed checks

Three new actual-child tests use a synthetic stdio server that ignores SIGTERM on
platforms that support doing so. They cover successful discovery, malformed output
and timeout; each asserts that the recorded child PID no longer exists when the
operation settles. All three failed before the correction and passed afterwards.
Only the failed reproducer's own PID is targeted by test cleanup. Existing tests
are not skipped, retried or relaxed.

| Local check | Result |
| --- | --- |
| Complete Node memory suite | 70 passed; zero failed, skipped or TODO |
| Python adapter suite, explicit SDK doubles | 24 passed |
| Transport/failure/actual-child evidence CLI regressions | 20 passed; zero failed, skipped or TODO |
| Hindsight TypeScript, supplementary local compiler/Node declarations | Passed |
| Source limits, suite inventory and whitespace | Passed; 292 test files in 31 suites, 32 helpers |

Local tools are Node 22.16.0, npm 10.9.2, TypeScript 5.8.3 and Python 3.13.5,
not the repository-qualified Node 24.21.0/npm 11.19.1 toolchain. Current-head hosted
Windows/macOS/Linux checks remain independently required. A preceding commit's
success does not qualify this correction, and reporter/SDK doubles are not native
companion, desktop integration, live-provider, manual-accessibility or release
acceptance. No publication, tag, merge or personal-vault operation was performed.
