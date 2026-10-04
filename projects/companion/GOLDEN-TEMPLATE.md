# Workbench Companion development baseline

The canonical starter is `configs/starters/companion-plugin.json` in the Workbench source. This project is an independent configured copy. Generated `design/project.json` is a consumer output, not a second maintained golden template.

Run `npm run verify:project` and `npm run build:clickdummy`; use `npm run dev:preview` for source-backed fixture review. These checks do not imply native authoring parity. Retain unimplemented requirements and interactions until their behavior is actually verified. Never replace them with generic success notifications to satisfy a coverage count.
