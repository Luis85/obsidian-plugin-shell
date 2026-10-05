# Agents · Klaus Editor 0.15 — repository import

The uploaded source package was imported on top of
[PR #5](https://github.com/Luis85/obsidian-plugin-shell/pull/5)
(`docs/companion-plugin-prd`), at base commit
`fa3acfed6a1ee768d9b22041ef0c10c17a2ced12`.

Start with the [README](README.md), [architecture](docs/ARCHITECTURE_0.15.md)
and [current verification](docs/REPOSITORY-VERIFICATION.md).
The prototype contains an agent/character editor, browser-backed persistence,
configuration views, Three.js models, schemas and tests. No native Obsidian
persistence adapter is implemented.

## Provenance and boundaries

- Input: `agents-prototype-0.15-source.zip`.
- Archive SHA-256: `7c9cd2001413f3cdd582e2bb69473a999ee08ccba8efca63f68131287d5396de`.
- At import, all **160 original files** were byte-identical to the upload and all
  **159 original checksum entries** were verified. The original list is preserved
  in [upload checksums](docs/history/SOURCE_SHA256SUMS_UPLOAD_0.15.txt).
- Subsequent repository fixes change the compiler, dependency policy, thumbnail
  conditional rendering, test/build configuration and README. They add a lockfile,
  rendering regression tests and current verification notes.
  [SOURCE_SHA256SUMS.txt](SOURCE_SHA256SUMS.txt) now covers the maintained source
  package, excluding itself and ignored dependencies/build outputs.
- Original packaging reports, failed-attempt logs and historical screenshots keep
  their original scope. They do not describe the corrected repository build.
- The concept is excluded from consumer developer kits and generated project
  scaffolds, following the existing standalone-concept policy.
- Root dependencies, lockfile, plugin source, manifest and canonical Companion
  project definitions are unchanged.

## Import findings and resolution

The initial checks found `TS5107` for legacy `moduleResolution: Node10` and an
invalid adjacent `v-else` chain in `CharacterThumbnail.vue`. Both are corrected.
Core compilation now uses TypeScript 6.0.3 with ESNext/Bundler resolution and
strict diagnostics before producing temporary CommonJS test artifacts. Paired
ear shapes share one conditional branch, with four actual Vue rendering tests.

Complete dependency installation also exposed Nuxt UI's default router imports.
The Vite integration now explicitly disables routing, matching this router-free
application. The complete prototype check and served-build smoke pass; see the
[current execution record](docs/REPOSITORY-VERIFICATION.md).

Repository integration was separately verified with `npm run typecheck:framework`
and 60 existing distribution/documentation tests. The consumer exclusion checks
cover the concept subtree and preserve similarly named unrelated paths.
