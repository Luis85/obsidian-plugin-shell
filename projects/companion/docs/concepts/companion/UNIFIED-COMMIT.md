# Unified editor commit and artifact identity

Date: 2026-09-23. This record distinguishes local concept checks from repository CI and native qualification.

- Previous PR checkpoint: `d22cc1c86aece83624713a2d3da30d1fd048e6ed`.
- Reviewed transfer commit: `a771ef279f1c55d90037e6ea0d763e631688c0da`.
- Expanded application-source and generated-HTML commit: `02fd9d1476d4b6043dabaab9dc5f73a5da6f4bac`.
- [Successful exact-assembly job](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35903575500).
- Accepted `index.html`: 1,091,653 bytes; SHA-256 `d85e9ddf3f6177a2a9fac11a3c99bd90e6c536f2246e8c2a008b13454a4e27da`.
- Git blob `445ba94ba16c28c0713956dfe634416d0d233043` was confirmed against the local accepted HTML.

The one-time finalization workflow verified every prior file hash and replacement hash, reconstructed the reviewed source, rebuilt the exact accepted HTML, committed the result without force-pushing, and removed its own write-enabled workflow and transfer files. The existing concept-source verification remains read-only. This documentation commit triggers the ordinary PR workflows against the expanded source rather than relying on the transient assembly job.

Local execution: 159 current scoped checks plus syntax checks for 45 authored JavaScript files. See [verification](UNIFIED-VERIFICATION.md), [machine results](verification-unified.json) and [review](UNIFIED-REVIEW.md). These are not a production/native qualification or a claim that all repository CI has passed. CI conclusions belong to the actual workflow run results for the final commit.

No merge into main, dependency/lockfile change, tag, release or marketplace publication was performed.
