# Klaus Editor 0.13 — Voxel Model Quality & Graphics Pass

## Goal

Improve visual fidelity without weakening the renderer-correctness work from 0.12. The target remains heavily stylized, Minecraft-inspired, retro and calm: sharp block silhouettes, small pixel-like face details, limited material gloss, strong readable color groups, and warm/cool studio lighting.

## Geometry changes

### Humans
- Legs are authored as hip-owned assemblies containing trouser, shoe, sole and toe detail.
- Arms are shoulder-owned assemblies containing sleeve, cuff and hand.
- Jacket/shirt/lapel geometry was rebalanced to reduce intersecting slabs.
- Hair is a stepped voxel crown/fringe rather than overlapping large plates.
- Nose, cheeks and palm pixels add expression without leaving the block vocabulary.
- Backpack straps and shield face detail now read from side/back views.

### Pets / quadrupeds
- Fore/hind legs own their paws and toe pixels.
- Dog, fox, cat, rabbit and turtle faces have distinct muzzle/nose/whisker/cheek cues.
- Fox tails include a light tip inside the same tail hinge assembly.
- Turtle shell plates sit on the shell surface rather than looking like a displaced second body.
- Neck/chest transitions were added so heads no longer appear detached from long bodies.

### Birds
- Legs/feet/claws form complete assemblies.
- Wings use authored shoulder hinges with inner-feather blocks.
- Tail feathers close the rear silhouette.
- Facial discs, brows, beak and chest patch improve owl readability.

### Talking heads / items
- Talking heads now have a deliberate support/signal base and stepped crown treatment.
- Terminal shells gain a front bezel and status pixels.
- Toolboxes gain latches/handle depth.
- Books gain an inset page block and line details.
- Floating/clamp arms stay under authored joints.

## Materials and stage

`MeshPhysicalMaterial` finishes were retuned toward high roughness and low metalness. `flatShading` and dithering reinforce broad voxel planes; metallic/glossy remain opt-in rather than the default. The stage adds a fixed contact shadow and a restrained warm face fill while reducing ambient/fill intensity.

## Assembly contract

Visual fidelity must never be implemented through per-preset corrective offsets. Every new part must satisfy the shared model contract:

1. Author geometry in +Y up / +Z forward coordinates.
2. Attach multi-voxel moving parts beneath one authored joint.
3. Mark the owned meshes with the semantic rig part.
4. Let structural bounds establish the floor and center.
5. Derive accessories/patterns from measured semantic geometry.
6. Animate semantic wrappers, not individual decorative voxels.

## Regression additions

`character-rendering.test.ts` now explicitly expects human semantic limbs to contain at least three visual meshes and quadruped limbs to retain their paws. Existing grounding, bounds, hinge-preservation, finite-animation and turntable tests remain.
