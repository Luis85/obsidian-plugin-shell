# Iteration 02 — completed implementation checkpoint

Branch `build/iteration-two`; main baseline `e64e75eefb22822356cb2473b77eadee35871beb`; version 0.2.0; fixed identity `plugin-shell`; draft PR #1. Main was not merged, tagged or published.

## Completed and verified

- [x] Full-width leaf-relative layout, common gutters, responsive navigation/Documents, unclipped native select, light/dark and German layouts.
- [x] Persistent header preference with validated defaults, all-view/pop-out ownership, command/menu/native-settings restoration and cleanup.
- [x] Review corrections: serialized snapshot settings, safe notification/subscriber failures, abandoned-preview disposal, uncertain-write protection and complete staged build/install.
- [x] Supported root ESLint 10 with actual parser/rule probes, reviewed esbuild override, narrow npm hook approvals and real EALLOWSCRIPTS regression.
- [x] Complete 30-input production coverage inventory; no silently omitted mount input or falsely inflated whole-production percentage.
- [x] Controlled pending-save regression and native-driver fix: click once and await committed checkbox state, never retry the action to hide timing failures.
- [x] Final candidate `f3a964621ccfb7678fc629666c29f37e948f6143`, [run 35782207137](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35782207137): fresh strict installation, all verify gates, 13 tooling tests, 51 runtime tests plus three repetitions, 52 baseline cases times three, 21 served tests, all 15 native checks in each of three fresh sessions, zero unexpected native errors and zero all-category audit vulnerabilities.
- [x] [Windows/Ubuntu setup matrix 35782212498](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35782212498) passed both Node/npm combinations. These are setup/build checks, not Windows-native UI evidence.
- [x] Accepted runtime assets frozen and matched through native restart and packaging. Final changes only complete documentation and the UI-02-PENDING inventory entry; no runtime rebuild.

## Remaining acceptance exception

The official Obsidian lint package still installs nested ESLint 9.39.5 through SDL/import peers. Supported parent updates did not resolve it; the trial lock was not adopted and no unsupported peer bypass was used. A clean audit does not make the entire graph supported. Keep PR #1 draft pending resolution or explicit acceptance of this exception; see [dependency investigation](ITERATION-TWO-DEPENDENCY-EXCEPTION.md).

The full-production coverage target and broader maker/mobile/release backlog remain separately scoped. See [actual verification](../testing/ITERATION-TWO.md) for exact counts, platform limits, asset hashes and the superseded failures. Do not reconstruct evidence from historical screenshots or advertise all PRD cases complete.
