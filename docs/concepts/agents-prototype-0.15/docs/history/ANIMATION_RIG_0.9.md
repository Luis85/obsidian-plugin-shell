# Klaus Editor 0.9 — Semantic Animation Rig & Presence

## Goal

Add liveliness without undoing the 0.8 geometry contract. Animation must move semantic parts around stable joints; it must never compensate for bad model origins with per-preset offsets.

## Coordinate and animation contract

Every model keeps the 0.8 structural contract:

- `+Y` is up.
- `+Z` is character forward.
- Structural footprint is centered at `X/Z = 0`.
- Structural ground is `Y = 0`.
- Accessories do not determine the root origin.

Animation sits **inside** that contract. The model root remains untranslated while rig nodes rotate around procedural pivots.

## Semantic rig

`CharacterRig.ts` converts assembled voxel geometry into optional semantic controls:

- `head`
- `leftArm`
- `rightArm`
- `leftLeg`
- `rightLeg`
- `tail`
- `eyes[]`

The controls are deliberately optional. Humans expose the full upper/lower-body rig; quadrupeds map front/hind limbs and tail; birds map wings/legs; abstract items can remain mostly facial/presence driven.

Meshes are re-parented with `Object3D.attach()`, preserving the assembled world-space pose before motion is applied.

## Pose vs motion

The design distinguishes durable identity from ephemeral behavior.

### Saved pose

Stored in `CharacterAppearance.pose`:

- `neutral`
- `ready`
- `wave`
- `thinking`
- `working`
- `celebrate`

A saved pose is part of how a team chooses to present the agent.

### Motion preview/runtime state

Not persisted as appearance:

- `idle`
- `listen`
- `think`
- `work`
- `celebrate`

Motion is layered over the saved pose by `CharacterAnimationController`. This allows the editor/runtime to communicate state without silently changing the character definition.

## Facial presence

Eye elements are tagged semantically by the model factory. The controller applies deterministic, calm blinks rather than random state. Reduced-motion mode suppresses animated blink and oscillation.

This foundation can later support eyebrows, mouths, visors and screen-face states without coupling those details to the editor component.

## Idle character

The existing `idleStyle` remains a personality-level motion modifier:

- `calm`
- `playful`
- `focused`
- `confident`

It changes amplitudes/frequency of head and tail motion without changing the saved pose.

## Architecture

```text
CharacterAppearance.pose
        │
        ▼
CharacterModelFactory
        │ assembled voxel parts
        ▼
CharacterRig
        │ semantic pivots + face controls
        ▼
CharacterAnimationController
        │ saved pose + temporary motion + idle style
        ▼
CharacterStageScene
```

`CharacterStageScene` owns frame timing and presence state. `CharacterAnimationController` owns motion rules. Vue only chooses pose/motion; it does not manipulate Three.js nodes directly.

## Regression coverage

`tests/character-animation.test.ts` checks that:

1. the human reference model exposes semantic head/limb nodes and eyes;
2. rig assembly does not move the grounded footprint;
3. pose/motion updates do not translate the character root;
4. every built-in model remains finite after an animated update.

The standalone browser regression additionally switches through Human, Pet, Animal and Item animation states at a 1586×992 viewport and checks for page/console errors and overflow.

## Current boundaries

This is intentionally a procedural transform rig, not a skinned mesh/skeletal animation system. That matches the block-built character architecture and keeps user-created part packs simple.

Future extensions can add:

- mouth/eyebrow/screen-face channels;
- pose thumbnails rendered from the actual scene;
- timeline/keyframe editing;
- named animation clips reusable across compatible silhouettes;
- agent-runtime state mapping (thinking/tool-use/waiting/error/success);
- optional GLTF/skinned-mesh adapter for external high-fidelity packs without changing the core character domain.
