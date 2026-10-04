---
name: feature-delivery
description: Deliver a Ready increment through change pull requests stacked on its branch and the tiered pull-request flow (draft Dev tier, ready Integration tier, green merge). Delegates to the canonical Claude skill without duplicating it.
---

Read and follow the [canonical skill](../../../.claude/skills/feature-delivery/SKILL.md) in full; resolve that link and every relative reference inside it from the canonical skill directory, not the terminal's working directory. Also read `AGENTS.md` and `.github/pull_request_template.md`. A handoff that is not Ready goes through the `increment-handoff` adapter first. This is a reference-only adapter: do not create a divergent Codex workflow or copy its references.

Where the canonical skill calls the AskUserQuestion tool or a GitHub MCP tool, use this host's equivalent (or the `gh` CLI it names), or ask the same questions as a numbered list, and wait for the answer before continuing.

Loading this skill grants no permission to push, run `pr publish` or `pr sync`, open or update a pull request, mark it ready, merge, dispatch a workflow, tag or publish. Each of those needs the user's explicit request in the conversation. If the canonical skill is missing, stop and report the missing path.
