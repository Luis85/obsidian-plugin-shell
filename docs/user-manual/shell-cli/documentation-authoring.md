# Maintaining the manual from source

## Three inputs, one documentation build

The manual deliberately separates executable command facts, explanations close to the implementation, and task-oriented writing. TypeDoc is the HTML renderer and source-comment processor, not a replacement CLI parser.

| Content | Authoritative location | Result |
| --- | --- | --- |
| Commands, accepted option kinds, positional bounds, effects | `scripts/framework/catalog.ts` | Generated command reference and JSON |
| Option meanings, profiles/defaults, usages, examples, groups | `scripts/framework/help-text.ts` | Terminal help and the same generated reference |
| Stable compiler diagnostic recovery hints | `scripts/compiler/domain/diagnostics.ts` | Generated diagnostic guide |
| Public interfaces and their docblocks | Explicit TypeDoc entry points in `scripts/documentation/typedoc.json` | Source/API appendix |
| Tutorials, workflows, safety explanations and troubleshooting | Markdown beside this page | Handbook documents |

Do not duplicate command tables in authored Markdown. Link readers to generated reference material and explain the decisions, sequence and expected outcome instead. A changed flag belongs in the catalog and help metadata; it should not require manually editing several copies of a command reference.

## Generate and validate without installing a renderer

Run from the trusted framework source checkout:

```sh
node --test tests/tooling/framework-manual.checks.mjs
node --experimental-strip-types scripts/documentation/manual.mjs
node --experimental-strip-types scripts/documentation/manual.mjs --check
node --experimental-strip-types scripts/documentation/audit.mjs
```

The generator produces four owned files below `docs/user-manual/shell-cli/generated/`: reference Markdown, diagnostics Markdown, structured command JSON and a fingerprint manifest. It does not invoke CLI handlers, install packages, access a vault or run the handbook examples.

`--check` compares existing output without writing. It catches stale retained output; when outputs are built on demand, running generation followed by check verifies consistency. Do not describe that sequence as a check against a committed baseline when no generated snapshot is committed. Generated snapshots can be retained in artifacts or deliberately committed for a release; neither requires hand-editing them.

The writer refuses unknown files in its output directory and symlinked destinations. Keep all authored material outside `generated/`. Replacements are per file, with the manifest written last; this is not a claim of a transactional, whole-directory update. An interrupted write requires a fresh inspection/regeneration.

The audit parses simple, single-line authored `node shell.mjs` examples using the real framework argument parser and checks local Markdown file links. It does not execute commands or validate all semantic preconditions. Separately dispatched memory examples are counted but not parsed with the wrong protocol. Complex shell programs and actual end-to-end behavior still need their own tests.

## Add content in a docblock

Put a standard TypeDoc-supported documentation comment on an exported symbol already included in the configured entry points. For example, a comment on the real `Request` interface can explain the contract without duplicating its fields:

````ts
/**
 * A structured request to the shared operation layer.
 *
 * @remarks
 * Arguments are data, not a shell command. This request does not grant
 * permission to write files, execute project code or publish a release.
 *
 * @example
 * ```ts
 * const request: Request = {
 *   command: 'status', args: [], options: { json: true }
 * };
 * ```
 */
````

TypeDoc reads TypeScript declarations and supported JSDoc/TSDoc-style tags. Arbitrary comments on unexported code are not automatically handbook pages. Keep implementation rationale near the relevant symbol; keep an end-user tutorial in Markdown. Add a new entry point only when its public contract genuinely belongs in the manual, not to expose every internal helper.

For a document that belongs underneath a particular source symbol, TypeDoc supports `@document path/to/guide.md`; the path is relative to the source file containing the comment. Use this for symbol-specific supporting material. Use `projectDocuments` for top-level handbook pages. Do not attach the same guide in multiple places merely to increase visibility.

Source: [TypeDoc external documents](https://typedoc.org/documents/External_Documents.html) and [input configuration](https://typedoc.org/documents/Options.Input.html).

## Add content as Markdown

Create a `.md` file beside this page. Give it a task-oriented title, prerequisites, a safe example sequence, expected results and recovery advice. Add its navigation link to `index.md` and register it in `projectDocuments` in the TypeDoc configuration. Plain Markdown works in GitHub/Obsidian and can be reused by a future website without converting all content to framework-specific components.

TypeDoc also supports document frontmatter for titles, grouping and child pages. Use it where a section becomes large enough to need hierarchy; do not turn every page into a configuration exercise. Keep screenshots optional and maintain only those that explain a visual interaction unavailable in text.

## Build HTML separately

The renderer lives in `tooling/documentation`, outside the kit's recursively scanned template roots. It does not alter the root application manifest/lockfile or install documentation packages into generated plugins.

With a reviewed tooling lockfile present, install and build:

```sh
npm --prefix tooling/documentation ci --ignore-scripts --no-audit --no-fund
npm --prefix tooling/documentation run build
```

For first-time lockfile bootstrapping only, use `npm --prefix tooling/documentation install --ignore-scripts --no-audit --no-fund`, review the resulting separate lockfile and commit it. Do not use a hand-written lockfile or claim exact transitive reproducibility until that file has been produced and checked. Ordinary builds should then use `ci`.

HTML is written to `reports/shell-cli-manual/`. TypeDoc receives explicit public entry points, handbook Markdown and generated reference pages. Invalid links/paths and undocumented referenced symbols are configured as build failures. The documentation build does not replace the repository's application typecheck or test suite.

The pinned renderer candidate is TypeDoc 0.28.20 with TypeScript 6.0.3. Upstream added TypeScript 6 support in TypeDoc 0.28.18. A supported version declaration is not a substitute for running this repository's renderer build.

## Pull-request and release workflow

Change behavior and its source metadata together. Generate the reference, run tests and the authored-example audit, then build the site. Review output changes as generated evidence, not as a second authoring surface. The manual workflow uses read-only repository permission and publishes workflow artifacts, not a public website or release.

When shipping a CLI candidate, build documentation from that same source. Include or attach its handbook/reference and retained manifest, then inspect archive contents. Link checks do not prove that a website is accessible or keyboard-friendly; perform a browser review before public website deployment. Later public hosting, multi-version navigation and translations are explicit follow-up scope, not silently enabled by this build.
