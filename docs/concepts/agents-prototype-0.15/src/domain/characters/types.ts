export type CharacterCategory = 'human' | 'pet' | 'animal' | 'item'
export type CharacterSilhouette = 'human' | 'quadruped' | 'bird' | 'head' | 'object'
export type CharacterEyeStyle = 'expressive' | 'round' | 'focused' | 'visor'
export type CharacterExpression = 'friendly' | 'calm' | 'curious' | 'confident'
export type CharacterIdleStyle = 'calm' | 'playful' | 'focused' | 'confident'
export type CharacterPoseId = 'neutral' | 'ready' | 'wave' | 'thinking' | 'working' | 'celebrate'
export type CharacterMotionState = 'idle' | 'listen' | 'think' | 'work' | 'celebrate'
export type CharacterPattern = 'none' | 'stripe' | 'patch' | 'gradient'
export type CharacterFinish = 'matte' | 'soft' | 'metallic' | 'glossy'
export type CharacterPartSlot = 'head' | 'body' | 'ears' | 'tail' | 'arms' | 'screen' | 'base'
export type CharacterPartSelection = Partial<Record<CharacterPartSlot, string>>

export interface CharacterAppearance {
  category: CharacterCategory
  modelId: string
  packId?: string
  teamStyleId?: string
  parts: CharacterPartSelection
  scale: number
  primaryColor: string
  secondaryColor: string
  accentColor: string
  eyeStyle: CharacterEyeStyle
  expression: CharacterExpression
  idleStyle: CharacterIdleStyle
  pose: CharacterPoseId
  pattern: CharacterPattern
  finish: CharacterFinish
  accessoryIds: string[]
  teamNickname: string
  greeting: string
  motto: string
  favoriteSymbol: string
}

export interface CharacterStylePreset {
  id: string
  name: string
  description: string
  builtIn: boolean
  primaryColor: string
  secondaryColor: string
  accentColor: string
  eyeStyle: CharacterEyeStyle
  expression: CharacterExpression
  idleStyle: CharacterIdleStyle
  pattern: CharacterPattern
  finish: CharacterFinish
  accessoryIds: string[]
}

export interface CharacterSavedLook {
  id: string
  name: string
  appearance: CharacterAppearance
}

export interface CharacterPackDefinition {
  id: string
  name: string
  description: string
  author: string
  builtIn: boolean
  category?: CharacterCategory
  modelIds: string[]
  partIds: string[]
  stylePresetIds: string[]
  savedLooks: CharacterSavedLook[]
}
