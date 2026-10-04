# Add the increment to the next release candidate (release-candidate feature)

*This step uses the release-candidate commands described in the
[[docs/development/RELEASE-CANDIDATES|release candidates guide]], delivered by the release-candidate feature.*

A **release candidate** collects the increments planned for one version. It lives in
`docs/releases/candidates/<version>/README.md` with frontmatter `type: ReleaseCandidate` and an `increments` list.
Use the version you chose in step 2.

    node bin/app candidate new --version <x.y.z>
    node bin/app candidate add --version <x.y.z> --increment <INC-0001>
    node bin/app candidate show --version <x.y.z> --json
    node bin/app candidate check --json

`candidate new` creates the candidate once; `candidate add` lists your increment in it. `show`, `status`, `docs` and
`check` inspect and validate the candidate; follow the guide for their exact options and for how a candidate is
reviewed.

A release candidate is a planning record. It does not tag, publish or submit anything: publishing the plugin
stays a separate, explicitly authorized operation ([[docs/development/MAINTENANCE-AND-RELEASE|maintenance and release]]).

This step checks that `docs/releases/candidates/<version>/README.md` exists, has `type: ReleaseCandidate` and names
your increment. With that, your idea has travelled from a brainstorm through Claude Design into a prototype and
onto the next release candidate.
