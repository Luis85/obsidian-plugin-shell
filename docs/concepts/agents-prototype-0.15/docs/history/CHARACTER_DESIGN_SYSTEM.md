# Character Design System — 0.6

## Purpose

The character layer gives each agent a durable, recognizable team identity without changing what that agent is allowed or able to do. A human, dog, owl, terminal, toolbox, talking head or abstract cube can represent the same operational role. Visual identity and operational authority remain separate by design.

## Product principles

1. **Preset recipes, not locked models.** A preset is the fastest way to begin, then every compatible part can be remixed.
2. **Recognition before realism.** Strong silhouettes, color language and small recurring details matter more than photorealism.
3. **Meaningful customization.** The editor exposes decisions that noticeably change the character: body/head proportions, ears, tails, arms/wings, face/screen, base, palette, expression, finish and accessories.
4. **Progressive disclosure.** The creation flow is Models → Parts → Style → Team → Packs. First-time users can stop after choosing a model; advanced teams can build reusable visual systems.
5. **Mixed casts can still look related.** Team styles store palette, material/presence and accessories, but intentionally do not force one species or body recipe.
6. **Portable visual assets.** Custom character packs can group recipes, parts, styles and complete saved looks and travel as JSON.
7. **No anthropomorphic capability claim.** Embodiment never modifies role, instructions, tools, skills, permissions, evals or runtime behavior.

## Domain model

```text
CharacterAppearance
├── category
├── modelId                # starting recipe
├── packId
├── teamStyleId
├── parts
│   ├── head
│   ├── body
│   ├── ears
│   ├── tail
│   ├── arms
│   ├── screen
│   └── base
├── scale
├── primaryColor
├── secondaryColor
├── accentColor
├── eyeStyle
├── expression
├── idleStyle
├── pattern
├── finish
├── accessoryIds[]
├── teamNickname
├── greeting
├── motto
└── favoriteSymbol
```

`CharacterModelDefinition` supplies a silhouette and `defaultParts`. `CharacterPartDefinition` declares slot, compatible silhouettes, compatible categories, pack ownership and tags. This lets validation reject impossible combinations before rendering.

## Composition pipeline

```text
Model recipe
   ↓
Compatible part overrides
   ↓
Visual style / palette / material
   ↓
Accessories
   ↓
Team-facing identity
   ↓
CharacterModelFactory
   ↓
CharacterStageScene
```

The UI does not directly construct Three.js geometry. It modifies the domain appearance. `CharacterModelFactory` translates that appearance into geometry; `CharacterStageScene` owns camera, lighting, raycasting, animation and cleanup.

## Model library

The built-in library spans four families:

- Humans: Klaus Classic, Operator, Scholar, Builder
- Pets: Buddy Dog, Vault Cat, Scout Rabbit
- Animals: Archive Owl, Signal Fox, Steady Turtle
- Items / mascots: Talking Head, Terminal Buddy, Toolbox, Living Book, Agent Cube

The catalog is data driven. Adding a recipe does not require editing the character editor itself.

## Part system

Current part slots:

- Head
- Body
- Ears
- Tail
- Arms / wings
- Face / screen
- Base / feet

Compatibility is based on the active model silhouette plus character category. The UI only offers compatible choices. Validation checks imported JSON again so incompatible combinations cannot bypass the editor.

## Team styles

A team style stores:

- primary / secondary / accent colors
- eye style
- expression
- idle style
- pattern
- surface finish
- accessories

It deliberately excludes model and procedural parts. This lets a team have an owl, human, dog and terminal that clearly belong together without making them physically identical.

## Character packs

`CharacterPackDefinition` can contain:

- model IDs
- part IDs
- style preset IDs
- saved complete looks
- author and description

Built-in packs are read-only. Team-created packs can be exported/imported as JSON. A future Obsidian implementation can store these as vault entities while still supporting portable JSON interchange.

## 3D presentation direction

The stage intentionally resembles a polished character studio rather than a generic 3D viewport:

- three-point key/fill/rim lighting
- ACES tone mapping
- presentation platform and accent rings
- subtle studio cyclorama and particles
- plumbob-style visual identifier
- orbit/zoom and authored camera views
- direct body-region selection
- capability cubes kept visually separate from the body
- appearance-driven material finish
- explicit GPU resource disposal
- reduced-motion support

The renderer avoids expensive post-processing so the same design can remain viable inside an Obsidian plugin and on mobile hardware.

## Extension model

Future character packs can add additional domain data without changing the editor navigation. Likely extensions include:

- horns, hair, hats, wings and clothing slots
- per-part color channels
- procedural body proportions
- animation sets / emotes
- model-specific voice indicators
- team-approved visual constraints
- pack preview artwork
- custom GLTF asset adapters while retaining the procedural fallback

The procedural voxel system should remain the baseline because it is portable, themeable, lightweight and easy to validate.
