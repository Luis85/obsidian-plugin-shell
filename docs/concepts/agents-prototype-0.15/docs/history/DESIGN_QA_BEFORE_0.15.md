# Klaus Editor 0.14 — Visual Correction QA

**Source visual truth:** `/mnt/data/image.png` (user-provided problem screenshot)

**Implementation evidence:** `/mnt/data/klaus-014/front.png`, `/mnt/data/klaus-014/right.png`, `/mnt/data/klaus-014/back.png`, `/mnt/data/klaus-014/left.png`, `/mnt/data/klaus-014/skills.png`

**Viewport:** 1586 × 992 CSS px, deviceScaleFactor 1

**State:** Klaus Classic · Human · Models workspace, plus Skills isolation state

## Comparison history

### P1 — Secondary robot/image visible in the upper-right studio

**Before:** the screenshot contains an unrelated small robot/character in the upper-right artwork, competing with the agent being edited.

**Fix:** removed the baked stage backdrop and removed the raster character-creator banner asset. The studio and banner are now character-free except for the active agent.

**Post-fix evidence:** `front.png`; browser-computed checks report `bakedStageImage: false` and `bannerImage: false`.

### P1 — Human reads as detached slabs/voxels

**Before:** arms/equipment appear visually separated, a large red side slab dominates the right side, and the figure lacks a coherent silhouette.

**Fix:** removed the permanent side shield; reduced/back-anchored the memory pack; rebuilt standalone model-space projection for shoulders and depth; rotated the belt as geometry; constrained front-facing shoe/detail pixels; increased profile depth; and added a compact safety emblem.

**Post-fix evidence:** `front.png`, `right.png`, `back.png`, `left.png`.

### P2 — Profile rotation looked like screen-space parts sliding

**Before:** part placement mixed character/model coordinates and 2D screen coordinates, so shoulders remained separated even at a 90° profile.

**Fix:** shoulder/wing positions now project from model space using character yaw. Backpack depth is represented on Z rather than an ad-hoc screen X offset.

**Post-fix evidence:** `right.png` and `left.png` show a coherent single profile rather than both arms floating on opposite sides.

## Required fidelity surfaces

- **Typography:** unchanged; hierarchy remains consistent with the established editor.
- **Spacing/layout:** no document overflow at 1586×992; creator shell remains contained.
- **Colors/tokens:** preserved retro-calm violet/cyan palette; memory equipment is now visually subordinate.
- **Image quality:** no baked raster stage character and no banner raster remain.
- **Copy:** unchanged except version documentation; no duplicate visual label was introduced.

## Functional checks

Browser state returned:

```json
{
  "skills": true,
  "appearance": false,
  "skillCards": 6,
  "overflow": false,
  "bakedStageImage": false,
  "bannerImage": false
}
```

Page errors: 0

Console errors: 0

Standalone JavaScript syntax: passed.

28 TypeScript source/test files: 0 parser/transpile diagnostics.

## Verification boundary

The standalone prototype is browser-verified. The full Vue/Vite/Three.js runtime is not marked build-verified because source-package dependencies are not installed in this environment.

## Final result

passed
