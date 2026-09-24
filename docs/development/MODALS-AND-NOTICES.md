# Modal and notice services

Feature code receives `services.modals` and `services.notices` from composition.
Both are framework-free application APIs with injected native/browser adapters.
Features do not construct Obsidian `Modal` or `Notice` objects.

## Modals

`info`, `confirm` and `prompt` return promises with explicit outcomes:

```ts
type ModalOutcome<T> =
  | { status: 'confirmed'; value: T }
  | { status: 'cancelled' }
  | { status: 'failed'; error: Failure };
```

Info confirms with `undefined`, confirmation with `true`, and a prompt with its
validated string. Cancellation is a normal user decision; it is not a failed write.
Opening a modal never persists data. The caller explicitly invokes its application
operation only after checking the outcome.

```ts
const choice = await services.modals.confirm({
  owner: 'view:archive-action',
  titleKey: 'archive.title',
  messageKey: 'archive.question',
});
if (choice.status !== 'confirmed') return;
// Call the existing application operation with its original safe context here.
```

The copy keys in an added feature must exist in its composed locales. Title,
message, confirmation/cancellation labels and prompt labels use the same translator.
For an explicitly safe report, `message: redactedReport` replaces `messageKey`;
raw messages longer than 64,000 characters are rejected before opening. Accepted
text preserves line breaks and is never interpreted as HTML or an ICU expression.

`prompt` additionally accepts `initialValue`, `labelKey`, `maxLength` (1–10,000;
default 1,000), and an optional synchronous or asynchronous
`validate(value): Result<string> | Promise<Result<string>>`. The validator can
normalize the value. A validation failure retains the input, displays its localized
error and focuses the field. Submit/input controls disable while validation runs;
Cancel and Escape remain available. Duplicate submissions cannot run the validator
twice. Unexpected validation, opening or update failures produce `failed` and
independent diagnostics. Cleanup failures are observed separately and cannot
replace an already settled confirmed or cancelled outcome.

Requests are snapshotted before opening. Mutating the caller's owner, copy or
validator later cannot change the reviewed dialog or strand its owner registration.
There is at most one active modal per owner and sixteen per runtime. A replacement
cancels its owner's prior dialog. `closeOwner(owner)` and `dispose()` cancel owned
dialogs idempotently; late callbacks/validation results cannot change a settled
outcome or revive a closed view.

Native dialogs use the public Obsidian `Modal` lifecycle. Browser dialogs use real
`<dialog>.showModal()`. A shared safe DOM renderer handles fields, validation and
Tab/Shift+Tab wrapping among owned enabled controls; each host owns actual modal
isolation from the underlying app. Trigger focus is restored when that element
still exists. Native placement follows Obsidian's public active-window behavior;
the service does not promise arbitrary pop-out targeting through private host APIs.

## Notices

`NoticeService` is a thin native-first facade over the existing notification policy:

```ts
const notice = services.notices.progress({
  owner: 'view:import', operation: submissionId, key: 'import.running',
});
// Only after the real operation confirms persistence:
notice?.update({ kind: 'success', key: 'import.saved' });
// Owner cleanup:
notice?.dismiss();
```

The convenience methods are `info`, `success`, `warning`, `error`, and `progress`.
They accept a request without `kind` and default to `native: true`. Use
`native: false, scope: 'view'` for owned inline feedback. The advanced `notify`
method retains explicit policy control. Handles use the same timer, queue, action,
locale-refresh and failure-isolation rules documented in
[Runtime services](RUNTIME-SERVICES.md). There is no duplicated state or policy:
`services.notifications === services.notices` is the compatibility alias.

Use the composed instance rather than constructing services inside components.
Existing low-level `host.showModal`/`host.notice` methods remain adapter compatibility
surfaces; the showcase and debugging features use the dedicated services.

Feature factories receive these convenience methods plus `registerActions` and
`invoke` through `AuthoringServices` in the public authoring API. Register recovery
under a unique owner and retain its returned release function. During cleanup,
release the registry, dismiss that owner's notices and close its dialogs. A pending
availability check can still settle after cleanup, but it cannot invoke a revoked
action. Use an [action scope](FRAMEWORK-GUIDE.md) to guard your own asynchronous
continuations. Read-only lifecycle observers receive metadata, never these handles
or action capabilities; keep qualification ledgers independent of production logs.

## Qualification

Service tests cover confirmed/cancelled/failed outcomes, request snapshots, capacity,
single-flight asynchronous validation, owner replacement/disposal, late callbacks,
open/update/close faults and safe plain-text reports. Native/browser adapter tests
exercise the real service and renderer with an explicit native API double.

The two small examples in Events & feedback exercise confirmation and text input
without writing notes. Served Playwright checks Enter, Escape, validation, keyboard
focus containment/return and empty persistence/error ledgers. The native qualification
driver repeats those interactions against actual Obsidian; its results remain
separate from adapter doubles. Screen-reader announcements and additional operating
systems still require their own evidence.
