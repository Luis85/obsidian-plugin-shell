<script setup lang="ts">
import type { Agent } from '../../domain/agents/types'
import type { PluginState } from '../../domain/shared/PluginState'
defineProps<{ agent: Agent; state: PluginState }>()
</script>
<template>
  <div class="space-y-4">
    <div><h1 class="text-xl font-semibold">Safety & permissions</h1><p class="text-sm text-muted">Separate authorization and review controls from prompt instructions.</p></div>
    <UAlert color="warning" variant="subtle" title="Least privilege by construction" description="Path policies constrain files; tool metadata describes side effects and risk; guardrails and approvals enforce sensitive boundaries."/>
    <div class="responsive-two">
      <UCard>
        <template #header><div class="font-semibold">Attached guardrails</div></template>
        <div class="space-y-2">
          <div v-for="g in state.guardrails.filter(x=>agent.guardrailIds.includes(x.id))" :key="g.id" class="rounded-lg border border-default p-3">
            <div class="flex items-center gap-2"><strong class="text-sm">{{ g.name }}</strong><UBadge size="xs" variant="subtle">{{ g.kind }}</UBadge><UBadge class="ml-auto" size="xs" :color="g.enforcement==='block'?'error':g.enforcement==='review'?'warning':'neutral'">{{ g.enforcement }}</UBadge></div>
            <p class="mt-1 text-xs text-muted">{{ g.description }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <template #header><div class="font-semibold">Tool risk & approval</div></template>
        <div class="space-y-2">
          <div v-for="tool in state.tools.filter(x=>agent.toolIds.includes(x.id))" :key="tool.id" class="rounded-lg border border-default p-3">
            <div class="flex items-center gap-2"><strong class="text-sm">{{ tool.namespace }}</strong><UBadge size="xs" variant="subtle">{{ tool.kind }}</UBadge><UBadge class="ml-auto" size="xs" :color="tool.risk==='high'?'error':tool.risk==='medium'?'warning':'success'">{{ tool.risk }}</UBadge></div>
            <div class="mt-1 text-xs text-muted">Approval: {{ tool.approval }} · Side effects: {{ tool.sideEffects ? 'yes' : 'no' }} · Destructive: {{ tool.destructive ? 'possible' : 'no' }}</div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
