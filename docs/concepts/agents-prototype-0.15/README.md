# Agents · Klaus Editor 0.15

Architecture refactor of the supplied Vue / Pinia / Three.js prototype. The character editor, character catalog, configuration views and existing authored models are retained.

**Delivery status:** this is a source package, not a prebuilt standalone HTML file or an installable Obsidian plugin. Repository fixes now pass the complete check command: 96 core tests, 163 Vitest tests, strict application types, 19 Vue components and the production build. A served-build browser smoke also passed. See [current repository verification](docs/REPOSITORY-VERIFICATION.md) for scope; the [original packaging report](docs/VERIFICATION_0.15.md) remains historical.

## Run and validate

Use Node **24.21.0**, npm **11.19.1** and the local lockfile. From this directory:

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

`npm run check` runs architecture, syntax, model-source contracts, generated-schema checks, strict core compilation, native core tests, Vue SFC/template compilation, full application typechecking, Vitest and the production build. It deliberately fails rather than silently skipping unavailable tools.

```sh
npm run check:core       # dependency-light checks; requires TypeScript
npm run test            # actual Pinia / Three.js tests through Vitest
npm run test:templates  # actual installed Vue SFC compiler
npm run build
npm run preview
```

The prototype pins local TypeScript **6.0.3** and rejects other compiler versions; there is no global fallback. Core checking uses modern ESNext/Bundler resolution, then emits temporary CommonJS artifacts for the Node tests. The lockfile records the verified application dependencies. Installation with dependency hooks disabled was tested through the complete build. The original Node 22 / TypeScript 5.x packaging receipts remain historical.

Do not open index.html directly from the filesystem: it is now the real Vite entry for src/main.ts, not the unrelated older inline application that was in the supplied archive.

## What changed

| Area | 0.15 implementation |
| --- | --- |
| Application services | StateRepository, Clock and IdGenerator ports; browser implementations selected at the composition root |
| Pinia | Receives injected services and initial state; never constructs browser infrastructure |
| Commands | Return typed results with detached state transitions; failed commands never partially mutate the caller |
| Persistence | Explicit load/save diagnostics; serialized writes; debounced autosave; corruption recovery gate; session export |
| Models | Five silhouette builders; dedicated face, material, accessory and pattern construction; a 70-line orchestration factory |
| Resource lifecycle | Idempotent model disposal includes material templates, mesh clones and geometry; stage rebuild also releases old decorations |
| Domain/catalog | Domain compatibility rules and persisted types are separate from names, copy, tags, palettes and editor categories |
| Import | Bounded structural and semantic validation; explicit legacy migration; malformed/future state rejected; duplicate pack IDs remapped |
| JSON contracts | Workspace and character-pack schemas generated from the runtime shape declarations |
| Startup | Correct Vite entry, Nuxt UI Vue plugin, Tailwind/UI CSS imports and visible startup errors |

## Architecture

```text
src/
  domain/                    # agents, characters, relations, shared invariants
  application/
    ports/                   # repository, time, identifiers and selection contracts
    agents/                  # agent command factory
    characters/              # style/look/pack command factory
    state/                   # codecs, migration, async persistence coordinator
    validation/              # runtime shapes + JSON Schema metadata
    bootstrap/               # seed state and built-in style/pack definitions
  infrastructure/
    persistence/             # BrowserStateRepository
    services/                # SystemClock, CryptoIdGenerator
    three/
      models/                # factory + five builders + face/context helpers
      materials/
      accessories/
      patterns/
      scene/                 # rig, animation, turntable, stage and disposal
  presentation/
    stores/                  # injected application context and Pinia adapter
    components/
    character-catalog/
    formatters/
  composition/               # browser service selection
  main.ts                    # Vue bootstrapping and lifecycle
```

## Compatibility and recovery

Application/manifest version is **0.15.0**. Persisted schema remains **1.4.0**: this refactor does not change the persisted data shape. Browser storage still uses `agents-klaus-editor-prototype-v3`.

The codec explicitly accepts 1.0.0, 1.1.0, 1.2.0 and 1.3.0 inputs that satisfy the supported legacy base shape, migrating their appearance/catalog additions to 1.4.0. These are not generic repair paths for arbitrary historical JSON. Missing required operational data, unknown fields, invalid recipes and unsupported versions produce diagnostics, not silent defaults or downgrades.

After a failed load, the editor keeps a usable in-memory seed session and blocks automatic overwrite. The status panel explains the failure and allows session export or explicit replacement. Exporting that session does **not** recover the corrupt original bytes; those remain in the same browser key until explicitly replaced.

The repository seam is asynchronous for future Vault-backed persistence. **No ObsidianStateRepository or Markdown writer is implemented in this package.** Existing Vault paths remain target configuration, not a claim that files have been written.

## Entry points for implementation

- [Architecture and migration map](docs/ARCHITECTURE_0.15.md)
- [Verification results and limits](docs/VERIFICATION_0.15.md)
- [Product review](PRODUCT_REVIEW.md)
- [Manual editor/rendering acceptance checklist](design-qa.md)
- [Changelog](CHANGELOG.md)

Earlier design notes and screenshots are preserved under docs/history and are explicitly historical, not screenshots of the 0.15 build.
