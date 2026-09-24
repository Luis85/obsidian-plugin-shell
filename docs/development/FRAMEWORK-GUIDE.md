# Develop a plugin with the template framework

Start with a feature, keep its business rules in `src/features/<name>`, and import
the public building blocks from `src/features/api.ts`. Generated source is ordinary
editable TypeScript/Vue. Bootstrap supplies host adapters and runtime ownership;
feature code does not import Obsidian or create another persistence path.

`src/features/api.ts` is an explicit public library entry for static analysis.
Its reviewed exports remain available when all demonstrations are removed and
before a consumer uses each contract. Add only intentional developer contracts
to this surface. Implementation exports and unrelated feature files remain
subject to the full unused-code gate; do not register feature directories as
additional entry points to hide unused scaffolding.

## From idea to a tested feature

1. Run `npm run setup` with the documented qualified toolchain. Start the actual
   component harness with `npm run dev:ui`.
2. Preview `npm run make -- feature bookmarks --entity bookmark --dry-run`, then
   apply the reviewed plan. Choose note-backed or plugin-data storage deliberately.
3. Edit fields, rules, actions and presentation. Keep the inferred repository map's
   one explicit registration; do not edit generic services or `main.ts` for business rules.
4. Test real actions and saved bytes, independent views, failures and owner closure.
   Run `npm run verify`, served E2E and appropriate isolated native qualification.
5. Review example removal and requalify the resulting consumer. Freeze the corrected
   candidate before release rehearsal. Production readiness still requires closing
   the readiness ledger's applicable gaps; a working scaffold is not that evidence.

The [authoring catalog](AUTHORING-TOOLS.md) documents feature, entity, view,
component, store, usecase, command, modal, setting, event, listener, style, locale
draft and explicit local maker recipes.

## Reusable contracts

| Need | Framework contract | Developer responsibility |
| --- | --- | --- |
| Typed business data | `defineEntity`, `fields` | Define validation/defaults and business invariants. |
| Markdown authority | `defineDocument`, `defineNoteFeature`, typed repository | Map every field; preserve original note content through repository updates. |
| Plugin-owned data | `definePluginDataFeature`, shared envelope writer | Select this backend explicitly; never duplicate note-backed state or call `saveData`. |
| Owner lifetime | `createActionScope`, `OperationPermit` | Dispose when the owner closes; invalidate when its editing context changes. |
| Changes across views | Descriptor-scoped publisher/subscriber, observer-only events | Publish committed facts only; subscribe before querying and guard older completions. |
| Host feedback/recovery | `AuthoringServices.modals` / `.notices` | Register deliberate recovery, revoke actions and dismiss only your owner. |
| Protected data | `preferences.persistenceStatus`, `readErrorKey`, `recoveryKey` | Show truthful guidance; never write defaults over blocked or uncertain data. |
| Qualification | Safe lifecycle observations and independent fault observer | Keep a loss-checked ledger; distinguish controlled adapters from real native I/O. |

## Own asynchronous actions

An action scope is framework-free and usable from a command, feature controller or
Vue composable. Only its owner has invalidation/disposal methods. Captured permits
are read-only and become permanently inactive when the context changes or closes.

```ts
import { createActionScope } from '../api';

const owner = createActionScope();

async function save(snapshot: Parameters<typeof repository.update>[0],
                    values: Parameters<typeof repository.update>[1]) {
  if (!owner.active()) return;
  const permit = owner.capture();
  const result = await repository.update(snapshot, values, permit);
  // Persistence returns its real outcome even if the owner closed during a write.
  if (!permit.active()) return;
  present(result);
}

// Call owner.invalidate() when the editing context changes.
// Call owner.dispose() from the feature/view's actual cleanup hook.
```

Note `update` and `delete` check the permit before accepting work and after awaited
preflight, immediately before storage. Omit the permit for intentional runtime-owned
work. This is cooperative owner liveness, not an access-control boundary or an
abort/rollback API. Once persistence starts, committed/failed/uncertain outcomes
remain truthful; closure suppresses UI completion rather than pretending to undo it.
Create/commit retain their existing request/runtime lifecycle contract; the optional
per-operation permit currently applies to note update/delete only.

Each view retains its own drafts. The Task reference reloads notes explicitly;
Items refreshes committed projections automatically. Neither behavior is a generic
framework promise. A new feature chooses its projection behavior and tests it.

## Recovery and resource ownership

`preferences.persistenceStatus` distinguishes unloaded, absent, ready, corrupt,
future, inaccessible and uncertain. Absent data uses in-memory defaults without an
initialization write. A future schema is preserved for a compatible version;
corrupt data requires deliberate repair/backup review; inaccessible data requires
resolving the read failure. An uncertain save blocks later writes, even if a query
or view is reopened. Restart only after inspecting durable state. Native and browser
adapters provide the optional `SettingsStorage.read()` exact-JSON contract: `null`
means an absent file, while the string `"null"` is present corrupt data. Native reads
use the public vault adapter and manifest plugin directory; saving still uses
`saveData`. Read failures, including disappearance after the presence check, block
writes. Legacy adapters implementing only decoded `load()` retain their null/undefined
absence convention and cannot distinguish a present JSON null; supply `read()` when
that distinction matters. This read is not a cross-process transaction.

`services.notices.registerActions(owner, actions)` returns a release function.
Release it during cleanup, dismiss that owner's notices and close its dialogs.
Use a captured action permit in asynchronous `available`/`run` callbacks too.
Pending availability may settle after closure; it must not reacquire a revoked
action. The public authoring capabilities include info/success/warning/error/progress
notices and deliberate invocation, with the shared timing and ownership policy.

With the optional showcase installed, **Events & feedback → Try owned recovery**
is an executable recipe in `src/presentation/composables/use-recovery-example.ts`
(removed with the showcase by the reviewed example-removal flow).
It opens a real confirmation dialog, delays progress feedback and offers a recovery
action whose availability awaits that existing dialog outcome. Confirm, then review
the result; cancel or close the owner to revoke the action and feedback. It changes
no files. This demonstrates asynchronous ownership using the public framework
services; it does not simulate a failed disk write or invent a recovery outcome.

Native `runtime.observation` exposes only `subscribe` and `snapshot`. Its events
contain safe fault or lifecycle metadata, never causes, note contents or paths.
It is a live stream, not a replay buffer: attach before the experiment, check the
baseline and sequence continuity, and retain observer failures and ledger overflow.
Resource release means an observed successful cleanup call, not a promise that
an arbitrary host implementation honored it; native assertions check actual handles.

## Limits that remain explicit

Documents are limited by UTF-8 bytes, including final serialized Markdown; invalid
Unicode and oversized candidates fail before persistence. Native trash is reversible
but is not cross-process compare-and-delete. Plugin-data transactions serialize
inside one runtime, not across processes. Automatic schema migrations, general
query/index platforms and broad mobile support are outside this increment.

Use the [readiness ledger](TEMPLATE-READINESS-LEDGER.md) and current execution record
to distinguish available abstractions, verified assertions and remaining production
qualification. The release profile stays blocked until its actual requirements
and separate owner authorization are satisfied.
