# Write the design brief in a new prototype folder

The **prototype maker** turns your brainstorm into an agreed design brief and a prototype package. Run it
from this step (action *Run the prototype maker*), with `node bin/app prototype`, or from `node bin/app`
→ **Prepare a prototype with the guided maker**.

1. **Brief.** Answer the guide: the prototype title, what you are making (`new-plugin`, `new-feature`,
   `improvement`), problem, audience, outcome, pages, components, journeys, non-goals, data rules, failure
   states, visual direction, accessibility and acceptance. Enter exactly the title you chose in step 2. Every
   default you accept is recorded as an assumption, and the final agreement is explicit.
2. **Package output folder.** Enter `prototypes/<slug>` with your slug. The suggested default is the
   configured `paths.prototypes` folder; change it so each prototype gets its own new folder.
3. **Review.** The maker shows the execution prompt and the complete file plan. Nothing is written until you
   approve it.

The package contains `design-brief.md`, `execution-prompt.md`, `README.md`, `INTEGRATION.md`,
`companion.project.json`, the replayable `prototype-answers.json`, the guide snapshot, a pending manifest and a
compiler-generated `source/` workspace. Read [[src/cli/README#Prepare a prototype|Prepare a prototype]].

Agents and scripts use the same guide without prompts:

    node bin/app prototype guide --json
    node bin/app prototype validate --input prototype-answers.json --json
    node bin/app prototype --input prototype-answers.json --out prototypes/<slug> --json

The last command returns a plan; repeat it with `--apply <planHash>` to write. `approved: true` in the answers
records your agreement with the brief, so set it only after reviewing the defaults.

Starting a whole new project instead? `node bin/app new` runs a project starter and the same prototype
interview, and its package also holds `design-brief.md` and `execution-prompt.md`
([[src/cli/PROJECT-STARTERS#Prepared package and generation|prepared package]]). Its design folder is created inside
the generated `source/` project, so this course's checks follow the prototype maker route.

At the end the maker asks whether to create a Claude Design folder. The next step explains that question;
answering No now is fine, because you can prepare the folder there.
