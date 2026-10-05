<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import type { Agent } from '../../domain/agents/types'
import type { CharacterEditorCategoryId } from '../character-catalog/editorCategories'
import type { CharacterMotionState, CharacterPoseId } from '../../domain/characters/types'
import { agentConfigurationCoverage, categoryReadiness, CHARACTER_EDITOR_CATEGORIES } from '../character-catalog/editorCategories'
import { characterModel } from '../character-catalog/catalog'
import { useAgentsStore } from '../stores/agents'
import AgentRoster from './editor/AgentRoster.vue'
import CharacterCustomizer from './editor/CharacterCustomizer.vue'
import CharacterStage from './CharacterStage.vue'
const VoxelWorld=defineAsyncComponent(()=>import('./VoxelWorld.vue'))

const props=defineProps<{agent:Agent}>()
const emit=defineEmits<{navigate:[view:string];teach:[id:string]}>()
const store=useAgentsStore()
const mode=ref<'character'|'world'|'animation'>('character')
const category=ref<CharacterEditorCategoryId>('appearance')
const stage=ref<InstanceType<typeof CharacterStage>|null>(null)
const renderQuality=ref<'Balanced'|'High'|'Ultra'>('High')
const motion=ref<CharacterMotionState>('idle')
const rotationAngle=ref(0)
const poses:{id:CharacterPoseId;label:string;description:string}[]=[
  {id:'neutral',label:'Neutral',description:'Calm default stance'},
  {id:'ready',label:'Ready',description:'Attentive and available'},
  {id:'wave',label:'Wave',description:'Friendly greeting pose'},
  {id:'thinking',label:'Thinking',description:'Reflective problem-solving'},
  {id:'working',label:'Working',description:'Hands-on task posture'},
  {id:'celebrate',label:'Celebrate',description:'Positive completion moment'}
]
const motions:{id:CharacterMotionState;label:string;description:string}[]=[
  {id:'idle',label:'Idle',description:'Uses the selected idle personality'},
  {id:'listen',label:'Listen',description:'Subtle attentive head motion'},
  {id:'think',label:'Think',description:'Small reflective nod and tilt'},
  {id:'work',label:'Work',description:'Alternating active limb motion'},
  {id:'celebrate',label:'Celebrate',description:'Short energetic response'}
]
const current=computed(()=>CHARACTER_EDITOR_CATEGORIES.find(x=>x.id===category.value)??CHARACTER_EDITOR_CATEGORIES[0]!)
const related=computed(()=>store.state.relations.filter(x=>x.fromAgentId===props.agent.id||x.toAgentId===props.agent.id))
const coverage=computed(()=>agentConfigurationCoverage(props.agent))
const readiness=computed(()=>Object.fromEntries(CHARACTER_EDITOR_CATEGORIES.map(x=>[x.id,categoryReadiness(props.agent,store.state,x.id)]))as Record<CharacterEditorCategoryId,number>)
const activeModel=computed(()=>characterModel(props.agent.appearance.modelId))
const setCategory=(c:CharacterEditorCategoryId)=>{category.value=c;mode.value='character'}
const fromStation=(id:string)=>{const map:Record<string,CharacterEditorCategoryId>={identity:'identity',memory:'memory',vault:'memory',schema:'runtime',skills:'skills',tools:'tools',permissions:'safety',safety:'safety',relations:'network',evals:'evals',instructions:'mind',runtime:'runtime'};if(map[id])setCategory(map[id])}
const setRotation=(value:number)=>{rotationAngle.value=((value%360)+360)%360;stage.value?.setRotation(rotationAngle.value)}
const snapRotation=(value:number)=>setRotation(value)
const onRotationInput=(event:Event)=>setRotation(Number((event.target as HTMLInputElement).value))
</script>

<template>
<section class="character-creator">
  <header class="creator-banner">
    <div class="creator-banner-copy">
      <div class="creator-overline">Character creator</div>
      <div class="creator-title-row"><h1>Klaus Editor</h1><UBadge size="xs" variant="subtle">v{{agent.version}}</UBadge></div>
      <p>Character Design System <span>•</span> Build unique agents for your world.</p>
    </div>
    <div class="creator-banner-steps"><span>Design</span><b>›</b><span>Customize</span><b>›</b><span>Bring to life</span><small>Block by block. More than an agent.</small></div>
    <div class="creator-banner-motto">Small agents<br/>Big ideas <b>♡</b></div>
  </header>

  <div class="creator-shell">
    <AgentRoster :agents="store.state.agents" :selected-agent-id="agent.id" @select="store.selectAgent" @add="store.addSpecialist"/>

    <main class="creator-stage-column">
      <div class="creator-stage-toolbar">
        <div class="creator-segmented" aria-label="Editor mode">
          <button :class="{active:mode==='character'}" @click="mode='character'">Character</button>
          <button :class="{active:mode==='world'}" @click="mode='world'">Environment</button>
          <button :class="{active:mode==='animation'}" @click="mode='animation'">Animation</button>
        </div>
        <label class="creator-quality"><span>◈</span><small>Render quality</small><select v-model="renderQuality"><option>Balanced</option><option>High</option><option>Ultra</option></select></label>
      </div>

      <div v-if="mode==='character'" class="creator-stage">
        <CharacterStage ref="stage" :agent="agent" :active-category="category" :quality="renderQuality" :motion="motion" @category="setCategory" @rotation="rotationAngle=$event"/>
        <div class="creator-stage-vignette"/>
        <div class="creator-stage-agent-card">
          <header><h2>{{agent.appearance.teamNickname||agent.name}}</h2><button aria-label="Edit identity" @click="setCategory('identity')">✎</button><span><i/>{{agent.status}}</span></header>
          <p>{{agent.description}}</p>
        </div>
        <div class="creator-stage-prop creator-prop-ideas" @click="setCategory('mind')"><span class="prop-gem">◆</span><b>Ideas</b></div>
        <div class="creator-stage-prop creator-prop-knowledge" @click="setCategory('memory')"><span class="prop-book">▤</span><b>Knowledge</b></div>
        <div class="creator-stage-prop creator-prop-planning" @click="setCategory('skills')"><span class="prop-screen">⌁</span><b>Planning</b></div>
        <div class="creator-stage-prop creator-prop-tasks" @click="setCategory('tools')"><span class="prop-clipboard">✓</span><b>Tasks</b></div>
        <div class="creator-stage-presence"><span>💡</span><div><strong>Appearance & presence</strong><p>Give your agent a recognizable embodiment without implying capability or authority.</p></div></div>
        <div class="creator-stage-controls creator-turntable" aria-label="360 degree character turntable controls">
          <button title="Rotate 45° left" @click="stage?.rotate(-1)">↺</button>
          <div class="creator-turntable-main">
            <div class="creator-turntable-snaps" aria-label="Rotation presets"><button :class="{active:rotationAngle<23||rotationAngle>337}" @click="snapRotation(0)">Front</button><button :class="{active:rotationAngle>=68&&rotationAngle<=112}" @click="snapRotation(90)">Right</button><button :class="{active:rotationAngle>=158&&rotationAngle<=202}" @click="snapRotation(180)">Back</button><button :class="{active:rotationAngle>=248&&rotationAngle<=292}" @click="snapRotation(270)">Left</button></div>
            <label class="creator-rotation-scrubber"><span>360° model rotation</span><input :value="Math.round(rotationAngle)" type="range" min="0" max="359" step="1" @input="onRotationInput"/><output>{{Math.round(rotationAngle)}}°</output></label>
          </div>
          <button title="Rotate 45° right" @click="stage?.rotate(1)">↻</button><i/>
          <button title="Zoom out" @click="stage?.zoom(1)">−</button><button title="Zoom in" @click="stage?.zoom(-1)">+</button>
        </div>
      </div>

      <div v-else-if="mode==='world'" class="creator-world"><VoxelWorld :agent="agent" @station="fromStation"/></div>

      <div v-else class="creator-animation-panel">
        <div class="creator-animation-preview"><CharacterStage ref="stage" :agent="agent" :active-category="category" :quality="renderQuality" :motion="motion" @category="setCategory" @rotation="rotationAngle=$event"/></div>
        <aside class="creator-animation-controls"><div class="creator-overline">Animation lab</div><h2>Presence & motion</h2><p>Fine-tune how {{agent.appearance.teamNickname||agent.name}} feels without changing capability or authority.</p>
          <section><header><b>Default pose</b><small>Saved with this character</small></header><div class="creator-option-grid"><button v-for="item in poses" :key="item.id" class="creator-option" :class="{active:agent.appearance.pose===item.id}" @click="agent.appearance.pose=item.id"><b>{{item.label}}</b><span>{{item.description}}</span></button></div></section>
          <section><header><b>Motion preview</b><small>Editor-only preview</small></header><div class="creator-option-grid"><button v-for="item in motions" :key="item.id" class="creator-option" :class="{active:motion===item.id}" @click="motion=item.id"><b>{{item.label}}</b><span>{{item.description}}</span></button></div></section>
          <section class="creator-motion-note"><b>{{agent.appearance.idleStyle}} idle personality</b><p>Idle personality remains the low-amplitude background motion. Poses and preview motions layer on top through the semantic procedural rig.</p></section>
        </aside>
      </div>
    </main>

    <CharacterCustomizer :agent="agent" :state="store.state" :category="category" :categories="CHARACTER_EDITOR_CATEGORIES" :readiness="readiness" :overall-coverage="coverage" @category="setCategory" @navigate="emit('navigate',$event)" @teach="emit('teach',$event)"/>
  </div>
</section>
</template>
