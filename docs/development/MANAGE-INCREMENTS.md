# Manage increments

> Type: how-to · Part of the [docs index](../README.md)

Everyday tasks with the `node bin/app increment`, `pr` and `issue` commands after
an increment exists. Each write command previews a plan; rerun it with
`--apply <planHash>` (or `--yes`) to write exactly that plan, and add `--json` for
the machine result. The first walk-through is [Your first increment](FIRST-INCREMENT.md);
documents, statuses, locks and codes are in the [Increments reference](INCREMENTS-REFERENCE.md).

## See where things stand

```sh
node bin/app increment list
node bin/app increment show export-notes
node bin/app pr list --increment export-notes
node bin/app increment validate
```

`increment validate` checks every Increment, PullRequest and Issue document:
structure, wikilinks and whether the generated lists match the documents
(`INCREMENT_LINK_DRIFT`). None of these commands contacts the hosting platform.

## Change an increment's status

```sh
node bin/app increment status export-notes Refining --dry-run
node bin/app increment status export-notes Ready --yes
```

- **Ready** runs the Definition of Ready and refuses with `INCREMENT_NOT_READY`
  and the failing rules. Run `increment check export-notes` for the full report.
- **In progress** is set for you when the first pull request of a Ready increment
  is published; set it yourself when work starts without publishing.
- **Back to Refining** from Ready or In progress when the scope must be discussed
  again.
- **Cancelled** needs no Draft or Ready pull request (`INCREMENT_OPEN_PULL_REQUESTS`);
  reopen a cancelled increment with `Refining`.
- **Done** comes from the Definition of Done: `increment complete export-notes`
  plans the generated outputs and the status once every change pull request is
  Merged or Closed. The kick-off may still be open (it merges the increment branch
  afterwards) but must not be Closed.

Done and Cancelled increments refuse content edits (`INCREMENT_LOCKED`).

## Edit scope and acceptance criteria

```sh
node bin/app increment scope add export-notes "Export of attachments" --yes
node bin/app increment out-of-scope add export-notes "Scheduled exports" --yes
node bin/app increment ac add export-notes "An empty vault exports an empty list" --yes
node bin/app increment ac set export-notes AC-3 --text "An empty vault exports []" --yes
node bin/app increment ac set export-notes AC-3 --status done --evidence tests/acceptance/export-notes/ac-3.checks.mjs --yes
node bin/app increment edit export-notes --size L --e2e required --yes
node bin/app increment edit export-notes --section "Test plan" --input test-plan.md --yes
node bin/app increment ref add export-notes "[[docs/prds/export]]" --yes
```

- `ac add` also creates the criterion's pending acceptance test stub and sets its
  `Evidence:` to the stub path.
- `--input` takes a Markdown file (or `-` for stdin); without `--section` it may
  hold several `## Section` blocks and replaces each of them.
- After changing scope or criteria of a Ready increment, run
  `increment check export-notes` again: the Definition of Ready decides, not the
  status.

## Track issues

```sh
node bin/app issue new export-notes --title "Exporter for attachments" --yes
node bin/app issue ac add export-notes-1 AC-3 --yes
node bin/app issue ac add export-notes-1 "Attachments keep their relative path" --yes
node bin/app issue status export-notes-1 "In progress" --yes
node bin/app pr issue add export-notes-1 export-notes-1 --yes
```

An issue references criteria of its increment (`AC-n`) or has its own (`IC-n`).
`issue status … Done` needs every issue criterion ticked (`issue ac set`). Issues
are local documents only; nothing creates GitHub issues or Azure Boards items.

## Move a planned pull request to another increment

```sh
node bin/app increment attach other-increment export-notes-2 --dry-run
```

Only a New (unpublished) pull request can move. The plan rewrites its
`increment:` and both increments' lists in one change.

## Change a pull request after publication

A published pull request (Draft or Ready) keeps its title, summary, scope,
documents and notes as published. Only tasks and amendments change:

```sh
node bin/app pr task add export-notes-1 "Handle empty vaults" --yes
node bin/app pr task set export-notes-1 T-2 --status done --yes
node bin/app pr amend export-notes-1 "Attachments moved to a follow-up pull request." --yes
```

Other edits refuse with `PR_LOCKED`; record a changed decision as an amendment
(`### A-n · <date>`). Before publication, use `pr edit`, `pr notes` and the scope
commands instead; `pr amend` refuses with `PR_NOT_PUBLISHED`. Merged and Closed
pull requests refuse every edit (`PR_TERMINAL`). Run `pr sync` to send the change
to the platform.

## Publish a pull request

```sh
node bin/app pr publish export-notes-1 --dry-run
node bin/app pr publish export-notes-1 --apply <planHash>
```

The preview reads the platform only: sign-in, whether head and base exist there,
and whether a pull request already carries this document's marker (then the
action is `adopt`, never a second create). It shows the steps, the body size
against the limit and the increment status change. Apply pushes a head branch
that is missing on the remote (`--no-push` refuses instead), creates the draft,
reads it back and writes the binding plus
`.workbench/pull-requests/<id>.sync.json`. Commit both files. Publication fails
before any write when hosting is not configured (`PR_HOSTING_UNCONFIGURED`;
choose `--platform github|azure-devops` or run `node bin/app hosting set`), when a
wikilink does not resolve, or when an open pull request without the marker
exists for the same branches (`PR_REMOTE_DUPLICATE`).

## Sync with the platform

```sh
node bin/app pr sync export-notes-1
node bin/app pr sync export-notes-1 --apply <planHash>
```

The preview shows, per region, whether the change is pulled, pushed or
unchanged, which tasks and amendments move in which direction, the status the
platform reports, and whether the description or the local files would change.
Reviewers can tick or add tasks and amendments in the description; text outside
the managed block is never imported. A second sync without changes reports
`unchanged` and writes nothing. After a merge or close the sync is pull-only.

## Resolve sync conflicts

When the same item changed on both sides, `pr sync` is blocked (exit 1) and lists
each conflict with both excerpts:

```text
Conflicts (1)
  [FAIL] task:T-3:text  (text)
         local:  Local wording
         remote: Remote wording
         resolve: local or remote
```

Choose one side for every conflict, or decide per key:

```sh
node bin/app pr sync export-notes-1 --prefer remote --yes
node bin/app pr sync export-notes-1 --resolutions '{"task:T-3:text":"local"}' --yes
```

`--resolutions` also takes a JSON file. The keys are the ones the blocked result
lists:

| Key | Conflict | Sides |
| --- | --- | --- |
| `title`, `region:<summary\|scope\|documents\|notes>` | changed on both sides | local or remote |
| `title:local-edit-locked`, `region:<name>:local-edit-locked` | a hand edit of a published region | remote only; record your change with `pr amend` |
| `task:T-n:text`, `amendment:A-n:text` | the text changed on both sides | local or remote |
| `task:T-n:deleted-remotely`, `task:T-n:deleted-locally` (and `amendment:…`) | removed on one side, kept on the other | local or remote |
| `<key>:terminal` | a local change after the platform merged or closed the pull request | remote only |
| `body:markers` | the managed block is missing or broken on the platform | local writes it again |

## Recover from an uncertain write (exit 2)

A remote write whose outcome is unknown (a timeout, a lost connection, a read-back
that does not match) or a local record that failed after a successful remote write
ends with `PR_REMOTE_UNCERTAIN` or `PR_READBACK_MISMATCH`, `data.uncertain: true`
and exit code 2. Nothing is retried automatically.

1. Look at the pull request on the platform: does it exist, and does its
   description hold the managed block?
2. Rerun the same command. `pr publish` finds a pull request by its marker and
   adopts it instead of creating another; `pr sync` sees both sides already equal
   and only records them.
3. Commit the updated document and sync record.

Never create the pull request by hand to "fix" an uncertain publish, and never
delete the sync record. `PR_SYNC_LOCKED` means another publish or sync of the same
document is running; wait for it.

## Azure DevOps

`pr publish` and `pr sync` use the Azure CLI with the `azure-devops` extension
(`az repos pr create|show|update|list`, `az repos ref list`, `az repos show`),
signed in with `az login` or a session-only `AZURE_DEVOPS_EXT_PAT`; the CLI never
installs extensions, signs in or stores tokens. The organization, project and
repository come from `tooling.hosting.azureDevOps` (`node bin/app hosting set
azure-devops …`) or the `origin` URL. Title and description go through
temporary files, never through the command line.

Facts and assumptions that have **not** been verified against a live Azure DevOps
organization:

- **HTML comment markers.** The managed block uses HTML comments. If Azure Repos
  drops or escapes them, the body can use Markdown reference markers
  (`[//]: # (wb:summary)`) instead; sync reads both styles. A body without
  recognisable markers blocks sync with the `body:markers` conflict.
- **4,000-character description limit.** Bodies above it are refused with
  `PR_BODY_TOO_LARGE` and never truncated. Keep summary and notes short, link
  documents instead of copying them, and check `Body … of 4000 characters` in the
  publish preview.
- **Draft pull requests.** Azure draft pull requests (`isDraft`) map to Draft;
  whether drafts are available in every organization is not verified. On GitHub,
  draft pull requests can be unavailable for some private repositories and plans;
  `pr publish` then fails with `PR_REMOTE_REJECTED`, and there is no fallback to a
  non-draft pull request.
- **`@file` arguments** of `az repos pr create|update` for title and description.

Azure Repos has no pull request labels: the `e2e` opt-in uses the pipeline's
`runE2E` parameter instead (see [Hosting platforms](HOSTING-PLATFORMS.md)).
