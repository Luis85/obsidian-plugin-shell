# Project-starter preparation packages

Creating a project always runs an installed **project starter**: a JSON definition
under `configs/starters/<id>.json` beside `shell.mjs` whose `generator.kind` is
`project`. It fixes the project type, frontend framework, targets and, for Angular,
exact dependency pins. The flow is starter → data-driven prototype interview →
agreement → complete plan review → separate default-No apply. Frameworks and targets
are never overridden at creation; choose (or author) a different starter instead.
The interview is `bin/guides/project-prototype.json`. Agent and terminal paths share
the installed starters, the interview and the compiler.

A prepared package carries `project.config.json` (the chosen starter's ID, version and
SHA-256 plus its complete selection), `project-request.json`, `prototype-guide.json`,
`prototype-answers.json`, the complete Companion document, `design-brief.md`,
`execution-prompt.md`, integration metadata and `source/`. Read the agreed brief
without repeating accepted questions. Choosing another starter reopens agreement.
The source copy of `project.config.json` must match the parent selection.
Never put target metadata into the closed Companion v6 envelope.

## Execute the selected target contract

Read `source/AGENTS.md`, `source/README.md` and `source/prototype.acceptance.json`.
Use `source/scripts/build.mjs` through the declared npm scripts. Do not invoke the
legacy Vue-only init/build/package helpers on a project-starter package: their
artifact/manifest assumptions are different. They remain correct for legacy
`node shell.mjs prototype` packages. Never change the selected stack to fit a helper.

Use the pinned Node/npm. The generated root-only package-lock is explicitly
unresolved: review and run `npm install` only when authorized, inspect the resolved
lock, then prove a clean `npm ci`, typecheck, tests and build. No toolchain substitution.

- Plugin: independently review `dist/plugin/main.js`, `styles.css`, `manifest.json`.
  Qualify a disposable Obsidian host only with native permission. Browser success
  does not qualify host lifecycle. Angular uses AOT and per-view application cleanup;
  Nuxt UI retains the pinned static-head/color guards and owned CSS; vanilla has no
  frontend framework dependency.
- Webapp/website: static-hostable client-rendered source and `dist/<target>/index.html`.
  No server rendering, guaranteed SEO or remote backend is implied. Build an offline
  `dist/prototype.html` with `npm run build:prototype`; existing output requires an
  explicit reviewed `--replace`. Validate exact artifact no-network behavior.
- CLI: source commands and real transcripts are the prototype. No fabricated HTML,
  frontend library or browser acceptance. Build then test `npm run start:cli -- pages
  --json`, invalid input, help, stdout/stderr separation and exit codes.
- Hybrid: the starter's two or more declared targets share `src/core`, with independent host
  entrypoints. Every target needs acceptance. No remote synchronization or desktop
  wrapper is assumed by choosing a hybrid starter.

The scaffold projects the authored page list; arbitrary visual trees, component
bodies and business actions remain implementation work. Preserve full design JSON,
stable IDs and unrelated data. Never count scaffold tests as full product acceptance.
Implement agreed actions, error recovery, keyboard/focus, cancellation and teardown.
Add actual tests and evidence. Do not replace null hashes/incomplete manifest status
until the deliverables are built and verified. Keep the full source handoff, exact
lockfile, licenses, model, brief and integration map; do not package node_modules,
secrets, personal data or fabricated QA evidence.
