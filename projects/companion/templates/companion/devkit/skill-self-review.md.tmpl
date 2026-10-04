---
name: self-review
description: Review your own change against this project's rules before asking for a pull request, then fill in the pull request template with real evidence. Use when a change is finished, before opening or updating a pull request, or when asked to self-review, double-check or prepare a change for review.
---

# Self-review before a pull request

Do not skip a step because the change looks small. Report what actually ran.

1. See which gates this diff needs: `node bin/app check --plan --json`. If the command
   is unknown in this checkout, continue with step 2.
2. Run `npm run verify:project` (it runs `npm run check` first). Run `npm run test:ui-quality` and
   `npm run ui:gallery` for any UI change, and `npm run -s dev:obsidian -- --json` when
   the host is involved and Obsidian is already provisioned (never download it yourself).
   A failing or skipped step goes in the pull request as it is.
3. Re-read your own diff (`git diff` plus `git status` for new files) against `AGENTS.md`:
   - Does each changed behaviour have a test that fails without it? No `it.todo`, skipped
     or snapshot-only test counts as evidence.
   - Architecture and file-size rules; no unsafe casts, weakened lint rules or removed tests.
   - Written data is exact (note IDs, unrelated frontmatter and body bytes kept); events
     are published only after a successful write; failures keep the user's draft.
   - No logging of note content, paths or raw error causes.
   - Only files inside this folder were touched; no secrets, `reports/` or `dist/` added.
4. Check traceability: requirement and `vi-*` obligations you completed are really
   implemented (the stub no longer throws, the `it.todo` became an assertion); the ones you
   did not touch are still listed as open. Compare the change with `BRIEF.md`: if it
   implies a product decision the brief does not make, ask the user instead of guessing.
5. Fill `.github/pull_request_template.md` (also for a local summary): requirement and
   interaction IDs, commands with their real result lines, UI evidence (`test:ui-quality`
   result and the `ui:gallery` artifact path), Obsidian evidence or "not run", and the
   untested scope. Do not write "all checks pass" without the output behind it.
6. Fix what the review found and rerun the affected step before reporting.
