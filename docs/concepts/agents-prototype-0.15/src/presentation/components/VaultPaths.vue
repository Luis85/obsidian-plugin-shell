<script setup lang="ts">
import type { Agent } from '../../domain/agents/types'
import type { Permission } from '../../domain/shared/types'
const props=defineProps<{ agent: Agent }>()
const permissions: Permission[]=['read','search','write','create','delete']
const toggle=(policy:Agent['pathPolicies'][number],permission:Permission)=>{const i=policy.permissions.indexOf(permission); if(i>=0)policy.permissions.splice(i,1);else policy.permissions.push(permission)}
</script>
<template>
  <div class="space-y-4">
    <UAlert color="info" variant="subtle" title="Path policies are capabilities" description="Agents do not implicitly own the whole vault. Give each role explicit read/search/write/create/delete scopes and a reason for the access." />
    <UCard><template #header><div><div class="font-semibold">Read/write map</div><div class="text-xs text-muted">Production implementation should normalize user-defined paths and enforce them at the tool boundary.</div></div></template>
      <div v-for="policy in agent.pathPolicies" :key="policy.id" class="mb-3 rounded-lg border border-default bg-elevated p-3">
        <div class="grid gap-3 md:grid-cols-[160px_1fr]"><UFormField label="Entity"><UInput v-model="policy.entity"/></UFormField><UFormField label="Vault / repo path"><UInput v-model="policy.path" class="voxel-font"/></UFormField></div>
        <UFormField class="mt-3" label="Purpose"><UInput v-model="policy.purpose"/></UFormField>
        <div class="mt-3 flex flex-wrap gap-2"><UButton v-for="perm in permissions" :key="perm" size="xs" :color="policy.permissions.includes(perm)?(perm==='delete'?'error':'primary'):'neutral'" :variant="policy.permissions.includes(perm)?'soft':'ghost'" @click="toggle(policy,perm)">{{ perm }}</UButton></div>
      </div>
    </UCard>
  </div>
</template>
