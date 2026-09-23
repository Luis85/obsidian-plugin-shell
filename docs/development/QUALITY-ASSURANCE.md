# Additional source assurance

These checks supplement the full coverage, compiler, architecture, official
Obsidian lint, artifact, browser and native gates. They have deliberately stated
scope and positive/negative fixtures; passing them is not full release acceptance.

Fallow explicitly excludes only the three generated install files
`dist/main.js`, `dist/styles.css` and `dist/manifest.json`. These were already
outside its maintained-source graph through built-in defaults; naming them avoids
an ambiguous default-ignore diagnostic in literal Git-free archives. The complete
artifact gate independently verifies that exact file set, hashes, ownership and
budgets. Additional source inside `dist` still produces a blocking diagnostic.
The real transported-archive regression checks valid inputs, unreachable maintained
source, an extra `dist` source file, and restored controls. The template maintainer
must review these exact names if the artifact layout changes; no maintained source
directory or unknown analyzer diagnostic is suppressed.

The Oxlint gate receives a complete explicit inventory of `src` JS/TS/Vue paths.
This prevents an archive under an ignored parent from silently checking no files.
Empty input and symlinks fail; actual ignored-parent positive/negative controls
run the same binary with denied warnings. This broadens checked inputs and changes
no lint rule. Vue/ESLint and architecture retain their independent gates.

Tailwind class detection uses `source(none)` with the existing explicit presentation
and generated Nuxt UI source roots. This bounds generated utility discovery to
actual frontend inputs and avoids scanning archive caches or unrelated examples.
It does not change lint, test or coverage inventories. The mechanism follows
[Tailwind's explicit-source contract](https://tailwindcss.com/docs/detecting-classes-in-source-files#disabling-automatic-detection).

Preview loads emitted harness assets without invoking Nuxt's generation plugins;
build/dev retain their guarded shared pipeline. An actual config-contract test
prevents preview from rewriting generated build inputs or scanning source caches.

The stylesheet pipeline uses the dedicated exact scope class `ps--<plugin-id>`
for repeated selectors, and `ph--<plugin-id>` for the native content container.
The double hyphens are outside the valid ID grammar, keeping these marker categories
disjoint from retained root IDs and each other. Readable `data-plugin-ui` markers
remain; variable/keyframe namespaces and hash guards are unchanged. Negative
controls reject foreign, suffix and sibling selectors, while actual renamed
consumer artifacts remain subject to the unchanged 100 KiB stylesheet limit.

`npm run check:test-quality` parses every TypeScript file in `tests/runtime` and
`tests/e2e` with the installed TypeScript AST. It rejects focused/skipped/todo/
conditional declarations from imported Vitest/Playwright test, suite, describe and
it bindings, including named aliases, namespace imports and literal property
access. String/comment examples do not trigger it. It does not claim whole-program
alias analysis of custom test factories. Node tooling tests have separate explicit
platform-provisioning skips and remain outside this runtime/E2E declaration policy.

The existing ESLint configuration now applies type-aware promise handling to
runtime tests, browser tests and harness TypeScript. Run
`node node_modules/eslint/bin/eslint.js tests/runtime tests/e2e harness/app --max-warnings 0`.
It uses `no-floating-promises` and `no-misused-promises` through the real project
types, so browser operations are checked as promises rather than by guessing method
names. Deliberately unused fixture parameters may begin with `_`; other unused
variables and arguments remain errors. Existing runtime Obsidian rules remain.
The negative control runs actual ESLint with the repository config against a
missing Playwright `await`; the corrected operation passes.

`npm run check:repository` inventories current `.github/workflows` YAML, owned
`src/styles/**/*.css`, documentation Markdown and root README/AGENTS/changelog.
Its YAML parser rejects malformed or duplicate mappings. The repository policy
requires job/step structure, full action SHA pins, explicit read-only permissions,
checkout without persisted credentials and environment-based handling of untrusted
inputs instead of direct shell interpolation. This is a focused repository policy,
not a substitute for the complete GitHub Actions schema or actionlint. Privileged
publication workflows are not allowed by this iteration's checker; introducing
them requires a separate authorized design and scoped policy change.

Owned CSS is parsed with the already selected PostCSS and selector parser. Empty
declarations and selectors without an owned class or plugin attribute fail. This
checks source syntax and obvious broad selectors; token roles and complete final
host containment remain independently checked after the production CSS pipeline.
It does not validate every CSS property's grammar or replace Stylelint. Extracted
vendor CSS remains under its existing hash/provenance gate, not this source scan.

Markdown checks balanced fenced blocks and existence of inline local file links,
excluding code examples. It rejects escaping the repository. Reference-link
definitions, heading anchors, spelling and full Markdown syntax are outside this
small offline check; no CSpell/TypeDoc completeness claim is made. Test fixtures
prove malformed workflow, unpinned action, write permission, missing await, focused
test, invalid CSS, broad selector, incomplete fence and missing local target are
detected alongside valid controls.

See the [quality adoption plan](TYPESCRIPT-QUALITY-TOOLS-PLAN.md) for the full
remaining work, including external security/dependency-review scanners and broader
style/documentation tooling. These local checks do not activate external services,
alter permissions or certify those unprovisioned scanners.
