# MVP continuation: reviewed concept intake

Date: 2026-09-27. Status: implemented CLI/data-intake increment; not full MVP or native companion acceptance.

## Baseline and integration

This increment builds on PR #28 head `2438f73508a874572a9fba34169eb2bd41fb03fa`, tree `bee010982b9be61b29ea165fe07e2aa497aa6a17`. PR #28 had advanced during continuation with editor and clickdummy work. That implementation is retained unchanged; this work is on `feat/mvp-concept-intake`, stacked on `feat/mvp-journey-lens-core` rather than overwriting concurrent changes.

The full source was recovered from existing workflow artifact `10933189749`, run `36326791129`. ZIP SHA-256: `06e2c0aedc29da70748f29392fc85eb5f7ec51797b38a0bf29c0713e971ad7ba`. Its merge checkout `2f2ea052df5efb33b3b7d8b23ce0a0536bb8b7bb` has no file changes relative to that head. Local execution used the recovered full source, not a rewritten substitute.

## Implemented scope

`concept schema`, `concept inspect` and `concept import` now expose data-only full-project replacement, additive features and exact-base-bound improvements. Inputs may be JSON or a recognized inert payload inside HTML under `docs/concepts`. Both ordinary companion JSON and the maintained prototype worker's base64/checksum envelope are supported. Raw HTML remains reference-only. No prototype code, project script, package installation or provider is executed by intake.

Fixed canonical collection changes are validated as a complete project, then passed through the existing compiler model and project-import configuration/ownership planner. Source/base/destination changes invalidate review. Published revisions cannot be modified by scoped imports. Provenance receipts enable exact no-op replay, but never authorize writes. Replaying an old concept after subsequent changes is refused. Input artifacts and implementation source are preserved.

The [guide](../development/CONCEPT-INTAKE.md) documents commands, limits, failure cases and extension boundaries. The [example](../concepts/concept-intake-example/README.md) includes three complete, hash-consistent project/feature/improvement JSON files.

## Executed verification

Supplementary local environment: **Node 22.16.0 / TypeScript 5.8.3**, not the repository-qualified Node 24.21.0 / npm 11.19.1 / TypeScript 6.0.3. Frontend dependencies were not installed locally.

| Check | Actual result |
| --- | --- |
| Canonical concept contract/candidate tests, including all checked-in example base hashes | 14 passed |
| Inert HTML/UTF-8/base64/ambiguity and false-marker rejection | 7 passed |
| Real shared CLI operation/plan/apply/ownership tests | 11 passed |
| Actual compiled and extracted CLI kit: feature import, Vue source generation, replay and improvement regeneration | 1 passed |
| New concept-specific total | **33 passed**, no failed/skipped/TODO cases |
| Broader sitemap/authoring/concept/CLI guidance/core run | **156 passed, 1 failed**; includes the 33 above, not additional |
| Strict framework TypeScript check, with library checking enabled | Passed |
| Source limits and locale parity | Passed: 893 inputs, 202 translated keys |
| Suite inventory | Passed: 259 test files in 26 suites, 31 helpers |
| Whitespace check | Passed |

The broader failure is the pre-existing `human doctor output is aligned plain text with ASCII markers and an actionable Next line` assertion: it requires empty stderr, while local Node 22 emits its experimental type-stripping warning. The same single test was rerun against the unmodified recovered baseline and failed on the same warning. The assertion was not weakened and warnings were not suppressed. Qualified-toolchain hosted results must be reported separately.

Commands used:

```sh
tsc --noEmit -p tsconfig.framework.json --skipLibCheck false
node --experimental-strip-types --test --test-concurrency=1 \
  tests/tooling/companion-authoring-*.checks.mjs \
  tests/tooling/companion-sitemap-*.checks.mjs \
  tests/tooling/companion-concept-intake.checks.mjs \
  tests/tooling/framework-concept-input.checks.mjs \
  tests/tooling/framework-concepts.checks.mjs \
  tests/tooling/framework-concepts-kit.checks.mjs \
  tests/tooling/framework-cli-guidance.checks.mjs \
  tests/tooling/framework-core.checks.mjs
node scripts/quality/check-source.mjs
node scripts/testing/suites.mjs --check
git diff --check
```

Initial red tests demonstrated missing parser/transport modules and unsupported CLI operations before implementation. The final tests exercise the actual shared handlers, canonical model and file-plan engine. The kit test compiles the actual source, creates/extracts the archive, invokes its CLI subprocesses without installed project dependencies, imports an authored page, generates the Vue SFC/specification, performs an improvement and checks exact preservation of a consumer-edited wrapper.

The kit test does **not** install or compile the generated Vue dependencies, exercise a browser, implement capture business behavior or establish native persistence acceptance. Existing framework CI includes the new `framework-*` cases and explicitly runs the concept contract suite in its unchanged desktop OS matrix. Adding those jobs is not a passing hosted result. No analyzer/coverage threshold or exception was relaxed by this increment.

## Remaining MVP boundaries

This addresses WP-06's structured concept intake and A14/A13 at the contract/CLI/generated-source level. It does not implement arbitrary HTML-to-code conversion, automatic ID remapping, direct ZIP/source integration, every possible authoring subsystem slice or a new in-companion import UI. These unsupported paths are explicit refusals, not silent partial merges.

Independent scope-selecting feature/page/component generators, final self-project/golden promotion, native companion authoring/persistence, the complete extracted-kit starter/GitHub setup journey and release qualification remain open. The existing clickdummy command from PR #28 is not replaced here and is not newly qualified by these concept tests. No PR merge, tag, public release, credential change or native-vault installation was performed.
