import type { CharacterAppearance, CharacterCategory, CharacterPartSlot } from './types'
import { CHARACTER_MODEL_RULES } from './modelRules'
import { CHARACTER_PART_RULES } from './partRules'
import { CHARACTER_ACCESSORY_RULES } from './accessoryRules'

export const findCharacterModel = (id: string) => CHARACTER_MODEL_RULES.find(model => model.id === id)
/** UI defaults may fall back; import validation must use findCharacterModel instead. */
export const characterModel = (id: string) => findCharacterModel(id) ?? CHARACTER_MODEL_RULES[0]!
export const characterPart = (id: string) => CHARACTER_PART_RULES.find(part => part.id === id)
export const compatibleAccessories = (category: CharacterCategory) => CHARACTER_ACCESSORY_RULES.filter(item => item.categories.includes(category))
export const compatibleParts = (appearance: Pick<CharacterAppearance, 'category' | 'modelId'>, slot?: CharacterPartSlot) => {
  const silhouette = characterModel(appearance.modelId).silhouette
  return CHARACTER_PART_RULES.filter(part => (!slot || part.slot === slot) && part.categories.includes(appearance.category) && part.silhouettes.includes(silhouette))
}
export const CHARACTER_PART_SLOTS: readonly CharacterPartSlot[] = ['head', 'body', 'ears', 'tail', 'arms', 'screen', 'base']
