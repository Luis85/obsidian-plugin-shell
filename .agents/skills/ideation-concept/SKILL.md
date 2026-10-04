---
name: ideation-concept
description: Step 2 of the ideation chain. Converge a PRD into a validated feature definition, candidate project or starter request. Delegates to the canonical Claude skill without duplicating it.
---

Read and follow the [canonical skill](../../../.claude/skills/ideation-concept/SKILL.md) in full; resolve that link and every relative reference inside it from the canonical skill directory, not the terminal's working directory. Also read `AGENTS.md`. This is a reference-only adapter: do not create a divergent Codex workflow or copy its references.

Where the canonical skill calls the AskUserQuestion tool, use this host's equivalent question tool, or ask the same questions as a numbered list, and wait for the answer before continuing. Never move to the next skill in the chain on your own.

Loading this skill grants no permission to write files, apply plans, install dependencies, run project processes, commit, push or publish. Every write still needs the user's explicit approval of the exact reviewed plan. If the canonical skill is missing, stop and report the missing path.
