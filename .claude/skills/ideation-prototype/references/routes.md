# Choosing a prototype route

| Route | Best when | Needs | Produces | Proves | Does not prove |
| --- | --- | --- | --- | --- | --- |
| A. Prepared package | You want a reviewed, replayable package for any project kind | agreed answers (`approved: true`), project or starter request | `design-brief.md`, answers, preparation, `execution-prompt.md`, `source/` boilerplate | the brief is complete and the compiler accepts the model | behavior, build, native use |
| B. Execute (`companion-prototype-design` 5–7) | People must click through real behavior before any code decision | prepared package or agreed brief, local toolchain, browser runner | self-contained HTML (or CLI transcript), selected-stack sources, `companion.project.json`, verification notes | the experience works offline in a browser from real sources | native Obsidian behavior, business acceptance |
| C. Clickdummy | A saved, generated project exists and you want navigation and layout review | saved project, installed dependencies | `clickdummy.html`, optional UI gallery | routes, navigation, component composition with synthetic read data | writes, persistence, native behavior |
| D. Brainstorm prototype output | A feature brainstorm should carry its own prototype source | saved project, current `baseSha256` | `brainstorms/<slug>-prototype/` with generated source, optional verification plan | the feature definition compiles | scoped feature-only implementation (output is whole-project) |

## Recommendation logic

- New project from a project starter: A (via `new --input - --out projects/<slug>`), then B if the user wants to click through before scaffolding.
- New feature in a saved project: A (via `prototype --out prototypes/<slug>`), or D when the user wants generated source with the definition.
- Existing generated project, layout review only: C.
- Several directions to compare: managed prototypes (`prototypes create`, `version`, `fork`, `compare`, `activate`) around any route.

## Evidence language

Say "browser prototype verified offline" or "clickdummy built", never "feature works" or "accepted". Keep gallery screenshots as review evidence; they are not baselines. Record the tested revision and artifact hashes when the tools report them, and list what was not run (native smoke, other browsers, other operating systems).
