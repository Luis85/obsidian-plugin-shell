---
name: release
description: Release this repository through Release cut, the Release tier and Publish with explicit confirmation for every remote action. Delegates to the canonical Claude skill without duplicating it.
---

Read and follow the [canonical skill](../../../.claude/skills/release/SKILL.md) in full; resolve that link and every relative reference inside it from the canonical skill directory, not the terminal's working directory. Also read `AGENTS.md`. This is a reference-only adapter: do not create a divergent Codex workflow or copy its references.

Where the canonical skill calls the AskUserQuestion tool or a GitHub MCP tool, use this host's equivalent (or the `gh` CLI it names), or ask the same questions as a numbered list, and wait for the answer before continuing.

Loading this skill authorizes nothing. Dispatching Release cut or Publish, pushing to a release branch and rerunning a run each need the user's explicit confirmation in the conversation, every time; environment approval is the owner's. Never tag, move a tag, merge the release pull request or edit a published release by hand. If the canonical skill is missing, stop and report the missing path.
