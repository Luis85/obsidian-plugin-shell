# Support-report privacy regression

Date: 2026-09-28. Follow-up to PR #35 authoring/support commit `519d94db4058d716f332a72c259eb2c91bd76994`; see the [implementation record](PR5-IMPROVEMENT-EXECUTION.md) and [support guide](../../development/LOCAL-SUPPORT-AND-MEASUREMENTS.md).

The final actual-launcher check reproduced a private-path disclosure before report collection: `support report --root <missing-path> --json` returned the raw `realpath` ENOENT message through the generic CLI catch. The report handler's own redaction did not cover root discovery.

The CLI now uses the same bounded `SUPPORT_UNAVAILABLE` result for failures while parsing or locating a requested support report, including options before the command. It never emits the raw error in that path. Cancellation remains separate. Other commands retain their existing diagnostics. This does not reset any data, broaden filesystem access, execute project scripts or introduce uploads.

Six support tests pass locally, including actual child-process launcher checks for missing roots and invalid options with both leading and trailing `--json`. The newly added regression was observed failing before the fix. Framework typechecking passed on supplementary TypeScript 5.8.3/Node 22.16.0; exact-toolchain hosted verification of the follow-up remains required.

The preceding `519d94d` compiler qualification run `36360743281` completed successfully. Its authoring run `36360743279` passed the actual Vue typecheck, integrated build and file-origin editing assertions at inspection; generated-workspace qualification and broader CI were still running. Those results are source-scoped, not an automatic green result for this later correction. No native companion, manual accessibility, live-provider or release acceptance is inferred.
