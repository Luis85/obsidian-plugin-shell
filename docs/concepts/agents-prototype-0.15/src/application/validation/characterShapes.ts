import * as v from './shape'
export const id = v.matching(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/, 'Expected a stable ID (letters, digits, dots, hyphens or underscores; up to 160 characters).')
export const ids = v.array(id)
export const color = v.matching(/^#[0-9a-fA-F]{6}$/, 'Expected a six-digit hexadecimal color such as #8b5cf6.')
export const category = v.oneOf('human', 'pet', 'animal', 'item')
const eyeStyle = v.oneOf('expressive', 'round', 'focused', 'visor')
const expression = v.oneOf('friendly', 'calm', 'curious', 'confident')
const idleStyle = v.oneOf('calm', 'playful', 'focused', 'confident')
const pattern = v.oneOf('none', 'stripe', 'patch', 'gradient')
const finish = v.oneOf('matte', 'soft', 'metallic', 'glossy')
const styleFields = {
  primaryColor: color, secondaryColor: color, accentColor: color,
  eyeStyle, expression, idleStyle, pattern, finish, accessoryIds: ids
}
export const appearanceFields = {
  ...styleFields, category, modelId: id, packId: v.optional(id), teamStyleId: v.optional(id),
  parts: v.object(Object.fromEntries(['head', 'body', 'ears', 'tail', 'arms', 'screen', 'base'].map(slot => [slot, v.optional(id)]))),
  scale: v.number(.75, 1.3), pose: v.oneOf('neutral', 'ready', 'wave', 'thinking', 'working', 'celebrate'),
  teamNickname: v.text, greeting: v.text, motto: v.text, favoriteSymbol: v.text
}
export const appearanceShape = v.object(appearanceFields)
export const styleShape = v.object({ ...styleFields, id, name: v.text, description: v.text, builtIn: v.boolean })
export const packShape = v.object({
  id, name: v.text, description: v.text, author: v.text, builtIn: v.boolean, category: v.optional(category),
  modelIds: ids, partIds: ids, stylePresetIds: ids,
  savedLooks: v.array(v.object({ id, name: v.text, appearance: appearanceShape }))
})
