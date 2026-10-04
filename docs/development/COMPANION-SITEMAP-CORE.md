# Companion sitemap authoring core

**Status: implemented core and read-only CLI integration; not the completed Journey Lens port or JSON-to-clickdummy MVP.** See the [execution record](../_archive/testing/MVP-SITEMAP-CORE.md) and [MVP plan](../prds/MVP-IMPLEMENTATION-PLAN.md).

## Current integration

`scripts/companion/sitemap/` contains framework-free TypeScript over the existing `design.nodes`, `design.links` and `design.canvas`. It does not create a competing page database, browser storage writer or native persistence service. `project inspect` uses the same core for an additive `data.sitemap` summary after the existing project/compiler intake:

```sh
node bin/app project inspect --input my-plugin.companion.json --json
```

The summary reports surface/native-view/page counts, hierarchy and navigation counts, explicitly declared routes/journeys/features and journey findings. `acceptance` is `structure-only-not-product-acceptance`. Inspection writes nothing and exports no private authoring preimages.

The complete transport is **project schema 6**, which carries the `sitemap`, `features` and `editors` subsystems; earlier versions are rejected and never migrated. A host must continue to apply the full project validator; the structural core cannot authorize saving an otherwise invalid project.

## Source provenance and differences

The Journey Lens source is already retained at `docs/concepts/sitemap-editor/` on PR #5's inspected commit `6178b1025336941ad6fb10eae4e26930622363f9`. Its source subtree is `c6f57137c2d182b875b376fa5d77f397c356d85c`. This resolves the earlier plan's source-location uncertainty; it does not establish byte identity with the Library ZIP whose raw materialization was unavailable.

| Retained source | Git blob |
| --- | --- |
| `src/domain/model.mjs` | `184c66e25732a146868c0f6161d77f2bcf4e6623` |
| `src/composables/useSitemap.js` | `71013d130f86d450877959d9667c33372addd538` |
| `src/components/SitemapEditor.vue` | `7cbb649214b8488abc9183858f7edb3c1ce12ffc` |
| `README.md` | `2e369a88e34c6bce1b6d068ad3fb22ddf5927ea3` |

Its README explicitly says that the Vue/Nuxt UI/Vue Flow source was not built or browser-qualified; the separate vanilla review is not evidence for the requested stack. The native core reimplements the relevant behavior against companion identities instead of copying that prototype's independent `pages` store and localStorage ownership.

Retained behavior: arrange versus reparent, route-preserving moves, named parameter route patterns, context navigation and journey references. Deliberate changes: native view/page/group/modal/settings/action distinctions; the companion's current 60-surface/120-transition/4 MB bounds; preserved unresolved journey steps rather than silent journey deletion; blocking removal when other companion subsystems still reference the target. The standalone editor's 500-page bound does not silently raise the complete project's limit.

## Modules

| Module | Responsibility |
| --- | --- |
| `model.ts` | Structural types, commands, extensions and current limits |
| `safety.ts` | Bounded inert JSON and exact private equality keys |
| `extension.ts` | Route/journey/feature field, ownership and dependency validation |
| `validate.ts` | Native hierarchy, reference and coordinate invariants; readiness findings |
| `commands.ts` | Detached candidate edits and conservative reviewed leaf-removal impact |
| `projection.ts` | Separate hierarchy/navigation/journey projections and context IDs |
| `transaction.ts` | Recomputed reviews, stale checks and bounded undo/redo candidates |
| `session.ts` | Per-view lifecycle and canonical persistence port; no concrete writer |
| `summary.ts` | Read-only CLI diagnostic projection |

The core supports move/reorder, rename, arrange, route/journey/feature upsert and reviewed leaf removal. It does **not** yet implement the complete editor command catalog: creation, duplication, link editing, route removal and broader feature/journey editing still require the UI/compiler integration increments. No generated HTML or native editor mount is added by this core.

## Structural and navigation semantics

Surface identity and parent remain on `design.nodes`. Explicit routes refer to a native view or internal page and never derive from parent or canvas coordinates. Route paths support static and complete named parameter segments such as `/projects/:projectId/tasks`. Equivalent parameter patterns collide regardless of parameter name. Paths with queries, fragments, encoded segments, traversal, partial parameter segments, repeated parameter names or external protocols are not accepted by this initial local-route contract. Static `/projects/new` and parameterized `/projects/:id` are distinct; runtime matching precedence belongs to the upcoming compiler, not this validator.

Feature records group existing surfaces, existing requirements and reusable components. A surface has at most one owning feature; components can be shared. Entry points must be owned non-group surfaces. Feature dependencies must exist and form an acyclic graph.

A journey step names an existing surface and optionally its incoming `design.links` ID. Hierarchy is never an executable journey edge. The first step has no incoming transition. Missing links, reversed transitions and data-only edges cannot masquerade as navigation. Explicit unresolved planning references retain last-known labels; missing transitions and prose conditions appear as findings rather than successful executable behavior. Modal stack/return compilation remains later work.

The projection preserves all canonical node IDs. Its display-edge IDs are not persisted as new transitions. Search marks matches without changing the document; contextual parent, siblings, children, incoming/outgoing and breadcrumb values are references to the same saved surfaces.

## Reviews, deletion and history

Commands validate their input and operate on a detached candidate. Identical output returns the original object, enabling actual no-op handling. Arrange changes only explicitly initialized canonical canvas positions. The sitemap semantic key excludes canvas positions but is **not** the complete compiler plan hash.

Before removing a surface, call `planSurfaceRemoval`. It reports children, transitions, routes, journey references, owning features and conservative external-reference locations. Children and references in PRDs, visual designs, sources, canvas anchors or retained payloads must be resolved by their owner first. The core does not auto-delete other editors' records or cascade-remove branches.

A reviewed leaf removal removes its direct transitions/routes and ownership references but retains affected journey steps as explicitly unresolved. The plan binds to the exact private whole-design preimage. Any edit after review invalidates it.

Private `beforeKey`, `afterKey` and removal `review` strings contain authoring content. They are local equality preimages, not cryptographic signatures, portable approvals or publishable diagnostics. Do not log or export them. Their bounded escaped review budget is separate from the unchanged 4 MB document limit.

Undo/redo retains exact candidate snapshots, validates them again and refuses concurrent changes. History is bounded to 20 entries and an 8 MB private history budget; eviction is reported. Current published component revisions are never removed to create undo capacity. The complete-project validator still decides whether a restored snapshot can be saved.

## Canonical persistence adapter

`SitemapSession<T>` is a per-view controller, not another canonical data owner. Bind its projections to Pinia during WP-02, and implement `SitemapHost<T>` through the existing document/application services during native integration:

```ts
interface SitemapHost<T extends SitemapDesign> {
  read(): Promise<SitemapSnapshot<T>>;
  validate(design: T): void;
  save(request: {
    expectedRevision: string;
    beforeKey: string;
    design: T;
  }): Promise<SitemapSaveResult<T>>;
}
```

The host must validate the complete project, serialize writes through its existing owner, recheck revision and preimage immediately before persistence, and return a truthful result. This interface does not turn a naive localStorage writer into a safe transaction. It is not a claim of cross-process filesystem atomicity.

Only `committed` moves the session's snapshot/history forward. A known unchanged failure preserves them. A conflict or uncertain result blocks further writes until explicit reload from a reconciled canonical owner. Read-only host state remains read-only after reload. Unexpected exceptions are not automatically retried or exposed as raw private content.

Disposal prevents view updates and new operations but cannot relabel a write already committed by the host. A committed result with a mismatched observation is reported as committed plus required reload, not as a failed save. The host owns committed-fact publication even when the initiating view has closed.

## Verification and next integration

```sh
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.sitemap.json
node --test --test-concurrency=1 tests/tooling/companion-sitemap-*.checks.mjs
```

These test filenames already belong to the existing companion test-suite pattern. The existing framework CLI workflow adds the strict typecheck and complete sitemap suite on Linux, Windows and macOS without changing its existing checks or permissions. The four checkout-level cases exercise the actual self-project, all starters and real `project inspect`; they are distinct from the dependency-free local unit tests.

Next: mount the real Vue editor through existing companion composition, use canonical IDs and per-view projections, coordinate v6 migrations/exporters, regenerate the self-project and implement the compiler/capability paths. Browser/native behavior, the full clickdummy and complete MVP acceptance remain unqualified by this core's tests.
