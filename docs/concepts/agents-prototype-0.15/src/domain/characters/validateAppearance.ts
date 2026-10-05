import type { CharacterAppearance, CharacterPackDefinition } from './types'
import type { ValidationIssue } from '../shared/ValidationIssue'
import { findCharacterModel, characterPart } from './rules'
import { CHARACTER_ACCESSORY_RULES } from './accessoryRules'

export function validateAppearance(appearance: CharacterAppearance, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const error = (id: string, field: string, message: string) => issues.push({ id, severity: 'error', path: `${path}.${field}`, message })
  const model = findCharacterModel(appearance.modelId)
  if (!model) error('character.model', 'modelId', `Unknown model: ${appearance.modelId}.`)
  else {
    if (model.category !== appearance.category) error('character.category', 'category', 'The category does not match the chosen model.')
    for (const [slot, id] of Object.entries(appearance.parts)) {
      const part = characterPart(id)
      if (!part || part.slot !== slot || !part.silhouettes.includes(model.silhouette) || !part.categories.includes(model.category)) error('character.part', `parts.${slot}`, `Part ${id} cannot be used in this slot and silhouette.`)
    }
    for (const slot of Object.keys(model.defaultParts)) if (!appearance.parts[slot as keyof typeof appearance.parts]) error('character.part-missing', `parts.${slot}`, 'This recipe requires an explicit part selection.')
  }
  const seen = new Set<string>()
  for (const id of appearance.accessoryIds) {
    const accessory = CHARACTER_ACCESSORY_RULES.find(item => item.id === id)
    if (!accessory || !accessory.categories.includes(appearance.category)) error('character.accessory', 'accessoryIds', `Accessory ${id} is not supported by this category.`)
    if (seen.has(id)) error('character.accessory-duplicate', 'accessoryIds', `Duplicate accessory: ${id}.`)
    seen.add(id)
  }
  return issues
}

export function validateCharacterPack(pack: CharacterPackDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const error = (path: string, message: string) => issues.push({ id: 'character.pack', severity: 'error', path, message })
  if (!pack.name.trim()) error('name', 'A character pack needs a name.')
  const looks = new Set<string>()
  for (const [index, look] of pack.savedLooks.entries()) {
    const path = `savedLooks[${index}]`
    if (looks.has(look.id)) error(`${path}.id`, 'Saved-look IDs must be unique within the pack.')
    looks.add(look.id)
    issues.push(...validateAppearance(look.appearance, `${path}.appearance`))
    if (!pack.modelIds.includes(look.appearance.modelId)) error(`${path}.appearance.modelId`, 'The saved model must be declared in modelIds.')
    for (const id of Object.values(look.appearance.parts)) if (id && !pack.partIds.includes(id)) error(`${path}.appearance.parts`, `Part ${id} must be declared in partIds.`)
  }
  for (const id of pack.modelIds) if (!findCharacterModel(id)) error('modelIds', `Unknown model: ${id}.`)
  for (const id of pack.partIds) if (!characterPart(id)) error('partIds', `Unknown part: ${id}.`)
  return issues
}
