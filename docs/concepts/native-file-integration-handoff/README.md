# Recovered native file-integration source

This directory publishes the complete alternative implementation delivered in
`native-file-extension-starters.zip` on September 27, 2026. **All 48 source files,
including the rebuildable HTML, are committed under `source/`. The 49th change is
a historical deletion recorded in `MANIFEST.json`. No conversation ZIP is needed.**

## Relationship to the active shell

PR #34 already supplied `custom-file-view`, `context-menu` and the `file-extension`
maker. It was merged into PR #5 on September 27, 2026. Those active implementations
remain unchanged by this handoff.

The recovered package is a different implementation: `custom-file-editor`,
`file-context-menu` and the `file-type` maker, with explicit-save text/JSON drafts.
Its native declaration shape is incompatible with the versioned namespace now
in PR #5. It was built against commit `24bde52e33b2d6e212b71d86e1b1ae045a8153d6`,
not the current compiler. **Do not copy this overlay onto current root source or
import its native JSON into the current shell.** Any active adoption needs an
explicit migration and qualification; this PR publishes the sources, not that migration.

## Verify and rebuild using this checkout

Requirements: Python 3.12+, Git, and a clone containing the historical baseline.
A full clone contains that commit. A shallow clone must obtain its history first;
the helper never fetches, installs dependencies, or updates a branch.

From the repository root:

```sh
python3 docs/concepts/native-file-integration-handoff/restore.py --check
python3 docs/concepts/native-file-integration-handoff/restore.py --out ../native-file-alternative
cd ../native-file-alternative
python3 scripts/concepts/build-companion.py --check
```

`--out` must name a new directory outside this checkout. It reconstructs the
historical baseline from Git and overlays the 48 verified files; it removes the
old bootstrap workflow only inside that new directory. Failure leaves the newly
created directory for inspection. Existing destinations are refused.

For source changes, rebuild with `python3 scripts/concepts/build-companion.py`.
The original companion HTML is **3,407,968 bytes**, SHA-256
`3fb223d500b19bfd42b35828b9ddd0a2189ce3f04da1b56c58ec5f0ee458ca30`.
Plugin builds additionally require the restored workspace's exact Node/npm and
lockfile dependencies, installed explicitly. Follow the recovered
`docs/development/NATIVE-FILE-INTEGRATIONS.md` in that restored workspace.

## Contents and evidence

`source/` retains repository-relative paths and byte-identical delivered contents.
`MANIFEST.json` identifies the original ZIP, baseline, publication base, each source
hash and the historical deletion. The recovery helper uses the readable source
files directly; no binary archive, compressed payload or patch application is
needed after checkout. Do not apply the old downloaded patch to current PR #5.

The original September 27 receipt reported 464 runtime tests, 56 native tooling
checks, 63 starter checks, two independent generated-workspace passes, 140 browser
checks and 19 assembly checks. Those are **historical, overlapping local results**
using Node 22.16.0, not a fresh runtime qualification of this publication. The
September 29 source recovery independently reapplied the patch, rebuilt the HTML
and checked all 49 inventory records. The read-only handoff workflow repeats byte
verification, reconstruction, deterministic assembly and distribution-isolation tests.

This snapshot is text/JSON boilerplate, not a complete graphical editor. Closing
an unsaved draft discards it. The four authored acceptance TODOs per starter,
real Obsidian/mobile acceptance and production draft recovery remain unresolved.

The handoff and its maintainer-only regression are narrowly excluded from generated
projects and distributable CLI kits, so incompatible alternate sources cannot
accidentally become consumer inputs. No dependency, runtime API, quality floor,
user vault, release or merge is changed by publishing this directory.
