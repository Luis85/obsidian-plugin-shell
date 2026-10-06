# Cross-owner review: recovery and document bounds

A reviewed B's actual changes after the independent implementation phase:
`plugin-data-store.ts`, `preference-service.ts`, `document-service.ts`,
`domain/utf8.ts`, `infrastructure/markdown.ts`, the new recovery/boundary tests,
and the changed uncertainty expectation in `persistence-outcomes.test.ts`.
The review also followed native/browser reads and the settings guidance consumers.
Normative scope is DAT-01–05, DOC-18 and ERR-07/09/11/17. This is source/assertion
review; current producer execution and acceptance remain separately recorded.

## Finding: present JSON null was indistinguishable from absence

The initial implementation retained `raw == null` as the absent-data condition.
The browser adapter parses stored JSON, so both a missing value and actual saved
bytes `null` reached that condition. The new category tests exercised missing
bytes, malformed JSON, malformed envelopes, future schemas and denied reads, but
omitted a present null envelope. Its state would be `absent` with writes enabled,
allowing a subsequent preference update to replace existing invalid data.

This predates the increment, but contradicts an unqualified new DAT-04 distinction.
Returning readonly for every null would instead break legitimate first use.
The review therefore requested a presence-aware read contract rather than guessing.

Parent selected an additive optional `SettingsStorage.read(): Promise<string | null>`:
null denotes absence and a string denotes actual stored bytes, including `null`.
B owns a failing regression and store correction; parent owns native/browser adapter
wiring. The existing save path remains authoritative. Legacy adapters exposing only
parsed `load()` cannot resolve this ambiguity and remains explicitly bounded.
The retained `b-null-red-01.txt` reproduces `absent` instead of `corrupt` in
RECOVERY-07-03. After correction `b-recovery-green-02.txt` passes all four recovery
cases. A inspected both original outputs and the corrected store/adapter source.
The independent A batch also passes the two actual native-adapter-double tests:
manifest/config path selection, null/malformed bytes, confirmed absence, exists/read
failure, no initialization writes and the unchanged host writer. This is unit
adapter evidence, not execution in an actual native host.

## Reviewed positive assertions and limits

- The UTF-8 helper counts Unicode scalars without browser/Node dependencies,
  rejects isolated surrogates, bounds iteration and validates its numeric budget.
  Independent test expectations use `Buffer.byteLength`, including ASCII, two-,
  three- and four-byte scalars, combining text and invalid values.
- Complete serialized Markdown accepts exactly 1,000,000 bytes and rejects one
  additional byte. Preview has zero writes/facts. Repository updates validate the
  complete patched candidate before replacement and preserve the original note
  when it exceeds the limit. Plugin-data's documented character policy is separate.
- Protected corrupt/future/inaccessible reads preserve original bytes and perform
  zero initialization writes. Uncertain saves retain the uncertain effect on later
  blocked operations; neither queries nor preferences silently clear the lockout.
- Recovery reconstruction reads the actual saved bytes for both committed and
  uncommitted rejected saves. Tests assert exact fault codes/counts and absence of
  committed facts before reconstruction. Opaque entity collections survive permitted
  unrelated preference writes without schema repair.

No additional defect was found in the reviewed byte-count algorithm or the tested
uncertainty transitions. These unit assertions do not establish real native I/O
failures, manual repair/migration capabilities, all input/template bounds or complete
DAT-01–05/DOC-18 acceptance. Native host error classification is limited by the
observed adapter result; opaque read exceptions are not evidence of corrupt bytes.

## A implementation and reviewed correction execution

`a-retained-red-01.log` preserves seven actual product failures and six fixture
failures caused by treating Vitest's untouched call-through spy implementation as
an accessible mock implementation. `a-retained-red-02.log` corrects only that
fixture and the exact YAML flow-list formatting expectation: seven product
regressions fail and all six started-persistence outcomes pass. Product corrections
then add the shared action-scope entry and post-preflight guards without changing
the already-started write results.

C's separate review found that the uncertain-recovery title overstated its
assertions. A narrowed that title and added RETAINED-C66-REVIEW, exercising an
actual live editor reload of uncertain saved bytes, a fresh revision and deliberate
new edit/save. RETAINED-C62-CONTEXT also changes the folder away and back during
paused preflight, proving the composable invalidates the old permit and leaves
storage and sibling draft intact.

`a-green-01.log` passes 34 tests in seven files with Node 24.21.0, no failures or
skips: all 15 retained-action component cases, six new independent `experiment`
entity unit permit cases, the scope unit test, runtime observation, native settings
adapter doubles, rendered settings and authoring-native doubles. The independent
entity suite imports the developer API and generic fixture only; it survives
reviewed Task/Project example removal. Raw logs remain under
`reports/framework-lifecycle`; full qualification is owned by the execution record.

## Parent integration: additive crosswalk audit

A compared the proposed crosswalk with the integration baseline: all 96 rows,
every required-mode list and all 117 earlier links are unchanged. The 25 new
links are unit-mode partial assertions (AC-05: six; AC-07: five; AC-11: two;
AC-46: one; AC-62: ten; AC-66: one). No component, served-browser or native
classification is inferred from those unit tests. The legacy machine plan is
unchanged, including its release boundary.

Each addition matches exactly one passed named assertion in the raw Vitest JSON
and packet `cf93ffd6-4769-4ba6-9188-fdd737bf63ae`, source digest
`0ad81aaa8fab342171c8cf898985f26a7ee3f6ba7869af28d581bc60763043bb`.
A rehashed all four raw receipts and checked their byte lengths against the
packet: no mismatch. Both raw reporter and packet retain 384 passed / 385 total,
one failed filename-guidance assertion, failed framework status and exit 1.
This packet proves observed names for assertion review only. It establishes
**zero acceptance advancement**; a later targeted correction does not turn the
failed packet into passing current-candidate evidence.

Actual assertion review requested four wording corrections from the parent:

- LIFECYCLE-OBS-02 disposes notices/modals, not the production Diagnostics object.
  Its link must not claim persistence after diagnostic disposal; FAULT-OBS-01
  tests that different clause separately.
- RECOVERY-07-02 preserves opaque values during compact JSON reserialization;
  it does not retain the original pretty-printed byte representation. Describe
  preserved data values and exact expected complete saved bytes separately.
- SETTINGS-RAW-02 injects read rejection after reported existence. It does not
  execute a real disappearance, so the link must retain that controlled boundary.
- RECOVERY-07-03 exercises present null only. The separate RECOVERY-07-01 case
  also compares absence; avoid attributing that comparison to the null-only case.

Parent corrected all four descriptions. A reread the resulting crosswalk and
confirmed that each now states the named assertion's actual boundary. The remaining
reviewed link text agrees with its named test's explicit assertions. Fresh candidate
qualification remains parent-owned; later native demonstration changes require
their own observed trusted names and do not inherit this failed packet's execution.
