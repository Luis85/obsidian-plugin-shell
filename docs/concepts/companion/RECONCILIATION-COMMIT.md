# Reconciled concept: repository handoff

Recorded 2026-09-23 after the accepted artifact was generated on GitHub.

| Step | Commit / evidence |
| --- | --- |
| True merge of current main into the existing PR | `76ab0cb5cfd7b0c1c66d1042f52b41e9895e9482` |
| Readable Concept 09 source plus Concept 10 polish, tests and documentation | `b1caf848657e401c889f3417298d215a3ed8788d` |
| Exact accepted HTML and retirement of the temporary assembly workflow | `799444f815b12e67b0ce5e116a79037ad2526f20` |
| GitHub assembly run | [35894617758](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35894617758) — completed successfully |

The assembly compared the generated output with the locally tested SHA-256 `d25dd5a892c09760a202f1663e2d14f8a6d2567ae91ca5ce3b920e3dc99207d7` and the expected 1,062,056-byte length. Both matched. It committed only the generated HTML and deletion of its temporary write-enabled helper. The replacement source-verification workflow has read-only permissions and non-persisted checkout credentials.

PR #5 was confirmed open, unmerged and mergeable at the generated-asset commit, with main `2d4087e93289a21d797fab4cd641ecde6cf16a82` as the target. No force push, runtime/dependency update, release, tag or marketplace publication was performed.

The 92 current scoped browser/model observations and 42 syntax checks are documented in [the executed verification record](RECONCILIATION-VERIFICATION.md). Successful artifact assembly is not a browser test, and neither implies that every production repository check has passed. GitHub's current checks are the authority for the final branch status.
