---
name: cloud-project-handoff
description: Generate a new Workbench plugin project in a cloud session and hand it over as a zip, project JSON and takeover prompt. Delegates to the canonical Claude skill without duplicating it.
---

Read and follow the [canonical skill](../../../.claude/skills/cloud-project-handoff/SKILL.md) in full; resolve that link and every relative reference inside it from the canonical skill directory, not the terminal's working directory. Also read `AGENTS.md`. This is a reference-only adapter: do not create a divergent Codex workflow or copy its references.

Where the canonical skill calls the AskUserQuestion tool, use this host's equivalent question tool, or ask the same questions as a numbered list, and wait for the answer before continuing. Where it calls the SendUserFile tool, use this host's file delivery, or give the absolute paths of the three files.

Loading this skill grants no permission to write outside the session scratchpad, commit to this checkout, add a remote, push, run `gh` or `az`, install into an Obsidian vault or implement features. If the canonical skill is missing, stop and report the missing path.
