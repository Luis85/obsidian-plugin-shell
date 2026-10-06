# Offline review QA — separate vanilla-JavaScript renderer

**final result: passed**

This result is narrowly scoped to the browser checks and visual review of `review-preview/editor-only-review.html`. It does not unblock `design-qa.md` for the Vue source, certify accessibility, or imply identical behavior across renderers.

## Browsers and capture conditions

Chromium, device scale 1. Desktop 1600 × 1000 CSS/pixel dimensions; mobile 390 × 844. HTML was loaded with Playwright `page.set_content` because the environment blocks `file://` navigation. This gives an opaque origin, so browser storage is unavailable: “Session only” and the export reminder are expected and visible in evidence. Direct file opening and persistence were not verified in this environment.

## Observations

- Global branding, account controls, workspace switcher, navigation rail, and simulated application content are removed from the DOM, not merely hidden with CSS.
- The central sitemap keeps the dark teal selection/path language. Editor controls are grouped in a slim toolbar. Contextual tree/inspector panels do not navigate into a sample SaaS app.
- Related-page lists show the parent, siblings and children, and select the existing page entity.
- The initial desktop view retains the inspector. The initial mobile view keeps it closed; selecting in the mobile tree replaces that tree with the inspector.
- Icons in the compact mobile map/outline and add controls initially disappeared due to legacy responsive selectors; those selectors were fixed and browser visibility checks now pass.
- No document-wide horizontal overflow was observed at 390 × 844. The full-site map becomes a deliberately zoomed-out overview at that size; labels require zoom or tree/outline navigation.
- System typography and local SVG icons render without external assets. Text remains dense in the full-map overview, consistent with a zoomable editor; this is not a readability claim at every zoom level.

## Evidence

- `editor-desktop.png`: initial 1600 × 1000 editor, selected Project details.
- `editor-related-pages.png`: tree and Related inspector visible, same desktop dimensions.
- `editor-journey-overlay.png`: journey remains on the map without simulated application screens.
- `editor-mobile.png`: initial mobile canvas, 390 × 844.
- `editor-mobile-related.png`: mobile contextual inspector.
- `review-browser-tests.json`: 22 passing browser checks, zero observed console errors, zero network requests.

Visual comparison is against the requested shell-removal behavior and the prior prototype's dark diagram language, not a pixel-perfect comparison to the old application-shell mock. The actual Vue source lacks a corresponding runtime capture; do not treat these review images as its implementation evidence.

## Remaining test gaps

The requested Vue runtime, Safari, actual file-origin storage, mobile touch gestures, screen readers, and large-document performance remain untested. Inspect and verify these after a real dependency build. The two runtimes also have different drag/duplicate/delete semantics, documented in the README.
