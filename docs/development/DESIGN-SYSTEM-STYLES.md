# Saved design system → Nuxt UI stylesheet

The companion and shell share a deterministic, dependency-free token validator and CSS compiler. This implements the design-system styling path on PR #5; it is not native companion conversion or arbitrary page/component-layout generation.

## Author, export, generate

Open **Design System → Nuxt UI styling** in the companion. Create or edit typed tokens in the existing sections. **Edit style bindings** selects an existing token for each Nuxt UI/shell role. Automatic uses visible conventional IDs; **Keep framework default** saves an explicit `null`. Unknown/missing tokens, wrong groups, untrusted CSS and cyclic generated-color references are errors rather than silently dropped inputs.

**Export stylesheet** downloads `design-system.css` from the saved declaration. Unsaved drafts are never exported. Markdown and offline HTML remain available and now include the effective frontend bindings and palette policy. No export installs or applies anything to the companion workbench or the host.

Alternatively, export the complete Project JSON and use the independent shell generator:

```sh
node shell.mjs generate --input /path/project.companion.json \
  --vault /path/existing-vault --target projects/my-plugin

# Review the returned inventory and use its actual planHash:
node shell.mjs generate --input /path/project.companion.json \
  --vault /path/existing-vault --target projects/my-plugin \
  --apply <reviewed-planHash>
```

Then enter the generated project and explicitly run `npm ci` and `npm run verify:project`. Its ordinary build imports the generated stylesheet and emits `dist/styles.css` together with the existing Nuxt UI and owned shell styles. No manual copy/paste, app-config editing, CDN, Nuxt server or extra dependency is required.

`companion:generate` remains the original byte-exact, write-free JSON handoff. `companion:scaffold` / `shell.mjs generate` is the reviewed compiler. Neither command publishes, enables a plugin or writes business data.

## Portable declaration

The existing `design.designSystem` schema 1 gains an optional, separately versioned frontend declaration. The full transfer remains version 3 with existing v1/v2 input compatibility. New code accepts earlier systems without `frontend`; older companion versions may reject the new extension rather than silently discard it.

```json
{
  "frontend": {
    "schema": 1,
    "target": "nuxt-ui",
    "colorPolicy": "declared",
    "bindings": {
      "primary": "accent",
      "background": "background",
      "bodyType": "body",
      "labelType": "label",
      "controlRadius": "control",
      "spacingUnit": "xs",
      "secondary": null
    }
  }
}
```

This is the `frontend` property of a complete validated design system, not a standalone project input. IDs refer to the correct existing collection. Omitted roles use conventions; explicit `null` disables inference. No arbitrary CSS, selector, JavaScript, source path, expression or font URL is accepted.

**Host policy** reads a color's optional host variable with its declared light/dark value as a fallback. **Declared policy** uses the saved hex palette exactly and ignores color host references. Both follow the shell's owned `.light`/`.dark` classes; `bindHostTheme` synchronizes those with the current owner document. Fonts retain their declared host/local-family policy independently of color policy. The host's font size still determines the meaning of `rem`.

## Generated artifacts and ownership

With the default source folder:

```text
src/generated/styles/
  project.css                   # managed import order: layout → design system → custom
  layout.css                    # extension: generated application layout
  custom.css                    # extension: application-specific overrides
  design-system.css             # managed, imports bounded generated fragments
  design-system/
    fonts.css
    typography.css
    spacing.css
    sizes.css
    radii.css
    colors.css
    theme.css
design/
  design-system.json             # original declaration
  style-manifest.json            # resolved roles, variables, helper classes and scope
```

Custom source folders relocate the whole product-style tree. The shared foundation remains in `src`. The manifest is deterministic and contains no timestamp or machine path. The browser's standalone CSS is the exact concatenation of the same fragments used by the generator.

All generated theme files participate in the existing reviewed plan, receipt hashes, stale-plan protection and rollback. Custom CSS is preserved. Editing a managed theme file creates a reconciliation conflict when regeneration needs to change it; it is never overwritten silently. Removing a design system emits the same empty managed fragments, so retained old files do not leave the retired theme active. Automatic deletion is not required.

## Token application

The finite binding catalog is `scripts/companion/design-system-roles.mjs`. It covers Nuxt UI primary/secondary/status colors; normal, muted, highlighted and inverted text; surface and border roles; interface/code fonts; body, label, page and section typography; the Tailwind spacing unit and shell spacing scale; control/surface radii; control height, icon size and inspector width.

Nuxt UI consumes scoped `--ui-*` semantic variables and Tailwind's prefixed `--ps-*` variables. The existing shell's host aliases are overridden only within that plugin root. Foundation CSS now consumes its own aliases, so the same design system reaches both Nuxt UI components and surrounding shell surfaces without redefining Obsidian variables.

Control radius is applied exactly to controls; Nuxt UI's other corners retain the framework's relative radius scale (`rounded-md` is based on 1.5 × `--ui-radius`). Control height is a minimum, not a forced clipping height. An inspector is opt-in markup, `data-ds-layout="inspector"`, with a maximum width of 100%; a size token does not invent an inspector or override native pane sizing.

Every typed token produces an owned variable even when it is not bound to a semantic role. The manifest lists its helper class and actual variable names. For plugin ID `my-plugin`, examples are:

```html
<div class="ps--my-plugin" data-plugin-ui="my-plugin">
  <h1 class="my-plugin-ds-typography-page-title">Project</h1>
  <section class="my-plugin-ds-padding-md my-plugin-ds-radii-surface">
    <span class="my-plugin-ds-colors-accent">Saved accent</span>
  </section>
</div>
```

Additional helpers cover background/border colors, spacing gaps and size heights. Helpers do not require dynamic Tailwind class discovery. All authored dimension/typography values, including px/rem, zero radii, font weight, line height and tracking, remain exact. A zero spacing token is valid; it is not inferred as the positive Tailwind spacing unit. Binding zero explicitly to that unit is rejected.

## Boundaries and safety

The compiler never writes `:root`, `body`, `html`, native CSS variables or another plugin's selectors. Each matching view/modal/portal must carry both its own `data-plugin-ui` marker and exact `ps--<id>` class. No global Tailwind Preflight, remote asset, font binary, `url()`, runtime script or `!important` is emitted. Existing forced-colors and reduced-motion protections remain effective. Local family names do not imply font availability or redistribution permission.

Guidelines remain plain documentation. Component-internal layouts, arbitrary variant recipes, breakpoint rules, shadows, animations and behavior are not inferred from prose or invented token groups. Unbound semantic roles retain their framework defaults. Accessibility remains a runtime responsibility: declared solid-color contrast checks are not proof for every host, state, opacity or combination.

## Verification

- `tests/tooling/project-generator-design-system.checks.mjs`: deterministic generation, semantic mappings, zero/unit handling, hostile inputs, exact scope, bounded fragments, legacy systems, custom roots and real plan/apply/regeneration conflicts.
- `tests/concepts/companion-design-styles.browser.py`: actual binding controls, guarded Save, Undo/Redo, JSON/CSS downloads, browser/CLI byte parity, computed token styling, modes and host/sibling-root isolation.
- `tests/e2e/design-system.spec.ts`: real bundled Nuxt UI buttons and inputs, fonts, corners, focus, mode changes, independent leaves and forced colors. It drives showcase controls, so it is example-owned and `examples:remove` deletes it with the showcase.
- `scripts/companion/qualify-styles.mjs`: independently generated project build plus its real Nuxt UI harness. It alters only the disposable qualification fixture to load the generated product CSS. CI retains the logs separately from native acceptance.

Run the repository's qualified Node/npm versions. Native Obsidian acceptance and release checks are still separate gates.

## Pinned implementation references

Nuxt UI 4.11.2 is consumed as a Vue/Vite library, not a Nuxt application. Its runtime CSS declares semantic variables and `.light`/`.dark` behavior: https://github.com/nuxt/ui/blob/v4.11.2/src/runtime/index.css . Its Button uses the component theme and explicit slots: https://github.com/nuxt/ui/blob/v4.11.2/src/runtime/components/Button.vue . Tailwind documents theme namespaces and CSS-variable resolution: https://tailwindcss.com/docs/theme . The shell's existing ownership pipeline remains the final selector/variable/keyframe gate.
