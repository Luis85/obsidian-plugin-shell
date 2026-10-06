<script setup lang="ts">
import type { Agent } from '../../domain/agents/types'
defineProps<{ agent: Agent }>()
</script>
<template>
  <div class="space-y-4">
    <div><h1 class="text-xl font-semibold">Eval lab & traces</h1><p class="text-sm text-muted">Configuration checks explain structure. Scenario evals and traces provide evidence about behavior.</p></div>
    <UAlert color="primary" variant="subtle" title="Prototype simulation" description="These cards model the data the production plugin should store or link to. They do not execute a model in this prototype."/>
    <div class="responsive-two">
      <UCard>
        <template #header><div class="font-semibold">Scenario evals</div></template>
        <div v-if="agent.evals.length" class="space-y-3">
          <div v-for="e in agent.evals" :key="e.id" class="rounded-lg border border-default p-3">
            <div class="flex items-center gap-2"><strong class="text-sm">{{ e.name }}</strong><UBadge class="ml-auto" :color="e.status==='passing'?'success':e.status==='failing'?'error':'neutral'" variant="subtle">{{ e.status }}</UBadge></div>
            <p class="mt-2 text-xs text-muted">{{ e.task }}</p>
            <ul class="mt-2 list-disc pl-5 text-xs text-muted"><li v-for="c in e.criteria" :key="c">{{ c }}</li></ul>
            <div v-if="e.lastScore!==undefined" class="mt-2 text-xs">Last score: {{ Math.round(e.lastScore*100) }}% · {{ e.lastRunAt }}</div>
          </div>
        </div>
        <div v-else class="text-sm text-muted">No scenario evals are defined for this agent.</div>
      </UCard>
      <UCard>
        <template #header><div class="font-semibold">Example run trace</div></template>
        <ol class="space-y-3 text-sm">
          <li v-for="(x,i) in ['Task received','Retrieve scoped vault evidence','Select specialist / continue locally','Propose tool call','Apply guardrail + approval policy','Execute tool','Validate output','Record eval evidence']" :key="x" class="flex gap-3"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-default text-xs">{{ i+1 }}</span><div>{{ x }}</div></li>
        </ol>
      </UCard>
    </div>
  </div>
</template>
