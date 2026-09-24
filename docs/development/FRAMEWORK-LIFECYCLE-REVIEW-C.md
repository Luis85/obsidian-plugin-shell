# Independent review C: retained Task actions and operation permits

Review read the actual diffs in `use-task-repository.ts`, `note-repository.ts`,
the author-facing action scope, `retained-task-actions-components.test.ts` and
`note-operation-permits.test.ts`. This is a separate review of A's implementation,
not a restatement of its summary. Parent owns the final execution receipt and
acceptance linkage.

## Findings and corrections

The original `RETAINED-C66` title claimed live-owner explicit reload recovery,
but its assertions only exercised a disposed reload and a direct repository read.
A narrowed that title and added `RETAINED-C66-REVIEW`: an actual uncertain write
saves changed bytes while suppressing the committed fact; the live editor blocks
another save, explicitly reloads those bytes, clears selection, obtains a newer
snapshot with the same identity, and persists a deliberately reviewed edit using
the exact previously saved bytes. The separate disposed recovery assertions remain.

The new generation invalidation contract also needed an assertion beyond simple
owner disposal. A added `RETAINED-C62-CONTEXT`: pause actual Task preflight, change
the configured folder away and back, release preflight, and require zero writes,
the disposed permit outcome, unchanged canonical bytes and no stale editor
resurrection. The live sibling retains its separate draft and explicitly reloads.
These were assertion gaps; review found no additional production correction
necessary in those two paths.

A's qualified development run `reports/framework-lifecycle/a-green-01.log`
passed 34 tests across seven files, including all 15 retained-action component
cases and six independent entity permit cases. Both review-added controls passed.
This targeted pre-freeze receipt does not replace final source-bound qualification.

## Adversarial behavior inspected

- Retained edit/reload/save/delete handles call the actual composable. Repository
  and adapter spies call through. Frozen state, snapshot reference/revision and
  acquisition counts prevent deduplication or detached DOM listeners from hiding
  an absent entry guard.
- Disposing during awaited read/preflight returns before replace/trash. Closing
  after persistence begins preserves committed, failed and uncertain results,
  exact bytes, committed-fact suppression and exact independent caught faults.
  The operation permit authorizes starting work; it does not cancel a host write.
- The repository checks permits before cached mutation replay, before queued
  preflight and after awaited preflight. The distinct `experiment` entity proves
  these contracts without Task/Project branches and remains useful after example
  removal. Queued disposed work starts no additional preflight read.
- Sibling Task projection remains explicitly reloaded. Tests first preserve its
  original row, then reload durable bytes; they do not claim Items-style automatic
  projection refresh. IDs, paths, original body/properties and independent drafts
  are asserted separately from operation outcome.

No whole acceptance or native claim follows from this source review. Current
qualified execution, generated-consumer preservation and all-mode closure remain
the parent's integration responsibility. Review-added assertions require their
own observed producer output before they become evidence links.
