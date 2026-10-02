# Reconciled fixture and relationship generation

This increment integrates the local review patch based on `dcbddab` into PR #21 after `7aa7507` and the PR #5 integration snapshot `70ae93e`. It does not replace the newer branch with the older review archive.

## Integration decisions

| Local review capability | Reconciled implementation |
| --- | --- |
| Shared browser/compiler manifest | `scripts/companion/test-data-manifest.mjs` now supplies browser preview and the existing `fixtureManifest` / `fixtureCode` entry points. There is no second compiler. |
| Executable recipes | The existing `testdata:*` command family remains canonical. `testdata:check` performs read-only reproducibility checks and joins generated project verification. |
| Native snapshot operations | `noteEntity` and canonical note metadata describe seeded notes separately from operation DTOs. Nested record/revision responses are not serialized as note frontmatter. |
| Typed fixture ports | Generated factories under the configured tests root cover every API/database source method; disabled/missing recipes reject instead of reaching production. Existing `createProjectTestPorts` remains available. |
| Relationship guard | The PR's existing session/wrapper and strict post-mutation graph validation are retained, with defensive value capture, shared read-only audits, unload disposal and the complete connected native graph. No parallel guard implementation. |
| Provider validation | Keep the PR's stricter complete-source override validator (including extra methods and prototype checks) and HTTPS provider lifecycle. |
| Responsive composition and styles | Preserve current captured revisions, responsive layouts, UI effects and scoped Design System compiler. |
| Verification | Retain current tests, add browser-download/manifest parity and generated-provider tests, and qualify a separate synthetic provider project alongside companion/boundary projects. |

The local review's lenient exception for newly created targets missing a required inverse link is **not** adopted. The existing strict whole-graph policy wins: every committed candidate must satisfy declared cardinalities. Required cycles still need an explicit multi-record transaction. This avoids changing product integrity semantics merely to resolve a merge.

## Fixture workflow

After explicitly installing the generated project's dependencies:

```sh
npm run testdata:check
npm run testdata:plan
npm run testdata:apply -- --approve REVIEWED_PLAN_HASH
```

Generation and `testdata:check` do not seed notes or start a server. Apply writes only within the project's `.test-vault`, under the retained receipt/approval rules. Reset uses `testdata:reset-plan` followed by `testdata:reset -- --approve REVIEWED_RESET_HASH`; unrelated or edited files are not silently removed. Never treat fixture revision examples as live snapshot leases.

The translator shallowly validates every top-level design member but copies only `dataSources` and `semantic`, the subtrees it reads, so large unrelated authoring state (for example the 80-design self-project in live browser state) cannot exhaust the bounded recipe input budget. Oversized recipe/entity input still fails. Browser optional undefined object fields are omitted as portable JSON would omit them. Accessors, executable values, symbols, sparse arrays, nonconstant dates and invalid recipes are rejected. Canonical Markdown metadata is emitted into notes without adding undeclared fields to API/application payloads.

## Integrity lifecycle

`createRelationshipIntegrity(shell)` returns a shell-scoped session shared by adapters; `audit()` reports graph findings without writing. The connected read-side graph is included so inbound references are not omitted from an audit. Unload disposes the session and blocks queued writes. A defensive snapshot captures scalar/string-list note values before queueing, and the canonical repository receives those same captured values. Caller edits cannot change the checked write.

Original repository plans retain identity and duplicate-request results. A rejected preflight discards only an unused preparation. An uncertain attempted commit is not retried or discarded. These protections are in-process, not a vault-wide atomic transaction; direct repository/native/external writers can bypass preflight.

## Verification scope

Local checks use Node 22.16.0 and the installed browser. Hosted qualification uses the repository's pinned toolchain; results are recorded on the PR for the actual pushed commit. The additional provider fixture is synthetic, not the companion's authored business acceptance. Requirement TODOs, native Obsidian acceptance, full release qualification and publication remain separate.

The analyzer integration repair classifies the exact fixture compiler before the general tooling zone and removes an unused internal HTTP export. No quality threshold or rule is suppressed. The concept HTML is rebuilt from the current source assembly, not copied from the older review archive.

See [providers and relationships](GENERATOR-PROVIDERS-AND-RELATIONSHIPS.md), [generator use](COMPANION-GENERATOR.md), and [declarative actions](GENERATOR-DECLARATIVE-ACTIONS.md).

## Project Starters integration

The concurrent PR #5 Project Starters catalog and all nine qualification jobs are retained. Built-in native list sources now use generated canonical read adapters, so starter tests execute those adapters and assert cancellation instead of requiring an obsolete placeholder. The HTTPS starter is still blocked until runtime origin approval. The Tasks starter uses `starter-task` and `starter-project` canonical keys to coexist with retained framework examples; its user-facing names and route slugs are unchanged. Catalog integrity metadata and embedded prototype bytes are regenerated together. This updates the built-in design only; no existing consumer workspace or vault is migrated.

## Baseline patch integration

The residual baseline-patch port, the relationship-policy decision and the verification record are in [the integration record](GENERATOR-BASELINE-PATCH-INTEGRATION.md).
