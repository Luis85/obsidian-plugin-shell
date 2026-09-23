# Runtime authoring independent review

Implementation and review used separate actual subagents in the shared isolated
worktree. The event owner implemented contracts/tooling; the item owner implemented
the reference workflow. A third worker performed bounded native diagnosis, then
independently reviewed item lifecycle and parent integration. The item owner
independently reviewed the event owner's actual diff. Source review and executed
regressions remain distinct evidence.

| Finding | Correction | Evidence responsibility |
| --- | --- | --- |
| A confirmed delete could continue after its initiating view closed | Recheck owner activity after confirmation and immediately before repository deletion | Independent real-service reproduction passed against the correction; exact regression retained in items lifecycle test |
| A narrowed observer could still acquire arbitrary descriptors | Public observers expose only typed on/once; bootstrap injects descriptor-scoped subscribers separately | Actual compiler negatives and generated real-bus tests |
| An unregistered same-name descriptor could shadow the catalog payload type | Reject ambiguous distinct source contracts before selecting payload text | Actual checker negative fixture and independent reinspection |
| Validation preceded cloning, so an accessor could change the delivered payload | Validate the isolated snapshot before delivery | Adversarial real-bus regression and independent reinspection |
| Event tests assumed only built-in runtime registrations and retained removed showcase facts | Separate built-in fixtures from composed consumer catalogs and use retained core facts | Generated consumer and removed-example qualification |
| A foundation test supplied observer-only services to a publishing repository | Give the test-owned repository a production bus and assert actual committed facts and no diagnostics | Foundation compiler/runtime verification |
| A browser cleanup baseline preceded lazy acquisition of the surviving view's item store | Compare initialized views, assert no growth across navigation, exact sibling cleanup and zero on final disposal | Independent source review and corrected full served suite |
| A negative fixture's string replacement became a no-op after formatting | Use whitespace-tolerant mutations and assert source bytes actually change | Actual compiler/checker controls pass; first failed attempt retained |

Parent integration also corrected type variance at narrowed repository publication
boundaries using typed forwarding functions, and changed a UI fault injection to
the actual injected ping action. No unsafe cast or broad publication capability
was added to repair those failures.

Review covers architecture/type boundaries, one-writer persistence and stale/
uncertain outcomes, multi-view drafts and cleanup, generated-consumer/removal
compatibility, author-facing copy and evidence claims. No conclusion here certifies
unexecuted host/device/manual scenarios. The historical Windows comparison is
documented separately in the [native diagnosis](../testing/RUNTIME-AUTHORING-NATIVE.md).
