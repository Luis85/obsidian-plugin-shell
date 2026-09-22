# Original Obsidian host-style fixture

Fixture version 0.1.0; repository MIT license. This is original CSS, not copied/extracted Obsidian app.css. Public class/token concepts guide it; measurements are approximations. No fonts or proprietary assets are included.

Load `obsidian.css` on a body with `.obsidian-harness` and one of `.theme-light` / `.theme-dark`. Five ordered modules supply tokens, layout/settings, controls, overlays and accessibility defaults. Load this simulation before the actual plugin stylesheet in the future integrated harness; never include it in native plugin assets.

## Executable checks

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node scripts/testing/verify-baseline.mjs --repeat 3
```

The first command is an interactive loopback specimen server. The second is finite dependency-free verification of the fixture and verification tooling, with JSON/JUnit/Markdown reports. Neither initializes a plugin or tests a real native adapter.

Optional browser checks use an explicitly preprovisioned Playwright module/browser:

```sh
node scripts/testing/check-browser-specimen.mjs --mode served
```

With no local `@playwright/test` or browser installed, the command reports infrastructure failure and exits nonzero; it does not download anything. `--driver` and `--browser` accept explicit trusted local overrides for constrained diagnostic environments. `--mode inline` is an explicit fallback investigation mode, NEVER evidence for served navigation, CSS imports or CSP. There is no automatic fallback.

## Boundaries

The specimen writes no notes/storage and contains no real Vue, NotificationService, DocumentCreationService or Obsidian Modal/Notice. A browser dialog's focus behavior is not native adapter proof. Current tests cover a declared subset, not every host class, theme, editor/Properties surface or assistive technology.

`fixture-manifest.json` still records no native comparison. Screenshots are evidence artifacts, not automatically accepted pixel baselines. See [test strategy](../../docs/testing/TEST-STRATEGY.md), [test concept](../../docs/testing/TEST-CONCEPT.md), and [host-style contract](../../docs/testing/HARNESS-STYLES.md).
