# Record an increment

*This step uses the increment and release-candidate commands; read the
[[docs/development/RELEASE-CANDIDATES|release candidates guide]] for the full format.*

An **increment** is one shippable change, recorded as a typed Markdown note (`type: Increment`) with an id such as
`INC-0001` in `docs/releases/increments/`. Its `sources` field lists where the change came from, so a reviewer can
trace the release back to the design. For this course, list at least:

- `prototypes/<slug>`: the prototype package with the brief and the execution prompt;
- `docs/design/<slug>`: the design folder with the prototypes, decisions and implementation map.

Create it with the guided capture, then look it up and validate every increment:

    node bin/app increment new
    node bin/app increment list --json
    node bin/app increment check --json

`increment list --json` shows the id and the file of your new note. Enter both below: the id (for example
`INC-0001`) and the file name inside `docs/releases/increments/` (for example `INC-0001-reading-log.md`). The step
checks that the note has `type: Increment`, its id and both sources.
