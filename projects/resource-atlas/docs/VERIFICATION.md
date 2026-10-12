# Verification record

The prototype was verified on 11 October 2026 against the standalone compiled HTML.

| Check | Result |
| --- | --- |
| Pure calculation, date, validation and serialization tests | 58 passed |
| Integrated browser workflow groups | 10 passed |
| Focused recovery, persistence and import regression groups | 9 passed |
| Resource Atlas → each of the four existing prototypes | 4 passed |
| Each existing prototype → Resource Atlas | 4 passed |
| Browser page errors during the exercised flows | 0 |
| External HTTP requests during the exercised flows | 0 |

The integrated flows used real controls and actual downloaded files. They covered creating a plan, decimal FTE, inclusive dates, invalid date rejection, drawing, moving and resizing assignments, keyboard movement, undo/redo, shared and role-specific partial blocks, saved drafts, JSON and Markdown round trips, and reloading persisted state. Exchange checks preserved native ownership and confirmed idempotent forwarded links.

The focused regressions covered full-duration draft creation, protection of unsaved edits from native import APIs, unnamed blocks, malformed preferences, stale connection targets, failed writes and recovery, another-tab notifications, safe registry lookup for unusual valid IDs, and maximum-length names when duplicating records. Recovery downloads completed without unload dialogs.

## Visual review

The initial review covered 1440px desktop, 1024px tablet and 390px phone layouts; dark and light themes; timeline and inspector states; and the time-distribution report. One correction batch improved narrow assignment labels and the inspector ledger. The final confirmation covered those changes and the phone role summary.

After that confirmation, the role summary's planned PT column was moved directly beside the role name. A targeted DOM geometry check on the final build confirmed that this result is visible without horizontal scrolling at 390px: the first PT cell ends at x=306px. No additional screenshot iteration was required.

## Reproduce

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run verify
npm run verify:edge-cases
```

Set `RESOURCE_CHROMIUM_PATH` to use a specific Chromium executable. Set `FAMILY_DIST_PATH` to the directory containing the four companion HTML files for exchange checks. Missing companion artifacts are reported as skipped rather than claimed as tested. The full original compatibility run used all four actual companion artifacts.

The browser script writes detailed results and screenshots to `.qa/`. Those generated files are excluded from the source package; run the commands to reproduce them. This is prototype verification, not a claim of testing a native Obsidian plugin installation or every browser and operating system.
