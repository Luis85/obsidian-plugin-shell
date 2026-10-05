import type { CharacterAppearance, CharacterStylePreset } from './types'
import { characterModel } from './rules'
import { CHARACTER_ACCESSORY_RULES } from './accessoryRules'
import { cloneData } from '../shared/cloneData'

export const modelAppearance = (modelId:string,base?:Partial<CharacterAppearance>):CharacterAppearance => {
  const model=characterModel(modelId)
  return {
    category:model.category,modelId:model.id,packId:model.packId,parts:{...model.defaultParts},scale:base?.scale??1,
    primaryColor:base?.primaryColor??'#8b5cf6',secondaryColor:base?.secondaryColor??'#25203a',accentColor:base?.accentColor??'#5eead4',
    eyeStyle:base?.eyeStyle??'expressive',expression:base?.expression??'friendly',idleStyle:base?.idleStyle??'calm',pose:base?.pose??'neutral',pattern:base?.pattern??'none',finish:base?.finish??'soft',
    accessoryIds:[...(base?.accessoryIds??['badge'])],teamNickname:base?.teamNickname??'',greeting:base?.greeting??'',motto:base?.motto??'',favoriteSymbol:base?.favoriteSymbol??'✦',teamStyleId:base?.teamStyleId
  }
}
export const defaultCharacterAppearance = (modelId='voxel-human-v2',primaryColor='#8b5cf6'):CharacterAppearance => modelAppearance(modelId,{primaryColor})
export const applyCharacterModel = (appearance:CharacterAppearance,modelId:string):void => {
  const model=characterModel(modelId)
  appearance.modelId=model.id
  appearance.category=model.category
  appearance.packId=model.packId
  appearance.parts={...model.defaultParts}
  appearance.accessoryIds=appearance.accessoryIds.filter(id=>CHARACTER_ACCESSORY_RULES.find(x=>x.id===id)?.categories.includes(model.category))
}
export const applyCharacterStyle = (appearance:CharacterAppearance,style:CharacterStylePreset):void => {
  Object.assign(appearance,{teamStyleId:style.id,primaryColor:style.primaryColor,secondaryColor:style.secondaryColor,accentColor:style.accentColor,eyeStyle:style.eyeStyle,expression:style.expression,idleStyle:style.idleStyle,pattern:style.pattern,finish:style.finish})
  appearance.accessoryIds=[...style.accessoryIds.filter(id=>CHARACTER_ACCESSORY_RULES.find(x=>x.id===id)?.categories.includes(appearance.category))]
}
export const appearanceToStyle = (appearance:CharacterAppearance,name:string,id:string):CharacterStylePreset => ({
  id,name,description:`Saved from ${appearance.modelId}.`,builtIn:false,primaryColor:appearance.primaryColor,secondaryColor:appearance.secondaryColor,accentColor:appearance.accentColor,eyeStyle:appearance.eyeStyle,expression:appearance.expression,idleStyle:appearance.idleStyle,pattern:appearance.pattern,finish:appearance.finish,accessoryIds:[...appearance.accessoryIds]
})
export const cloneCharacterAppearance = (appearance:CharacterAppearance):CharacterAppearance => cloneData(appearance)
