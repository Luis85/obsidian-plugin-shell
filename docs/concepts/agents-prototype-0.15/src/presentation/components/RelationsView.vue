<script setup lang="ts">
import { computed } from 'vue'
import type { Agent } from '../../domain/agents/types'
import type { AgentRelation } from '../../domain/relations/types'
const props = defineProps<{ agents: Agent[]; relations: AgentRelation[] }>()
const byId = computed(() => Object.fromEntries(props.agents.map(a => [a.id, a])))
const positions = computed(() => {
  const out: Record<string,{x:number;y:number}> = {}
  const general = props.agents.find(a=>a.kind==='general') ?? props.agents[0]
  if (general) out[general.id]={x:50,y:16}
  props.agents.filter(a=>a.id!==general?.id).forEach((a,i)=>{
    const count=Math.max(1,props.agents.length-1); const angle=Math.PI*(.12+.76*(i/Math.max(1,count-1)))
    out[a.id]={x:50+40*Math.cos(angle),y:73+18*Math.sin(angle)}
  })
  return out
})
</script>
<template>
  <div class="responsive-two">
    <UCard class="min-h-[580px]">
      <template #header><div><div class="font-semibold">Agent constellation</div><div class="text-xs text-muted">Edges are rendered from relation data; cards remain the authoritative relation inspector.</div></div></template>
      <div class="relative h-[480px] overflow-hidden rounded-xl border border-default bg-elevated">
        <svg class="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line v-for="rel in relations" :key="rel.id" :x1="positions[rel.fromAgentId]?.x" :y1="positions[rel.fromAgentId]?.y" :x2="positions[rel.toAgentId]?.x" :y2="positions[rel.toAgentId]?.y" stroke="currentColor" :stroke-width="rel.type==='delegates-to'?0.55:0.38" :stroke-dasharray="rel.type==='consults'?'1.5 1.5':undefined" />
        </svg>
        <button v-for="agent in agents" :key="agent.id" class="absolute w-40 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-default bg-default p-3 text-left shadow-xl" :style="{left:`${positions[agent.id]?.x}%`,top:`${positions[agent.id]?.y}%`}" type="button">
          <div class="flex items-center gap-2"><span class="h-3 w-3 rounded-sm" :style="{background:agent.color}"/><div class="font-semibold">{{ agent.name }}</div></div><div class="mt-1 text-xs text-muted">{{ agent.kind }} · {{ agent.version }}</div>
        </button>
      </div>
    </UCard>
    <UCard><template #header><div class="font-semibold">Relation contracts</div></template><div class="space-y-2"><div v-for="rel in relations" :key="rel.id" class="rounded-lg border border-default bg-elevated p-3"><div class="text-sm font-medium">{{ byId[rel.fromAgentId]?.name }} <span class="text-primary">{{ rel.type }}</span> {{ byId[rel.toAgentId]?.name }}</div><div class="mt-1 text-xs text-muted">{{ rel.description }}</div></div></div></UCard>
  </div>
</template>
