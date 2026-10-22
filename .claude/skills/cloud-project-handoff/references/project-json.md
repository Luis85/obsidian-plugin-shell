# Project JSON from a starter

`node bin/app new --from <file>` generates a project from a companion project JSON (schema 6). Every companion starter in `configs/starters/<starter>.json` carries one under `generator.document`. The recipe below copies that document and changes only these fields:

- the project's `id`, `name`, `author` and `description` (`version` stays the starter's);
- the entry view: `label`, `slug` and `goal`. The goal names the first feature, so the generated `PROJECT-IMPLEMENTATION.md` and screen catalog point at it;
- the design-system name.

Other nodes, links, entities and design tokens stay exactly as the starter declares them. If the starter has several views with a ribbon icon, only the entry view is renamed. List the others for the user instead of deleting them by hand.

Run it from the repository root and write into the session scratchpad, never into this checkout:

<!-- derive-project-json -->
```sh
node -e '
const fs = require("fs");
const [, starterPath, out, id, name, author, description, viewLabel, firstFeature] = process.argv;
const starter = JSON.parse(fs.readFileSync(starterPath, "utf8"));
if (starter.generator?.kind !== "companion") throw new Error("not a companion starter: " + starter.id);
const doc = structuredClone(starter.generator.document);
doc.project = { ...doc.project, id, name, author, description };
const view = doc.design.nodes.find(node => node.kind === "view" && node.entry);
if (!view) throw new Error("the starter declares no entry view: " + starter.id);
view.label = viewLabel;
view.slug = viewLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
if (!view.slug) throw new Error("the view label needs at least one letter or digit");
view.goal = "Host the " + name + " workspace; first feature: " + firstFeature + ".";
if (doc.design.designSystem) doc.design.designSystem.name = name + " tokens";
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
' configs/starters/blank.json "$SCRATCH/delivery-management.companion.json" delivery-management "Delivery Management" "Luis Mendez" \
  "Delivery management for Obsidian: plan delivery resources from one workspace view." "Delivery Management" "resources planner"
```

The arguments, in order: starter file, output file, plugin ID, display name, author, description, view label, first feature. `$SCRATCH` is the session scratchpad directory. The example is the first project packaged this way.

Then validate it, and preview the generation without writing:

```sh
node bin/app project validate --input "$SCRATCH/delivery-management.companion.json"
node bin/app new "$SCRATCH/delivery-management" --from "$SCRATCH/delivery-management.companion.json" --dry-run
```

`project validate` must report no findings. The `new` preview must show `Conflicts none`, and it prints the plan hash to apply. A project JSON exported from the browser companion skips the recipe and starts at `project validate`.
