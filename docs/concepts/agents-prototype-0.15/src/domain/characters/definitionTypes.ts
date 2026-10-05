import type { CharacterCategory, CharacterSilhouette, CharacterPartSlot, CharacterPartSelection } from './types'

export interface CharacterModelRule {
  id: string
  category: CharacterCategory
  silhouette: CharacterSilhouette
  packId: string
  defaultParts: CharacterPartSelection
}
export interface CharacterPartRule {
  id: string
  slot: CharacterPartSlot
  silhouettes: CharacterSilhouette[]
  categories: CharacterCategory[]
  packId: string
}
export interface CharacterAccessoryRule { id: string; categories: CharacterCategory[] }
