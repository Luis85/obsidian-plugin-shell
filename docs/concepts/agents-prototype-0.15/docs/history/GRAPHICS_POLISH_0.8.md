# Klaus Editor 0.8 — 3D Graphics & Alignment Polish

## Goal

Fix visible part drift in procedural characters and make every embodiment family obey one stable scene contract, while improving model readability and keeping the calm, stylized voxel direction.

## Root causes fixed

1. **No shared ground plane.** Human, quadruped, bird, floating-head and object builders used unrelated local Y ranges while the stage applied one hard-coded offset.
2. **Mixed forward axes in quadrupeds.** The former animal builder mixed X-forward body/head placement with +Z-forward face details, making muzzles, ears and tails appear shifted.
3. **Humanoid-only decoration coordinates.** Patterns and accessories reused human coordinates on animals and objects.
4. **Asymmetric equipment affected model centering.** Shields, badges, tails and halos could enlarge the visible bounds on one side and pull the apparent body origin away from center.
5. **Fixed camera, plumbob and inventory anchors.** Stage framing assumed a human-sized model.
6. **Standalone fallback repeated the same baseline issue.** All silhouette families were placed against a human-derived origin.

## Stable model-space contract

Every procedural character now follows one convention:

- `+Y` = up
- `+Z` = forward / face direction
- structural body/footprint owns X/Z centering
- structural feet/base define the floor
- structural floor is normalized to `Y = 0`
- visual accessories may extend outside the structural bounds without moving the body origin
- final visible width/height/depth are measured after all parts and accessories are assembled

The structural origin is derived from the centered `mind` + `character` geometry. This deliberately excludes asymmetric presentation elements such as safety shields, badges, memory packs, tails, halos and other accessories from origin calculation.

The final assembled model is still measured with `THREE.Box3` so camera framing, plumbob placement and floating semantic props adapt to the visible result.

## Model improvements

### Human

- common floor plane for shoes and legs
- torso/head contact derived from dimensions
- continuous shoulder / upper-arm / forearm placement
- layered voxel hair
- face catchlights and expression blocks
- backpack and shield anchored from body dimensions rather than global stage coordinates

### Pets and quadrupeds

- rebuilt around `+Z` forward
- centered head and chest
- muzzle projects forward instead of sideways
- four distinct fore/hind leg and paw anchors
- ears derive from head width/height
- tail derives from the rear body plane
- collar and chest patch improve animal readability without affecting the structural origin
- turtle shell remains a low centered body rather than a shifted accessory

### Bird / owl

- stable grounded talons
- centered body/head stack
- owl-like facial discs, brow blocks and chest patch
- wings remain semantically selectable while staying symmetrical
- rear feather/tail blocks keep the silhouette readable from oblique camera angles

### Floating head / object mascots

- shared base/floor convention
- screen and face coordinates remain +Z-forward
- accessories use silhouette-specific anchors
- terminal, toolbox, book and cube variants stay centered despite different visible depths

## Decoration and attachment rules

Accessories and patterns now use silhouette-specific anchor calculations instead of one humanoid coordinate table. Supported anchors include:

- face plane
- head top
- neck/collar
- chest/front plane
- body width

This keeps glasses, headsets, scarves, caps, bow ties, antennas, halos and patterns attached when the user changes body/head parts or switches categories.

## Stage improvements

- pedestal top is the single model ground plane
- camera target and distance derive from model metrics
- plumbob height derives from visible model height
- floating capability props derive from visible width/height
- render-quality selector controls renderer pixel ratio and shadow quality
- platform accent lighting follows the selected agent accent
- desktop camera controls are centered beneath the character; mobile controls remain edge-aligned

## Standalone fallback improvements

The dependency-free HTML renderer now mirrors the same visual contract:

- family-specific floor baselines
- grounded humans, pets, animals and objects
- centered front-facing quadruped assembly
- four visible paw/leg positions
- centered muzzle / ear / tail anchors
- more readable pet collar/chest treatment
- stronger owl facial/chest/wing treatment

The fallback remains deliberately simpler than the production Three.js scene; its purpose is portability, not a second 3D engine.

## Regression coverage

`tests/character-rendering.test.ts` iterates every built-in procedural model and checks:

- visible bounding-box `min.y === 0`
- root stays at the scene origin
- model dimensions are non-zero
- returned metrics match the actual assembled Three.js bounds

Asymmetric presentation gear is allowed to shift *visible* bounding-box center; it must never shift the structural body origin.

## Verification in this pass

Standalone Chromium smoke test at `1586 × 992`:

- Human → Pet → Animal → Item switching
- all families stay grounded on the same platform
- no document overflow (`1586 × 992` document bounds)
- no page errors during tested family switching
- standalone inline JavaScript passes `node --check`
- all TypeScript source/test files pass parser-level transpilation with TypeScript 5.8.3

A complete `Vite + vue-tsc + Vitest` run still requires installing project dependencies in the execution environment.

## Next graphics step

Do not return to manual per-model position offsets. The next graphics work should build on this coordinate contract with:

- skeletal/part-group animation rigs
- authored poses per silhouette
- Three.js-rendered model thumbnails
- material/texture variation
- subtle facial animation
- optional external voxel/GLTF asset adapters that normalize imported content into the same floor/forward/origin contract
