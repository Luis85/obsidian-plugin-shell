# Record a release item

*This step uses the release item and release-candidate commands; read the
[[docs/development/RELEASE-CANDIDATES|release candidates guide]] for the full format.*

A **release item** is one shippable change, recorded as a typed Markdown note (`type: ReleaseItem`) with an id such as
`ITEM-0001` in `docs/releases/items/`. Its `sources` field lists where the change came from, so a reviewer can
trace the release back to the design. For this course, list at least:

- `prototypes/<slug>`: the prototype package with the brief and the execution prompt;
- `docs/design/<slug>`: the design folder with the prototypes, decisions and implementation map.

Create it with the guided capture, then look it up and validate every release item:

    node bin/app release-item new
    node bin/app release-item list --json
    node bin/app release-item check --json

`release-item list --json` shows the id and the file of your new note. Enter both below: the id (for example
`ITEM-0001`) and the file name inside `docs/releases/items/` (for example `ITEM-0001-reading-log.md`). The step
checks that the note has `type: ReleaseItem`, its id and both sources.
