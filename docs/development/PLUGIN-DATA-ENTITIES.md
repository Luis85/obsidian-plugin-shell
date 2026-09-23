# Plugin-data entities

Choose this backend for feature data that belongs in the plugin's `data.json`.
Markdown-backed features continue to use `defineNoteFeature` and Markdown remains
their only canonical store. Registration rejects duplicate entity keys across
the two backends. Domain-only definitions need no repository.

```ts
import { defineEntity, definePluginDataFeature, fields } from '../api';

export const bookmarkFeature = definePluginDataFeature({
  backend: 'plugin-data',
  entity: defineEntity('bookmark', 1, {
    label: fields.text({ trim: true, min: 1 }),
    pinned: fields.defaulted(fields.boolean(), false),
  }),
});
```

Add `bookmarks: register(bookmarkFeature)` to the explicit registry in
`src/bootstrap/features.ts`. Bootstrap provides the same serialized plugin-data
coordinator used by preferences and owns repository disposal. Authors use
`services.repositories.bookmarks`; they do not construct storage adapters.

```ts
const repository = services.repositories.bookmarks;
const created = await repository.create({ label: 'Reference' });
if (created.ok) {
  const updated = await repository.update(created.value, {
    ...created.value.values, pinned: true,
  });
  if (updated.ok) await repository.delete(updated.value);
}
const rows = await repository.list();
const found = await repository.get('previously-returned-id');
```

Inspect every `Result`. Plugin-data creation does not render Markdown, accept a
document request ID, or return a document preview/path. Its immutable snapshots
contain entity, ID, schema version, persisted revision, creation time and typed
values. Updating preserves ID and creation time. Deletion removes plugin-owned
data; it does **not** use Obsidian's reversible note trash. A caller should obtain
appropriate confirmation before deletion. There is no query language, automatic
migration, whole-vault index or second copy of note-backed entities.

## Persistence and safety

The existing top-level schema remains version 1 with `preferences`. An optional
`pluginEntities` registry has its own version 1 and keyed collections. Each
collection declares the entity schema version, a monotonic revision counter and
records. The complete envelope is bounded to 1,000,000 characters, JSON data to
30 nested levels and each collection to 1,000 records. Exhausted safe-integer
revisions fail closed. A load, list or get never writes.

All preferences and entity writes share one runtime queue. Each operation merges
against the latest committed envelope; unrelated top-level data and unregistered
collections are retained. Untouched rows in the same collection also retain their
original stored values and revisions, even when decoding supplies defaults or
normalizes their display values. Unknown/corrupt top-level schemas block all writes.
Unknown/corrupt registry or selected-collection schemas block that repository;
preferences may still change while preserving their raw data. No schema is
silently repaired or automatically migrated.

Updates and deletes require an authentic snapshot returned by that repository
runtime. The saved record revision must still match. Competing views get a stale
failure and must reload/review. The counter survives deletion, preventing stale
snapshots from overwriting a recreated ID. The storage port is Obsidian's
`loadData`/`saveData`; it supplies no cross-process compare-and-swap. This queue
coordinates this plugin runtime, not other processes, devices or external edits
to `data.json`. Run one writer for that plugin installation.

A rejected `saveData` may already have committed. It returns an `uncertain`
failure and blocks **all** subsequent preference/entity writes for that runtime.
It emits no committed event and does not retry. Investigate and restart to read
the actual stored outcome before making another deliberate change. In-flight
saves that finish successfully after disposal still return their true committed
result, but do not publish to disposed owners; queued work never starts writing.

Successful saves publish `plugin-data.created`, `.updated` or `.deleted` with
entity, ID, schema version and committed revision, never raw field values. Typed
bus subscriber failures are observed independently and cannot undo a committed
write. Repositories and preferences suppress late events after disposal.

## Verification scope

`tests/runtime/plugin-data.test.ts` exercises real shared services, registration,
CRUD, revisions, concurrent preferences, uncertain writes, subscriber failures and
disposal. `plugin-data-preservation.test.ts` covers corrupt/future schemas,
unrelated data, capacity/version bounds and seeded property-based CRUD/reload
roundtrips. Only storage and the host/event boundary are doubled. These tests
establish runtime behavior, not cross-process or mobile durability guarantees.
