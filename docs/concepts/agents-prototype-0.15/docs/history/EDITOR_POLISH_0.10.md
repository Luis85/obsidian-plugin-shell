# Klaus Editor 0.10 — Editor Interaction & Side-panel Polish

## Scope

This pass addresses two editor-level issues without changing the Agent Definition schema:

1. Character orientation needed to behave like a real character-creator turntable rather than a few camera-step buttons.
2. The Skills side panel visually inherited controls and layout patterns from unrelated editor categories, making other component UI appear to leak into the active workspace.

## 1. True 360° character turntable

The production Three.js implementation now uses character yaw as the horizontal editing interaction. The workshop, light rig, camera framing, props, and pedestal stay stable while the character rotates.

### Interaction model

- Horizontal pointer drag: continuous 360° character rotation.
- Click without drag: character-region selection/editing.
- Range scrubber: 0–359° deterministic orientation.
- Snap views: Front 0°, Right 90°, Back 180°, Left 270°.
- Step buttons: ±45°.
- Zoom remains camera-based and independent of yaw.

The pointer interaction uses a drag threshold before rotation starts. This prevents the old ambiguity where trying to turn the character could trigger the configuration category attached to the clicked body region.

### Transform separation

`CharacterStageScene` now separates turntable yaw from character motion:

```text
characterRoot             ← persisted/editor yaw
└── characterMotionRoot   ← idle bob / procedural presence motion
    └── procedural model
```

This keeps user orientation stable while idle/pose animation continues. Animation no longer overwrites the user's turntable angle.

## 2. Skills workspace isolation

The generic compact category grid has been removed from normal configuration panels. It was useful during early prototyping, but it visually mixed navigation and editor content and contributed to unrelated component UI appearing inside Skills.

Skills now has its own presentation model:

- Equipped / Available / Linked-tools summary.
- Search.
- Library / Equipped filtering.
- Dedicated skill cards.
- Skill category and loading metadata.
- Related tool names and resource-path counts as read-only context.
- A concise explanation that actual tool/resource editing remains in its respective component.

The panel deliberately does **not** embed Appearance controls, Tool-loadout controls, Memory forms, or other category editors.

### Panel containment

The side panel now has explicit layout and painting isolation:

- isolated stacking context;
- `contain: paint`;
- contained scroll behavior;
- a three-row non-design panel layout: context switcher, header, scrollable editor, footer;
- dedicated Skills component styles rather than generic option-card styles.

This prevents neighboring category surfaces from visually leaking into the active editor.

## Responsive behavior

At narrow widths:

- turntable snap buttons collapse while the scrubber remains available;
- rotation angle remains visible;
- Skills search/filter becomes one-column;
- side-panel category selector remains compact;
- no horizontal document overflow is introduced.

## Verification

Standalone browser regression at 1586×992 covered:

- Front 0°;
- Right 90°;
- Back 180°;
- Left 270°;
- scrubber upper bound at 359°;
- Skills workspace isolation;
- six available skill cards;
- absence of Appearance editor tabs in Skills;
- absence of Tool-loadout controls in Skills;
- no horizontal document overflow;
- no browser page errors during the tested interactions.

The Vue/Three.js source cannot be fully built in this execution environment because the project dependencies are not installed. `tsc` therefore reports missing `three`, `vue`, `pinia`, `vite`, and `vitest` modules; this is an environment/dependency boundary rather than a successful full production build claim.
