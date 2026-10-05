<script setup lang="ts">
import type { Agent } from '../../domain/agents/types'
defineProps<{ agent: Agent }>()
const primaryAttributes = ['st', 'dx', 'iq', 'ht'] as const
const secondaryAttributes = ['hp', 'will', 'per', 'fp'] as const
</script>

<template>
  <div class="space-y-4">
    <UAlert color="neutral" variant="subtle" title="GURPS-compatible character structure" description="Uses the familiar core attribute and sheet structure as editable agent metadata. Rules text and proprietary trait catalogs are intentionally not reproduced." />
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <UFormField v-for="key in primaryAttributes" :key="key" :label="key.toUpperCase()">
        <UInput v-model.number="agent.gurps[key]" type="number" />
      </UFormField>
      <UFormField v-for="key in secondaryAttributes" :key="key" :label="key.toUpperCase()">
        <UInput v-model.number="agent.gurps[key]" type="number" />
      </UFormField>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <UFormField label="Point total"><UInput v-model.number="agent.gurps.pointTotal" type="number" /></UFormField>
      <UFormField label="Unspent points"><UInput v-model.number="agent.gurps.unspentPoints" type="number" /></UFormField>
    </div>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <UCard>
        <template #header><div class="font-semibold">Advantages</div></template>
        <div class="space-y-2"><div v-for="item in agent.gurps.advantages" :key="item.id" class="rounded-lg bg-elevated p-2"><div class="font-medium">{{ item.name }} <span class="text-muted">[{{ item.points }}]</span></div><div class="text-xs text-muted">{{ item.notes }}</div></div></div>
      </UCard>
      <UCard>
        <template #header><div class="font-semibold">Disadvantages</div></template>
        <div class="space-y-2"><div v-for="item in agent.gurps.disadvantages" :key="item.id" class="rounded-lg bg-elevated p-2"><div class="font-medium">{{ item.name }} <span class="text-muted">[{{ item.points }}]</span></div><div class="text-xs text-muted">{{ item.notes }}</div></div></div>
      </UCard>
      <UCard>
        <template #header><div class="font-semibold">Quirks</div></template>
        <div class="space-y-2"><div v-for="item in agent.gurps.quirks" :key="item.id" class="rounded-lg bg-elevated p-2"><div class="font-medium">{{ item.name }}</div><div class="text-xs text-muted">{{ item.notes }}</div></div></div>
      </UCard>
    </div>
    <UCard>
      <template #header><div class="flex items-center justify-between"><div class="font-semibold">Character skills</div><UBadge color="neutral" variant="subtle">Agent metaphor + RPG sheet</UBadge></div></template>
      <div class="grid grid-cols-[minmax(0,1fr)_72px_72px] gap-2 text-xs text-muted"><span>Name</span><span>Level</span><span>Points</span></div>
      <div v-for="skill in agent.gurps.skills" :key="skill.id" class="mt-2 grid grid-cols-[minmax(0,1fr)_72px_72px] gap-2"><UInput v-model="skill.name"/><UInput v-model.number="skill.level" type="number"/><UInput v-model.number="skill.points" type="number"/></div>
    </UCard>
  </div>
</template>
