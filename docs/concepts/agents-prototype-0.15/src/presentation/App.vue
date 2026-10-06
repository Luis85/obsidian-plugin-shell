<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useAgentsStore } from './stores/agents'
import CharacterEditor from './components/CharacterEditor.vue'
import PersistenceStatus from './components/PersistenceStatus.vue'
const OverviewDashboard = defineAsyncComponent(() => import('./components/OverviewDashboard.vue'))
const GurpsSheet = defineAsyncComponent(() => import('./components/GurpsSheet.vue'))
const RelationsView = defineAsyncComponent(() => import('./components/RelationsView.vue'))
const VaultPaths = defineAsyncComponent(() => import('./components/VaultPaths.vue'))
const JsonStudio = defineAsyncComponent(() => import('./components/JsonStudio.vue'))
const TeachingAcademy = defineAsyncComponent(() => import('./components/TeachingAcademy.vue'))
const SafetyView = defineAsyncComponent(() => import('./components/SafetyView.vue'))
const EvalLab = defineAsyncComponent(() => import('./components/EvalLab.vue'))
const RuntimeAdapters = defineAsyncComponent(() => import('./components/RuntimeAdapters.vue'))
const InstructionsView = defineAsyncComponent(() => import('./components/InstructionsView.vue'))

type View = 'overview'|'editor'|'agents'|'academy'|'relations'|'vault'|'safety'|'evals'|'instructions'|'runtime'|'character'|'json'
const store = useAgentsStore()
const view = ref<View>('editor')
const selected = computed(() => store.selectedAgent)
const academyRequirementId = ref('memory.long')
const openTeaching = (requirementId: string) => { academyRequirementId.value = requirementId; view.value = 'academy' }
const navigateTo = (target: string) => { view.value = target as View }
const nav: [View,string][] = [
  ['overview','Overview'],['editor','Klaus Editor'],['agents','Agent Registry'],['academy','Requirements Academy'],
  ['vault','Vault & Memory'],['instructions','Instruction Layers'],['safety','Safety & Permissions'],['relations','Relations'],
  ['evals','Eval Lab'],['runtime','Runtime Adapters'],['character','Character Sheet'],['json','JSON Studio']
]
</script>

<template>
  <UApp>
    <div class="app-shell bg-default text-default" :class="{'app-shell-editor':view==='editor'}">
      <header class="app-header" :class="{'app-header-editor':view==='editor'}">
        <div class="agents-mark" aria-hidden="true"><i/><i/></div>
        <div class="font-semibold app-product-name">Agents</div>
        <template v-if="view==='editor'">
          <div class="app-breadcrumb" aria-label="Breadcrumb"><span>Workspace</span><b>›</b><strong>Klaus Editor</strong></div>
          <div class="ml-auto app-editor-status">
            <PersistenceStatus/>
            <span class="app-status-pill"><i/>Target vault: {{ store.state.project.vaultName }}</span>
            <span class="app-status-pill">Schema {{ store.state.schemaVersion }}</span>
            <button class="app-settings-button" aria-label="Settings" @click="view='overview'">⚙</button>
          </div>
        </template>
        <template v-else>
          <div class="hidden text-xs text-muted sm:block">Vault-native agent environment · Klaus Editor</div>
          <UBadge class="hidden md:inline-flex" color="success" variant="subtle">{{ store.state.project.vaultName }}</UBadge>
          <div class="ml-auto flex gap-2">
            <PersistenceStatus/>
            <UButton class="hidden sm:inline-flex" color="neutral" variant="subtle" @click="view='json'">JSON</UButton>
            <UButton @click="store.snapshotSelected()">Snapshot</UButton>
          </div>
        </template>
      </header>

      <div class="app-body" :class="{'app-body-editor':view==='editor'}">
        <aside v-if="view!=='editor'" class="app-nav">
          <div class="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-muted">Workspace</div>
          <UButton v-for="item in nav" :key="item[0]" class="mb-1 w-full justify-start" :color="view===item[0]?'primary':'neutral'" :variant="view===item[0]?'soft':'ghost'" @click="view=item[0]">{{ item[1] }}</UButton>
          <div class="mb-2 mt-5 px-2 text-xs font-semibold uppercase tracking-widest text-muted">Characters</div>
          <UButton v-for="agent in store.state.agents" :key="agent.id" class="mb-1 w-full justify-start" color="neutral" variant="ghost" @click="store.selectAgent(agent.id); view='editor'">
            <span class="mr-2 inline-block h-3 w-3 rounded-sm" :style="{background:agent.color}"/>{{ agent.name }}
          </UButton>
        </aside>

        <main class="app-main" :class="{'editor-main':view==='editor'}">
          <template v-if="selected">
            <OverviewDashboard v-if="view==='overview'" :agent="selected" :state="store.state"/>
            <CharacterEditor v-else-if="view==='editor'" :agent="selected" @navigate="navigateTo" @teach="openTeaching"/>
            <div v-else-if="view==='agents'" class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-xl font-semibold">Agent registry</h1><p class="text-sm text-muted">General agent, specialists, variants and versions. Production target: Markdown/frontmatter entities with a Bases-compatible view.</p></div><UButton @click="store.addSpecialist()">Add specialist</UButton></div>
              <div class="agent-cards"><UCard v-for="agent in store.state.agents" :key="agent.id" class="cursor-pointer" @click="store.selectAgent(agent.id); view='editor'"><div class="flex items-center gap-3"><span class="h-10 w-10 rounded" :style="{background:agent.color}"/><div><div class="font-semibold">{{ agent.name }}</div><div class="text-xs text-muted">{{ agent.kind }} · {{ agent.version }}<span v-if="agent.variantOf"> · inherits</span></div></div></div><p class="mt-3 text-sm text-muted">{{ agent.description }}</p><div class="mt-3 flex flex-wrap gap-1"><UBadge size="xs" variant="subtle">{{ agent.roleId }}</UBadge><UBadge size="xs" variant="subtle">{{ agent.toolIds.length }} tools</UBadge><UBadge size="xs" variant="subtle">{{ agent.evals.length }} evals</UBadge></div></UCard></div>
            </div>
            <TeachingAcademy v-else-if="view==='academy'" :agent="selected" :state="store.state" :initial-id="academyRequirementId"/>
            <RelationsView v-else-if="view==='relations'" :agents="store.state.agents" :relations="store.state.relations"/>
            <div v-else-if="view==='vault'" class="space-y-4"><UAlert color="primary" variant="subtle" title="Vault + Git are durable external memory" description="Storage becomes useful memory through retrieval: properties, links, search and path conventions select evidence, then context assembly recalls only the relevant slices into working memory."/><VaultPaths :agent="selected"/></div>
            <SafetyView v-else-if="view==='safety'" :agent="selected" :state="store.state"/>
            <EvalLab v-else-if="view==='evals'" :agent="selected"/>
            <RuntimeAdapters v-else-if="view==='runtime'" :agent="selected" :state="store.state"/>
            <InstructionsView v-else-if="view==='instructions'" :agent="selected" :state="store.state"/>
            <GurpsSheet v-else-if="view==='character'" :agent="selected"/>
            <JsonStudio v-else-if="view==='json'" :state="store.state" @apply="store.replaceState"/>
          </template>
        </main>
      </div>
    </div>
  </UApp>
</template>
