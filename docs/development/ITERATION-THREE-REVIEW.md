# Iteration 03 — independent review and improvement pass

Review against the [plan](ITERATION-THREE-PLAN.md), retained product requirements,
actual source and adversarial reproductions. Findings are not waived by coverage.
Review contexts were separate from the implementer of the code being inspected.

| Finding | Consequence | Required correction and regression |
| --- | --- | --- |
| I03-R1: queued create retains an old destination | A preference change while earlier work is pending can write into the previous folder. | Recheck current folder immediately before the host write, after asynchronous preflight. Deterministic held-write test. |
| I03-R2: disposal during preflight | A new host write can begin after the owning repository is disposed. | Guard again after awaited reads and before persistence; already-started writes still report their real outcome. |
| I03-R3: incomplete document mapping accepted by repository | Unmapped supplied fields silently disappear and defaults replace them after creation. | Reject lossy recipes at repository construction; test a partial Project mapping with nondefault budget/archived values. |
| I03-R4: patched note validated only after writing | A near-limit note can become too large to read, after persistence already succeeded. | Decode/validate the full candidate before replacement; assert zero writes and unchanged original bytes on rejection. |
| I03-R5: malformed managed metadata accepted | An owned record missing its creation metadata is treated as safe to mutate. | Validate the managed envelope without repairing it; existing real schema-one fixtures remain readable. |
| I03-R6: Task-specific validation labels inside generic entity code | New entities inherit showcase assumptions. | Field-owned error configuration; generic schema mechanics know no Task fields. |
| I03-R7: mutable definition inputs and throwing event ports | Later configuration mutation changes validation; post-write publication can relabel success. | Capture configuration/callbacks; contain publication failure and retain the committed receipt. |
| I03-R8: test host alias enters static production graph | Analyzer sees infrastructure importing test fixtures. | Use a test-only resolver that fails closed; retain unchanged architecture rules and zero-finding gate. |
| I03-R9: zero or overflowing coverage denominators | A corrupt report can falsely pass with 100% or NaN. | Require safe counters and nonzero executable aggregate scopes; prove rejection through the actual CLI. |
| I03-R10: preview server uses an unqualified child npm | Hosted served tests can escape the selected toolchain. | Launch the installed Vite entry using the current qualified Node executable. |
| I03-R11: comment scanner mishandles a regular expression after automatic semicolon insertion | A regex character class can be mistaken for an unterminated comment and hide subsequent code from the LoC gate. | Preserve regex/literal content and prove an over-limit valid source fails through the real CLI. |
| I03-R12: asynchronous feature registration accepted as a successful registry | A later rejection can leave constructed repositories undisposed. | Require synchronous registration in types and at runtime, observe rejected thenables, and dispose already registered repositories. |
| I03-R13: short plugin IDs matched CSS class substrings | An identity such as `shell` could leak `.shell-sidebar` rules into the host. | Exact positive selector ownership, native exceptions, and identity-aware artifact assertions; test short IDs, negative selectors and both path separators. |
| I03-R14: maker/setup planning rebased hashes after asynchronous reads | A concurrent author edit could become the accepted baseline for stale replacement content. | Bind final plans to the originally inspected bytes and reject drift, with deterministic barrier tests. |
| I03-R15: migration decoded corrupt UTF-8 and accepted occupied destinations | Copying could silently change data or overwrite an unrelated plugin. | Reject non-round-tripping bytes and foreign destinations; include source bytes as unchanged preconditions; preserve the old installation. |
| I03-R16: failed installer rollback deleted recovery backups | A second failure during restore could destroy last-good assets. | Retain staged originals, lock and recovery report when restoration is incomplete or external edits must be preserved. |
| I03-R17: setup resume trusted incomplete markers | Missing dependencies or changed verified inputs could be reported as ready. | Validate installed metadata, always rerun verification, hash the complete verified source/config/document inventory and reject changes during execution. |
| I03-R18: full transient slots hid essential background recovery | An error/action could become invisible inline data without a visible owner. | Preserve persistent recovery outside the transient queue and give runtime-scoped fallback a visible surface. |
| I03-R19: scheduling/cancellation exceptions escaped ownership boundaries | A committed document could be relabeled uncertain, and cleanup could stop before releasing resources. | Contain scheduler faults, isolate each cancellation, preserve receipts, and prove real-store and eight-ref cleanup behavior. |
| I03-R20: late/open follow-ups were not single-flight or stale-safe | Repeated clicks opened twice, or an older error appeared against a new draft. | Guard opening, bind results to the original receipt, and ignore obsolete view updates. |
| I03-R21: native command removal used an already-prefixed ID | The public plugin API prefixes again, leaving an owned command registered. | Remove local descriptor IDs; validate against the installed application and a native before-unload conformance probe. |
| I03-R22: modal requests retained mutable caller configuration | Changing owner/validator after opening could leak ownership or change the displayed operation. | Capture a frozen request before side effects and test caller mutation plus capacity reuse. |
| I03-R23: logger reentry guards blocked unrelated records while an async observer waited | A slow observer could suppress normal logging and level changes. | Bound delivery per callback, keep independent records/control operations live, and expose skipped-delivery counts. |
| I03-R24: command registration could take effect before throwing | Cleanup missed an attempted registration that never returned its handle. | Track the intended local ID before the host call and test side-effect-then-throw cleanup. |
| I03-R25: malformed command results could execute getters or lose a committed effect during normalization | Feedback could read private payloads or misrepresent a completed write. | Validate data descriptors without invoking accessors, preserve valid effect semantics when replacing unknown translation keys, and exercise both paths in dispatch tests. |

The independent reviewer reran all five repository reproductions after the fixes
and confirmed rejection before writes where required, unchanged original bytes,
and readable retained records. Coverage-report false-pass reproductions also now
fail as required. Final full verification is recorded separately.

The scanner review also covered valid JSX text, CSS URL tokens, Vue directive
comments and encoded quotes, raw attributes, RCDATA and `v-pre` content. Each
concrete false count was corrected and the independent bounded fixture set passed.
Unknown HTML entity forms are counted conservatively within the bounded attribute
rather than allowed to hide subsequent code.

## Experience and polish

Real browser captures at 1280px and 320px show the existing native-token design
with readable wrapping and visible controls. Task editing retains the draft on
stale writes, offers explicit reload, uses two-step reversible trash, and prevents
new actions during pending/uncertain outcomes. Validation fields reference an
announced error and receive focus. English/German strings share one key inventory.
The mechanical UI detector reported no findings for the added panel/styles;
this is supplementary to served interaction tests, not accessibility certification.

## Qualification boundaries

Coverage reports, runtime tests, synthetic host contracts, served browser tests
and native host evidence have separate scopes. The executed verification record
must identify which ran for the final candidate. No mobile, Windows-native host,
third-party theme or broad accessibility certification follows from these tests.
The upstream nested ESLint support exception and external compare-and-trash race
remain documented limitations. Full makers and template-release qualification
remain pending rather than being removed from the retained requirements.
