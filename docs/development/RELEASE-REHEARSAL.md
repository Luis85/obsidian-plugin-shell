# Fixed-candidate release rehearsal

This iteration supplies a local version plan, a read-only release rehearsal and
validated [draft/promotion operation plans](RELEASE-OPERATION-PLANS.md). It does
not execute remote draft creation or publication. No release, tag,
listing, repository permission, environment protection or automerge change is
performed. Those remain explicit future work in the [full contract](MAINTENANCE-AND-RELEASE.md).

## Prepare metadata

Write reviewed release notes to a file and choose a version above the current
package version. For a project currently at 0.4.0:

```sh
npm run release:prepare -- --version 0.4.1 --notes-file release-notes.txt --dry-run
npm run release:prepare -- --version 0.4.1 --notes-file release-notes.txt
git diff -- package.json package-lock.json manifest.json versions.json CHANGELOG.md
```

The dry run prints the proposed five files and their before/after hashes without
writing. Apply uses the same shared file-plan engine as setup/makers, checks
concurrent edits, and rolls back owned writes on failure. It requires a strictly
higher three-number stable version, consistent source/lock/manifest metadata,
nonempty notes and an unchanged reviewed host floor. Historical `versions.json`
entries survive. Host-floor changes require their own evidenced review; this
command refuses a mismatch rather than silently adopting one. No Git operation
is part of version preparation. Review and commit through the normal PR process.

Metadata should land immediately before its corresponding release operation once
publication is implemented. Until then these are development versions, explicitly
not published releases. Do not submit to the directory while default-branch
metadata and public assets disagree. A failed future publication leaves a draft
and requires maintainer recovery; never move an existing public tag or overwrite
published assets to repair it.

## Retain a candidate

From a clean, committed checkout with exact Node 24.21.0/npm 11.19.1 and the strict
lockfile install, run:

```sh
npm run release:rehearse -- --commit <full-40-character-HEAD-SHA> --version 0.4.1
```

The command rejects aliases, a different commit and dirty/untracked source. It
runs the current `verify` once, including its production build, then copies the
resulting `dist` bytes without rebuilding. The immutable output directory is
`reports/release/<version>-<commit>/`, containing exactly:

- `main.js`, `manifest.json`, `styles.css` (installable root layout);
- `release-notes.md` (the committed changelog);
- `candidate.json` (source SHA, identity, version/floor, lock hash, file SHA-256,
  selected tools, qualified scopes and explicit missing acceptance).

`tools` and `qualification.node/npm` identify the actual qualified build runner.
`packagingNode` records the process that copied the already qualified bytes; pure
retention does not rebuild or claim that packaging itself qualifies that runtime.
The rehearsal CLI still requires actual Node 24.21.0/npm 11.19.1 before running
verification. Synthetic packet tests can run on the supported setup matrix while
supplying explicitly synthetic prior build evidence.

Extra files, missing/empty files, symlinks, inconsistent versions or manifest,
qualification/hash mismatch and an existing output directory are rejected. A
retry never clobbers an earlier candidate. Preserve it for investigation or use a
new reviewed commit. The provenance file is a hash-bound record, not a signature
or independent proof of trust; retain it through the trusted workflow artifact
along with its run/source identity.

Inspect a downloaded retained directory without building or altering it:

```sh
npm run release:rehearse -- --check <directory> --commit <full-source-SHA> --version 0.4.1
```

This checks the exact file set, source/version identity, qualification bindings,
manifest and notes/asset hashes. Altered or missing metadata fails closed. An
integrity check is not a promotion authorization or a substitute for real-host
acceptance. The rehearsal marks served-browser/native/mobile/publication as not
run; the selected `verify` gate cannot certify those scopes.

## Actions and manual acceptance

After merge, **Release rehearsal** accepts a full source SHA and stable version.
It verifies that source is reachable from the repository's default branch, freezes
the detached checkout, refuses an existing exact version tag, installs the exact
graph, and runs the same local rehearsal. Default-branch ancestry is a source
selection restriction, not proof that branch protection/review rules exist; owners
must verify those settings themselves. The workflow has `contents: read`, pinned
actions, no persisted Git credentials and no privileged publication stage.
Version-keyed concurrency avoids overlapping same-version runs. Existing GitHub
drafts/releases are not inspected because this operation never modifies them;
that check is mandatory for future draft/publication implementation.

Download its retained artifact into a codebase-contained isolated vault, disable
that plugin, and install only the three assets in
`.obsidian/plugins/<candidate-manifest-id>/`. Preserve `data.json`, notes and other
plugins. Record acceptance outside the frozen source: source SHA, version, every
asset hash, actor, timestamp, application/installer/platform, settings search/edit/
reload, real example flow, failed writes, modal focus/cancel, notices, command/
ribbon, close/reopen and disable/re-enable. Missing checks stay `not-run`. Test
additional platforms/pop-outs/devices before claiming them. A later rebuild needs
a new candidate and evidence.

Future draft and promotion stages must reject existing public versions, mismatched
tags, incomplete upload sets, untrusted evidence and changed hashes. Promotion
must validate native evidence and approval and upload the retained bytes without
rebuilding. Introduce only an explicitly authorized isolated mutation stage with
the minimum token permission then; do not rely on token-created tags to trigger
another workflow. The rehearsal intentionally cannot publish even when all its
checks pass. First/subsequent public release and failed-upload recovery qualification
remain unperformed.
