# Modular CSS and composed styles.css

> **Contract:** PRD 0.3 extension; requirements CSS-01–12.  
> **Status:** Required build/authoring behavior, not an implemented stylesheet pipeline.  
> **Related:** [PRD](../product/PRD.md), [setup and makers](../development/SETUP-AND-MAKERS.md), [research](../research/2026-09-22-setup-makers-events-styles.md).

## 1. The intended result

Developers author small, cohesive CSS files and Vue component styles. The build produces **one complete `styles.css`** next to the plugin's `main.js` and `manifest.json`. Local installation and release publication use that exact composed artifact.

```text
src/styles/index.css ── ordered CSS source imports ──┐
                                                   │
imported Vue components ── compiled SFC styles ──────┼─ shared Vite CSS pipeline
                                                   │        │
approved local assets/dependency styles ────────────┘        ▼
                                                       dist/styles.css
                                                            │
                                      local fixture vault / release assets
```

Obsidian loads a plugin-root stylesheet named `styles.css`. This is the installed plugin directory, not a requirement to hand-edit a monolithic file at the repository root. Vite supports CSS import inlining/rebasing and single-file library CSS output. Use those supported facilities rather than building a CSS compiler from string concatenation. [S10, S11, S13]

**CSS-01 — Source/output separation.** `src/styles/**` and component-owned styles are maintained source. `dist/styles.css` is generated and ignored by Git. Do not edit it, use it as an input, copy it back over source, or require developers to manually concatenate CSS before release. A generated header identifies the authoring entry without embedding timestamps or machine-specific paths that destabilize the artifact hash.

## 2. Source organization

The default means **modular CSS files**, not mandatory hashed CSS Modules. Ordinary namespaced CSS is appropriate for native Obsidian elements and shared primitives. Scoped SFC styles are appropriate for Vue-owned component internals. Standard `.module.css` / `<style module>` support may be used deliberately, but is not required just to split a stylesheet. [S10, S12]

An illustrative layout is:

```text
src/
  styles/
    index.css
    tokens.css
    base.css
    layout.css
    components/
      index.css
      buttons.css
      fields.css
    features/
      index.css
      example.css
    native/
      index.css
      settings.css
      modals.css
      notices.css
    utilities.css
  presentation/
    example/
      ItemCard.vue             # may contain <style scoped>
      ItemCard.css             # optional externally owned SFC style source
scripts/
  build/
    styles.mjs
    vite-shared.mjs
  quality/
    check-styles.mjs
  make/
    makers/style.mjs
    templates/
```

Create only modules with an actual use. A large product can split its feature/native entries further without changing the pipeline.

**CSS-02 — Explicit composition.** Use a single ordered root entry for ordinary shared/feature/native CSS and small subentries as needed. Both plugin and harness reach it through shared composition. Prefer an entry like:

```css
@import './tokens.css';
@import './base.css';
@import './layout.css';
@import './components/index.css';
@import './features/index.css';
@import './native/index.css';
@import './utilities.css';
```

Imports are resolved at build time. They are not runtime requests for loose source files in a user's vault. Do not automatically include every CSS file through an unordered filesystem scan, hide scratch styles in a wildcard, or append an import after ordinary rules where CSS import placement would be invalid.

A single side-effect style entry in bootstrap may import `src/styles/index.css`. `main.ts` remains composition-only. No generator inserts style strings or DOM `<style>` construction into the plugin entrypoint.

## 3. Build composition

**CSS-03 — One processing implementation.** Shared Vite configuration under `scripts/build/` owns CSS resolution, Vue style compilation, supported transforms, minification, asset treatment, and output validation. Conventional Vite config files remain thin root adapters. `styles:build`, `build`, `build:dev`, `dev:local`, and harness builds reuse these rules; they do not maintain separate concatenation scripts.

For the selected compatible Vite version, configure single CSS extraction and the `styles` filename. Current documented facilities include `build.cssCodeSplit: false` and `build.lib.cssFileName: 'styles'`; prove the exact resulting filename/config behavior against the pinned version. [S11, S14]

The styles command must account for **the complete imported UI graph**, including compiled SFC styles. Building only `src/styles/index.css` while omitting component styles is not a valid complete stylesheet build. It may invoke the relevant full plugin build internally rather than duplicate SFC discovery/compilation.

**CSS-04 — Complete self-contained output.** The native plugin build emits exactly one required plugin stylesheet. No unresolved local `@import`, remote stylesheet import, development URL, unintended CSS chunk, or unshipped asset path remains. Approved local static assets are inlined for the three-file baseline or require a separately specified packaging extension; do not silently emit an `assets/` directory that the installer never copies. No CDN fonts or runtime dependency downloads.

Parsing and URL checks must understand CSS syntax and distinguish data URLs, local fragments, and actual network/resource requests. Avoid regex-only rewriting of CSS imports/URLs. Missing imports, cycles, syntax failures, and invalid asset resolution fail the build. Required license notices and any explicitly supported semantic comments are preserved and tested through minification.

**CSS-05 — Deterministic cascade.** Shared styles have a declared order; component-local styles are encapsulated rather than relying on incidental chunk order. Preserve meaningful conditional imports/media/supports contexts. Do not sort or deduplicate rules blindly: repeated rules and imports under different conditions may be intentional.

Use plain ordered author CSS as the default. Cascade layers are optional only after testing interaction with Obsidian/theme rules, because introducing layers changes precedence rather than merely organizing files. Avoid blanket `!important` fixes and selectors whose correctness depends on an unrelated harness rule.

## 4. Vue component styles

**CSS-06 — SFC support.** Styles declared by imported Vue SFCs must be compiled and included in the same output. Preserve Vue-generated scope identifiers and CSS Module class mappings. Raw concatenation of `<style scoped>` text is invalid because it omits the compilation that binds selectors to the component markup. [S12]

For externally stored component styles, declare ownership explicitly: a file consumed as scoped SFC source must not also be imported globally through `src/styles/index.css`. Avoid accidentally loading two differently scoped copies. Moving a style into a separate file does not waive either file's normal source-size policy.

Vue scoped styles do not style arbitrary host-created DOM just because it appears nearby. Native settings/modals/notices need owned namespaced rules in the native style group, or an explicitly mounted Vue subtree with matching compiled styles. Teleported content and pop-out windows require their own tested ownership/inheritance path.

## 5. Native-friendly style conventions

**CSS-07 — Namespace and tokens.** Every plugin-owned global rule is scoped to the generated plugin namespace or an owned element class; all native roots receive that namespace. Tokens resolve to Obsidian semantic variables where appropriate. Example, after choosing the ID `field-notes`:

```css
.field-notes {
  --field-notes-surface: var(--background-primary);
  --field-notes-border: var(--background-modifier-border);
  color: var(--text-normal);
}

.field-notes .field-notes-item-card {
  background: var(--field-notes-surface);
  border: 1px solid var(--field-notes-border);
  padding-inline: var(--size-4-3);
}
```

This is authoring guidance, not a required default visual design. Setup updates owned namespace definitions/references safely; it does not replace unrelated user text globally.

Do not redefine global `body`, `button`, `.modal`, or `.notice` styles for the whole host. Apply the plugin's own class to the appropriate native root, respecting host-owned layout and lifetime. Shared tokens needed by a modal must be available at that modal's owned root, not only under a view container elsewhere in the document.

Use logical spacing, theme variables, focus styles, reduced-motion handling, and responsive layouts. No global reset and no mandatory Tailwind/Sass/UI framework. State classes and narrowly scoped dynamic custom properties are allowed; they are not permission to inject whole runtime stylesheets. Third-party style assets require provenance and distribution review.

## 6. Browser/native parity and watch behavior

**CSS-08 — Shared sources, explicit artifact proof.** Interactive harness HMR uses the same source entries, Vue transforms, and style rules as the plugin. Its fixture host shim is separate and clearly identified; it is never part of the native `styles.css`.

A built-harness artifact-fidelity scenario also loads the exact candidate `dist/styles.css`, with no second independently generated plugin stylesheet layered on top. The matching Vue scope/CSS-Module identifiers must be proved across the two builds; share root/transform settings or the compiled UI as needed. If the compiler would derive different identifiers, fix the composition rather than hiding missing styles with a broad shim.

Do not claim development-injected styles are byte-identical to production-minified CSS. The guarantees are shared authoring/processing for fast iteration and a separate test of the exact packaged stylesheet. Record the CSS hash in release/browser evidence. CSS-only changes invalidate prior visual/host evidence for a candidate.

**CSS-09 — Changes are observed.** Editing a module, adding one through `make style`, removing an import, and changing an SFC style all trigger the correct dev/build path. Tests verify stale rules disappear when ownership is removed. Vite-injected HMR styles are acceptable in the browser development server; production relies on the packaged stylesheet rather than a custom style-tag injector.

A failed style build leaves the last good installed plugin asset set unchanged. A new stylesheet must not be installed alongside an unrelated older JavaScript bundle when scoped/module identifiers may have changed. The local installer stages and validates the complete candidate set before replacement.

## 7. Maker integration

**CSS-10 — A style maker that connects the file.** `npm run make -- style item-card --feature tasks` asks for or validates the intended owner. It creates a small namespace-correct module and updates the appropriate ordered import entry once, or attaches it as scoped component source when that mode is selected. Its dry run shows the order/registration edit.

`make feature`, `make view`, and `make modal` reuse this recipe. No detached unused CSS files, duplicate imports, direct edits to output, or second harness stylesheet. Re-running is safe; collisions or changed registration anchors are errors. The recipe includes a representative style/build assertion and identifies where to add visual tests.

## 8. Quality, size, and commands

**CSS-11 — Source limits versus output limits.** Each handwritten CSS file remains
at most **400 code lines**, excluding comments and blank lines under the owner's
iteration 03 amendment. An entire `.vue` file counts template/script/style code
together. Tests/helpers remain at most 450 code lines. Compiled `dist/styles.css`
may exceed 400 because it is generated composition output; it remains subject to
artifact-size budgets, complete-source provenance and output validation. Do not
exempt handwritten large files by naming them generated.

The existing initial CSS artifact budget of 100 KiB remains a proposed target, not a substitute for source maintainability. Minification does not make an oversized source file comply with its line limit.

| Future command | Contract |
| --- | --- |
| `npm run styles:build` | Compose the complete plugin stylesheet through the same build graph, including SFCs; may delegate the plugin build. |
| `npm run styles:check` | Verify source ownership/imports, CSS syntax and policy, one artifact, URLs/assets, and required output integrity. |
| `npm run dev:ui` | HMR from the shared style source/pipeline. |
| `npm run dev:local` | Watch, rebuild, and safely stage the matching JS/CSS/manifest set. |
| `npm run make -- style ...` | Add a module and its explicit integration/test. |

Styles checks are part of `verify`; release checks consume the accepted candidate rather than rebuilding it. Use a supported CSS parser/checker as needed; the JavaScript linters are not described as validating all CSS syntax or theme compatibility.

**CSS-12 — Acceptance evidence.** Test ordered imports, missing/cyclic imports, SFC scoped extraction, optional CSS Module mappings if offered, local asset rebasing, forbidden external imports, duplicate ownership, one emitted stylesheet, no harness-shim leakage, HMR after maker additions, removed-rule cleanup, failed-build last-good behavior, generated output exemption versus source LoC, two builds' identifier parity, and installation/release CSS hash equality. Browser/native cases cover light/dark, narrow pane, modal/settings roots, pop-out windows, and interference with unrelated host UI.
