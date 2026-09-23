# Structured logging and runtime debugging

The runtime exposes `services.logger` and `services.debugging`. Logging starts at
`info`; detailed debug logging is off until explicitly enabled. The setting belongs
to the current plugin runtime and resets on reload. No preference migration,
telemetry, remote reporting, global console interception or filesystem log is added.

The command palette provides **Toggle debug logging** and **Inspect debug report**.
The toggle uses a localized `NoticeService.info` message. Inspection uses the owned
`ModalService.info` path and displays the latest 50 safe records as plain JSON,
with retained/exported/omitted counts. Closing the modal does
not clear evidence, retry an operation, or change canonical data.

## Developer API

Use known codes and operations, with a logger-issued correlation for one operation:

```ts
const correlation = services.logger.correlation();
services.logger.debug('operation.started', 'command.execute', { correlation });
services.logger.info('operation.completed', 'command.execute', {
  correlation, effect: 'committed', durationMs: 12,
});
```

`debug`, `info`, `warn` and `error` return whether a record was accepted. `setLevel`
accepts `off`, `error`, `warn`, `info` or `debug`. Levels filter records; they do not
control the independent diagnostic/error observer. Repeated originating failures
remain independently observable even when logging is off or records are cleared.

Feature authors register their own static catalog without editing logger plumbing:

```ts
import { defineLogCatalog } from '../api';

const catalog = defineLogCatalog('meetings', {
  codes: ['created', 'open-failed'],
  operations: ['create', 'open'],
});
const log = services.logger.registerCatalog(catalog);
log.info('created', 'create', { count: 1, effect: 'committed' });
```

Names remain literal unions in TypeScript and are checked against the registered
catalog at runtime. The stored names are scoped, such as `meetings.created` and
`meetings.create`. Catalogs are frozen snapshots; duplicate scopes, duplicate
codes/operations and invalid identifiers fail. Declare catalogs in source. Never
construct code names, operation names or scopes from note titles, paths or inputs.
Register once during runtime composition and inject that scoped logger into each
view or use case; registering again on every view mount is a duplicate.

## Redaction and effects

Metadata has only `count`, `attempt`, `durationMs`, `effect` and `correlation`.
Counts/attempts are bounded nonnegative integers; durations are bounded finite
numbers. Effects reuse the application's `none | committed | uncertain` vocabulary.
Correlations are opaque tokens issued by that logger and export only a local
numeric identifier. Tokens from another runtime or hand-built objects are rejected.

There is no message, path, title, cause, stack, payload or arbitrary-object field.
Unknown keys, accessor properties, unsupported prototypes, symbols, circular
objects, nonfinite values and raw errors fail validation without reading property
getters or serializing the input. Rejected inputs produce stable diagnostic codes;
their original values are not retained. A logger failure never changes the effect
of an application operation or licenses a retry.

The startup path records runtime initialization. The shared command executor records
declared command lifecycle facts through its explicit catalog. Completion means the
callback completed under its contract; it does not infer a successful business write
from a void return. Returned typed failures remain failures.

## Bounds and ownership

Each logger owns a FIFO ring of 200 records by default, configurable from 1 to 1000
at construction. Records, metadata and returned snapshots are immutable. Statistics
report retained, dropped, rejected, cleared, reentrant and skipped-delivery counts. Clearing removes
records while retaining those counters; it does not clear diagnostic evidence.

Observers and subscribers are read-only notification boundaries, not application
work pipelines. Thrown and rejected callbacks are contained through independent
diagnostics. Synchronous reporter, observer and listener reentry is rejected and
counted. Async callbacks permit at most one in-flight delivery per observer or
subscriber. While that callback is pending, further notifications to that callback
are skipped and counted; independent records, level changes and clearing continue
normally. Nothing is queued or replayed on settlement. Subscribers should read the
current snapshot after their work finishes. Use synchronous read-only observers
when every individual record is required. Observers must not form asynchronous
application/logging feedback loops; the logger is not an asynchronous causality
engine or a work pipeline.

`dispose()` clears owned records/subscriptions and prevents later writes. Callback
errors cannot recursively report through the logger. Invalid/throwing clocks yield
a null timestamp and a safe diagnostic, never raw exception text.

## Export scope

`services.debugging.snapshot()` returns a read-only report and `exportJSON()` returns
the same sanitized structure as text. `exportJSON({ maxRecords: 50 })` explicitly
limits an inspection view; omitted counts remain visible. These APIs do not save or
send files. A feature can offer a separately authorized export surface using this
text, without serializing application state or host objects.

Reports contain log records, level, runtime counters, scope/version and aggregate
diagnostic counts. Runtime bootstrap also captures public plugin ID/version and
the actual `browser` or `obsidian` host kind, so copied reports identify their build
and distinguish synthetic browser use. This optional identity is validated and
frozen; author, repository and filesystem metadata are not accepted. Reports
intentionally omit raw diagnostic strings as well as note
data, titles, paths, stacks, credentials and host objects. Records are transient
developer evidence, not a durable audit log or proof of native/device qualification.

## Verification

`tests/runtime/logging.test.ts` covers levels, independent diagnostics, capacity,
immutable scoped exports, typed catalogs, getters/circular/prototype/non-Error
inputs, observer/reporter failures, synchronous/asynchronous reentry and disposal.
`tests/runtime/debugging-commands.test.ts` exercises actual debug service commands,
bounded reports through the modal contract and honest modal failures. Host modal
focus/window behavior is qualified separately by the native adapter tests and
explicit native runs.
