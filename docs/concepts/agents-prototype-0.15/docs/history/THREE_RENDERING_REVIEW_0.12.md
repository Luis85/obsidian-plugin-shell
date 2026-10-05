# Klaus Editor 0.12 — Three.js Renderer Correctness & Model Assembly Pass

## Scope

This pass targets the two remaining complaints in the 3D editor:

1. rotation could still *feel* like a perspective/camera change;
2. some voxel parts appeared displaced, especially after composable part changes or animation.

The fixes are structural rather than preset-specific offsets.

## Root causes found

### 1. Two transform systems were competing

`addHingedBox()` correctly authored ears, tails and wings under joint groups. Later, `assembleCharacterRig()` could re-parent the individual voxel mesh out of that authored group with `Object3D.attach()`. The world pose was preserved at that moment, but the authored joint hierarchy was lost and the semantic animation pivot was then reconstructed from bounds.

That made the final result sensitive to model proportions and was the main remaining source of apparently shifted animated parts.

### 2. Accessory coordinates were preset-derived

Glasses, headsets, caps, scarves, patterns and similar details still used formulas based on the default silhouette proportions. Composable head/body recipes could therefore move the base geometry without moving those decorations by the same amount.

### 3. Cardinal view actions re-fitted the camera

The model root already owned yaw, but `setView()` called camera fitting before applying Front/Right/Back/Left. This could reset zoom/framing at the same time as rotation, visually reinforcing the impression that the camera was orbiting.

### 4. Small geometry gaps remained

The owl legs had a visible body/leg gap and the human leg/torso seam was looser than intended. Floating-head and object appendages were also not consistently authored as hinge assemblies.

## 0.12 transform contract

```text
scene
├── environmentRoot                  FIXED
└── stageRoot                        FIXED
    ├── characterRoot               TURN TABLE YAW ONLY
    │   └── characterMotionRoot      IDLE / POSE MOTION ONLY
    │       └── model root
    │           └── semantic rig
    │               └── authored joint assemblies
    ├── inventoryRoot                FIXED contextual props
    └── fxRoot                       FIXED stage FX
```

### Coordinate contract

- `+Y` = up
- `+Z` = character forward
- `+X` = character right
- structural body defines the footprint and ground plane
- accessories do not influence body centering
- user yaw never modifies the camera

## Turntable changes

A dedicated `CharacterTurntable` now owns character yaw.

- it has no camera reference;
- all angles normalize to `0..359.999...`;
- yaw is applied to the character-root quaternion;
- Front/Right/Back/Left now change only yaw;
- camera fitting occurs only when model dimensions or portrait framing actually require it;
- zoom changes camera distance only;
- idle animation no longer adds a competing root-level Y rotation.

This makes "rotate character" and "change perspective" separate operations in code, not just in UI wording.

## Model assembly changes

### Preserve authored joints

Semantic rigging now promotes the highest authored assembly below the model content root. A wing mesh inside `joint:leftArm`, for example, stays inside that joint. The semantic `rig:leftArm` node wraps the whole assembly rather than extracting the wing voxel.

This preserves:

- ear attachment angles;
- tail bases;
- wing shoulders;
- floating/object arm anchors;
- future pack-authored hinge assemblies.

### Geometry-driven accessories

Attachment anchors now come from the actual assembled `identity` and `mind` bounds:

- face front
- head top
- head center
- head width
- neck
- chest front

The result adapts to wide/compact heads and different body recipes automatically.

Patterns similarly derive their size and front-surface position from the actual `mind` geometry rather than hard-coded per-silhouette coordinates.

### Additional geometry fixes

- human legs close the remaining torso seam;
- owl legs now meet the body;
- floating-head ears are authored as proper hinges;
- floating/object arms use stable joint assemblies and semantic rig tags.

## Tests added/strengthened

### `character-rendering.test.ts`

In addition to grounding and pivot proximity, every built-in model now checks that authored hinge assemblies still contain visible meshes after semantic rigging. This protects against a future refactor accidentally extracting a child voxel from its joint again.

### `character-turntable.test.ts`

The turntable test proves:

- 450° normalizes to 90°;
- negative angles wrap correctly;
- the model quaternion changes as expected;
- an unrelated camera remains unchanged.

## Verification performed

- TypeScript parser/transpile pass: **27 TS files, 0 syntax diagnostics**.
- Source review confirms CharacterStageScene has no OrbitControls dependency.
- Source review confirms cardinal views no longer invoke camera fit unless portrait mode changes.
- Source review confirms accessories/patterns use assembled geometry bounds.
- Source review confirms authored hinge groups are preserved by semantic rigging.

## Remaining runtime verification gap

A complete `vue-tsc + Vite + Vitest` run could not be completed because dependency installation timed out in this execution environment. The package contains the new tests so the implementation repository can run the full verification immediately after `npm install`.
