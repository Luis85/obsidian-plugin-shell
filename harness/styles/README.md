# Original Obsidian host-style fixture

**Fixture version:** 0.1.0. **License:** repository MIT license. **Origin:** original implementation; not copied or extracted from Obsidian app.css. Public class/token concepts guide the interface; values/metrics are approximations. No fonts or proprietary assets are included.

Use `obsidian.css` as the explicit entry, with `.obsidian-harness` on the document body and exactly one of `.theme-light` or `.theme-dark`. Optional `.is-mobile` increases control size. Its five ordered modules cover tokens, host-like layout/settings, semantic controls, overlays, and accessibility defaults.

The production-component harness must load this host simulation before the actual composed plugin stylesheet. Keep gallery/scenario layout separate. The simulation and its controls never enter plugin release assets.

## Inspect and test

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node --test tests/harness-styles/server.test.mjs
```

The first is a standalone loopback server; use the printed address and Ctrl+C to stop. It does not install dependencies, initialize a plugin, write notes, expose a vault, or exercise native APIs. The page is a styling specimen; its demo notification/modal handlers are not NotificationService or Obsidian adapters.

Seven Node tests cover declared HTTP routes, CSS module serving, rejected paths/writes, safe response headers, and limited source tripwires. They are not the complete CSS/TypeScript/full-harness verification. Integration into the selected Vite/Vitest/Playwright projects is pending.

## Coverage and gaps

Provided: light/dark tokens, text/spacing/radii, workspace leaf/content/header, settings rows, inputs/selects/textareas/buttons/check controls, modal/notice/menu/suggestion appearance, hidden/focus/reduced-motion/forced-color rules.

Not provided: actual native widget behavior, Properties editor, complete CodeMirror/editor styling, every host DOM class, all user themes, real device behavior, or native pixel fidelity. Menu keyboard behavior and native portal targeting require future adapter tests. A CSS file cannot implement focus, cancellation, live announcements or asynchronous notification state.

**Last native comparison:** none. **Qualified native host:** none. A date or a filename must not be substituted for actual host-comparison evidence. See `fixture-manifest.json` and the [test contract](../../docs/testing/HARNESS-STYLES.md).

The review used inline Chromium rendering because the environment blocked browser navigation to loopback; Node tests exercised the server separately. See the [review](../../docs/reviews/2026-09-22-product-review.md) for precise test scope and failures fixed.
