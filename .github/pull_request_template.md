<!-- Paste real command output. "Not run" needs a reason. Agents: use the self-review skill. -->

## Summary

<!-- What changed and why, in two or three sentences. Link the issue or plan. -->

## Change type

- [ ] Product code (`src/`, `bin/`, `plugins/`)
- [ ] Tooling, scripts or CI (`scripts/`, `.github/`)
- [ ] Tests only
- [ ] Docs only
- [ ] UI change (screenshots or gallery below)
- [ ] Generated-project output (templates, devkit, golden files)

## Gates

Each line needs "result pasted" (summary of the real output) or "not run" with the reason.

- [ ] `node bin/app check --plan --base origin/main`: <!-- result pasted / not run + reason -->
- [ ] `node bin/app check`: <!-- result pasted / not run + reason -->
- [ ] `npm run verify -- --json`: <!-- result pasted / not run + reason -->
- [ ] `npm run check:self-review`: <!-- result pasted / not run + reason -->
- [ ] Relevant suites, `node scripts/testing/suites.mjs <suite>`: <!-- suite names and results / not run + reason -->
- [ ] Browser `npm run test:e2e`: <!-- result pasted / not run + reason -->
- [ ] Native (`npm run test:native`, explicitly provisioned scratch vault only): <!-- result pasted / not run + reason -->

## Evidence

- Verify report: `reports/verify/summary.md` <!-- paste the status table or path -->
- Evidence packets (`npm run evidence`): <!-- paths and candidate hash, or none -->
- UI gallery (`reports/ui-gallery/gallery.html`): <!-- attach as an artifact or link when the UI changed, otherwise n/a -->

## UI/UX checklist

Evidence for human review, not acceptance. No screenshot baselines (`toHaveScreenshot` and snapshot files are rejected).

- [ ] Axe result: <!-- violations count or not run -->
- [ ] Light and dark themes checked
- [ ] Narrow width checked (no horizontal scroll)
- [ ] Keyboard and focus order checked
- [ ] Gallery reviewed by a human
- [ ] n/a, no UI change

## Thresholds, ignores and suppressions

- [ ] None changed: no edits to `configs/quality/**`, coverage thresholds, lint rules, analyzer ignore lists, lint or type suppressions, or code-line limits
- [ ] Changed with owner approval: <!-- link the approval and name each change -->

## Untested scope

<!-- State what this change was not tested against, e.g. native host, Windows, mobile. "Nothing beyond the gates above" is only valid if true. -->

## Release and publication

- [ ] This PR does not authorize a release, tag, listing submission or publication. Those need a separate, explicit owner decision.
