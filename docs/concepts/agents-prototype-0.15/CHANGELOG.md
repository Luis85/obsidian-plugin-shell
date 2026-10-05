# Changelog

## 0.15.0 — architecture and persistence refactor

### Application boundaries

Introduced StateRepository, Clock and IdGenerator ports and browser-only composition. Removed the flat domain barrel and infrastructure creation from Pinia. Moved presentation catalog metadata, editor categories and requirements copy out of the domain. Agent and character commands now work against readonly input and return detached state transitions through a typed Result.

### Persistence and imports

Added load/save diagnostics for absent storage, access denial, quota exhaustion, corruption, unsupported schemas and invalid data. Added explicit recovery authorization before replacing unreadable data, serialized async writes, debounced autosave, save-revision tracking, startup coalescing and disposal cleanup. Browser saves reject workspaces larger than the reader's supported limit. JSON Studio preserves local drafts when live data changes and validates before apply. Character-pack import reports errors and remaps colliding identifiers.

Introduced complete nested runtime shapes, semantic reference and recipe validation, explicit supported-version migration and generated workspace/pack JSON schemas. Kept schema 1.4.0 and the existing storage key.

### Three.js construction

Reduced CharacterModelFactory from 662 to 70 lines. Extracted HumanModelBuilder, QuadrupedModelBuilder, BirdModelBuilder, HeadModelBuilder and ObjectModelBuilder, plus face, accessory, pattern and material helpers. Preserved the authored construction, rig, animation and turntable bodies in 17 static parity contracts. Added owned, idempotent resource disposal, including previously untracked template materials and stage decorations.

### Integration corrections

Replaced the stale inline index.html with the actual Vue entry. Added the documented Nuxt UI Vue plugin and Tailwind/UI CSS integration. Moved runtime-path placeholder replacement out of template interpolation, avoiding a closing-delimiter collision. Replaced template-level attribute casts with typed script constants.

### Verification

96 native core tests passed, along with strict compilation of 42 dependency-light modules, architecture checks, local-import/syntax checks, 17 model-source parity checks and two generated-schema checks. All 19 templates compiled with the locally available Vue 3.5.13 browser compiler. That compiler is not the package's declared Vue version.

The updated and expanded Vitest suites, full vue-tsc check, installed-version SFC compiler and production build remain unexecuted because the required dependencies could not be installed here. No full browser/WebGL visual regression pass is claimed.
