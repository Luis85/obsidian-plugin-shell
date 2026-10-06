# Iteration 04 — reusable template completion plan

Baseline: `d755745668974820ff4dbcdd0b9f8bfeec307ec3`, confirmed merged PR #3.
Main is clean; implementation belongs to `build/template-foundation` in
`.worktrees/template-foundation`. No `.codex/` instructions exist at baseline.

Implementation and independent correction waves are complete. Final qualification
uses a frozen code commit; the [execution record](../testing/ITERATION-FOUR.md)
contains actual results and the [review record](ITERATION-FOUR-REVIEW.md) records
the reproduced findings. Maintained source and generated-consumer qualification
remain distinct acceptance inputs.

## Gap inventory

| Requirement | Baseline state | Work package / acceptance |
| --- | --- | --- |
| Entity definitions, Markdown CRUD, runtime services, identity/resume | Implemented with prior evidence | Preserve APIs, real services and all existing gates. |
| Full maker catalog, domain-only entities and composed UI features | Partial: note feature/entity only | A: all named recipes, explicit integration, prerequisites, safe plans, useful generated tests, custom local registry, formatted staged output. |
| Optional examples | Missing automated removal | B: reviewed hash-bound removal preserving edited/user source, minimal plugin and new generated feature fully qualified. |
| Plugin-data entities | Missing | C: typed explicit backend; shared serialized preference/entity writes; schema preservation, revision conflicts, uncertain-write lockout, disposal and committed events. |
| Quality tool adoption | Partial: strong coverage/static gates | D: audit outstanding plan; qualify focused formatter, typed/test rules, properties, accessibility and selective mutation/style/docs/workflow checks with negative controls. |
| Nested ESLint support | Known upstream exception | D: inspect current compatible metadata; retain honest exception if unsupported peers remain. |
| Maintenance/fixed candidate release rehearsal | Missing | E: updater configuration, truthful freshness, version preparation, fixed-commit retained-asset packaging/provenance and read-only rehearsal. No publication/tag/permissions changes. |
| Physical/native/theme/device evidence | Partial prior Linux evidence | F: execute available current-candidate browser/native matrix; explicitly report unprovisioned devices/platforms. |

## Dependency order, ownership and verification

1. Parent establishes baseline, this plan, qualified local toolchain and integration.
2. Parallel implementation: authoring agent owns `scripts/makers/`, maker fixtures/tests and authoring docs; persistence agent owns new application persistence modules, preference integration, `src/features/api.ts`, service composition and persistence tests/docs; maintenance agent owns `scripts/maintenance/`, `scripts/release/`, new maintenance/release workflows/config/tests/docs.
3. Parent owns example-removal integration, quality configuration/dependencies, package scripts/lockfile, global registries/styles/locales and overall docs. Agents must request coordinated edits to shared files; no concurrent package/config mutations. All work uses this topic worktree, with disjoint ownership. Child agents do not commit or push; parent integrates the complete concern.
4. Parent and authoring agent agree explicit extension registries before UI generation/removal. Persistence public API stabilizes before backend generator integration. Composite makers reuse primitives and the existing safe-plan engine.
5. Independent review wave: reviewers inspect other agents' work, actual diffs and adversarial tests without relying on implementation narratives. Cover architecture, persistence, ergonomics/lifecycle, accessibility, tooling and release safety. Fix findings and polish before final qualification.
6. Run targeted tests per package, then complete `npm run verify`, served browser, live all-category security, fresh checkout/source archive, distinct identities, custom maker and edited/conflicting/rerun cases. Fully verify remove-examples then generate-business-feature consumer. Record static, coverage, synthetic, browser and native evidence separately. Keep all current numerical floors and complete production inventory.
7. Freeze accepted commit/assets, record SHA-256 and actual command results. Commit/push/open PR, attach it, and report URL/branch/SHA/checks/limitations; ask the owner for the next step. No release/tag/listing/permission/automerge action is authorized.

## Evidence policy

## Completion inventory

| Work package | Delivered scope | Remaining boundary |
| --- | --- | --- |
| A | Entire named maker catalog, primitive reuse, explicit native views/commands, typed data backends, local custom registry, formatting and real generated tests | Locale output is intentionally pending review; authors still supply their business requirements. |
| B | Reviewed removals/replacements, exact registration ownership, consumer preservation and a minimal UI/test/native-driver profile | Edited examples conflict and require author reconciliation; no force deletion or vault migration. |
| C | Typed plugin-data CRUD and one serialized preferences/entities writer; schema/JSON/revision/uncertainty/disposal/event guarantees | No cross-process CAS, ORM, query language or second Markdown authority. |
| D | Typed/test lint, generated formatter, seeded real-service properties, rendered accessibility, targeted guard mutation and bounded workflow/style/docs checks | Manual screen-reader/device evidence and broader optional external scanners remain separate. Nested ESLint support is upstream-blocked. |
| E | Dependabot/freshness, safe version preparation, frozen retained assets/provenance and read-only validated draft/promotion plans | Remote mutation is neither executed nor authorized; supplied review/native/remote records are not cryptographic attestations. |
| F | Existing deterministic/browser scope plus actual Windows native qualification and source/consumer paths | No unsupported claim for physical mobile, macOS or third-party themes. Final source/hash-bound evidence is recorded separately. |

Prior iteration results are baseline evidence only. Each package updates its
implementation/status/acceptance documentation. Failures, unavailable registries,
unavailable physical devices and unexecuted native scopes stay explicit. No
placeholder command, empty test selection, skipped checker or clean advisory
report constitutes support or acceptance. Source limits count code lines only
(400 source/scripts, 450 tests, 100 main). Preserve data and source on conflicts.
