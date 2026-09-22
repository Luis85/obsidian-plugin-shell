# Iteration 02 implementation checkpoint

Baseline: main e64e75eefb22822356cb2473b77eadee35871beb (2026-09-22), including the npm EALLOWSCRIPTS repair. Dedicated branch: build/iteration-two. No merge, tag or publication is authorized.

- [x] Inspect current main, AGENTS, README, package metadata, existing verification and npm policy repair.
- [x] Capture real baseline: Node 24.21.0/npm 11.19.0 npm ci, verify and selected-core coverage passed; full diagnostic analyze exited 1. Current audit: one low esbuild advisory GHSA-g7r4-m6w7-qqqr.
- [x] Reproduce served baseline on hosted Chromium: all eight existing E2E tests passed. Local browser navigation was policy-blocked; it is not evidence.
- [x] Implement full-width leaf-scoped layout, aligned gutters, select metrics and responsive panels.
- [x] Implement persisted isolated native-header preference, recovery command, per-view lifecycle and explicitly labeled harness simulation.
- [x] Add behavioral regressions: local 43 tests / eight files, typecheck, lint and source/locale checks pass. First development build passed; this is not yet accepted native evidence.
- [ ] Review/fix remaining architecture, reliability, dependencies and verification gaps.
- [ ] Verify final candidate, capture real screenshots and hashes, record unavailable matrices honestly.
- [ ] Final committed source, installable candidate, sanitized evidence and handover.

Environment: local Linux Node 22.16.0/npm 10.9.2; GitHub/npm DNS unavailable locally. Source recovered from the exact baseline GitHub Actions source archive. Hosted verification provides network-dependent checks. Historical runs remain baseline context, not Iteration 02 evidence. No user working tree was mounted; main is the source of truth. Existing setup security configuration is preserved.

Research checkpoint: ESLint 10.11.0 installs and runs actual existing rules successfully. A nested ESLint 9 remains in Obsidian lint dependencies and requires further investigation. Ordinary supported parent updates leave fontless 0.2.1 pinning vulnerable esbuild 0.27.x; latest @nuxt/fonts 0.14.0 still depends on that line. No override has been applied. TypeScript 7 is not compatible with the current typescript-eslint peer range; retain supported 6.0.3.

Implemented reliability fixes: queued preferences snapshot callers and serialize functional toggles; external commits merge only into clean preference fields; native notice failure leaves one inline localized fallback; uncloneable event data and rejected preference/diagnostic listeners are contained; initialization/disposal restore plugin-owned header markers and stop view-owned subscriptions.

## Resumed implementation checkpoint

Recovered exact remote 2b995b5 and its failed native/source/dependency artifacts. Local recovery used Node22.16.0 and the reviewed hosted dependency modules, not a new npm ci. Implemented pop-out theme ownership, async notification isolation, unused-preview release, in-flight/uncertain state protection, atomic complete build promotion, serialized watch/install, exact source snapshots, full analyzer gate and negative lint/analyzer fixtures. Adopted the reviewed ESLint10.11.0/esbuild0.28.2 lock with a narrowly scoped fontless override and version-specific lifecycle approvals. Version is now 0.2.0.

- [x] Full local verify, strict linters/types/source gates, 51 runtime tests, retained52×3 baseline and harness build.
- [x] Separate core and whole-production coverage; no false whole-codebase percentage.
- [x] Real local served attempt recorded as navigation-policy infrastructure failure.
- [x] Review/fix record, updated commands and explicit security classifier.
- [ ] Commit exact source/lock and execute final hosted fresh-install, served/native/audit and Windows setup matrix.
- [ ] Record final candidate hashes/results; package accepted assets unchanged; source/evidence and pull request.

The temporary recovery workflow only creates a verified Git blob. It must be removed before the final candidate; no force update, main merge, tag, release or registry publication is permitted.
