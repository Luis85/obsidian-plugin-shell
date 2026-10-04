# A learning path is data, too

A learning path is one JSON file in `configs/learning/paths/`, named after its `id`. Each step teaches one thing:

- `goal` says what the step teaches, and `markdown` explains it (inline, or a file in `configs/learning/content/`).
- `docs` entries and wikilinks such as `[[docs/development/WIZARDS-AND-FORMS]]` point to the documentation;
  `learn check` reports broken links.
- `fields` or `form` ask questions, `checklist` lists what to do, and `actions` run a wizard, open a form or show a command.
- `winConditions` decide when the step is complete. Every condition must hold.

Read [[docs/development/LEARNING-PATHS#Write a learning path|Write a learning path]] and
[[docs/development/LEARNING-PATHS#Win conditions|the win condition reference]] before you continue.
