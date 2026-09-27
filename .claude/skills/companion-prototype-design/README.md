# Companion Prototype Design — installable agent skill

Design-first brainstorming for a whole plugin, a new feature, or a feature improvement.
The agent interviews until the design is explicitly agreed, writes the complete bespoke
execution prompt inline, then offers prompt save or execution. Authorized execution
produces a source-built HTML clickdummy, complete source workspace and companion JSON.

## Install

Copy this **whole directory**, not only SKILL.md, to one supported skill location:

```text
<repo>/.claude/skills/companion-prototype-design/
```

The current generated developer kit already uses `.claude/skills/*/SKILL.md`. For
another agent, use its documented skill discovery directory, or explicitly instruct
it to read this SKILL.md. The portable format has name/description frontmatter and
progressively loaded references/scripts. It is not a ChatGPT connector installation.
No account, plugin permission, repository change or global install is performed by
extracting this archive.

For existing generated plugins, installing this folder only changes agent guidance.
For future generator output, extend `scripts/companion/devkit` and its compiler inventory
under the repository's normal review/tests; this package does **not** silently patch
that generator or claim automatic propagation to every generated project.

## Start a session

```text
Use companion-prototype-design. I want to design [a new plugin / a new feature /
an improvement] before implementation. Start from the current checkout and walk me
through the decisions until we agree. Then give me the complete execution prompt inline.
```

Or: “Use companion-prototype-design to improve the capture flow. Preserve the existing
plugin and start with the design.” The agent should read the baseline before asking.

A fresh execution session receives the completed prompt plus repository/baseline access.
A second discovery interview is unnecessary unless a genuine compatibility gap remains.

## What is included

SKILL.md; design interview, repository/import constraints, architecture/QA, subagent and
artifact references; brief/manifest/integration/prompt templates; read-only inspection,
real reader/compiler-plan validation, single-file assembly, offline inspection, actual
browser-check runner, change reporting, safe ZIP packaging; helper regression tests.
See `scripts/README.md` for commands and `VERIFICATION.md` for tested/untested scope.

The observed PR #5 head is 6178b1025336941ad6fb10eae4e26930622363f9. This skill explicitly
rechecks it each time. At inspection the real contract was v5, not the v4 text still
present in parts of the PR description.

## Important boundaries

The companion imports complete authoring JSON, not arbitrary Vue files. Source handover
is separate and traceable. Feature imports are reviewed full-project replacements, not
magic merges. `companion:generate` is read-only byte echo; `shell.mjs generate` and
`companion:scaffold` are separate plan/apply generation paths. The HTML assembler consumes
already compiled Vue output; it does not fake a Nuxt UI application or compiler.

This delivery creates the skill, not a bespoke prototype without a product brief.
No changes have been committed or pushed to the repository by this package.
