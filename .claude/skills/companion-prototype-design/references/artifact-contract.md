# Prototype package contract

A prototype is a delivery package, not only a screenshot or a JS blob. Proposed layout:

```text
<slug>/
  prototype.html                 # self-contained source-built browser artifact
  companion.project.json         # actual complete companion import/compiler input
  prototype.manifest.json         # separate metadata, never import this as project JSON
  design-brief.md                 # agreed brief and decisions
  execution-prompt.md             # exact standalone prompt used
  README.md                      # open, install/build/test, truthful limitations
  INTEGRATION.md                 # companion + CLI paths and source handover
  THIRD-PARTY-NOTICES.md          # dependencies, assets and licenses; no font binaries
  integration-map.json            # authoring IDs ↔ source files ↔ tests ↔ ownership
  source/                        # independent buildable generated-shell workspace
    package.json
    package-lock.json
    AGENTS.md
    src/                         # foundation + generated product paths from compiler
    harness/prototype/           # separate browser-only frame and fake host adapters
    scripts/prototype/           # build/verification helpers copied with their imports
    ...                          # every config, style tool and local dependency needed
  tests/prototype.journeys.mjs    # named real-browser checks, not generic smoke only
  evidence/
    repository.json
    verification.json
    generator-plan.json
    ...                          # actual commands/logs/screenshots/round-trip export
  changes/                       # required for existing-feature/improvement scope
    baseline-reference.json      # identity/hash/access; baseline bytes only if authorized
    change-set.json              # informational full structural diff, not an import schema
    regression-cases.md
```

Generated configurable code/test roots take precedence over illustrative `src` paths.
Never move code just to match a diagram. Package every referenced source/config/tool;
no absolute imports, missing workspaces, `file:../../shell`, `workspace:*`, absent local
packages, unexplained binary blobs or dependencies on the creator's checkout. No
node_modules, .git, caches, secret files, personal vaults or font files in the ZIP.
Root production build outputs are permitted only when intentionally documented.

The source project's `npm run prototype:build` must reproduce `../prototype.html`.
`npm ci`, its check/test scripts and the build run from an extracted clean package.
Using the existing shell's lockfile and generated workspace is preferred to inventing
a second incompatible dependency graph. Include actual Vue SFCs and TypeScript, not
`.vue.txt` / `.ts.txt` placeholders. Plan repository analyzer inventories explicitly;
do not rename sources or broadly suppress checks to hide them.

## Manifest v1 — package metadata only

Required fields (the packer checks these):
- `kind`: `obsidian-prototype-package`; `schemaVersion`: 1.
- `slug`: lowercase portable slug; `mode`: one of the three skill modes.
- `repository`: `{name, commit}` with the actual 40-hex inspected commit.
- `project`: `{path: "companion.project.json", sha256}` for the exact import file bytes.
- `artifact`: `{path: "prototype.html", sha256}` for the exact source-built HTML bytes.
- `source`: `{path: "source", packageManager}`.
- `status`: `verified` or `incomplete`; use incomplete for any required blocked gate.

Additional human-readable metadata is allowed **here**, never in companion JSON.
`verification.json` must list actual checks with command, cwd (portable), status,
exit code, evidence path/hash, artifact/revision association, and limitations. Empty
reports, invented counts and placeholder successes are invalid delivery practice.
Manifest status is self-reported metadata, not a cryptographic proof of correctness.
The packer does not promote status or validate the truth of tests.

## Source-to-design traceability

For each agreed surface/component/interaction/source requirement map:
`designId`, `kind`, `sourceFiles`, `testIds`, `ownership`, `generatorSupport`,
`nativeRemaining`. Classify ownership `generated`, `extension`, or `prototype-only`.
Use real generator output paths and receipts. Do not call manually edited managed
files safely regeneration-proof; move behavior to supported seams or state the conflict.

The authoring JSON should describe everything the contract supports. Bespoke logic and
external-library adapters remain source code, with explicit mappings and native TODOs.
A separate source package is the code handover: neither companion JSON nor shell CLI
magically imports arbitrary handcrafted SFCs. INTEGRATION.md must say what compiles
automatically, what must be ported, and where, without claiming pixel-perfect regeneration
when the IR cannot represent a design detail.

## Single-file HTML

Bundle real Vue, Pinia, Nuxt UI, compiled CSS, local icons, synthetic data and assets.
No CDN, remote fonts, import maps, runtime fetch of project JSON, dynamic chunk loads,
service worker, server dependency or Vue runtime template compilation. No font binaries.
Use system fonts and inline/local icons. The build must work from `file://` offline.
Tests may serve the same file over HTTP to additionally assess browser storage behavior.

The helper assembles a **previously compiled classic IIFE** plus scoped CSS, installs a
restrictive CSP, and embeds the original JSON bytes as base64 data in
`script#prototype-project-data`. Decode that data at the browser boundary; expose
Download project JSON using those original bytes. Never execute the JSON. This data
carrier is not itself the companion envelope; the separate decoded file is.

Set `document.documentElement.dataset.prototypeReady = 'true'` only after real Vue
mount and initial deterministic rendering. Generic browser checks use that marker;
the named journeys must still prove real interaction. Do not set it on an error screen.
No authoring data writes on startup. Use in-memory services by default, resettable
synthetic fixtures, and feature-detected storage behind an adapter only when agreed.
Handle blocked file-origin storage without crashing; never treat it as native persistence.

## Packaging and repository save

The packer requires the listed artifacts, hashes, source lockfile, package scripts and
named journey file. It scans for symlinks, dangerous paths, secrets and font files,
adds a deterministic inventory receipt, and writes a fresh ZIP outside the package.
It is not a malware scanner, lossless-regeneration proof or substitute for validation.
Review included files before sharing, especially logs and original baseline exports.

Repository save is separate from producing local artifacts. Save only to the approved
new `docs/concepts/<slug>/` folder; stop on a collision. Preserve all existing concepts.
Do not include machine paths/receipts from a real vault. Saving files does not authorize
committing, pushing, installing, publishing or importing into a live companion.
