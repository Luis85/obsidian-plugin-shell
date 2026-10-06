# Archive

This folder keeps the repository's historical plans, reviews, iteration and
execution records, dated research and retained evidence. They stay here for
traceability: links from current documents, commit history and pull requests
still resolve.

- **Not maintained.** Archived documents describe the repository at the date or
  candidate they name. Commands, paths and status claims inside them may be out
  of date; nothing here is updated when the code changes.
- **Not normative.** An archived document is a requirement or decision record
  only when a current document links it as one. Otherwise the current
  documents outside `docs/_archive/` win.
- **Never shipped.** Generated projects and extracted kits never receive anything
  under `docs/_archive/` (`maintainerFolders` in
  `bin/compiler/emitters/framework-scope.ts`).

## Structure

The layout mirrors `docs/`: a file that lived at `docs/<path>` lives at
`docs/_archive/<path>`. For example `docs/development/ITERATION-TWO.md` is now
[`development/ITERATION-TWO.md`](development/ITERATION-TWO.md) and the retained
evidence JSON is under [`testing/evidence/`](testing/evidence/).

## Archiving a document

1. Move it with `git mv docs/<path> docs/_archive/<path>` so history follows the file.
2. Rewrite every relative link that points to it, and the relative links inside
   it (its depth changes by one folder). Links between documents that move
   together stay unchanged. Then run `npm run check:repository` for the README,
   AGENTS.md and CHANGELOG links.
3. If `scripts/quality/docs-launchers-allowlist.json` names the old path, change
   that entry to the exact archived path (do not broaden it to
   `docs/_archive/**`), then run `npm run check:docs-launchers`.
4. If `bin/compiler/emitters/framework-scope.ts` names the file (for example as a
   testing guide), remove it there; the whole archive is already excluded from
   generated projects. Run
   `node --test tests/tooling/project-generator-framework-scope.checks.mjs`.
5. Keep a document in place when code reads it by path (for example
   `docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md`,
   `docs/testing/test-plan.json`) or when it is still normative.
