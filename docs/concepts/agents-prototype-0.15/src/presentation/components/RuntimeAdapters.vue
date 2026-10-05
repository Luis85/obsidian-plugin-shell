<script setup lang="ts">
import { formatRuntimeTargetPath } from '../formatters/runtimeTargetPath'
import type { Agent } from '../../domain/agents/types'
import type { PluginState } from '../../domain/shared/PluginState'
defineProps<{ agent: Agent; state: PluginState }>()
</script>
<template>
  <div class="space-y-4">
    <div><h1 class="text-xl font-semibold">Runtime adapters</h1><p class="text-sm text-muted">Keep the Agent Definition Model neutral and project it into runtime-specific files.</p></div>
    <div class="agent-cards">
      <UCard v-for="adapter in state.runtimeAdapters" :key="adapter.id">
        <div class="flex items-center gap-2"><strong class="text-sm">{{ adapter.name }}</strong><UBadge class="ml-auto" size="xs" :color="adapter.generated?'neutral':'success'">{{ adapter.generated?'generated':'canonical' }}</UBadge></div>
        <p class="mt-2 text-xs text-muted">{{ adapter.description }}</p>
        <code class="mt-3 block rounded bg-elevated p-2 text-xs">{{ formatRuntimeTargetPath(adapter.targetPath, agent.slug) }}</code>
      </UCard>
    </div>
    <UCard>
      <template #header><div class="font-semibold">Adapter contract</div></template>
      <div class="grid gap-3 text-sm md:grid-cols-4"><div><div class="text-xs text-muted">Input</div>Neutral agent model</div><div><div class="text-xs text-muted">Transform</div>Runtime adapter</div><div><div class="text-xs text-muted">Output</div>Generated file(s)</div><div><div class="text-xs text-muted">Rule</div>Never make generated files the hidden source of truth</div></div>
    </UCard>
  </div>
</template>
