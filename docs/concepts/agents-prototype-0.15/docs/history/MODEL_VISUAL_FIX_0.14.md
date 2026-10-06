# Klaus Editor 0.14 — Model Visual Correction & UI Polish

## Purpose

This pass responds to two concrete visual defects observed in the Character studio:

1. the default human looked like separate slabs/voxels rather than a coherent voxel character; and
2. a small robot/character image remained visible in the upper-right studio/banner artwork even though it was not part of the edited agent.

The pass fixes those defects first, then polishes the stage and protects the source implementation against their return.

## What changed

### No duplicate decorative character

The self-contained prototype no longer uses the baked voxel-studio raster as its stage backdrop. The studio is rendered procedurally and contains no second character or floating robot. The character-creator banner was also changed to a calm solid/voxel-themed surface with no raster image, so there is no ambiguous secondary character in the upper-right UI.

The Vue source no longer references `src/assets/klaus-creator-banner.png`; the asset was removed from the source package.

### Default human rebuilt for visual cohesion

The self-contained renderer now uses one model-space projection contract for box centers. Parent/part locations are projected from the character yaw rather than mixing model-space and screen-space offsets.

Important changes:

- shoulder positions rotate with the character instead of remaining fixed on screen;
- backpack position uses actual negative-Z depth rather than an X-offset approximation;
- the belt is a rotating voxel volume rather than a manually collapsed screen-space line;
- shoe accents are front-facing details and no longer float beside the feet in profile;
- profile depth was increased for head, torso, arms and legs to avoid a paper-thin 90° silhouette;
- a small profile nose cue makes left/right views readable;
- the old permanent side shield is gone; safety remains a compact chest emblem;
- the memory pack is smaller, darker and subordinate to the body silhouette.

### Source Three.js model

The production-oriented Three.js factory keeps the 0.12/0.13 geometry contracts and now explicitly represents safety as a small torso emblem. The memory pack hugs the back instead of competing with the body silhouette. Capability props are contextual rather than permanently orbiting every editing state.

## Rendering contract

The source renderer continues to use:

```text
+Y = up
+Z = character forward

fixed studio / camera
        ↓
CharacterTurntable (yaw only)
        ↓
characterMotionRoot
        ↓
semantic rig
        ↓
authored voxel assemblies
```

The standalone fallback mirrors the same mental model with a dependency-free canvas projection.

## Regression protection

`tests/character-rendering.test.ts` now includes a guard that the default human's `safety` geometry remains a compact torso affordance instead of expanding into another permanent side-mounted object.

Existing tests continue to cover:

- common ground plane;
- centered structural origin;
- authored hinge preservation;
- semantic rig pivot proximity;
- complete human limb assemblies;
- quadruped paw/leg ownership;
- composed part bounds.

## Browser QA

The self-contained prototype was rendered in Chromium at 1586×992 and checked at 0°, 90°, 180° and 270°.

Verified:

- no baked stage robot or duplicate character;
- no banner raster image;
- no red side shield;
- human body remains connected in the front/back views;
- shoulders rotate with the model;
- side profile uses actual body depth;
- no horizontal overflow;
- Skills workspace remains isolated;
- no page errors or console errors.

The complete Vue/Vite/Three.js build was not executed because dependencies are not installed in the generation environment. TypeScript source/test files pass parser/transpile validation.
