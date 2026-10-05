# Airship qualification — 2026-09-28

## Executed upstream integration

[Airship compatibility run 36413368625](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36413368625) passed on **Windows, macOS and Linux** for PR #39 head `babc4e3fd7f6ce1e3d2fc58acb42b55c31b56eb2`. The Actions merge checkout was `90e750943e26e006950e31f59534ef03a6f45276`, against PR #5 head `f140c7e89570329fc7ed40ee2d4cb885f4524fc2`.

Toolchain: Node **24.21.0**, npm **11.19.1**, workspace TypeScript **6.0.3**. Every platform passed framework/compiler typechecks, compiler architecture, the Airship contract suite, test inventory and retained legacy concept verification. Generation covered **11 starters × two output targets × enabled/disabled** (44 compiler runs). It also checked custom source roots, separate process approval, loopback/safe arguments, environment override removal, project JSON round-trip, malformed-input rejection and source-edit preservation/conflicts.

The Linux browser job independently installed a generated quick-capture project in a path containing a space, explicitly installed **@airshiplabs/cli 0.3.0**, and verified:

1. The actual `element-source` Vue resolver found `src/generated/presentation/components/details/vp-1.vue`, line 15, column 1.
2. A real authored-source edit appeared through Vite HMR and was restored afterward.
3. Project JSON export retained the opt-in, and private `.env` access was denied.
4. The actual Airship canvas, overlay and preview iframe rendered a navigable generated Vue surface without uncaught browser errors.
5. An independent production build excluded Airship and `data-v-inspector` metadata.

Generated compiler fingerprint: `54c6021d6acac578b6fe19efd9886ddb376e00cbd4fdd5a1fb2f28960e4e3b13`. Artifact `airship-compatibility-ubuntu-latest` (ID `10966850879`) contains `evidence.json`, `servers.log` and `airship-preview.png`; archive digest `sha256:d3570007c2d5ae9930026e6444ee931b43d39fe2ad345e7b04f57aedf672da8e`. Retention is seven days; rerun the workflow for fresh evidence.

## Subsequent compatibility-test and analyzer integration

The initial dedicated compiler run correctly rejected a changed golden-file count: AIR-01 adds `harness/prototype/index.html`. The follow-up test asserts that new entry's **complete expected bytes** separately, then verifies every historical product file against the unchanged independent baseline. No baseline hashes, thresholds or ignore patterns were relaxed. Local supplementary Node 22.16 execution passed **23/23** Airship/compatibility tests after that correction.

The follow-up also registers the generated preview's entry points with the analyzer, puts the two inert tooling modules inside the existing strict authoring-contract zone, and makes the internal defaults private. These are explicit graph declarations, not directory exclusions. Its hosted results must be read for its own commit; this dated record does not promote the earlier run to acceptance of later source.

## Acceptance boundaries

No AI-provider prompt was submitted and no provider-mediated source edit was accepted. The HMR edit was a controlled test. Backend-specific permission guarantees, live Claude/Codex/OpenCode sessions, and Storybook runtime acceptance remain separate. The unrelated shell Real Obsidian job passed on this candidate, but it does not establish native Airship or complete Companion acceptance. No merge, release, publication or personal-vault operation was performed.

See [integration guide](../../tooling/AIRSHIP.md) for setup, operation, safety and source/regeneration behavior.
