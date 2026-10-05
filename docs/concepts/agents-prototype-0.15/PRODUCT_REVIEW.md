# Product review · 0.15

## Implemented against the requested findings

| Finding / priority | Change | Evidence and remaining gate |
| --- | --- | --- |
| Large CharacterModelFactory | 662 → 70 lines; five silhouette builders and dedicated composition helpers | 17 preserved-source contracts pass; actual geometry/visual suite blocked |
| Pinia creates infrastructure | Injected AgentsContext and browser composition root | Architecture rules pass; actual Pinia integration tests added but blocked |
| Hidden clock and IDs | Clock/IdGenerator application ports with concrete browser services | Deterministic and failure/rollback core tests pass |
| Silent persistence errors | Typed diagnostics, visible status panel and explicit recovery authorization | Repository/coordinator tests pass; full browser recovery flow still needs acceptance |
| Broad dependency direction | Removed flat domain barrel; explicit leaf imports and layer guardrails | 85 source files checked |
| Catalog/domain mixing | Domain rules separated from labels/copy/editor categories and catalogs | Strict core compilation and catalog tests pass |
| Direct shared application mutation | Readonly inputs and detached state transitions | Frozen-input/rollback tests pass; form-level v-model remains intentionally mutable |
| Weak migration/import validation | Nested schemas, explicit version dispatch, reference and recipe checks, pack remapping | Core tests and generated-schema checks pass; real historical user-file corpus unavailable |
| Integration regressions | Corrected real Vite entry and Nuxt UI wiring; fixed template delimiter collision | Local template checks pass; installed-version production build blocked |

## User-visible outcome

The header distinguishes an in-memory browser session from a successful save and exposes diagnostics across views. A corrupt saved workspace is not silently replaced by defaults. Users can export the current session and explicitly choose replacement. JSON drafts survive unrelated live edits and cannot be applied when invalid. Pack imports provide visible failure feedback instead of disappearing into empty catches.

The existing editor and character style are retained, rather than redesigned as part of a structural refactor. Catalog and model numbers remain unchanged. Resource ownership is explicit so repeated character/stage rebuilds can release materials and geometry.

## Handover decision

**Accept as an implemented source refactor with passing core/static evidence. Do not approve as a fully tested executable release yet.** Run the included full validation command and manual acceptance checklist after installing dependencies. Obsidian persistence, full command-based editing, undo/redo, multi-tab conflict handling and large-library performance remain separate work.
