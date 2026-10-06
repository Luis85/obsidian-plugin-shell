import type { CharacterStylePreset, CharacterPackDefinition } from '../../domain/characters/types'

export const BUILTIN_CHARACTER_STYLES: readonly CharacterStylePreset[] = [
  {
    "id": "style-studio-violet",
    "name": "Studio violet",
    "description": "The default Agents identity: violet, graphite and mint signal accents.",
    "builtIn": true,
    "primaryColor": "#8b5cf6",
    "secondaryColor": "#25203a",
    "accentColor": "#5eead4",
    "eyeStyle": "expressive",
    "expression": "friendly",
    "idleStyle": "calm",
    "pattern": "none",
    "finish": "soft",
    "accessoryIds": [
      "badge"
    ]
  },
  {
    "id": "style-field-team",
    "name": "Field team",
    "description": "Practical forest palette with calmer, grounded presence.",
    "builtIn": true,
    "primaryColor": "#22c55e",
    "secondaryColor": "#17342a",
    "accentColor": "#bef264",
    "eyeStyle": "focused",
    "expression": "calm",
    "idleStyle": "focused",
    "pattern": "patch",
    "finish": "matte",
    "accessoryIds": [
      "badge"
    ]
  },
  {
    "id": "style-workshop",
    "name": "Workshop",
    "description": "Warm amber palette and confident delivery cues.",
    "builtIn": true,
    "primaryColor": "#f59e0b",
    "secondaryColor": "#3b2a17",
    "accentColor": "#fb7185",
    "eyeStyle": "expressive",
    "expression": "confident",
    "idleStyle": "confident",
    "pattern": "stripe",
    "finish": "matte",
    "accessoryIds": [
      "badge",
      "headset"
    ]
  },
  {
    "id": "style-signal",
    "name": "Signal",
    "description": "Cool technical palette for routers, reviewers and systems agents.",
    "builtIn": true,
    "primaryColor": "#38bdf8",
    "secondaryColor": "#153244",
    "accentColor": "#a78bfa",
    "eyeStyle": "visor",
    "expression": "curious",
    "idleStyle": "focused",
    "pattern": "gradient",
    "finish": "glossy",
    "accessoryIds": [
      "badge"
    ]
  }
]

export const BUILTIN_CHARACTER_PACKS: readonly CharacterPackDefinition[] = [
  {
    "id": "pack-core",
    "name": "Core team",
    "description": "Foundational humanoid and neutral parts for general project agents.",
    "author": "Agents",
    "builtIn": true,
    "category": "human",
    "modelIds": [
      "voxel-human-v2",
      "voxel-scholar-v2"
    ],
    "partIds": [
      "head-classic",
      "head-wide",
      "body-tailored",
      "body-scholar",
      "ears-none",
      "tail-none",
      "arms-standard",
      "arms-none",
      "screen-none",
      "base-legs"
    ],
    "stylePresetIds": [
      "style-studio-violet",
      "style-signal"
    ],
    "savedLooks": []
  },
  {
    "id": "pack-workshop",
    "name": "Workshop",
    "description": "Utility bodies, tool cues and implementation-oriented mascot parts.",
    "author": "Agents",
    "builtIn": true,
    "modelIds": [
      "voxel-operator-v2",
      "voxel-builder-v2",
      "voxel-toolbox-v1"
    ],
    "partIds": [
      "head-compact",
      "body-utility",
      "body-toolbox",
      "arms-compact",
      "arms-clamps",
      "screen-dotmatrix",
      "base-feet"
    ],
    "stylePresetIds": [
      "style-workshop"
    ],
    "savedLooks": []
  },
  {
    "id": "pack-companions",
    "name": "Companions",
    "description": "Pet-oriented heads, ears, tails and proportions for approachable specialists.",
    "author": "Agents",
    "builtIn": true,
    "category": "pet",
    "modelIds": [
      "voxel-dog-v1",
      "voxel-cat-v1",
      "voxel-rabbit-v1"
    ],
    "partIds": [
      "head-dog",
      "head-cat",
      "head-rabbit",
      "body-compact",
      "body-long",
      "ears-round",
      "ears-floppy",
      "ears-pointed",
      "ears-tall",
      "tail-short",
      "tail-curled",
      "tail-puff",
      "base-paws"
    ],
    "stylePresetIds": [
      "style-field-team"
    ],
    "savedLooks": []
  },
  {
    "id": "pack-wild",
    "name": "Wild minds",
    "description": "Owl, fox and turtle forms for strong specialist archetypes.",
    "author": "Agents",
    "builtIn": true,
    "category": "animal",
    "modelIds": [
      "voxel-owl-v1",
      "voxel-fox-v1",
      "voxel-turtle-v1"
    ],
    "partIds": [
      "head-fox",
      "head-turtle",
      "head-owl",
      "body-shell",
      "body-feather",
      "ears-owl",
      "tail-fox",
      "arms-wings",
      "base-talons"
    ],
    "stylePresetIds": [
      "style-signal",
      "style-field-team"
    ],
    "savedLooks": []
  },
  {
    "id": "pack-mascots",
    "name": "Mascot lab",
    "description": "Talking heads, screens, books and abstract object teammates.",
    "author": "Agents",
    "builtIn": true,
    "category": "item",
    "modelIds": [
      "voxel-talking-head-v1",
      "voxel-terminal-v1",
      "voxel-book-v1",
      "voxel-cube-v1"
    ],
    "partIds": [
      "head-floating",
      "body-floating",
      "body-terminal",
      "body-book",
      "body-cube",
      "arms-floating",
      "screen-friendly",
      "screen-terminal",
      "base-hover",
      "base-pedestal"
    ],
    "stylePresetIds": [
      "style-studio-violet",
      "style-signal"
    ],
    "savedLooks": []
  }
]
