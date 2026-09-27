# Verification evidence

`build.json` identifies the standalone HTML. `domain.tap` and `schema.json` record executable checks. `browser.json` records the local exact-artifact interaction suite: 49 checks, zero page errors, and zero network requests. It uses the documented in-memory Storage test adapter, not real file-origin persistence.

The original HTML is byte-identical to the reviewed conversation artifact:

```text
f6261d764e2579a4ace89db034973f3da0b30a61bd744615b7dcea25598ded07  jev-studio.html
```

Screenshots are not committed. `python tests/browser.test.py` and `python scripts/capture-previews.py` regenerate them from the synthetic demo when Playwright and Chromium are provisioned. No personal vault contents are included.

These receipts are not evidence of live Jev inference, model accuracy, native Obsidian behavior, Safari/iOS acceptance, or a full repository CI run.
