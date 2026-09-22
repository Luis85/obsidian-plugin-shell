# Iteration 02 — recovery checkpoint

Branch: `build/iteration-two`; base main `e64e75eefb22822356cb2473b77eadee35871beb`; draft PR #1. Version 0.2.0, fixed identity `plugin-shell`. Main has not been merged, tagged or published.

## Completed

- [x] Full-width leaf layout, shared gutters, responsive navigation/Documents, actual language-control metrics and light/dark/German layouts.
- [x] Validated persistent header preference, command/menu/native-settings restoration, all-leaf ownership, pop-out theme ownership and cleanup.
- [x] Review corrections: serialized preference snapshots, safe notification/subscriber failures, preview discard, uncertain-write protection, complete atomic build/install and full analyzer enforcement.
- [x] Root ESLint 10.11.0 with actual rule/parser negative probes; reviewed esbuild 0.28.2 scoped override; retained narrow npm hook approvals and real EALLOWSCRIPTS regression.
- [x] Production coverage uses the real Nuxt/Vue resolver and proves all 30 TS/Vue inputs are present. COV-02-01 fails on omitted inputs. Earlier 54.91% whole-production line coverage was incomplete and is superseded by 53.39%.
- [x] Full qualification at `23c0893db3c34d7c15ea06c4c5d647a91a041b60`, workflow run [35780897004](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35780897004): fresh strict npm ci; all verify gates; 51 runtime tests plus three fresh repetitions; core/production coverage; 20 served tests; all 15 real Linux Obsidian checks with zero unexpected errors; JSON and ordinary audit both exit 0 with zero vulnerabilities.
- [x] Same revision's PR setup matrix [35780905297](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35780905297) is successful. Windows setup/build is not Windows-native UI evidence.

## Finalization

This checkpoint removes the completed exploratory dependency workflow and corrects a native-test lifecycle comment. No production source, package lock or accepted runtime assets change. The next qualification must retain identical asset hashes. Final documentation and downloadable source/plugin/evidence packages remain to be assembled from the qualified candidate, without rebuilding another runtime deliverable.

## Explicit unresolved criterion

The whole dependency graph is **not fully supported**. The official Obsidian lint package still pulls ESLint 9.39.5 through its SDL/import dependency peers. The supported parent-update/dedupe investigation did not remove it; no incompatible peer override was adopted. See [dependency exception](ITERATION-TWO-DEPENDENCY-EXCEPTION.md). A zero-vulnerability audit does not close this support finding. Keep PR #1 draft until that acceptance exception is resolved or explicitly accepted.

## Environment and prior failures

The local runtime cannot reach GitHub/npm and its served Chromium navigation was policy-blocked. Hosted runners provide the fresh-install, served, Windows and native evidence. Earlier native attempts failed on moved-document theme ownership and multi-window test-driver assumptions; their failures were not retried into acceptance or ignored. Final native commands locate the real palette owner, use the actual Appearance control, and preserve the settings realm until fixture restart/teardown. All native page errors and independent application diagnostics remain assertions.
