<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatRuntimeTargetPath } from '../../formatters/runtimeTargetPath'
import type { Agent } from '../../../domain/agents/types'
import type { CharacterEditorCategory, CharacterEditorCategoryId } from '../../character-catalog/editorCategories'
import type { PluginState } from '../../../domain/shared/PluginState'
import { relationPeerId, toggleMembership } from '../../character-catalog/editorCategories'
import CharacterDesignPanel from './CharacterDesignPanel.vue'

const props=defineProps<{agent:Agent;state:PluginState;category:CharacterEditorCategoryId;categories:readonly CharacterEditorCategory[];readiness:Record<CharacterEditorCategoryId,number>;overallCoverage:number}>()
const emit=defineEmits<{category:[id:CharacterEditorCategoryId];navigate:[view:string];teach:[id:string]}>()
const current=computed(()=>props.categories.find(x=>x.id===props.category)??props.categories[0]!)
const role=computed(()=>props.state.roles.find(x=>x.id===props.agent.roleId))
const related=computed(()=>props.state.relations.filter(x=>x.fromAgentId===props.agent.id||x.toAgentId===props.agent.id))
const skillSearch=ref('')
const skillFilter=ref<'all'|'equipped'>('all')
const visibleSkills=computed(()=>props.state.skills.filter(skill=>{const needle=skillSearch.value.trim().toLowerCase();const matchesFilter=skillFilter.value==='all'||props.agent.skillIds.includes(skill.id);const matchesSearch=!needle||[skill.name,skill.description,skill.category,skill.entrypoint].some(value=>value.toLowerCase().includes(needle));return matchesFilter&&matchesSearch}))
const linkedToolCount=computed(()=>new Set(props.state.skills.filter(skill=>props.agent.skillIds.includes(skill.id)).flatMap(skill=>skill.allowedToolIds)).size)
const skillToolNames=(ids:string[])=>ids.map(id=>props.state.tools.find(tool=>tool.id===id)?.name).filter(Boolean) as string[]
const onCategorySelect=(event:Event)=>emit('category',(event.target as HTMLSelectElement).value as CharacterEditorCategoryId)
const attrs=[['st','ST'],['dx','DX'],['iq','IQ'],['ht','HT'],['will','Will'],['per','Per'],['hp','HP'],['fp','FP']] as const
const toggle=(key:'skillIds'|'toolIds'|'guardrailIds',id:string)=>{props.agent[key]=toggleMembership(props.agent[key],id)}
const peer=(r:{fromAgentId:string;toAgentId:string})=>props.state.agents.find(x=>x.id===relationPeerId(props.agent.id,r))
</script>

<template>
<aside class="creator-panel" :class="{'creator-panel-design':category==='appearance'}">
  <template v-if="category!=='appearance'">
    <div class="creator-context-switcher creator-context-switcher-clean">
      <button @click="emit('category','appearance')">‹ Character design</button>
      <div class="creator-context-current"><small>Editing</small><b>{{current.label}}</b></div>
      <label class="creator-context-category-select"><span class="sr-only">Change agent configuration section</span><select :value="category" @change="onCategorySelect"><option v-for="item in categories.filter(x=>x.id!=='appearance')" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
    </div>
    <header class="creator-panel-header" :style="{'--category-accent':current.accent}"><div class="creator-panel-kicker">Customize {{agent.appearance.teamNickname||agent.name}}</div><div class="creator-panel-title-row"><span class="creator-panel-title-icon">{{current.icon}}</span><div><h2>{{current.title}}</h2><p>{{current.description}}</p></div><div class="creator-readiness-badge"><strong>{{readiness[category]}}%</strong><span>ready</span></div></div></header>
  </template>
  <div class="creator-panel-scroll" :class="{'creator-panel-scroll-design':category==='appearance'}">
    <template v-if="category==='identity'">
      <div class="creator-section"><div class="creator-section-title">Operational identity</div><UFormField label="Agent name"><UInput v-model="agent.name"/></UFormField><UFormField class="mt-3" label="Mission"><UTextarea v-model="agent.description" autoresize/></UFormField><UFormField class="mt-3" label="Role"><select v-model="agent.roleId" class="creator-native-select"><option v-for="x in state.roles" :key="x.id" :value="x.id">{{x.name}}</option></select></UFormField><div class="creator-option-grid mt-3"><button :class="['creator-option',{active:agent.kind==='general'}]" @click="agent.kind='general'"><b>General agent</b><span>Project-wide orientation and routing.</span></button><button :class="['creator-option',{active:agent.kind==='specialist'}]" @click="agent.kind='specialist'"><b>Specialist</b><span>Bounded expertise and ownership.</span></button></div></div>
      <div class="creator-section"><div class="creator-section-title">Routing identity</div><UTextarea v-model="agent.invocation.handoffDescription" autoresize/></div>
      <div class="creator-callout"><b>Identity ≠ appearance</b>The operational identity decides routing and responsibility. The visual character is a team-facing social identifier.</div>
    </template>

    <CharacterDesignPanel v-else-if="category==='appearance'" :agent="agent" :state="state"/>

    <template v-else-if="category==='mind'"><div class="creator-section"><div class="creator-section-title">Operating instruction</div><UTextarea v-model="agent.systemPrompt" :rows="6"/></div><div class="creator-section"><div class="creator-section-title">Goals</div><div v-for="(g,i) in agent.goals" :key="g" class="creator-trait"><span class="creator-trait-icon">{{i+1}}</span><div><b>{{g}}</b><p>Persistent outcome this agent should optimize for.</p></div></div></div><div class="creator-section"><div class="creator-section-title">Autonomy</div><UInput v-model.number="agent.autonomy.maxSteps" type="number"/><select v-model="agent.autonomy.approvalPolicy" class="creator-native-select mt-3"><option v-for="x in ['never','on-write','on-risk','always']" :key="x">{{x}}</option></select><UButton class="mt-3 w-full" variant="subtle" @click="emit('navigate','instructions')">Open instruction layers</UButton></div></template>
    <template v-else-if="category==='skills'">
      <section class="creator-skill-summary" aria-label="Skill loadout summary">
        <div><strong>{{agent.skillIds.length}}</strong><span>equipped</span></div><div><strong>{{state.skills.length}}</strong><span>available</span></div><div><strong>{{linkedToolCount}}</strong><span>linked tools</span></div>
      </section>
      <section class="creator-skill-toolbar">
        <label class="creator-skill-search"><span>Search skills</span><input v-model="skillSearch" type="search" placeholder="Find a skill…"/></label>
        <div class="creator-skill-filter" role="group" aria-label="Skill filter"><button :class="{active:skillFilter==='all'}" @click="skillFilter='all'">Library</button><button :class="{active:skillFilter==='equipped'}" @click="skillFilter='equipped'">Equipped</button></div>
      </section>
      <section class="creator-skill-library" aria-label="Skill library">
        <button v-for="x in visibleSkills" :key="x.id" :class="['creator-skill-card',{active:agent.skillIds.includes(x.id)}]" @click="toggle('skillIds',x.id)">
          <span class="creator-skill-toggle">{{agent.skillIds.includes(x.id)?'✓':'+'}}</span>
          <div class="creator-skill-card-copy"><header><b>{{x.name}}</b><small>{{x.category}}</small></header><p>{{x.description}}</p><footer><span>{{x.loading}}</span><span v-for="tool in skillToolNames(x.allowedToolIds).slice(0,2)" :key="tool">{{tool}}</span><span v-if="x.resourcePaths.length">{{x.resourcePaths.length}} path{{x.resourcePaths.length===1?'':'s'}}</span></footer></div>
        </button>
        <div v-if="!visibleSkills.length" class="creator-empty creator-skill-empty">No skills match this filter.</div>
      </section>
      <div class="creator-callout creator-skill-callout"><b>Skills are reusable techniques</b>Skills package procedural know-how. Their linked tools and resource scopes are shown here only as context; editing those stays in their own components.</div>
    </template>
    <template v-else-if="category==='tools'"><div class="creator-section"><div class="creator-section-title">Tool loadout</div><button v-for="x in state.tools" :key="x.id" :class="['creator-option','creator-option-wide',{active:agent.toolIds.includes(x.id)}]" @click="toggle('toolIds',x.id)"><span class="creator-option-mark">{{agent.toolIds.includes(x.id)?'✓':'+'}}</span><b>{{x.name}}</b><span>{{x.namespace}} · {{x.risk}} risk</span></button></div><div class="creator-callout"><b>Tools are equipment</b>Use explicit contracts, risk and approval behavior.</div></template>
    <template v-else-if="category==='memory'"><div class="creator-section"><div class="creator-section-title">Working memory</div><UFormField label="Context token budget"><UInput v-model.number="agent.shortTermMemory.tokenBudget" type="number"/></UFormField><UFormField class="mt-3" label="Retrieval strategy"><UInput v-model="agent.shortTermMemory.retrieval"/></UFormField><div class="creator-callout mt-3"><b>Context window = working memory</b>Only task-relevant evidence belongs here.</div></div><div class="creator-section"><div class="creator-section-title">Long-term memory</div><UInput v-model="agent.longTermMemory.summaryPath"/><div class="creator-callout mt-3"><b>Vault + Git = durable external memory</b>Persistence, retrieval and context assembly are distinct.</div></div><UButton class="w-full" variant="subtle" @click="emit('navigate','vault')">Manage vault paths</UButton></template>
    <template v-else-if="category==='safety'"><div class="creator-section"><div class="creator-section-title">Guardrails</div><div class="creator-pills"><button v-for="x in state.guardrails" :key="x.id" :class="['creator-pill',{active:agent.guardrailIds.includes(x.id)}]" @click="toggle('guardrailIds',x.id)">{{agent.guardrailIds.includes(x.id)?'✓ ':'+ '}}{{x.name}}</button></div></div><UButton class="w-full" variant="subtle" @click="emit('navigate','safety')">Open detailed safety policy</UButton></template>
    <template v-else-if="category==='network'"><div class="creator-section"><div class="creator-section-title">Agent network</div><div v-for="r in related" :key="r.id" class="creator-trait"><span class="creator-trait-icon" :style="{background:peer(r)?.color}">↔</span><div><b>{{peer(r)?.name}}</b><p>{{r.type}} · {{r.description}}</p></div></div></div><UButton class="w-full" variant="subtle" @click="emit('navigate','relations')">Edit relation graph</UButton></template>
    <template v-else-if="category==='character'"><div class="creator-section"><div class="creator-section-title">Primary attributes</div><div class="creator-gurps"><label v-for="x in attrs" :key="x[0]"><span>{{x[1]}}</span><input v-model.number="agent.gurps[x[0]]" type="number"/></label></div></div><UButton class="w-full" variant="subtle" @click="emit('navigate','character')">Open full character sheet</UButton></template>
    <template v-else-if="category==='evals'"><div class="creator-section"><div class="creator-section-title">Scenario evidence</div><div v-if="!agent.evals.length" class="creator-empty">No scenario evaluations attached.</div><div v-for="x in agent.evals" :key="x.id" class="creator-trait"><span class="creator-trait-icon">{{x.status==='passing'?'✓':'!'}}</span><div><b>{{x.name}}</b><p>{{x.task}}</p></div><span>{{x.lastScore!=null?Math.round(x.lastScore*100)+'%':x.status}}</span></div></div><UButton class="w-full" variant="subtle" @click="emit('navigate','evals')">Open Eval Lab</UButton></template>
    <template v-else><div class="creator-section"><div class="creator-section-title">Projection targets</div><div v-for="x in state.runtimeAdapters" :key="x.id" class="creator-runtime-row"><div><b>{{x.name}}</b><code>{{formatRuntimeTargetPath(x.targetPath, agent.slug)}}</code></div></div></div><UButton class="w-full" @click="emit('navigate','runtime')">Open runtime adapters</UButton></template>
  </div>
  <footer v-if="category!=='appearance'" class="creator-panel-footer"><div class="creator-panel-footer-summary"><strong>{{role?.name||'No role'}}</strong><span>{{overallCoverage}}% overall configuration</span></div><div class="creator-panel-footer-meter"><i :style="{width:readiness[category]+'%'}"/></div><UButton size="sm" variant="soft" @click="emit('teach',current.requirementId)">Explain concept</UButton></footer>
</aside>
</template>
