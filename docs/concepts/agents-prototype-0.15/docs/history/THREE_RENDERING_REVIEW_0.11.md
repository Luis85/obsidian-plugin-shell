# Klaus Editor 0.11 — Three.js Rendering & Voxel Assembly Review

## Scope

This pass addresses two rendering defects that were still visible after the 0.10 editor polish:

1. Horizontal rotation could read as a camera/perspective change rather than the character turning in place.
2. Rotated voxel parts—especially ears, tails, wings, limbs and some accessories—could appear displaced from their parent body.

The fixes are structural. They define a repeatable model-coordinate and joint-pivot contract rather than adding preset-specific correction offsets.

## 1. Rotation: fixed camera, rotating character

The character editor no longer uses `OrbitControls` for character rotation. The camera remains fixed relative to the workshop and the character root owns yaw.

```text
scene
├── environmentRoot       fixed
└── stageRoot             fixed
    ├── characterRoot     USER YAW: 0..360°
    │   └── characterMotionRoot
    │       └── procedural model / animation rig
    ├── inventoryRoot     fixed contextual props
    └── fxRoot            fixed stage FX
```

Rules:

- `characterRoot.rotation.y` is the only user-controlled horizontal turntable rotation.
- Dragging horizontally changes model yaw, not camera azimuth.
- Front / Right / Back / Left are deterministic 0 / 90 / 180 / 270° character rotations.
- The camera may change distance/target when a different-sized model is selected, but model yaw is preserved.
- Raycasting calls `updateWorldMatrix(true, true)` before intersection tests so body-region hit areas reflect the current turntable angle.
- Zoom changes camera distance only.

This separation also keeps procedural idle/pose motion inside `characterMotionRoot`, so runtime animation cannot overwrite the user-selected orientation.

## 2. Coordinate contract

Every procedural character follows the same coordinate convention:

```text
+Y = up
+Z = forward / face direction
+X = character right
Y=0 = structural floor contact
X=0,Z=0 = centered structural footprint
```

The structural body defines grounding and centering. Accessories and asymmetric equipment are allowed to extend final visible bounds without moving the body origin.

## 3. Why rotated voxels looked displaced

A box rotated around its own center preserves the numeric mesh position but moves both attachment edges. For an appendage such as an ear, wing or tail, that visually detaches the part from the body.

Incorrect conceptual model:

```text
body ---- [ mesh center ]   rotate mesh around center
```

Correct model:

```text
body ---- (joint anchor)
             └── [voxel offset from joint]
                   joint rotates
```

The model factory now uses a reusable `addHingedBox(...)` primitive:

- create a `THREE.Group` at the semantic attachment point;
- create the voxel as a local child offset away from the joint;
- rotate the joint group, not the voxel center;
- tag the controlled voxel with a semantic `rigPart`.

This is used for rotated ears, tails, owl wings and other hinged appendages.

## 4. Explicit semantic rigging

The animation rig no longer has to infer all limbs from editor categories. Procedural construction can explicitly tag geometry as:

- `head`
- `leftArm`
- `rightArm`
- `leftLeg`
- `rightLeg`
- `tail`

`CharacterRig` prefers explicit tags and only uses category/spatial inference as a compatibility fallback. This prevents a skill-colored voxel from accidentally becoming an arm, or an appearance voxel from being pulled into the wrong animated group.

## 5. Model-family fixes

### Humans

- Arms and legs carry explicit rig tags.
- Shoes/soles follow their leg rig.
- Round and pointed ears use anchored hinge groups.
- Head decoration remains attached to the head rig.

### Pets / quadrupeds

- +Z is consistently forward.
- Forelegs and hind legs are explicitly differentiated.
- Ears pivot from the top/side of the head rather than their centers.
- Tails pivot from the rear body attachment and extend locally along -Z.
- Paws remain associated with their corresponding leg.

### Birds / owl

- Wings pivot at shoulder attachment points.
- Head tufts use anchored joints.
- Feet and legs have explicit left/right rig membership.

### Items / mascots

- Remain centered around the structural base and do not receive artificial humanoid joints.

## 6. Bounding and camera behavior

The assembled model updates world matrices before bounds are read. Final visible bounds are used for presentation metrics, while the structural root remains authoritative for grounding.

The fixed camera is fitted to the selected model's measured width/height. Selecting a pet after a human can therefore change framing without changing the model's yaw.

## 7. Regression tests

`tests/character-rendering.test.ts` now protects two classes of rendering defect:

1. Every built-in model must remain grounded with valid measured dimensions.
2. Every semantic rig pivot must sit on or very near the visible bounds of the voxels it controls. This catches limbs whose joint is accidentally far away from their geometry.
3. Every catalogued composable part is injected into a compatible model and checked for grounding plus sane scene bounds. This catches a bad pivot or offset that would explode the assembled model bounds.

## 8. Standalone fallback

The self-contained HTML does not bundle Three.js. Its dependency-free Canvas renderer previously approximated yaw mostly through side-face shear, which made a 90° turn look like a changed camera perspective.

0.11 now projects voxel width and horizontal position from the actual yaw angle. Front/right/back/left therefore produce recognizably different model orientations in the standalone prototype too. This renderer remains an approximation; the Vue source's Three.js renderer is the production direction.

## Verification performed

- Standalone JavaScript syntax check: passed.
- Browser render at 1586×992 via Chromium `set_content`: passed.
- Front / right / back / left turntable states: distinct and contained.
- Human / pet / animal / item family switching: no page errors and no viewport overflow.
- Source scan confirms `CharacterStageScene` no longer imports `OrbitControls`.
- TypeScript parser/static checks on modified Three.js files report no syntax diagnostics; unresolved module diagnostics are expected because dependencies are unavailable in this environment.

## Remaining verification gap

A complete `vue-tsc + Vite + Vitest` run is still blocked because the package dependencies cannot be installed in the current execution environment. The test suite and source changes are included so the full run can be executed immediately in the implementation repository.

## Non-negotiable rule for future model parts

Do not repair a displaced part with model-specific world offsets. If a part rotates, define its attachment anchor and local child offset. If it animates, give it a semantic rig tag. New character packs should conform to the same coordinate and pivot contract.
