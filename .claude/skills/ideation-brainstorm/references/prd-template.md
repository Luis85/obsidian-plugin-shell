# PRD draft template

The app reads PRDs as Markdown in `paths.prds` (default `docs/prds`). Only the scalar frontmatter fields `type`, `id` and `title` are parsed: `type` must be `prd`, `id` must start with a letter and use letters, digits, hyphens or underscores (at most 100 characters), and `title` is at most 120 characters. Use plain scalars or JSON-style double quotes; no YAML blocks, lists, anchors or tags in those fields. Keep the file UTF-8, under 250 KB. The full Markdown body is retained as written.

```markdown
---
type: prd
id: quick-capture
title: "Quick capture"
---

# Quick capture

Status: draft from an ideation brainstorm on YYYY-MM-DD. Not approved for implementation.
Mode: new project | new feature | improvement

## Problem and outcome
- Problem: <who struggles with what, today>
- Desired outcome: <observable change when this works>

## Users and jobs
- <user>: when <situation>, I want to <motivation>, so I can <expected outcome>.

## Current workaround
<what people do now and why it falls short>

## Options considered
| Option | Summary | Why chosen / rejected |
| --- | --- | --- |
| A (chosen) | ... | ... |
| B | ... | ... |
| Smallest useful | ... | ... |

## Scope
- In: ...
- Non-goals: ...

## Risks and assumptions
- Riskiest assumption: ... (how we will learn whether it holds)
- Other risks: ...

## Success signals
- ...

## Open questions
- ...

## Decision log
- YYYY-MM-DD — <decision> (decided by the user | assumption accepted by the user)
```

Do not add sections the brainstorm did not cover just to fill the template; write "Not discussed" instead. Do not copy recalled memory or third-party text verbatim into the PRD.
