# Evidence records

No runtime acceptance receipts are supplied with this initial backlog. Create real records here only after the documented review or execution. The synthetic examples below describe a format, not evidence.

## Review record

`review_record` points to a JSON file containing:

```json
{"type":"PBI-Review","pbi":"WB-PBI-001","revision":1,"spec_sha256":"<64-hex specification hash>","decision":"approved","reviewed_on":"YYYY-MM-DD","reviewers":{"product":"<actual reviewer>","ux":"<actual reviewer>","engineering":"<actual reviewer>"}}
```

A person may cover multiple agreed roles; do not manufacture separate reviewers. Record supporting rationale/meeting references as additional fields. Approval is of the requirement and verification plan, not release authorization.

## Execution receipt

Each path in `evidence_refs` points to a JSON receipt:

```json
{"type":"PBI-Evidence","pbi":"WB-PBI-001","revision":1,"spec_sha256":"<64-hex specification hash>","candidate":"<40-hex implementation commit>","executed_at":"2026-09-29T12:00:00Z","protocol":"<actual command or manual protocol>","environment":"<actual target, OS, toolchain and host>","artifacts":[{"reference":"<retained log/artifact reference>","sha256":"<64-hex artifact hash>"}],"checks":[{"criterion":"WB-PBI-001-AC01","profile":"cli:shared","result":"passed"}]}
```

Results are `passed`, `failed`, `blocked` or `not-run`. One receipt can cover part of the matrix, but the union of current receipts must cover the entire approved plan before `tested`. For the same pair, the newest result wins; contradictory results at one timestamp fail validation. A receipt from another revision/candidate or changed specification is stale.

## Product acceptance

`acceptance_record` points to a separate decision:

```json
{"type":"PBI-Acceptance","pbi":"WB-PBI-001","revision":1,"spec_sha256":"<64-hex specification hash>","candidate":"<40-hex implementation commit>","decision":"accepted","reviewed_by":"<actual accountable acceptor>","reviewed_on":"YYYY-MM-DD"}
```

Match `accepted_by` and `accepted_on` in the PBI. The record does not substitute for passing execution evidence. Record release evidence separately through `release_ref` and the existing authorized process.

`node docs/requirements/tooling/progress.mjs --json` includes each PBI's calculated `spec_sha256`. A SHA binds bytes, not identity, authenticity or permissions. This reader checks consistency and references; an independent reviewer must still inspect actual logs and trusted execution records. Never enter the illustrative placeholders above as a passing receipt.
