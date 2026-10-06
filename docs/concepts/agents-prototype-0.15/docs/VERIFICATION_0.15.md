# 0.15 verification report

**Date:** October 5, 2026  
**Application / manifest:** 0.15.0  
**Persisted schema:** 1.4.0  
**Input:** agents-prototype-source(2).zip

## Release status

The refactor is implemented and packaged as source. The dependency-light core and static checks below passed. The complete application is **not** verified as buildable or visually correct in this environment, because its npm dependencies could not be installed. There is no built dist directory, self-contained 0.15 HTML bundle, installable Obsidian plugin or newly captured full-app screenshot in this delivery.

The blocked checks are included as executable scripts/tests, not marked as passing. This distinction matters: preserving geometry construction source does not prove that renderer integration is correct, and compiling isolated Vue templates does not exercise Nuxt UI or Pinia.

## Executed checks

| Check | Result | Scope |
| --- | --- | --- |
| Architecture/static boundary checks | Passed: 85 source files, 299 imports | Inward layer dependencies, resolved source imports, no domain barrel, no infrastructure construction in stores, no empty catches, factory budget |
| Syntax and local import checks | Passed: 109 files, 306 local imports | TS/JS parser and Vue script sections; no external dependency typing |
| Strict core compilation | Passed: 42 TypeScript modules | Domain, application, browser persistence/services, pure catalog and formatter modules; TypeScript 5.8.3 |
| Native Node core tests | Passed: 96 tests, zero failures/skips | Commands, validation, migration, persistence ordering/errors and pure editor/catalog rules |
| Model source parity | Passed: 17 contracts | Normalized authored bodies compared with the supplied source; does not load Three.js |
| Schema generation consistency | Passed: two schemas | Workspace and character-pack schemas regenerated from runtime shapes |
| Isolated template syntax | Passed: 19 templates, zero warnings/errors | Locally available Vue 3.5.13 global compiler in headless Chromium; not the declared Vue dependency version |

Raw evidence is retained under `docs/verification/`: `core-check.log`, `template-syntax.json`, and explicit failed command-attempt logs.

### Core test coverage

Command tests exercise frozen/readonly input, detached transitions, injected IDs/time, equivalent deterministic inputs, snapshot-before-version-increment, missing agents, invalid labels, identifier collisions, bad clocks and rollback after dependency exceptions. Relation tests cover missing targets, duplicates, self-links and inheritance cycles. Character tests cover reusable styles, preserving operational authority, portable packs, collision remapping and proxy-safe cloning.

Codec tests cover representative supported legacy schemas, snapshot migration, unsupported versions, malformed nested data, wrong categories/parts/accessories, duplicate identities, dangling references, prototype-related keys, cycles and oversized text. These are synthetic fixtures based on the supplied seed, not proof against every historical user file.

Persistence tests cover absent storage versus absent key, valid round-trip, corrupt bytes left untouched, denied access including property getters, quota failures, generic read/write exceptions, invalid data rejected before overwrite, migration without automatic write, write ordering, detached queued snapshots, recovery after rejected saves, oversize reload protection and typed snapshot-copy failure. Pure editor checks retain the 15 models, 49 part definitions, four embodiment categories, built-in style/pack catalog and 11 configuration sections.

### Renderer contracts

The factory dropped from 662 to 70 lines. Five silhouette construction bodies, face helpers, material finish properties, accessory/pattern algorithms and transform/animation bodies were compared against the original source after syntax normalization. The original factory SHA-256 and per-contract fingerprints are in `tests/fixtures/model-builder-contracts.json`. Changes to extraction helper names are explicitly listed.

That check catches unintended edits during decomposition. It does not measure visible bounds, GPU leaks, picking, transparency, framerate, shadows or screenshots. Those depend on running the actual renderer.

### Template findings corrected

The local template check found a closing-delimiter collision caused by inline `{{slug}}` replacement inside Vue interpolation. Runtime target formatting now lives in a typed helper. Character attribute key lists now live in script constants rather than template type assertions. All 19 templates passed the same local syntax check afterward.

## Blocked checks and evidence

| Command/check | Observed outcome |
| --- | --- |
| npm install | Dependency download did not complete; registry access was unavailable in this container |
| npm run test:templates | Exited 1: installed Vue/compiler-sfc package missing |
| npm run typecheck | Exited 127: vue-tsc not found |
| npm test | Exited 127: vitest not found |
| npm run build | Exited 127 at vue-tsc; Vite production bundling never started |
| Actual Pinia integration suite | Added eight cases; not executed here |
| Actual Three.js geometry/rig/animation/turntable suites | Retained and rewired; not executed here |
| Material lifecycle suite | Added 16 model/material ownership cases; not executed here |
| Full browser/editor/WebGL visual regression | Not performed; no rendered 0.15 visual approval claimed |
| Obsidian/Vault integration | Out of scope; no adapter implemented |

The local compiler used for core checks was TypeScript 5.8.3, while package.json retains the supplied ^5.9.0 range. The isolated browser compiler was Vue 3.5.13, while package.json retains ^3.5.43. Neither local fallback is represented as exact-version application verification.

## Required acceptance run after dependency installation

```sh
npm install
npm run check
npm run dev
```

Commit the generated lockfile after dependency resolution and successful checks. Run the manual editor/rendering checklist in `design-qa.md`, including full 360-degree rotation, all silhouettes and part selections, switching away from appearance to skills, repeated model rebuild/disposal, save/reload, corrupt-storage recovery and invalid imports. Use the actual target browsers and viewport sizes.

For a production build, also inspect the built output, reopen the workspace through the served build, repeat key persistence operations, and verify that the current Vue editor—not the legacy standalone page—is served.

## Explicit remaining limitations

Field-level form edits still mutate the reactive draft directly; only application commands return transactional states. Whole-state cloning and validation can become expensive for large workspaces. Multi-tab browser concurrency is not coordinated. Unmount cancels scheduled autosave, not an already-started repository write. The runtime codec is authoritative for cross-entity rules not expressible in the generated structural schema. Old design screenshots are historical. Plugin manifests and configured Vault paths do not constitute an implemented Obsidian persistence adapter.
