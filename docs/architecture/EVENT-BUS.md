# Typed event bus and Obsidian integration

> **Contract:** PRD 0.3 extension; requirements EVT-01–16.  
> **Status:** Runtime bus, scoped authoring ports, registered descriptors, catalog/checker and makers implemented. This document retains the complete target; qualification records state the executed scope.
> **Related:** [PRD](../product/PRD.md), [setup and makers](../development/SETUP-AND-MAKERS.md), [research](../research/2026-09-22-setup-makers-events-styles.md).

## 1. Purpose and boundary

Provide a small, plugin-scoped, typed notification bus connecting application features, view projections, and selected Obsidian events. A developer can add an event and a listener through `make`, with explicit ownership, tests, and a discoverable catalog.

This requirement deliberately replaces v0.2's decision not to include an event-bus baseline. It does not introduce a distributed message broker, event sourcing, a transaction log, durable queues, request/reply messaging, or a globally accessible service locator.

**Use direct calls for requests and results; publish events for facts.** A create-item command calls an application use case and awaits its outcome. After successful persistence the use case publishes `example.item-created`; interested views invalidate/reload their projection. Ordinary parent/child Vue communication continues to use props and emitted component events.

```text
Obsidian Vault / Workspace / MetadataCache
                  │ supported events, owned EventRefs
                  ▼
        ObsidianEventBridge (infrastructure)
                  │ normalized typed snapshots
                  ▼
       plugin-instance TypedEventBus
          │                    ▲
          ▼                    │ successful committed facts
 application subscribers ← application use cases
          │
          ▼
  view projections / owned Pinia state
```

The bus is not the owner of canonical application data. Late subscribers load a current snapshot from an application query; they do not assume they saw every event since plugin startup.

## 2. Placement and ownership

```text
src/
  application/
    events/                    # framework-free bus ports and shared event contracts
    example/events/            # feature-owned fact declarations
  infrastructure/
    events/                    # small in-process implementation
    obsidian/events/           # native-to-typed mapping and EventRef ownership
  presentation/
    composables/               # Vue-owned subscription cleanup
  bootstrap/
    events/                    # explicit catalog composition and wiring
```

**EVT-01 — Instance scope.** Bootstrap creates one bus per plugin runtime, shared by that runtime's views/services. No exported global singleton, `window` property, Node EventEmitter dependency, or cross-vault shared instance. Harness instances use separate buses unless a multi-view scenario intentionally shares one runtime.

**EVT-02 — Architectural ports.** Domain code may define immutable domain facts but imports no bus implementation, Obsidian, Vue, or Pinia. Application code publishes/subscribes through narrow framework-free ports. The concrete bus and host bridge are wired in bootstrap. Only the bridge receives native objects; consumers receive normalized values.

**EVT-03 — Least surface.** A component that needs to observe an event receives a subscriber facade for those event names, not unrestricted publication of all host/application events. A feature receives publication rights for its own declared facts. These are compile-time design boundaries, not a security sandbox against malicious code in the same plugin process.

## 3. Type and catalog contract

**EVT-04 — Correlated types.** Event names are literal keys with associated payload types. `on`, `once`, and `publish` preserve the correlation between a name and its exact payload, including when event types are combined into unions. Unknown names and incorrect payloads fail TypeScript tests. Do not expose a catch-all string index, public `any`, or an unchecked generic `emit(name, unknown)` overload to erase this guarantee. [S09]

The current `EventPublisher<FactMap>` accepts the correlated publication union; `EventObserver<FactMap>` supplies `on` and `once` without publication or capability-acquisition methods:

```ts
interface TaskEvents {
  'tasks.item-created': Readonly<{
    itemId: string;
    revision: number;
  }>;
}

// Injected publisher for TaskEvents, not a global bus.
taskEvents.publish({
  type: 'tasks.item-created',
  payload: { itemId, revision },
});

// Injected subscriber facade; the owner retains the disposer.
const unsubscribe = taskObservers.on('tasks.item-created', payload => {
  taskProjection.invalidate(payload.itemId);
});

// Called by the owning runtime/view's cleanup path.
unsubscribe();
```

The public publication input is a mapped discriminated union of `{ type, payload }`, rather than two unrelated unions. Current subscribers receive frozen typed payload snapshots. The retained envelope and bus-generated metadata target in section 5 remains separate from this authoring milestone. Tests cover widened union inputs, not only obvious misspelled literals.

**EVT-05 — Explicit composition.** Core, host, and feature maps/descriptors are composed through explicit imports. Duplicate event names are rejected during catalog validation, including duplicates with identical payload shapes; type intersections alone do not detect every collision. Adding an event never requires editing the bus algorithm or widening a global string map.

**EVT-06 — Event catalog.** Each descriptor identifies literal name, owner, meaning, payload contract/version, publisher, expected subscribers, origin, sensitivity classification, and delivery notes. Generate the human-readable catalog from registered descriptors using `events:catalog`; `events:check` detects drift, duplicates, and invalid references. Do not maintain a second hand-edited payload schema that can diverge silently. The runtime needs a compact descriptor/validation registry, not all explanatory documentation strings bundled into the plugin.

Names use feature/category prefixes and describe completed facts, for example `example.item-created` or `host.vault.entry-renamed`. Breaking payload changes require an explicit contract/version decision. This is a local process contract; catalog versioning does not imply durable replay or public cross-plugin compatibility.

### Current descriptor authoring and catalog commands

`defineEvent(literalName, payloadTypeGuard)` creates the compact immutable runtime
contract. Add it to `featureEvents` in `src/bootstrap/events.ts`; core, host and
removable example descriptors are composed separately. Duplicate names fail even
when their guards or payload shapes match. Generated facts require no augmentation
of `ShellEvents` and no changes to the bus algorithm.

Bootstrap supplies `bus.publisher(descriptor)` only to its declaring action and
`bus.subscriber(descriptor)` only to its listener factory. The latter returns an
`EventSubscriber<Payload>` with `on(listener)` and `once(listener)`; it has neither
an arbitrary event-name parameter nor publication rights. Public runtime services
expose an observer facade only. Returned disposers remain owned by the feature or
view; closing a view does not dispose the runtime bus. These are compile-time
capability boundaries, not protection from deliberately malicious plugin code.

`npm run events:catalog` prints the registered human-readable catalog;
`-- --json` prints the same contracts as JSON. `npm run events:check` fails for
runtime duplicates, absent catalog entries, duplicate documentation, invalid
registered references, invalid metadata and ambiguous source payload declarations.
Payload text is inferred by the actual TypeScript checker from the same guard
used at runtime, rather than a parallel payload schema. The catalog includes owner,
meaning, contract version, publisher, subscribers, origin, sensitivity and delivery.
Explanatory catalog modules are imported by tooling and tests, never by the
production runtime registry.

The event maker registers the descriptor and its documentation, then injects only
its publisher into the generated demonstration command. The listener maker injects
only its declared subscriber. Both preserve reviewed plans, exact reruns and edited
source conflicts. Their generated tests execute the production bus and release
owned subscriptions. A demonstration command is not a persistence success fact;
a real business action must publish only after its committed write.

The bus clones first, validates that exact snapshot against registered guards,
then freezes and dispatches it. Unknown runtime names and invalid values report a
safe diagnostic without delivery. Registered reference identity is checked when
creating a scoped capability. The legacy unconstrained constructor remains useful
for isolated typed bus tests; production always supplies explicit descriptors.

## 4. Delivery semantics

**EVT-07 — One simple notification model.** The v1 API supplies `publish`, `on`, `once`, and idempotent unsubscribe/dispose operations. `publish` begins delivery synchronously in subscription registration order and returns without awaiting asynchronous listener work. There is no hidden awaited command pipeline, persistence, replay, sticky last-event state, or exactly-once delivery claim.

The following semantics are mandatory and tested:

| Situation | Required behavior |
| --- | --- |
| Listener added while delivering an event | It begins receiving from a subsequent publication, not the current one. |
| Listener removed before its turn | It is skipped even if it was present in the initial snapshot. |
| `once` listener | Unsubscribe before invoking it, including before a nested publication or returned promise. |
| Nested synchronous publication | Defined depth-first delivery; a bounded recursion guard prevents unbounded synchronous loops. |
| Synchronous listener exception | Report through the injected error sink; continue delivering to remaining listeners. |
| Listener returns a rejected promise/thenable | Observe the rejection and report it; no unhandled rejection. Other listeners are not awaited or blocked. |
| Async completions | May finish in a different order from subscription order. The caller must not infer completion from `publish` returning. |
| Publication after runtime disposal | Ignore safely with bounded diagnostics; never revive listeners or notify dead views. |
| Subscription after runtime disposal | Reject as an explicit lifecycle misuse rather than silently create a permanent subscription. |
| Already-running work when unsubscribed | Unsubscribe prevents future invocations; it cannot automatically undo I/O already started. The owner supplies cancellation/abort where supported. |

No `publishAsync`, priority scheduler, wildcard mutation hook, background retry queue, or event-bus transaction layer is required for v1. A caller needing a result or guaranteed completion invokes an application service directly. A future API extension must define ordering, cancellation, reentrancy, and failure semantics before implementation.

**EVT-08 — Facts after successful writes.** Publish committed application facts after validated persistence succeeds, including a relevant revision/identifier for projections. A failed save publishes no success fact. Listener failure does not roll back an already committed operation or turn it into a misleading failed-save result. The in-memory interval between save and notification is not atomic: a process crash may prevent delivery, so projections can always recover by querying current state.

**EVT-09 — Bounded diagnostics and loops.** Listener failures go directly to the error/logger sink, not to an error event on the same bus. Record event type, safe IDs, owner, and error code, not full payloads. Bound recursion and diagnostic memory. High-frequency host work is filtered/coalesced at a declared adapter/subscriber boundary with owned timers; do not hide a generic unbounded queue inside the bus. Do not coalesce ordered rename/create/delete facts as though they were interchangeable refresh signals.

A synchronous recursion limit does not prevent every asynchronous causal loop. Subscribers that write back to the vault must use idempotent application operations, explicit origin/correlation where available, and tested echo handling. Native events do not inherently identify which plugin caused a change; never claim perfect origin attribution.

## 5. Payload and metadata rules

**EVT-10 — Boundary snapshots.** Payloads are small plain value objects with deeply read-only public types. The publication boundary creates an isolated snapshot and guards against mutation; tests verify that changing the original source object cannot change an already dispatched payload. Runtime freezing/defensive copying must be consistent with the supported JSON-like payload types and measured overhead.

Do not publish `App`, `TFile`, `TFolder`, `WorkspaceLeaf`, DOM nodes, Vue refs/proxies, closures, or complete metadata-cache objects. They leak infrastructure dependencies and object lifetime into application contracts. Use stable IDs, normalized vault-relative paths where necessary, and small scalar fields. Event paths/titles can be sensitive even though they are not note contents; they are excluded from default diagnostics.

Metadata includes a generated event ID, injected-clock timestamp, plugin-instance identity, and origin category (`application`, `obsidian`, or `harness`). Correlation/causation identifiers may be included for an explicit workflow, but no claim of global ordering or host-generated tracing is made. These values are controllable in tests.

**EVT-11 — Runtime validation where needed.** TypeScript is not a runtime validator. Host mappings and future external/cross-plugin inputs validate unknown data and schema versions before publication. Reject unknown keys/invalid values according to the declared contract and log a safe diagnostic. No arbitrary unchecked event name received from the outside is forwarded to subscribers. Internally constructed events retain compile-time checks plus the selected boundary invariant checks; avoid redundant heavyweight schema engines for simple scalar payloads.

## 6. Obsidian bridge

Obsidian exposes supported event sources with `EventRef` registration and removal. Use those APIs, not monkey-patching `trigger`, inspecting private listener maps, or replacing the host's event system. [S06, S08]

**EVT-12 — Explicit mapping.** The initial bridge supports these named mappings, with documented payloads and fixtures:

| Host source | Typed event | Payload intent |
| --- | --- | --- |
| `vault.create` | `host.vault.entry-created` | Normalized path and file/folder kind. |
| `vault.modify` | `host.vault.entry-modified` | Path and available scalar revision/mtime information; no content read. |
| `vault.rename` | `host.vault.entry-renamed` | Old/new paths and file/folder kind. |
| `vault.delete` | `host.vault.entry-deleted` | Last path and kind, captured before retaining no host object. |
| `workspace.file-open` | `host.workspace.file-opened` | Path or null when no file is open; no `TFile` escape. |
| `workspace.active-leaf-change` | `host.workspace.active-view-changed` | Small supported context snapshot; no leaf reference. |
| `workspace.layout-change` | `host.workspace.layout-changed` | Invalidation signal, not serialized workspace layout. |
| `metadataCache.changed` | `host.metadata.changed` | File path and minimal change signal; discard raw content/cache arguments. |

Validate the exact overloads and nullable cases against the selected current public API during implementation. Map folder events correctly instead of casting every abstract file to a `TFile`. Register only the supported allowlist, with optional noisy mappings configurable; no blanket interception of all host events.

**EVT-13 — Startup and unload.** Obsidian can emit `create` for existing files during vault initialization. By default the bridge registers its live-change handling after `workspace.onLayoutReady`, and does not present startup enumeration as new user activity. A plugin loaded after readiness still initializes correctly. [S07]

A deferred readiness callback must check whether its runtime was already disposed before registering anything. Where the API does not offer a cancellation handle, an owned disposed flag remains necessary. Use `registerEvent` for plugin-lifetime host subscriptions; early bridge disposal removes owned refs through the supported API. Double disposal and subsequent host cleanup are safe and tested.

No expensive initial scan is introduced just to seed the bus. Views query current application/host context explicitly, then subscribe using a tested snapshot/subscription sequence that does not lose intervening updates. The bus remains transient rather than a replay store.

**EVT-14 — Directionality.** Native notifications flow into normalized plugin events. Plugin actions call Obsidian through application/host adapters; they must not trigger a native built-in event to simulate the action. Publishing `host.vault.entry-renamed` does not rename a note.

Optional outward cross-plugin integration is a separately versioned adapter using plugin-ID-prefixed public names and runtime validation. It is off by default, has its own type declarations and cleanup, and does not republish the entire internal catalog or cause inward/outward echo loops. It is not necessary to satisfy the initial typed-bus requirement.

## 7. Developer integration

**EVT-15 — Maker and lifecycle helpers.** `make event` adds a feature-owned contract/descriptor, catalog registration, and type/validation tests. `make listener` adds a typed subscriber, its injected dependencies, explicit ownership registration, and disposal/error tests. No global `on` calls at module import time.

A Vue helper subscribes to the injected facade and uses the component/effect scope for automatic unsubscribe. Native view close also unmounts the Vue root; plugin unload disposes runtime listeners. Do not dispose the shared bus when one leaf closes. Late asynchronous handlers must not update an already disposed view.

The supplied example uses the bus for real committed item-change notifications between two views. The host bridge also has a real, non-destructive example consumer, such as updating the shell's active-note availability context; it does not create notes or log their contents to demonstrate activity. Event-inspection tools belong in the harness/diagnostic layer, not mandatory end-user chrome.

## 8. Test contract

**EVT-16:** Required evidence includes unknown name/wrong payload compile failures; duplicate descriptors; correct union correlation; snapshot isolation; listener add/remove during delivery; once with reentrancy; sync throw and async rejection isolation; ordering; disposal and outstanding work; two plugin instances; two views; save-failure/no-event and save-success/event ordering; bridge path/null/folder mappings; startup create suppression; unload before readiness; rename echo handling; bounded storm/diagnostic behavior; and a generated event/listener scenario running through the real bus.

The harness uses the production bus implementation with a fake host event-source adapter. Contract tests prove the fake's declared behavior; native acceptance separately verifies actual Obsidian delivery and cleanup. No mock event bus may claim to prove the implementation's error/lifecycle semantics.
