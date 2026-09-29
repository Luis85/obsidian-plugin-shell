# PR35 MVP base integration — 2026-09-28

Integrate PR5 `f140c7e89570329fc7ed40ee2d4cb885f4524fc2` into PR35
`73084904159483e72bcd2a10d1e2c01b3cd6cc1c`. The earlier PR35 workflows all passed,
but their checkout was merge `d61dffa9fe5a2ccc2a9a0e49b0cf5271f9889c8c`
(tree `afa21405ef355db2d9c42d9bbef374fac41009bf`), which already included the
TypeScript 6 workspace-selection change from PR5 `70c18034`. The retained archive
matched that tree before edits. Do not mistake those checks for qualification of
the later combined editor.

The later PR5 archive was merge `fa9944ced7616b4f41d6709bacd64cc40e3e5318`.
Comparison with its head showed only unrelated package/lockfile changes from main;
those files were not copied. Only the 17 changed editor/documentation/layout paths
since `70c18034` were reconciled. This keeps the exact dependency lockfile and all
TypeScript 6 selection requirements.

## Conflict decisions

Retain both branches' tests and behavior: compact non-overlapping display geometry,
pre-order outline, correct navigation versus hierarchy connectors, journey step
selection, named v6 artifacts and Back context from PR5; reviewed whole-map
arrangement, exact non-drag positions, dirty/recovery status, focus mode, per-view
graph identity, cached geometry and guarded dragging from PR35. Whole-map arrange
still requires Apply and remains undoable; merely opening the review writes nothing.

New tests cover focused-view restoration and numeric coordinates matching the
actual display fallback. Focused state retains its previous panel visibility across
an editor remount. No canonical project schema or geometry is changed by view state.
The browser sequence retains both branches' checks and explicitly confirms arrangement.

## Local checks and limits

Node 22.16.0 dependency-free sitemap suites: 81 passed, no skips/TODOs. A separately
labelled local copy of the real-store test used Node's own type stripping and a
small import rewrite against the retained Vue/Pinia runtimes: 13 passed after
correcting a missing required projection-options argument. The first replay had
11 passes and 2 failures; it is retained as a failure, not counted as a pass.
This replay is not the committed TypeScript-6-transpiled suite or a typecheck.
Source limits, suite ownership and whitespace checks passed (294 files, 31 suites,
32 helpers). Local package-registry/Git DNS is unavailable. No TypeScript 5 compiler
was linked or substituted. Hosted locked TypeScript 6, complete browser, generated
consumer and cross-platform checks are required on the resulting commit.

The [MVP improvement plan](../product/PR5-IMPROVEMENT-PLAN.md) remains incomplete.
This integration removes branch conflicts; it does not establish full native
companion acceptance or authorize a release, tag, PR merge or personal-vault install.
