# Iteration Planner — partial source transfer

**The PR now contains source code and executable domain tests, but the clickdummy cannot yet be built from this checkout alone.** Uploads of `source/planning.ts` and `source/app.ts` were blocked. `prototype.html` is not committed. Keep PR #45 in draft.

This concept is stacked on PR #5 (`docs/companion-plugin-prd`). The retry extends PR45 commit `14d55558fca71fb9bd2c9610c233d09d965fa781` without changing its base branch, production code or other concepts.

## Concept

Help an agile team plan a useful step, walk its iteration backlog daily, review what became usable, and improve its next iteration. The intended cadence is Monday planning, daily backlog walkthroughs, iteration review and retrospective.

The concept includes arbitrary backlogs; automatically indexed, goal-named iterations; descriptions and dates; people/capacity/reference resources; selected work and an agreed planning baseline; one increment report per iteration; and an approachable progress dashboard. Delivered work is distinguished from unfinished progress. Closing an iteration neither marks unfinished items Done nor automatically carries them forward.

Read [the design brief](design-brief.md) for requirements, defaults, journeys and open decisions, and [the transfer record](PUBLICATION.md) for exact limitations and evidence.

## What is committed

Fourteen of the original sixteen files under `source/` are present: the domain model, validation, commands, fixtures, shared UI helpers, overview dashboard, ceremonies, dialogs, styles, HTML frame, build script, package manifest, lockfile and TypeScript configuration. The complete 38-case domain suite is in `tests/domain.test.mjs`.

These source and test bytes match the previously delivered ZIP. They were not rewritten or replaced by placeholders. The missing planning and application modules prevent the UI from assembling. The standalone HTML, browser test script, screenshots and full package handover metadata have not been transferred.

## Run the committed domain tests

From the repository checkout:

```sh
cd docs/concepts/iteration-planner/source
npm ci --ignore-scripts
npm test
```

The partial source/test tree was checked separately with Node 22.16.0 / npm 10.9.2: install passed and all 38 domain tests passed, with zero failed, skipped or TODO. This is supplementary fallback validation, not the repository's qualified Node/npm/TypeScript toolchain.

**Do not treat `npm run prototype:build`, `npm run prototype:check` or `npm run test:browser` as working commands for this partial checkout.** The build was attempted and fails with `ENOENT` for `source/planning.ts`; `source/app.ts` is also absent. The browser script and HTML are absent. The original package scripts are retained unchanged so the transfer gap remains explicit.

[Verification metadata](evidence/transfer-checks.json) and [captured output excerpts](evidence/transfer-checks.log) distinguish this partial checkout from the complete attachment's successful local build.

## Qualification boundary

The separately delivered complete prototype is a TypeScript/native-browser interaction implementation, not the Vue 3/Pinia/Nuxt UI package prescribed by PR5's canonical prototype skill. Actual Companion project JSON, importer/compiler qualification, native Obsidian integration and the repository's full quality gates remain outstanding. Node type stripping is not TypeScript type checking.

No production runtime, current Companion project, schema, root dependency, workflow, quality threshold, vault, release, PR5 branch or main branch is changed. This commit preserves accepted source-transfer progress; it does not claim a runnable prototype on the PR.
