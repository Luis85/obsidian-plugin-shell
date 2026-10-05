<script setup lang="ts">
import { computed } from 'vue'
import type { Agent } from '../../domain/agents/types'
import type { PluginState } from '../../domain/shared/PluginState'
import { validateState } from '../../domain/shared/validateState'
import { requirements } from '../character-catalog/requirements'

const props = defineProps<{ agent: Agent; state: PluginState }>()
const issues = computed(() => validateState(props.state))
const evals = computed(() => props.agent.evals)
const verified = computed(() => evals.value.filter(x => x.status === 'passing').length)
const coverage = computed(() => {
  const a = props.agent
  const checks = [a.description, a.goals.length >= 2, a.pathPolicies.length, a.toolIds.length, a.skillIds.length, a.guardrailIds.length, a.invocation.handoffDescription, a.shortTermMemory.retrieval, a.longTermMemory.retrievalNotes, a.evals.length]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold">Environment overview</h1>
      <p class="text-sm text-muted">Configuration completeness, verification evidence, safety posture and runtime portability are separate signals.</p>
    </div>
    <div class="responsive-cards">
      <UCard><div class="text-xs text-muted">Configuration coverage</div><div class="mt-1 text-2xl font-semibold">{{ coverage }}%</div><div class="mt-2 text-xs text-muted">Static structure only — not an agent performance score.</div></UCard>
      <UCard><div class="text-xs text-muted">Passing scenario evals</div><div class="mt-1 text-2xl font-semibold">{{ verified }}/{{ evals.length }}</div><div class="mt-2 text-xs text-muted">Behavioral evidence attached to this agent.</div></UCard>
      <UCard><div class="text-xs text-muted">Validation issues</div><div class="mt-1 text-2xl font-semibold">{{ issues.length }}</div><div class="mt-2 text-xs text-muted">{{ issues.filter(x=>x.severity==='error').length }} errors · {{ issues.filter(x=>x.severity==='warning').length }} warnings</div></UCard>
      <UCard><div class="text-xs text-muted">Runtime adapters</div><div class="mt-1 text-2xl font-semibold">{{ state.runtimeAdapters.length }}</div><div class="mt-2 text-xs text-muted">One neutral model, multiple generated targets.</div></UCard>
    </div>
    <div class="responsive-two">
      <UCard>
        <template #header><div class="font-semibold">What “good” means here</div></template>
        <div class="space-y-3 text-sm text-muted">
          <p><strong class="text-default">Configured</strong> means the required structures exist and references resolve.</p>
          <p><strong class="text-default">Verified</strong> means representative tasks have been run and checked against observable criteria.</p>
          <p><strong class="text-default">Safe enough for a task</strong> depends on path boundaries, tool risk, guardrails and human approvals — not on a single global badge.</p>
        </div>
      </UCard>
      <UCard>
        <template #header><div class="flex items-center justify-between"><span class="font-semibold">Environment model</span><UBadge variant="subtle">{{ requirements.length }} teachable requirements</UBadge></div></template>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span>Canonical knowledge</span><span class="text-muted">Markdown + frontmatter</span></div>
          <div class="flex justify-between"><span>Working memory</span><span class="text-muted">Context window</span></div>
          <div class="flex justify-between"><span>Durable memory</span><span class="text-muted">Vault + Git + retrieval</span></div>
          <div class="flex justify-between"><span>Runtime integration</span><span class="text-muted">Adapters + MCP</span></div>
          <div class="flex justify-between"><span>Behavior evidence</span><span class="text-muted">Evals + traces</span></div>
        </div>
      </UCard>
    </div>
  </div>
</template>
