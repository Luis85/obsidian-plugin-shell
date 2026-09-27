# Jev Studio — the decision workbench

A self-contained, offline product prototype for authoring TypeSafe Jev decision prompts with scoped Obsidian-vault context. **Open [jev-studio.html](jev-studio.html) in a desktop browser.** No server, package installation, account, or API key is needed to use the supplied file.

This is an interactive prototype, **not a native Obsidian plugin**. It was designed against the inspected Obsidian Plugin Shell PR #5 baseline, `b66200e2f43cd0682028f0151f9bdffc853cd2bf`, and is retained under `docs/concepts/jev-prompt-editor/` as a design reference. The repository addition is stacked on PR #5 at `e540157e63c9b81fdadb7bd84eca4aa56a8809b0`; it does not install a native feature. See [integration/PR5-HANDOFF.md](integration/PR5-HANDOFF.md) for the native implementation boundary.

## First walkthrough

1. Start with **Route an inbox note**. Expand a question and change its instructions, options, yes/no criteria, or scoring rubric.
2. Open **Vault state**. Keep the synthetic demo, or choose a small local Markdown folder / selection of `.md` files. Review the import before replacing the in-memory snapshot.
3. Choose an active note and a few references. Configure body, allowlisted properties, tasks, headings, selection text, and optional one-hop links. Inspect the resolved state.
4. Open **Test bench** and replay a clear, ambiguous, or negative fixture. These are synthetic responses that exercise the UI and review policy, **not model inference or accuracy evaluation**. A separately obtained real response can also be imported and structurally checked.
5. **Save version**, edit again, then compare and restore from **Versions**. Restoration first checkpoints the current valid draft.
6. **Export JSON**. Choose a reusable recipe, a full library backup, or a resolved Jev request. The latter requires explicit acknowledgement because it contains selected note content and paths.

The **How it works** guide can be reopened at any time. Keyboard shortcuts: Ctrl/Cmd+K for library search, Ctrl/Cmd+S for a named version, and Ctrl/Cmd+E for export.

## Working functionality

The library supports four starting templates, blank creation, search, duplicate, lifecycle status, reversible archive, and version history. Question editing supports Choice, Score, and Noul; add/remove/reorder; contextual validation; and a live JSON preview. Library imports create independent copies rather than replacing existing work.

Vault imports use browser file selection and are read-only. The local parser supports a deliberately small frontmatter subset, Markdown tasks/headings, and wiki-links. It is not Obsidian's parser and does not execute Dataview, Templater, scripts, or imported HTML. Ambiguous link targets are skipped rather than guessed.

Review rules treat Choice/Score confidence separately from Noul probability. Default thresholds are illustrative, not calibrated for a real vault. Results become stale when the recipe, policy, or resolved state changes. No result moves, writes, deletes, or modifies a note.

## Three different JSON roles

| Format | Purpose | Contains resolved vault content? |
| --- | --- | --- |
| `jev-prompt`, schema 1 | Editable recipe: questions, model, bindings, policy, metadata | No |
| `jev-prompt-library`, schema 1 | Recipes and immutable recipe revisions | No |
| Jev API request | `model`, `state`, `questions` in the documented provider shape | Yes, after explicit review |

These formats are **not** PR #5 companion project JSON. No companion import, generation, or shell compatibility qualification is claimed. The provider request compiler uses a supported text-only authoring subset; it does not expose all structured instruction/criterion forms the broader API accepts.

`schema/` contains JSON Schema descriptions of the emitted authoring and request subset. Domain validation adds checks JSON Schema alone does not express here, including unique question/option IDs, forbidden object keys, and ordered Noul thresholds. The runtime validators remain the executable authority.

`examples/` includes a starter recipe/library, a request using only synthetic demo notes, and an explicitly synthetic response. **The synthetic response is not evidence of Jev performance.**

## Privacy and persistence

No network connection or API key entry exists. A Content Security Policy blocks connections and allows only the exact embedded scripts by SHA-256. Vue templates are compiled at build time; no `unsafe-eval`, CDN, external font, or image request is required.

Only valid prompt recipes and versions are stored through the browser repository. Imported note bodies, the selected snapshot, and imported responses remain in memory. Reloading starts the synthetic demo again. Authored instructions and rubrics may themselves contain sensitive material; review them before exporting a recipe or library.

Hidden/private path segments, `private: true`, `ai: false`, and supported private/no-AI tags are excluded. Configured folder prefixes are additionally excluded during context compilation. Metadata is allowlisted. The small secret-pattern warning is not a comprehensive scanner or a guarantee of confidentiality. Explicitly reviewing the actual exported state remains necessary.

When browser storage is inaccessible or incompatible, the interface reports memory-only mode and preserves the original stored value. When a save fails, the last canonical state is retained and an error is shown. Export JSON to keep work before closing. Browser storage behavior can differ for local files or privacy modes; a downloaded JSON backup is the portable recovery path.

## Deliberate prototype limits

- At most 100 recipes, 50 versions per recipe, and 24 questions per recipe.
- Choice: 2–255 options in this editor; Score: 2–10 levels; Noul: explicit yes/no descriptions in this editor.
- Import: at most 1,500 inspected files, 250 Markdown notes, 5 MB selected Markdown, and 256 KB per note.
- Context: at most 20 references and 200–30,000 body characters per note. Clipping is visible. Character counts are **not token-budget guarantees**.
- Folder selection is a snapshot, not a watcher. Active note and selection are chosen manually in the browser; there is no live Obsidian connection.
- The displayed short fingerprint detects ordinary changes for UX purposes; it is not a cryptographic approval or security token.
- Imported response checks verify shape and numeric consistency, not provenance, semantic correctness, or actual provider execution.

## Source, build, and verification

The provided artifact was built with **Node 22.16.0, TypeScript 5.8.3, and Vue 3.5.13**. The Vue runtime is bundled with its MIT notice. There is no Nuxt framework, Pinia, or Nuxt UI runtime in this standalone build. Porting to PR #5's actual pinned stack is a separate native integration step, not an accomplished compatibility claim.

With compatible Node and `tsc` already available:

```sh
node scripts/build.cjs
node --test tests/domain.test.cjs
node scripts/export-examples.cjs
```

`TSC` can point to a specific TypeScript compiler executable. The build makes no network requests. `dist/` is regenerated from the supplied TypeScript and template sources; the runtime file embeds scripts/styles and its CSP hashes.

Browser checks additionally need Python, Playwright, and Chromium already installed:

```sh
python tests/browser.test.py
```

Set `CHROMIUM` to a different Chromium executable as needed. Optional schema/example checks need Python's `jsonschema` package:

```sh
python tests/schema.test.py
```

The exact-artifact verification recorded **64 domain tests, 49 browser checks, and 9 schema/example checks passed**, with zero page errors and zero network requests in the interaction suite. Coverage includes editing, real JSON downloads, import copies, versions, privacy exclusions, stale results, response validation, storage-failure handling, and responsive layouts.

**Verification scope:** the managed browser blocked file and localhost navigation. The suite rendered the exact generated HTML bytes using Playwright `set_content`, with an explicit in-memory Storage test adapter. This checks the shipped scripts, CSP, layout, controls, and downloads, but does not qualify real local-file persistence, Safari, iOS, native Obsidian, a screen reader, or the live Jev endpoint. No managed policy was bypassed. Evidence files distinguish these scopes.

## Package map

- `jev-studio.html` — standalone interactive artifact.
- `docs/RESEARCH.md` / `docs/RESEARCH.html` — source-grounded research and design rationale.
- `integration/PR5-HANDOFF.md` — PR baseline, architecture seams, native work packages and acceptance gates.
- `src/domain`, `src/application` — host-independent contracts, compilation, policy and canonical transactions.
- `src/adapters`, `src/presentation`, `src/bootstrap` — browser adapter, UI, and composition.
- `schema`, `examples` — documented JSON interchange and synthetic examples.
- `tests`, `evidence` — runnable checks and exact-artifact receipts. Screenshots are reproducible with the included browser/capture scripts and are not committed.
- `THIRD-PARTY-NOTICES.md` — included Vue license; no font files are distributed.

This package does not publish a release, authorize a provider call, or grant permission to read/write a live vault.

## Repository placement and integrity

From the repository root, open `docs/concepts/jev-prompt-editor/jev-studio.html` in a browser. GitHub shows HTML source rather than executing the prototype. The complete runtime is embedded, so only that one file is needed for review.

This folder is maintainer-only. The developer-kit distribution and companion project generator explicitly exclude it, including its embedded vendor runtime and generated files. No production dependency, companion project schema, native plugin, provider integration, or root lockfile is changed.

Validate the checked-in inventory before rebuilding or rerunning tests:

```sh
node docs/concepts/jev-prompt-editor/scripts/manifest.cjs
```

The manifest records the checked-in files and their SHA-256 hashes, excluding itself, transient screenshots, caches, and dependencies. Test/build receipts may change when rerun. After intentional source changes, rebuild and test, then regenerate the inventory with `node scripts/manifest.cjs --write` from this folder.

The retained `evidence/browser.json` is from the local exact-artifact browser run described above; it is not a hosted CI or native-Obsidian acceptance receipt.
