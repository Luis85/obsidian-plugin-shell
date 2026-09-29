# Typed Markdown application documentation — verification checkpoint

The implementation is stacked on PR #5 at base
`15f74eaec78b5555bed94e4310472db841e371f7`, in draft PR #51.

This checkpoint recovers the prepared implementation after an interrupted editing
session. It adds docs import/export/status/validate/schema/recover, model adapters,
reviewed plans, synchronization baselines, preservation, packaging and focused
tests. It is not a claim that the recovered tree has passed qualification.

The initial bootstrap workflow at
`af44809ad96edfbdf70602c876eaf7b191bd376f` ran before the feature tests existed.
That run is not feature evidence. The revised workflow requires all four named
suites and retains exact checked-out source, toolchain identity and logs on Ubuntu
and Windows. Verification results will be recorded against the actual candidate.

No merge, release, plugin activation, native Companion acceptance or personal-vault
operation is included. Recovery targets process interruption, not a power-loss or
filesystem-wide atomicity guarantee. Remaining validated v6 fields are retained as
structured project context; preserved data is not a claim of finished prose docs.
