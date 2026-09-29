# Companion starters and the empty authoring workspace

`configs/starters/companion-plugin.json` is the canonical Companion development
starter. Edit its metadata, inputs and complete `generator.document` together.
The shell and the current browser authoring build read the same versioned
validation contract. Adding a definition requires no starter-ID dispatch change.

## Create a project

A new browser session opens **Start your project**, with no project and no
bundled definitions. Choose **Blank project**, or extract the independent starter
ZIP and select its JSON files in **Import starter definitions**. Imports validate
the entire batch before changing the session library. Importing a definition
never installs a project, writes native files or starts a process.

Choose **Configure project**, review its identity and folders, then review the
complete authored model. Explicitly confirm the project before entering the
setup wizard. A blank project uses the same identity and setup flow without
requiring a downloaded Blank starter. Existing saved projects reopen unchanged;
imported starter files are session-local, not a hidden persistent catalog.

File-only starter definitions are listed safely with shell generation instructions.
They are not misrepresented as Companion authoring models.

```sh
node shell.mjs starters list
node shell.mjs starters show companion-plugin --json
node shell.mjs new ../my-companion --starter companion-plugin
node shell.mjs new ../my-companion --starter companion-plugin --yes
```

The first creation command previews its plan. `--yes` approves source creation,
not process trust. Explicit first-run execution still requires both a selected
process sequence and `--trust-processes`. No browser import carries that trust.

## Ownership and compatibility

The canonical starter contains the complete v6 design, including routes,
journeys, feature groupings, page/component IR, pinned revisions, requirements,
entities, source contracts, fixture recipes and design-system declarations.
Identity customization deep-copies it and never rewrites internal IDs or labels.

`npm run companion:build` builds the current **empty-start** authoring HTML.
It does not embed a starter catalog, the Companion project or its visual seed.
Its two project-JSON outputs under `reports/companion-mvp` are deterministic,
**derived compatibility exports** for existing compiler qualification scripts.
They are not editable masters, release starters or startup defaults.
`build.json` records this role and the canonical starter's SHA-256.

The checked-in v5 HTML/project/seed and legacy catalog remain immutable historical
compatibility inputs, verified by the retained assembly check. Their validator
remains separate from the current v5/v6 starter adapter. Canonical definitions,
legacy starter directories and historical self-project/seed JSON are excluded
from shell and generated-project distributions. The independent starter ZIP is
the source of installable definitions.

A 4 MB per-definition ceiling matches the existing full authoring-document
budget; a 16 MB library and 256-entry limit remain enforced. Strict JSON shape,
version, path, UTF-8, duplicate, reference and process validation still applies.
The ordinary operation/request budget is not increased.

## Qualification commands

```sh
node --test tests/tooling/starter-authoring.checks.mjs
node --test tests/tooling/starter-definitions.checks.mjs tests/tooling/starter-lifecycle.checks.mjs
node --test tests/tooling/starter-manual.checks.mjs tests/tooling/framework-manual.checks.mjs
node scripts/concepts/build-mvp.mjs
node tests/concepts/companion-starters.browser.mjs
```

The browser check normally uses a real Chromium file-origin session. Its explicit
`--fixture` mode renders the same complete HTML and performs real DOM actions,
but supplies isolated in-memory storage and a SHA-256 host shim. That mode is
useful when navigation is blocked and **is not file-origin or native acceptance**.
It checks empty startup, blank setup/cancel, atomic/duplicate/invalid/oversized
imports, source hashing, confirmation, v6 retention, setup entry and reopening.

## Completion boundary

The golden starter is a development model, not proof of complete generated
native Companion behavior. The existing compiler emits supported visual
controls, typed contracts and interactions, along with explicit acceptance and
business obligations. Generating or building that output does not close the
remaining native editor/business-action parity or native acceptance work.
Keep those obligations visible rather than converting them to placeholder
success states. Browser setup remains a simulation; the independent shell owns
real generation and explicitly approved process execution.
