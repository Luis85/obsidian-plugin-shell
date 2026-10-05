<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Agent } from '../../domain/agents/types'
import type { PluginState } from '../../domain/shared/PluginState'
import type { RequirementStatus } from '../../domain/shared/types'
import { requirements } from '../character-catalog/requirements'

const props = defineProps<{ agent: Agent; state: PluginState; initialId?: string }>()
const activeId = ref(props.initialId || 'memory.long')
watch(() => props.initialId, value => { if (value) activeId.value = value })
const active = computed(() => requirements.find(r => r.id === activeId.value) ?? requirements[0])
const sections = computed(() => [...new Set(requirements.map(r => r.section))])

const status = (validator: string): RequirementStatus => {
  const a = props.agent, s = props.state
  const tests: Record<string, boolean> = {
    mission: !!(a.description && a.goals.length >= 2 && a.constraints.length),
    routing: !!a.invocation?.handoffDescription,
    declarative: s.agents.every(x => !!x.id) && s.tools.every(x => !!x.id),
    schema: /^\d+\.\d+\.\d+$/.test(s.schemaVersion),
    frontmatter: s.settings.sourceOfTruth === 'markdown-frontmatter' && !!s.settings.agentsPath,
    bases: s.settings.sourceOfTruth === 'markdown-frontmatter',
    shortMemory: !!(a.shortTermMemory?.tokenBudget && a.shortTermMemory?.retrieval && a.shortTermMemory?.compaction),
    longMemory: a.dataSourceIds.includes('ds-vault') && a.dataSourceIds.includes('ds-git') && !!a.longTermMemory?.retrievalNotes,
    sources: a.dataSourceIds.length > 0 && s.dataSources.filter(x => a.dataSourceIds.includes(x.id)).every(x => !!x.trust && !!x.retrieval),
    paths: a.pathPolicies.length > 0 && a.pathPolicies.every(p => p.path && p.purpose && p.permissions.length),
    guardrails: a.guardrailIds.length > 0,
    approvals: s.tools.filter(t => a.toolIds.includes(t.id) && t.risk === 'high').every(t => t.approval !== 'never'),
    tools: a.toolIds.length > 0 && s.tools.filter(x => a.toolIds.includes(x.id)).every(t => t.inputSchema && t.outputSchema),
    mcp: s.mcpServers.every(m => !!m.protocolVersion && !!m.transport),
    skills: a.skillIds.length > 0 && s.skills.filter(x => a.skillIds.includes(x.id)).every(sk => !!sk.entrypoint),
    instructions: a.instructionLayerIds.length > 0 && s.instructionLayers.length > 0,
    relations: s.relations.some(r => r.fromAgentId === a.id || r.toAgentId === a.id),
    versions: !!a.version && (a.kind === 'general' || !!a.variantOf),
    evals: a.evals.length > 0,
    traces: a.evals.some(e => !!e.lastRunAt),
    runtime: s.runtimeAdapters.length >= 3 && !!s.settings.generatedPath
  }
  const passed = tests[validator] ?? false
  if (passed) return 'complete'
  if (['evals','traces','mcp','approvals'].includes(validator)) return 'partial'
  return 'missing'
}
const statusColor = (x: RequirementStatus) => x === 'complete' ? 'success' : x === 'partial' ? 'warning' : x === 'not-applicable' ? 'neutral' : 'error'
</script>

<template>
  <div class="space-y-4">
    <div><h1 class="text-xl font-semibold">Agent requirements academy</h1><p class="text-sm text-muted">Select a requirement to learn what the agent needs, why it matters, how to implement it, and how this definition currently measures up.</p></div>
    <UAlert color="primary" variant="subtle" title="Teaching is part of the model" description="Requirements are data, not hard-coded help text. They can be versioned, filtered by maturity, linked to configuration evidence, and extended as agent practices evolve."/>
    <div class="academy-grid">
      <UCard class="academy-menu">
        <div v-for="section in sections" :key="section" class="mb-4">
          <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{{ section }}</div>
          <UButton v-for="req in requirements.filter(r=>r.section===section)" :key="req.id" class="mb-1 w-full justify-start text-left" :color="activeId===req.id?'primary':'neutral'" :variant="activeId===req.id?'soft':'ghost'" @click="activeId=req.id">
            <UBadge class="mr-2" size="xs" :color="statusColor(status(req.validator))" variant="subtle">{{ status(req.validator) }}</UBadge>{{ req.title }}
          </UButton>
        </div>
      </UCard>
      <UCard>
        <template #header><div class="flex flex-wrap items-center gap-2"><div><div class="text-xs text-muted">{{ active.section }} · {{ active.maturity }}</div><div class="font-semibold">{{ active.title }}</div></div><UBadge class="ml-auto" :color="statusColor(status(active.validator))" variant="subtle">{{ status(active.validator) }}</UBadge></div></template>
        <div class="space-y-4">
          <div><div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">What the agent needs</div><p class="text-sm">{{ active.need }}</p></div>
          <div class="responsive-two">
            <UCard variant="subtle"><div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Why</div><p class="text-sm text-muted">{{ active.why }}</p></UCard>
            <UCard variant="subtle"><div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">How to fulfill</div><p class="text-sm text-muted">{{ active.fulfill }}</p></UCard>
          </div>
          <div><div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Completion checks</div><ul class="list-disc space-y-1 pl-5 text-sm text-muted"><li v-for="x in active.checks" :key="x">{{ x }}</li></ul></div>
          <div><div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Example</div><pre class="voxel-font whitespace-pre-wrap rounded-lg border border-default bg-elevated p-3 text-xs">{{ active.example }}</pre></div>
          <div><div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Anti-patterns</div><ul class="list-disc space-y-1 pl-5 text-sm text-muted"><li v-for="x in active.antiPatterns" :key="x">{{ x }}</li></ul></div>
          <div v-if="active.sources.length"><div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Research basis</div><div v-for="source in active.sources" :key="source.url" class="text-sm"><a class="text-primary underline" :href="source.url" target="_blank" rel="noreferrer">{{ source.label }}</a></div></div>
        </div>
      </UCard>
    </div>
  </div>
</template>
