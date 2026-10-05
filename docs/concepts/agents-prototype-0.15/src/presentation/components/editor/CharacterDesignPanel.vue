<script setup lang="ts">
import { computed,ref } from 'vue'
import type { Agent } from '../../../domain/agents/types'
import type { CharacterCategory, CharacterPackDefinition, CharacterPartSlot, CharacterStylePreset } from '../../../domain/characters/types'
import type { PluginState } from '../../../domain/shared/PluginState'
import { CHARACTER_CATEGORIES, CHARACTER_MODELS, CHARACTER_PALETTES, CHARACTER_PART_SLOT_LABELS, accessoriesForCategory, availablePartSlots, characterModel, partsForAppearance } from '../../character-catalog/catalog'
import { applyCharacterModel, applyCharacterStyle, modelAppearance } from '../../../domain/characters/appearance'
import { toggleMembership } from '../../character-catalog/editorCategories'
import { useAgentsStore } from '../../stores/agents'
import CharacterThumbnail from './CharacterThumbnail.vue'

const store = useAgentsStore()
const importMessage = ref('')
const props=defineProps<{agent:Agent;state:PluginState}>()
const activeModel=computed(()=>characterModel(props.agent.appearance.modelId))
const modelOptions=computed(()=>CHARACTER_MODELS.filter(model=>model.category===props.agent.appearance.category))
const accessoryOptions=computed(()=>accessoriesForCategory(props.agent.appearance.category))
const partSlots=computed(()=>availablePartSlots(props.agent.appearance))
const tabs=[{id:'presets',label:'Models',icon:'◈'},{id:'parts',label:'Parts',icon:'✣'},{id:'style',label:'Style',icon:'⌁'},{id:'team',label:'Team',icon:'♟'},{id:'packs',label:'Packs',icon:'✥'}] as const
const tab=ref<(typeof tabs)[number]['id']>('presets')
const styleName=ref('')
const packName=ref('')
const categoryPreview=(category:CharacterCategory)=>{const model=CHARACTER_MODELS.find(x=>x.category===category)??CHARACTER_MODELS[0]!;return modelAppearance(model.id,props.agent.appearance)}
const setCategory=(category:CharacterCategory)=>{const first=CHARACTER_MODELS.find(model=>model.category===category);if(first)selectModel(first.id)}
const selectModel=(id:string)=>{applyCharacterModel(props.agent.appearance,id);props.agent.model=id;props.agent.color=props.agent.appearance.primaryColor}
const preview=(id:string)=>modelAppearance(id,props.agent.appearance)
const selectPalette=(palette:(typeof CHARACTER_PALETTES)[number])=>{Object.assign(props.agent.appearance,{primaryColor:palette.primary,secondaryColor:palette.secondary,accentColor:palette.accent,teamStyleId:undefined});props.agent.color=palette.primary}
const toggleAccessory=(id:string)=>{props.agent.appearance.accessoryIds=toggleMembership(props.agent.appearance.accessoryIds,id);props.agent.appearance.teamStyleId=undefined}
const selectPart=(slot:CharacterPartSlot,id:string)=>{props.agent.appearance.parts={...props.agent.appearance.parts,[slot]:id}}
const partOptions=(slot:CharacterPartSlot)=>partsForAppearance(props.agent.appearance,slot)
const saveStyle=()=>{const name=styleName.value.trim();if(!name)return;if(store.saveCharacterStyle(props.agent.id,name).ok)styleName.value=''}
const useStyle=(style:CharacterStylePreset)=>{applyCharacterStyle(props.agent.appearance,style);props.agent.color=props.agent.appearance.primaryColor}
const surprise=()=>{const models=modelOptions.value,model=models[Math.floor(Math.random()*models.length)];if(model)selectModel(model.id);const palette=CHARACTER_PALETTES[Math.floor(Math.random()*CHARACTER_PALETTES.length)]!;selectPalette(palette);props.agent.appearance.accessoryIds=accessoryOptions.value.filter(()=>Math.random()>.58).slice(0,2).map(x=>x.id);props.agent.appearance.expression=(['friendly','calm','curious','confident'] as const)[Math.floor(Math.random()*4)]!;props.agent.appearance.idleStyle=(['calm','playful','focused','confident'] as const)[Math.floor(Math.random()*4)]!}
const applyLook=(look:Agent['appearance'])=>store.applySavedLook(props.agent.id,look)
const createPack=()=>{const name=packName.value.trim();if(!name)return;if(store.createCharacterPack(props.agent.id,name).ok)packName.value=''}
const downloadPack=(pack:CharacterPackDefinition)=>{const blob=new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${pack.id}.character-pack.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
const importPack = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importMessage.value = ''
  try {
    if (file.size > 5 * 1024 * 1024) {
      store.reportDiagnostics([{code:'import.too-large', severity:'error', message:'Choose a character-pack file smaller than 5 MiB.', operation:'import'}])
      return
    }
    const result = store.importPackText(await file.text())
    importMessage.value = result.ok ? 'Character pack imported.' : 'Nothing was imported. Open Diagnostics for the field-level errors.'
  } catch {
    store.reportDiagnostics([{code:'import.read-failed', severity:'error', message:'The selected file could not be read. No changes were made.', operation:'import'}])
  } finally { input.value = '' }
}
</script>

<template>
  <p v-if="importMessage" class="text-sm" role="status">{{ importMessage }}</p>
  <nav class="character-design-tabs" aria-label="Character design sections">
    <button v-for="item in tabs" :key="item.id" :class="{active:tab===item.id}" @click="tab=item.id"><span>{{item.icon}}</span><b>{{item.label}}</b></button>
  </nav>

  <template v-if="tab==='presets'">
    <section class="design-card design-card-primary">
      <header><div><h3>Choose an embodiment</h3><p>Start with a model type, then customize with parts and style.</p></div><button class="design-surprise" @click="surprise">✦ Surprise me</button></header>
      <div class="embodiment-grid">
        <button v-for="group in CHARACTER_CATEGORIES" :key="group.id" :class="['embodiment-card',{active:agent.appearance.category===group.id}]" @click="setCategory(group.id)">
          <CharacterThumbnail :appearance="categoryPreview(group.id)" :size="68"/>
          <span><b>{{group.label}}</b><small>{{group.description}}</small></span>
          <i v-if="agent.appearance.category===group.id">✓</i>
        </button>
      </div>
    </section>

    <section class="design-card">
      <header><div><h3>{{activeModel.category[0].toUpperCase()+activeModel.category.slice(1)}} models</h3><p>{{modelOptions.length}} starting recipes. Pick one, then remix freely.</p></div></header>
      <div class="model-thumb-grid">
        <button v-for="model in modelOptions" :key="model.id" :class="['model-thumb-card',{active:agent.appearance.modelId===model.id}]" :title="model.name" @click="selectModel(model.id)">
          <CharacterThumbnail :appearance="preview(model.id)" :size="68"/>
          <span>{{model.name}}</span><i v-if="agent.appearance.modelId===model.id">✓</i>
        </button>
      </div>
    </section>

    <section class="design-card quick-customization">
      <header><div><h3>Quick customization</h3><p>Give this teammate an immediately recognizable presence.</p></div></header>
      <div class="quick-custom-grid">
        <div class="quick-custom-fields">
          <UFormField label="Display name"><UInput v-model="agent.appearance.teamNickname" :placeholder="agent.name"/></UFormField>
          <UFormField label="Greeting (optional)"><UInput v-model="agent.appearance.greeting" placeholder="Hello! I'm ready."/></UFormField>
        </div>
        <div class="quick-custom-style">
          <label>Accent color</label>
          <div class="accent-swatch-row"><button v-for="palette in CHARACTER_PALETTES.slice(0,6)" :key="palette.id" :class="{active:agent.appearance.accentColor===palette.accent}" :style="{background:palette.accent}" :title="palette.name" @click="selectPalette(palette)"/><input v-model="agent.appearance.accentColor" type="color" aria-label="Custom accent color"/></div>
          <label>Accessory</label>
          <div class="accessory-icon-row"><button v-for="item in accessoryOptions.slice(0,5)" :key="item.id" :class="{active:agent.appearance.accessoryIds.includes(item.id)}" :title="item.label" @click="toggleAccessory(item.id)"><span>{{item.id==='glasses'?'▭':item.id==='headset'?'◉':item.id==='cap'?'⌂':item.id==='badge'?'▤':item.id==='scarf'?'≈':'✦'}}</span></button></div>
        </div>
      </div>
    </section>
    <button class="design-next" @click="tab='parts'">Next: Customize Parts <span>→</span></button>
  </template>

  <template v-else-if="tab==='parts'">
    <section class="design-card character-composer-summary"><CharacterThumbnail :appearance="agent.appearance" :size="92"/><div><div class="creator-overline">Procedural assembly</div><h3>{{activeModel.name}} · remixed</h3><p>Preset recipes stay intact as defaults; every compatible slot can be overridden independently.</p></div></section>
    <section v-for="slot in partSlots" :key="slot" class="design-card"><header><div><h3>{{CHARACTER_PART_SLOT_LABELS[slot]}}</h3><p>{{partOptions(slot).length}} compatible options</p></div></header><div class="character-part-grid"><button v-for="part in partOptions(slot)" :key="part.id" :class="['character-part-card',{active:agent.appearance.parts[slot]===part.id}]" @click="selectPart(slot,part.id)"><span class="character-part-glyph">{{slot==='head'?'◇':slot==='body'?'▣':slot==='ears'?'⌁':slot==='tail'?'∿':slot==='arms'?'↔':slot==='screen'?'▤':'▱'}}</span><span><b>{{part.name}}</b><small>{{part.description}}</small></span><i v-if="agent.appearance.parts[slot]===part.id">✓</i></button></div></section>
    <button class="design-next" @click="tab='style'">Next: Style & Presence <span>→</span></button>
  </template>

  <template v-else-if="tab==='style'">
    <section class="design-card"><header><div><h3>Team styles</h3><p>Reuse a visual language across different bodies and species.</p></div><span class="design-count">{{state.characterStyles.length}} saved</span></header><div class="team-style-grid"><button v-for="style in state.characterStyles" :key="style.id" :class="['team-style-card',{active:agent.appearance.teamStyleId===style.id}]" @click="useStyle(style)"><span class="team-style-swatch"><i :style="{background:style.primaryColor}"/><i :style="{background:style.secondaryColor}"/><i :style="{background:style.accentColor}"/></span><span><b>{{style.name}}</b><small>{{style.description}}</small></span><em>{{style.builtIn?'built in':'team'}}</em></button></div></section>
    <section class="design-card"><header><div><h3>Palette</h3><p>Warm, calm colors with one vivid team accent.</p></div></header><div class="creator-palette-grid"><button v-for="palette in CHARACTER_PALETTES" :key="palette.id" :class="['creator-palette',{active:agent.appearance.primaryColor===palette.primary}]" @click="selectPalette(palette)"><span><i :style="{background:palette.primary}"/><i :style="{background:palette.secondary}"/><i :style="{background:palette.accent}"/></span><small>{{palette.name}}</small></button></div><div class="creator-field-grid creator-field-grid-3 mt-3"><UFormField label="Primary"><input v-model="agent.appearance.primaryColor" class="creator-color-input" type="color" @input="agent.color=agent.appearance.primaryColor;agent.appearance.teamStyleId=undefined"/></UFormField><UFormField label="Secondary"><input v-model="agent.appearance.secondaryColor" class="creator-color-input" type="color" @input="agent.appearance.teamStyleId=undefined"/></UFormField><UFormField label="Accent"><input v-model="agent.appearance.accentColor" class="creator-color-input" type="color" @input="agent.appearance.teamStyleId=undefined"/></UFormField></div></section>
    <section class="design-card"><header><div><h3>Presence</h3><p>Expression and motion make the character vivid without changing capability.</p></div></header><div class="creator-field-grid"><UFormField label="Expression"><select v-model="agent.appearance.expression" class="creator-native-select"><option>friendly</option><option>calm</option><option>curious</option><option>confident</option></select></UFormField><UFormField label="Eye style"><select v-model="agent.appearance.eyeStyle" class="creator-native-select"><option>expressive</option><option>round</option><option>focused</option><option>visor</option></select></UFormField><UFormField label="Idle style"><select v-model="agent.appearance.idleStyle" class="creator-native-select"><option>calm</option><option>playful</option><option>focused</option><option>confident</option></select></UFormField><UFormField label="Pattern"><select v-model="agent.appearance.pattern" class="creator-native-select"><option>none</option><option>stripe</option><option>patch</option><option>gradient</option></select></UFormField><UFormField label="Surface finish"><select v-model="agent.appearance.finish" class="creator-native-select"><option>soft</option><option>matte</option><option>glossy</option><option>metallic</option></select></UFormField></div><UFormField class="mt-3" label="Character scale"><input v-model.number="agent.appearance.scale" type="range" min="0.8" max="1.2" step="0.05" class="creator-range"/></UFormField><div class="creator-pills mt-3"><button v-for="item in accessoryOptions" :key="item.id" :class="['creator-pill',{active:agent.appearance.accessoryIds.includes(item.id)}]" @click="toggleAccessory(item.id)">{{agent.appearance.accessoryIds.includes(item.id)?'✓ ':'+ '}}{{item.label}}</button></div></section>
    <button class="design-next" @click="tab='team'">Next: Team Identity <span>→</span></button>
  </template>

  <template v-else-if="tab==='team'">
    <section class="design-card character-team-card"><CharacterThumbnail :appearance="agent.appearance" :size="104"/><div><div class="creator-overline">Social identity</div><h3>{{agent.appearance.teamNickname||agent.name}}</h3><p>{{agent.appearance.motto||'Give this teammate a phrase the team remembers.'}}</p></div></section>
    <section class="design-card"><header><div><h3>Team identity</h3><p>Human-readable cues that help the team recognize and bond with the agent.</p></div></header><div class="creator-field-grid"><UFormField label="Nickname"><UInput v-model="agent.appearance.teamNickname" placeholder="How the team addresses them"/></UFormField><UFormField label="Signature"><UInput v-model="agent.appearance.favoriteSymbol" maxlength="3"/></UFormField></div><UFormField class="mt-3" label="Greeting"><UInput v-model="agent.appearance.greeting" placeholder="Ready when you are."/></UFormField><UFormField class="mt-3" label="Motto"><UInput v-model="agent.appearance.motto" placeholder="A memorable team-facing phrase"/></UFormField></section>
    <section class="design-card"><header><div><h3>Save this visual language</h3><p>Team styles deliberately exclude model and parts, so one style can unify a mixed cast.</p></div></header><div class="character-save-row"><UInput v-model="styleName" placeholder="e.g. Platform team"/><UButton :disabled="!styleName.trim()" @click="saveStyle">Save style</UButton></div></section>
    <button class="design-next" @click="tab='packs'">Next: Packs <span>→</span></button>
  </template>

  <template v-else>
    <section class="design-card"><header><div><h3>Character packs</h3><p>Bundle models, parts, styles and saved looks for a team or project.</p></div><span class="design-count">{{state.characterPacks.length}} installed</span></header><div class="character-pack-grid"><article v-for="pack in state.characterPacks" :key="pack.id" class="character-pack-card"><header><span>{{pack.builtIn?'◈':'◇'}}</span><div><b>{{pack.name}}</b><small>{{pack.author}} · {{pack.builtIn?'built in':'custom'}}</small></div></header><p>{{pack.description}}</p><div class="character-pack-metrics"><span>{{pack.modelIds.length}} models</span><span>{{pack.partIds.length}} parts</span><span>{{pack.savedLooks.length}} looks</span></div><div v-if="pack.savedLooks.length" class="character-pack-looks"><button v-for="look in pack.savedLooks" :key="look.id" @click="applyLook(look.appearance)"><CharacterThumbnail :appearance="look.appearance" :size="50"/><small>{{look.name}}</small></button></div><UButton v-if="!pack.builtIn" size="xs" variant="subtle" @click="downloadPack(pack)">Export pack</UButton></article></div></section>
    <section class="design-card"><header><div><h3>Create a team pack</h3><p>Save the current look so it can travel with the project.</p></div></header><div class="character-save-row"><UInput v-model="packName" placeholder="Pack name"/><UButton :disabled="!packName.trim()" @click="createPack">Save current look</UButton></div><label class="character-pack-import"><input type="file" accept="application/json,.json" @change="importPack"/><span>Import character-pack JSON</span></label></section>
  </template>

  <div class="design-authority-note"><span>💡</span><p><b>{{activeModel.name}} is presentation, not authority.</b> Changing the character never changes tools, skills, permissions, role, eval scores, or runtime behavior.</p></div>
</template>
