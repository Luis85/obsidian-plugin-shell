<script setup lang="ts">
import type { Agent } from '../../domain/agents/types'
import type { PluginState } from '../../domain/shared/PluginState'
defineProps<{ agent: Agent; state: PluginState }>()
</script>
<template>
  <div class="space-y-4">
    <div><h1 class="text-xl font-semibold">Instruction layers</h1><p class="text-sm text-muted">Separate standing repository rules, path rules, agent specialization and task-local context.</p></div>
    <div class="space-y-2">
      <UCard v-for="layer in [...state.instructionLayers].sort((a,b)=>a.priority-b.priority)" :key="layer.id">
        <div class="flex items-center gap-2"><UBadge variant="subtle">{{ layer.scope }}</UBadge><strong class="text-sm">{{ layer.name }}</strong><span class="ml-auto text-xs text-muted">priority {{ layer.priority }}</span></div>
        <div class="mt-2 text-xs text-muted"><span v-if="layer.sourcePath">{{ layer.sourcePath }}</span><span v-if="layer.applyTo"> · applies to {{ layer.applyTo }}</span></div>
        <p class="mt-2 text-sm">{{ layer.content }}</p>
      </UCard>
      <UCard>
        <div class="flex items-center gap-2"><UBadge variant="subtle">agent</UBadge><strong class="text-sm">{{ agent.name }} system prompt</strong><span class="ml-auto text-xs text-muted">effective specialist layer</span></div>
        <p class="mt-2 text-sm text-muted">{{ agent.systemPrompt }}</p>
      </UCard>
    </div>
  </div>
</template>
