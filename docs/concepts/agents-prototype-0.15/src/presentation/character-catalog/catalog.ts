import type { CharacterAppearance, CharacterCategory, CharacterPartSlot } from '../../domain/characters/types'
import type { CharacterModelRule, CharacterPartRule, CharacterAccessoryRule } from '../../domain/characters/definitionTypes'
import { CHARACTER_MODEL_RULES } from '../../domain/characters/modelRules'
import { CHARACTER_PART_RULES } from '../../domain/characters/partRules'
import { CHARACTER_ACCESSORY_RULES } from '../../domain/characters/accessoryRules'
import { CHARACTER_PART_SLOTS, compatibleParts } from '../../domain/characters/rules'

export interface CharacterModelDefinition extends CharacterModelRule { name: string; description: string; tags: string[] }
export interface CharacterPartDefinition extends CharacterPartRule { name: string; description: string; tags: string[] }
export interface CharacterAccessoryDefinition extends CharacterAccessoryRule { label: string }

const character_models_copy: Record<string, { name: string; description: string; tags: string[] }> = {
  "voxel-human-v2": {"name": "Klaus Classic", "description": "Balanced humanoid base with expressive face and clean voxel tailoring.", "tags": ["balanced", "general"]},
  "voxel-operator-v2": {"name": "Operator", "description": "Utility-forward teammate with technical equipment cues.", "tags": ["technical", "tools"]},
  "voxel-scholar-v2": {"name": "Scholar", "description": "Knowledge-worker silhouette with calmer, studious details.", "tags": ["knowledge", "research"]},
  "voxel-builder-v2": {"name": "Builder", "description": "Practical workwear for delivery and implementation identities.", "tags": ["delivery", "build"]},
  "voxel-dog-v1": {"name": "Buddy Dog", "description": "Friendly blocky dog with expressive ears and collar badge.", "tags": ["friendly", "loyal"]},
  "voxel-cat-v1": {"name": "Vault Cat", "description": "Compact cat mascot with bright eyes and quiet confidence.", "tags": ["curious", "calm"]},
  "voxel-rabbit-v1": {"name": "Scout Rabbit", "description": "Approachable mascot with tall ears and energetic presence.", "tags": ["curious", "quick"]},
  "voxel-owl-v1": {"name": "Archive Owl", "description": "Wide-eyed owl for knowledge, review and requirements work.", "tags": ["knowledge", "review"]},
  "voxel-fox-v1": {"name": "Signal Fox", "description": "Agile fox silhouette for routing and coordination identities.", "tags": ["clever", "routing"]},
  "voxel-turtle-v1": {"name": "Steady Turtle", "description": "Stable form for deliberate and reliability-oriented roles.", "tags": ["steady", "reliable"]},
  "voxel-talking-head-v1": {"name": "Talking Head", "description": "Floating expressive head for teams that want the agent to be a literal voice.", "tags": ["voice", "minimal"]},
  "voxel-terminal-v1": {"name": "Terminal Buddy", "description": "CRT-style terminal mascot with face and status lights.", "tags": ["technical", "retro"]},
  "voxel-toolbox-v1": {"name": "Toolbox", "description": "Friendly toolbox mascot for implementation and operations agents.", "tags": ["tools", "delivery"]},
  "voxel-book-v1": {"name": "Living Book", "description": "Book-like mascot for documentation, policy and knowledge agents.", "tags": ["knowledge", "docs"]},
  "voxel-cube-v1": {"name": "Agent Cube", "description": "Minimal abstract block with a face and configurable light band.", "tags": ["minimal", "abstract"]},
}
export const CHARACTER_MODELS: readonly CharacterModelDefinition[] = CHARACTER_MODEL_RULES.map(rule => ({ ...rule, ...character_models_copy[rule.id]! }))

const character_parts_copy: Record<string, { name: string; description: string; tags: string[] }> = {
  "head-classic": {"name": "Classic head", "description": "Balanced voxel head with room for facial expression.", "tags": ["balanced"]},
  "head-wide": {"name": "Wide head", "description": "Broader, friendlier proportions with a stronger mascot read.", "tags": ["friendly"]},
  "head-compact": {"name": "Compact head", "description": "Sharper compact proportions for technical or focused characters.", "tags": ["technical"]},
  "head-dog": {"name": "Dog muzzle", "description": "Rounded pet head with a pronounced muzzle.", "tags": ["friendly"]},
  "head-cat": {"name": "Cat face", "description": "Compact feline proportions.", "tags": ["curious"]},
  "head-rabbit": {"name": "Rabbit face", "description": "Small face designed for tall-ear combinations.", "tags": ["quick"]},
  "head-fox": {"name": "Fox face", "description": "Tapered alert muzzle with confident eye placement.", "tags": ["routing"]},
  "head-turtle": {"name": "Turtle head", "description": "Low, sturdy proportions for calm characters.", "tags": ["steady"]},
  "head-owl": {"name": "Owl mask", "description": "Large eye plane for knowledge and review identities.", "tags": ["knowledge"]},
  "head-floating": {"name": "Floating head", "description": "A literal talking-head form with no full body.", "tags": ["voice"]},
  "body-tailored": {"name": "Tailored", "description": "Clean jacket proportions for generalists and coordinators.", "tags": ["general"]},
  "body-utility": {"name": "Utility", "description": "Broader torso with equipment-friendly surfaces.", "tags": ["tools"]},
  "body-scholar": {"name": "Scholar", "description": "Narrower, calmer knowledge-worker silhouette.", "tags": ["knowledge"]},
  "body-compact": {"name": "Compact", "description": "Short companion body for cats, rabbits and small mascots.", "tags": ["compact"]},
  "body-long": {"name": "Long companion", "description": "Longer dog/fox body with stronger motion cues.", "tags": ["active"]},
  "body-shell": {"name": "Shell body", "description": "Low shell-backed body with stable proportions.", "tags": ["steady"]},
  "body-feather": {"name": "Feather body", "description": "Rounded bird body with wide wing anchor points.", "tags": ["review"]},
  "body-floating": {"name": "Floating frame", "description": "Minimal support frame for a talking head.", "tags": ["minimal"]},
  "body-terminal": {"name": "Terminal shell", "description": "CRT-inspired shell with a luminous face screen.", "tags": ["technical"]},
  "body-toolbox": {"name": "Toolbox shell", "description": "Chunky utility shell with handle and latch details.", "tags": ["delivery"]},
  "body-book": {"name": "Book shell", "description": "Standing book form with expressive cover details.", "tags": ["docs"]},
  "body-cube": {"name": "Agent cube", "description": "Abstract configurable cube for minimal teams.", "tags": ["abstract"]},
  "ears-none": {"name": "No ears", "description": "A clean silhouette with no extra ear geometry.", "tags": ["minimal"]},
  "ears-round": {"name": "Round ears", "description": "Soft round ears for friendly companions.", "tags": ["friendly"]},
  "ears-floppy": {"name": "Floppy ears", "description": "Relaxed long ears with a companion-like read.", "tags": ["friendly"]},
  "ears-pointed": {"name": "Pointed ears", "description": "Alert triangular ears for cat and fox combinations.", "tags": ["alert"]},
  "ears-tall": {"name": "Tall ears", "description": "Tall rabbit-like ears that change the silhouette strongly.", "tags": ["playful"]},
  "ears-owl": {"name": "Owl tufts", "description": "Small raised feather tufts.", "tags": ["knowledge"]},
  "tail-none": {"name": "No tail", "description": "No rear appendage.", "tags": ["minimal"]},
  "tail-short": {"name": "Short tail", "description": "Short blocky tail.", "tags": ["simple"]},
  "tail-curled": {"name": "Curled tail", "description": "Raised curl for playful pets.", "tags": ["playful"]},
  "tail-fox": {"name": "Fox tail", "description": "Large tapered tail for a strong silhouette.", "tags": ["bold"]},
  "tail-puff": {"name": "Puff tail", "description": "Compact round tail for rabbits and mascots.", "tags": ["cute"]},
  "arms-standard": {"name": "Standard arms", "description": "Regular humanoid arms.", "tags": ["balanced"]},
  "arms-compact": {"name": "Compact arms", "description": "Shorter arms that make the torso feel broader.", "tags": ["utility"]},
  "arms-wings": {"name": "Wings", "description": "Wide feather-like side pieces.", "tags": ["bird"]},
  "arms-floating": {"name": "Floating hands", "description": "Detached expressive hands for heads and mascots.", "tags": ["expressive"]},
  "arms-clamps": {"name": "Tool clamps", "description": "Short mechanical clamps for practical object mascots.", "tags": ["tools"]},
  "arms-none": {"name": "No arms", "description": "Minimal body without arm geometry.", "tags": ["minimal"]},
  "screen-none": {"name": "No screen", "description": "Use a physical face rather than a screen.", "tags": ["face"]},
  "screen-friendly": {"name": "Friendly screen", "description": "Large luminous face panel with simple eyes.", "tags": ["friendly"]},
  "screen-terminal": {"name": "Terminal screen", "description": "Dark CRT panel with command-line cues.", "tags": ["technical"]},
  "screen-dotmatrix": {"name": "Dot matrix", "description": "Small pixel display for abstract mascots.", "tags": ["retro"]},
  "base-legs": {"name": "Legs", "description": "Standard two-leg stance.", "tags": ["human"]},
  "base-paws": {"name": "Paws", "description": "Four grounded paws.", "tags": ["animal"]},
  "base-talons": {"name": "Talons", "description": "Small bird feet.", "tags": ["bird"]},
  "base-hover": {"name": "Hover", "description": "Floating base with a soft signal glow.", "tags": ["floating"]},
  "base-pedestal": {"name": "Pedestal", "description": "Small grounded plinth for object mascots.", "tags": ["stable"]},
  "base-feet": {"name": "Tiny feet", "description": "Two compact mascot feet.", "tags": ["playful"]},
}
export const CHARACTER_PARTS: readonly CharacterPartDefinition[] = CHARACTER_PART_RULES.map(rule => ({ ...rule, ...character_parts_copy[rule.id]! }))

const character_accessories_copy: Record<string, { label: string }> = {
  "glasses": {"label": "Glasses"},
  "headset": {"label": "Headset"},
  "badge": {"label": "Team badge"},
  "scarf": {"label": "Scarf"},
  "cap": {"label": "Cap"},
  "bowtie": {"label": "Bow tie"},
  "antenna": {"label": "Antenna"},
  "halo": {"label": "Signal halo"},
}
export const CHARACTER_ACCESSORIES: readonly CharacterAccessoryDefinition[] = CHARACTER_ACCESSORY_RULES.map(rule => ({ ...rule, ...character_accessories_copy[rule.id]! }))

export const CHARACTER_CATEGORIES = [
  {
    "id": "human",
    "label": "Humans",
    "icon": "◆",
    "description": "Familiar teammates with readable body-language cues and modular outfits."
  },
  {
    "id": "pet",
    "label": "Pets",
    "icon": "●",
    "description": "Approachable companion mascots with expressive ears, tails and accessories."
  },
  {
    "id": "animal",
    "label": "Animals",
    "icon": "▲",
    "description": "Distinctive archetypes with memorable silhouettes and species-specific parts."
  },
  {
    "id": "item",
    "label": "Items",
    "icon": "■",
    "description": "Talking heads, screens, tools, books and abstract mascots that can still feel like teammates."
  }
] as const

export const CHARACTER_PALETTES = [
  {
    "id": "violet",
    "name": "Klaus violet",
    "primary": "#8b5cf6",
    "secondary": "#25203a",
    "accent": "#5eead4"
  },
  {
    "id": "forest",
    "name": "Forest",
    "primary": "#22c55e",
    "secondary": "#17342a",
    "accent": "#bef264"
  },
  {
    "id": "signal",
    "name": "Signal blue",
    "primary": "#38bdf8",
    "secondary": "#153244",
    "accent": "#a78bfa"
  },
  {
    "id": "workshop",
    "name": "Workshop amber",
    "primary": "#f59e0b",
    "secondary": "#3b2a17",
    "accent": "#fb7185"
  },
  {
    "id": "rose",
    "name": "Rose",
    "primary": "#ef6684",
    "secondary": "#3a202c",
    "accent": "#f9a8d4"
  },
  {
    "id": "mono",
    "name": "Graphite",
    "primary": "#94a3b8",
    "secondary": "#202630",
    "accent": "#f8fafc"
  }
] as const

export const CHARACTER_PART_SLOT_LABELS: Readonly<Record<CharacterPartSlot, string>> = {
  "head": "Head",
  "body": "Body",
  "ears": "Ears",
  "tail": "Tail",
  "arms": "Arms / wings",
  "screen": "Face / screen",
  "base": "Base / feet"
}

export const characterModel = (id: string) => CHARACTER_MODELS.find(model => model.id === id) ?? CHARACTER_MODELS[0]!
export const characterPart = (id: string) => CHARACTER_PARTS.find(part => part.id === id)
export const modelsForCategory = (category: CharacterCategory) => CHARACTER_MODELS.filter(model => model.category === category)
export const accessoriesForCategory = (category: CharacterCategory) => CHARACTER_ACCESSORIES.filter(item => item.categories.includes(category))
export const partsForAppearance = (appearance: Pick<CharacterAppearance, 'category' | 'modelId'>, slot?: CharacterPartSlot) => {
  const ids = new Set(compatibleParts(appearance, slot).map(part => part.id))
  return CHARACTER_PARTS.filter(part => ids.has(part.id))
}
export const availablePartSlots = (appearance: Pick<CharacterAppearance, 'category' | 'modelId'>): CharacterPartSlot[] => {
  const slots = new Set(compatibleParts(appearance).map(part => part.slot))
  return CHARACTER_PART_SLOTS.filter(slot => slots.has(slot))
}
