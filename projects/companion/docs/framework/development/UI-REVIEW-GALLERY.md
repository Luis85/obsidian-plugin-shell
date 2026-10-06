> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**

# UI review gallery

> **Evidence for human review — not acceptance, not a baseline.** The gallery shows what a surface looked like in one browser at one commit so a person can look at it. It is never compared with stored images, never passes or fails a gate and never accepts a requirement.

Screenshots from the browser tests used to disappear inside one large `reports/` archive with no index. The gallery captures a fixed matrix and indexes it, so a reviewer opens one page.

## Run it

```sh
npm run ui:gallery                       # this repository: the served harness
node bin/app ui gallery                  # same, through the CLI (add --json for one JSON result)
# in a generated project, `npm run ui:gallery` captures its built clickdummy.html
node bin/app ui gallery --target clickdummy --out reports/ui-gallery --input clickdummy.html
```

| Option | Meaning |
| --- | --- |
| `--target harness\|clickdummy` | `harness` serves this framework's `dist-harness` (built first when missing). `clickdummy` opens a built `clickdummy.html` from disk. |
| `--out <dir>` | Output folder, relative to the project and never `.git`, `node_modules` or outside it. Default `reports/ui-gallery`. Earlier PNGs, `index.json` and `gallery.html` in it are replaced; other files are kept. |
| `--input <file>` | Clickdummy file for `--target clickdummy`. Default `clickdummy.html`; run `npm run build:clickdummy` first. |
| `--json` | Print one JSON receipt (counts, failures, commit) instead of text. |
| `--dry-run` | Only with `node bin/app ui gallery`: show the plan, launch nothing. |

In a generated project `npm run ui:gallery` already means `--target clickdummy`.

The browser comes from `SHELL_CHROMIUM` (an absolute executable path) when set, otherwise the Chromium revision pinned by the installed Playwright (resolution is shared with the other browser scripts in `scripts/testing/browser-executable.mjs`). The tool never downloads a browser. An older installed revision is refused unless you opt in with `SHELL_CHROMIUM`.

## What is captured

For every surface, state, scenario, theme and width one full-page PNG:

- **Surfaces.** Harness: each navigation page of the simulated leaf. Clickdummy: every entry of the *Browse surfaces* selector, opened through its `#surface=<id>` address.
- **States.** Harness: `default`. Clickdummy: `default`, `loading`, `empty`, `error`, `disabled` from the *Preview state* picker. Editor surfaces disable that picker, so only `default` exists for them.
- **Scenarios.** Clickdummy only: each authored scenario in the *Authored scenario* selector, recorded with the state the scenario applies. Pages without scenarios have none; none are invented. See [clickdummy scenarios](COMPANION-CLICKDUMMY.md#authored-scenarios).
- **Themes and widths.** `light` and `dark` (the host-style `theme-light`/`theme-dark` body classes), at 1280 and 360 pixels wide. A 360 pixel capture is a layout view, not device qualification.

Every capture uses a fresh page with fixed locale and time zone, device scale factor 1, reduced motion, frozen animations, and waits for network idle, fonts and two animation frames. Two runs of the same build produce identical PNG hashes in the harness. Modal dialogs are not separate surfaces.

## Output

`reports/ui-gallery/` holds:

- `<surface>__<state>__<scenario|none>__<theme>__<width>.png`
- `index.json`: `schemaVersion`, `notice`, `target`, `commit` (`git rev-parse HEAD`, `null` without git), `generatedAt`, `entries` and `failures`. Each entry has `surfaceId`, `surfaceLabel`, `state`, `scenario` (`null` for none), `theme`, `width`, `file`, `sha256`, `commit` and `timestamp`. Entries are ordered by surface, state, scenario, theme and width, independent of discovery order.
- `gallery.html`: self-contained (inline CSS and script, relative images, no remote resources, strict content security policy). Grouped by surface, filterable by theme and width, each capture captioned with state, scenario, theme, width and hash prefix, with the disclaimer at the top. All text taken from the project is HTML-escaped.

A capture that fails is listed under `failures` and in `gallery.html`, the other captures are kept, and the command exits non-zero (1 for capture failures, 2 for unusable options or startup). A stale capture is never left behind.

## In CI

The `showcase` job in `.github/workflows/ci.yml` runs `npm run ui:gallery` after the served end-to-end tests (also when they fail), uploads `reports/ui-gallery` as the separate artifact `ui-review-gallery` (retention 14 days) and appends a link with the disclaimer to the job summary. Download the artifact and open `gallery.html`. The job runs on Linux for pushes and manual runs; pull requests run only its Windows leg, so they have no gallery from this job.

Generated projects get the same script and `npm run ui:gallery`; wiring it into their CI is part of the generated workflow.

## Limits

- It is a screenshot catalogue. It does not assert layout, accessibility or behavior; the Playwright specs, `test:ui-quality` and native tests do.
- The harness is a simulated host; native Obsidian rendering is qualified separately.
- Clickdummy captures show synthetic read data and local effects only.
- Image hashes are for identification and reproducibility, not for approval. Do not commit the PNGs as baselines or add `toHaveScreenshot` checks.

## Implementation

| File | Responsibility |
| --- | --- |
| `scripts/ui/review-gallery.mjs` | Entry for `npm run ui:gallery` |
| `scripts/ui/gallery-options.ts` | Option validation shared by the script and `ui gallery` |
| `scripts/ui/gallery-matrix.ts` | Matrix expansion, deterministic order, file names |
| `scripts/ui/gallery-report.ts` | `index.json` entries and escaped `gallery.html` |
| `scripts/ui/gallery-run.ts` | Capture loop over an injected session; writes files, always closes the session |
| `scripts/ui/gallery-browser.ts`, `gallery-harness.ts`, `gallery-clickdummy.ts` | Playwright sessions for the two targets |
| `bin/adapters/framework/ui-gallery.ts` | `node bin/app ui gallery` (validates, then runs the script) |
| `tests/tooling/framework-ui-gallery*.checks.mjs` | Matrix, ordering, index shape, HTML escaping and CLI parsing with a fake capture function (no browser) |
