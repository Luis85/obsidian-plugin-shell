# Request shapes

These are illustrations. The live contract is whatever `node bin/app brainstorm schema --json`, `node bin/app new guide --starter <id> --json` and `node bin/app sketch schema --json` return in the checkout you are using; prefer them over this file when they differ.

## Feature brainstorm request (route A)

Strict, versioned, inert JSON. Copy `projectId` and `baseSha256` from `node bin/app brainstorm context --json`.

```json
{
  "schemaVersion": 1,
  "name": "Quick capture",
  "purpose": "Capture a thought into the inbox note without leaving the current note.",
  "projectId": "<from brainstorm context>",
  "baseSha256": "<64 hex characters from brainstorm context>",
  "actors": ["Vault owner"],
  "entities": ["Capture"],
  "acceptance": ["A capture appears in the inbox list after saving"],
  "pages": [
    { "title": "Capture", "purpose": "Write and save one capture.", "kind": "view",
      "interactions": [
        { "kind": "navigate", "label": "Open inbox", "target": "Inbox" },
        { "kind": "action", "label": "Save capture", "outcome": "The capture is appended to the inbox." }
      ] },
    { "title": "Inbox", "purpose": "Review recent captures.", "kind": "page" }
  ],
  "output": "definition",
  "verification": "none"
}
```

- `pages[0]` becomes the native feature view; `page` entries belong to it; `modal` entries stay overlays. Limits: 12 pages, 12 interactions per page.
- `action` interactions are descriptive outcomes, never callbacks.
- `output` is `definition`, `prototype` or `boilerplate`; `verification` is `none`, `test` or `test-build`. This step uses `definition`/`none`; `ideation-prototype` and `ideation-boilerplate` may re-run with other values into a new `--out` folder.

Pass it on stdin to avoid writing a request file:

```sh
node bin/app brainstorm validate --input - --json <<'JSON'
{ ...request... }
JSON
```

## Project-starter request (route B)

`node bin/app new guide --starter <id> --json` returns `data.input`. Its nested field is `interview` (never `prototype`):

```json
{
  "schemaVersion": 2,
  "starter": "plugin-nuxtui",
  "interview": {
    "schemaVersion": 1, "guideId": "project-prototype", "guideVersion": 1,
    "answers": { "title": "Issue Desk", "pages": ["Overview", "Issues"], "components": ["Issue summary"],
      "problem": "Keep local issues visible while working in the vault.", "approved": false }
  }
}
```

Keep `approved: false` until `ideation-design` records explicit agreement and every open question and requested concept-board exploration is resolved. Validation and discovery reject write flags.

## Sketch transaction (optional candidate model)

`schemaVersion: 1`, a `title` only for a new project, and `operations` (for example `page.add`, `entity.add`, `entity.properties`, `collection.add`, `page.collection-table`, `interaction.add`, `interaction.action`). Operation IDs accept `@aliases` from earlier steps. Only titles are required to create things. Preview returns a plan for `design/project.json`; apply its `planHash` only after approval, and only inside the intended project folder.
