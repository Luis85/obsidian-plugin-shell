---
name: increment-handoff
description: Write and refine the developer handoff for one increment until the Definition of Ready passes. Delegates to the canonical Claude skill without duplicating it.
---

Read and follow the [canonical skill](../../../.claude/skills/increment-handoff/SKILL.md) in full; resolve that link and every relative reference inside it from the canonical skill directory, not the terminal's working directory. Also read `AGENTS.md`. This is a reference-only adapter: do not create a divergent Codex workflow or copy its references.

Where the canonical skill calls the AskUserQuestion tool, use this host's equivalent question tool, or ask the same questions as a numbered list, and wait for the answer before continuing. Never move on to `feature-delivery` on your own.

Loading this skill grants no permission to write the handoff, change the Definition of Ready configuration, implement, commit, push or open a pull request. Every write still needs the user's explicit approval of the exact previewed content. If the canonical skill is missing, stop and report the missing path.
