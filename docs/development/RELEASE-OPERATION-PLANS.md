# Draft and promotion operation plans

For authenticated discovery and separately authorized execution, use
[release execution](RELEASE-EXECUTION.md). This offline planner remains read-only.

`npm run release:plan -- --input <operation-input.json>` validates retained local
bytes and supplied state/evidence, then prints exact `gh` argument arrays. It never
calls GitHub, executes those arrays, builds, uploads, tags or publishes. Output is
always `plan-only`, `executed: false`, `authorization: not-granted`. A supplied
review record is evidence to validate, not permission for this session to publish.
Start with the [candidate rehearsal](RELEASE-REHEARSAL.md).

For an initial draft, an input file has this shape (replace timestamps and SHA with
the actual freshly reviewed state):

```json
{
  "candidateDirectory": "./0.4.0-<full-source-sha>",
  "commit": "<full-source-sha>",
  "version": "0.4.0",
  "mode": "draft",
  "remote": {
    "schemaVersion": 1,
    "repository": "owner/repository",
    "checkedAt": "<current UTC timestamp>",
    "sourceCommit": "<full-source-sha>",
    "sourceReviewed": true,
    "tag": null,
    "releases": []
  }
}
```

Candidate paths are relative to the input JSON file. `remote` is a normalized,
explicitly supplied snapshot: `tag` is null only when confirmed absent, otherwise
`{ "name": "0.4.0", "commit": "<peeled full SHA>" }`. Every stable release row has
`version`, `draft` (boolean), a resolved `targetCommit` and `assets` rows with
`name`/`sha256`. Capture authenticated read-only release/tag/asset API results and
review default-branch/source trust before constructing it; a failed request is not
an empty release list. Resolve annotated tags to their commit. GitHub's asset API
exposes a [SHA-256 digest](https://docs.github.com/en/rest/releases/assets); absent
digests require independently hashing downloaded bytes. The snapshot must be less
than one hour old, and must be refreshed immediately before any later authorized
mutation. This offline planner cannot prove a supplied snapshot is authentic.

Draft planning rejects an existing public version, duplicate releases/assets,
wrong tag/source, unexpected assets or changed hashes. A matching partial draft
plans only missing uploads, without `--clobber`; a matching complete draft plans
no upload. A newer version can follow earlier published versions. The planned
[create](https://cli.github.com/manual/gh_release_create) operation always specifies
the exact full target SHA, notes file and draft flag. Uploads use only the retained
five files. The rehearsal workflow can accept `draft_snapshot` to retain this
plan alongside the candidate; no GitHub mutation occurs.

For `mode: "promote"`, the snapshot must contain a complete matching draft. Supply
an explicit `platforms` array and `acceptance` array. Each acceptance record has
schemaVersion 1, `mode: "manual"` or `"automated"`, actor, completedAt, sourceCommit,
version and the exact three `assetHashes` from `candidate.json`. Its `host` contains
platform (`win32`, `darwin`, `linux`, `ios` or `android`), architecture, appVersion
and installerVersion. Every declared platform needs evidence including the declared
minimum host; mobile support also requires both mobile platforms. Each record's
`scenarios` maps these keys to `"passed"`:

```json
{
  "load": "passed",
  "settings-search": "passed",
  "settings-edit-reload": "passed",
  "entity-flow": "passed",
  "failed-write": "passed",
  "modal-focus-cancel": "passed",
  "notices": "passed",
  "command-ribbon": "passed",
  "view-close-reopen": "passed",
  "disable-reenable": "passed"
}
```

The separate `review` object contains actor, reviewedAt (less than 24 hours old),
sourceCommit and the exact three assetHashes. Missing/native-not-run evidence,
partial uploads and changed evidence fail instead of returning an operation. The
resulting [edit plan](https://cli.github.com/manual/gh_release_edit) preserves the
same target and publishes the existing draft without a build; an existing tag also
requires `--verify-tag`. Tests exercise this decision model with synthetic records,
including first/subsequent versions, interrupted uploads and public immutability.
They do not establish that a real first or subsequent release was published.
