import type { CharacterAppearance } from '../../domain/characters/types'
import type { DeepReadonly, ReadonlyState } from '../../domain/shared/ReadonlyState'
import type { CommandServices } from '../ports/ApplicationServices'
import { appearanceToStyle } from '../../domain/characters/appearance'
import { cloneData } from '../../domain/shared/cloneData'
import { validateAppearance } from '../../domain/characters/validateAppearance'
import { decodeCharacterPack } from '../state/StateCodec'
import { checkShape } from '../validation/shape'
import { appearanceShape } from '../validation/characterShapes'
import { CommandError, nextId, requireAgent, requireName, transact } from '../shared/transaction'

export function createCharacterCommands({ ids }: CommandServices) {
  return {
    saveStyle: (state: ReadonlyState, agentId: string, name: string) => transact(state, draft => {
      const agent = requireAgent(draft, agentId)
      const style = appearanceToStyle(agent.appearance, requireName(name), nextId(ids, 'style', draft))
      draft.characterStyles.push(style)
      agent.appearance.teamStyleId = style.id
      return { value: style.id }
    }),
    applyLook: (state: ReadonlyState, agentId: string, look: DeepReadonly<CharacterAppearance>) => transact(state, draft => {
      const agent = requireAgent(draft, agentId)
      const structural = checkShape(appearanceShape, look)
      if (structural.length) throw new CommandError('look.invalid', structural[0]!.message, structural[0]!.path)
      const appearance = cloneData(look) as CharacterAppearance
      const issues = validateAppearance(appearance, 'appearance')
      if (issues.length) throw new CommandError('look.invalid', issues[0]!.message, issues[0]!.path)
      const { teamNickname, greeting, motto, favoriteSymbol } = agent.appearance
      agent.appearance = { ...appearance, teamNickname, greeting, motto, favoriteSymbol }
      agent.model = appearance.modelId
      agent.color = appearance.primaryColor
      return { value: agent.id }
    }),
    createPack: (state: ReadonlyState, agentId: string, name: string) => transact(state, draft => {
      const agent = requireAgent(draft, agentId)
      const id = nextId(ids, 'pack-custom', draft)
      const look = cloneData(agent.appearance)
      const problems = validateAppearance(look, 'appearance')
      if (problems.length) throw new CommandError('pack.invalid-look', problems[0]!.message, problems[0]!.path)
      look.packId = id
      draft.characterPacks.push({
        id, name: requireName(name), description: `Custom character pack created from ${agent.appearance.teamNickname || agent.name}.`,
        author: 'Team', builtIn: false, category: look.category,
        modelIds: [look.modelId], partIds: [...new Set(Object.values(look.parts).filter((part): part is string => Boolean(part)))],
        stylePresetIds: look.teamStyleId ? [look.teamStyleId] : [],
        savedLooks: []
      })
      draft.characterPacks.at(-1)!.savedLooks.push({ id: nextId(ids, 'look', draft), name: look.teamNickname || agent.name, appearance: look })
      return { value: id }
    }),
    importPack: (state: ReadonlyState, input: unknown) => {
      const decoded = decodeCharacterPack(input)
      if (!decoded.ok) return decoded
      return transact(state, draft => {
        const pack = decoded.value
        const oldId = pack.id
        if (Object.values(draft).some(value => Array.isArray(value) && value.some(entity => entity.id === oldId))) pack.id = nextId(ids, 'pack-custom', draft)
        pack.builtIn = false
        pack.author = pack.author.trim() || 'Imported'
        const existingLookIds = new Set(draft.characterPacks.flatMap(item => item.savedLooks.map(look => look.id)))
        draft.characterPacks.push(pack)
        for (const look of pack.savedLooks) {
          if (existingLookIds.has(look.id)) look.id = nextId(ids, 'look', draft)
          existingLookIds.add(look.id)
          look.appearance.packId = pack.id
        }
        return { value: pack.id }
      })
    }
  }
}
