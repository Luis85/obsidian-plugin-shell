# Runtime events and owned notifications

The runtime provides a typed in-process bus, a native observation bridge and a
notification policy with owned timers/actions. They run per plugin instance.
Application services remain authoritative for committed results; neither native
observations nor notification visibility prove a write succeeded.

## Native observations

`bindHostEvents` registers after `workspace.onLayoutReady`. It owns eight public
Obsidian EventRefs, registers them with the plugin and removes them on early
disposal. A late readiness callback cannot restart a disposed bridge. Partial
registration, callback and cleanup faults are observed with redacted codes.

| Native source | Typed fact | Payload |
| --- | --- | --- |
| Vault create/delete | `host.vault.entry-created/deleted` | Vault-relative path; file/folder kind |
| Vault modify | `host.vault.entry-modified` | Path; finite nonnegative mtime or null |
| Vault rename | `host.vault.entry-renamed` | New path, old path, kind |
| Workspace file-open | `host.workspace.file-opened` | Path or null |
| Workspace active-leaf-change | `host.workspace.active-view-changed` | Bounded public view-type string or null |
| Workspace layout-change | `host.workspace.layout-changed` | Runtime-local invalidation revision |
| Metadata cache changed | `host.metadata.changed` | Path only |

The existing `host.active-file-changed` availability fact remains a compatibility
projection of file-open. It is not a document-created fact. Body/cache/native
objects never enter payloads. The actual configurable Obsidian metadata directory
is filtered, invalid paths are rejected, and diagnostics do not contain paths.
Other plugins' view types may include punctuation, spaces or Unicode.

Only layout invalidations coalesce, over a default 50ms owned timer. Ordered
create/rename/delete observations are never coalesced. Options can disable modify
or metadata mappings and change the layout delay. Disposing the bridge cancels
pending work. There is no initial vault scan, native-event interception, outward
echo, durable replay or reliable attribution to the plugin that caused a change.

Subscribe through the existing typed `events.on(name, listener)` facade; retain
its disposer. Query the repository for current state, then use native events to
invalidate a deliberate projection. Count application `documents.created` once
for the initiating use case, not once again when the host reports the file.

## Notification API

The runtime's `services.notices` (also exposed as the same `services.notifications`
instance for compatibility) is configured with a scheduler, locale-key
validation and native/browser sinks. `notify` accepts an owner and operation ID,
semantic kind, existing locale key, scope, surface preference and optional approved
action IDs. It returns an owned handle with `update` and `dismiss`. Invalid requests
return no handle and record a diagnostic. At the 128-entry ownership limit,
essential recovery displaces optional pending feedback. If every retained entry
already represents essential recovery, the new request is rejected with a diagnostic
and one persistent overflow summary. Callers retain their operation result/recovery
state independently.

```ts
const handle = services.notices.notify({
  owner: 'import-panel',
  operation: submissionId,
  kind: 'progress',
  key: 'doc.creating',
  scope: 'view',
  native: true,
});
// After the real operation resolves, map its actual effect-aware result:
handle?.update({ kind: 'success', key: 'feedback.saved', native: true });
// The owner calls this on close; dismissal does not cancel or undo the operation.
handle?.dismiss();
```

Do not use the example success update for uncertain or failed writes. Show a
persistent error/reconciliation message and preserve the original receipt/path.
No timer marks an operation complete, and the policy never retries a mutation.

| Policy | Behavior |
| --- | --- |
| Progress | Default 300ms cancelable display delay; remains until an explicit terminal update or disposal |
| Info/success | Default six-second lifetime, beginning when displayed; optional 0–60000ms override |
| Errors/warnings/actions | Persistent; caller controls dismissal and preserves canonical recovery context |
| Deduplication | Same owner/operation updates the same handle; separate attempts use separate operation IDs |
| Transient native burst | Three visible transient sinks and ten queued requests, FIFO; excess transient requests produce one overflow summary |
| Essential background recovery | Persistent errors/actions bypass the transient queue, within the explicit 128-entry ownership bound |
| Locale changes | Visible owned sinks update through their handle; inline messages translate from their stable key |
| Disposal | Cancels delays/expiry, removes actions, dismisses owned sinks and empties the queue |

Scheduler creation/cancellation failures are independently observed. A failed
delay displays its feedback immediately; a failed expiry leaves it persistent.
Cancellation invalidates the callback before invoking the scheduler, and cleanup
continues through every remaining handle even if that provider throws. A broken
timer provider cannot turn a committed document into an uncertain write or revive
feedback after owner disposal. The native bridge applies the same cleanup rule
before removing all its EventRefs.

The composed policy creates native Notice instances with duration zero and owns
their sole expiry timer;
it never assumes `setMessage` restarts a host timer. Native/browser sinks use safe
text and owned buttons, not arbitrary HTML. The native public Notice API does not
promise placement in a particular pop-out window. Native sink failure preserves
inline recovery: runtime scope is available in open showcase views, while view
scope remains with its owner. New `notify` requests default to runtime scope.
View-scoped feedback must be consumed by that owner's view; choosing a scope does
not automatically register an arbitrary view or introduce a global toast store.

Register recovery implementations explicitly with
`registerActions(owner, { actionId: { labelKey, available, run } })`. Requests carry
only those IDs, never executable data from events or documents. `available` checks
the original context immediately before invocation. Actions are single-flight;
an updated/dismissed request or disposed owner invalidates a pending availability
check. Action failures retain the original notification and produce an independent
diagnostic. The registration disposer removes all that owner's pending/visible
feedback. Safe follow-up actions such as opening a committed receipt are distinct
from retrying creation.

The existing `show(owner, kind, key, native?, scope?)` API is a compatibility facade
over this policy in the composed runtime. Direct three-argument constructions of
`NotificationService` retain the earlier simple sink contract for compatibility;
advanced `notify`/action APIs require the scheduler options. New feature code should
use the composed service. There is no second global toast store.

## Evidence and limits

`host-events.test.ts` runs all native mappings against explicit public-API doubles
and the real bus, including null/folder/path cases, startup, bursts, failure and
cleanup. `notification-policy.test.ts` runs real policy with controlled timers,
queue/overflow, persistent background recovery, stale/single-flight actions and
fault observers. `notification-sinks.test.ts` checks native Notice contracts and
the real browser DOM sink. Runtime lifecycle/component tests continue separately.
These doubles establish contracts, not real-host qualification. Native Notice
placement, actual announcements and screen-reader interaction retain their native
and manual evidence requirements.

The larger retained event contract still distinguishes typed bus delivery from
metadata-envelope versioning, outward cross-plugin integration and a durable event
system. No documentation catalog alone qualifies those capabilities.
