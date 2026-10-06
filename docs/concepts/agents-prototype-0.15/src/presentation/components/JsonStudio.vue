<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PluginState } from '../../domain/shared/PluginState'
import { decodeStateJson } from '../../application/state/StateCodec'
const props = defineProps<{ state: PluginState }>()
const emit = defineEmits<{ apply: [state: PluginState] }>()
const initial = JSON.stringify(props.state, null, 2)
const baseline = ref(initial)
const draft = ref(initial)
const sourceChanged = ref(false)
const hasLocalEdits = computed(() => draft.value !== baseline.value)
const validation = computed(() => decodeStateJson(draft.value))
const issues = computed(() => validation.value.diagnostics)
const bytes = computed(() => new Blob([draft.value]).size)
watch(() => props.state, value => {
  const serialized = JSON.stringify(value, null, 2)
  if (hasLocalEdits.value) { sourceChanged.value = serialized !== baseline.value; return }
  baseline.value = serialized; draft.value = serialized
}, { deep: true })
const sync = () => {
  if (hasLocalEdits.value && !window.confirm('Discard this JSON draft and reload the current workspace?')) return
  const serialized = JSON.stringify(props.state, null, 2)
  baseline.value = serialized; draft.value = serialized; sourceChanged.value = false
}
const apply = () => {
  const result = validation.value
  if (!result.ok) return
  if (sourceChanged.value && !window.confirm('The workspace changed while you edited JSON. Replace it with this validated draft?')) return
  baseline.value = JSON.stringify(result.value, null, 2)
  draft.value = baseline.value
  sourceChanged.value = false
  emit('apply', result.value)
}
const download = () => {
  const url = URL.createObjectURL(new Blob([draft.value], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = 'agents-plugin-state.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
</script>
<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2"><div><div class="font-semibold">Agent Definition Model</div><div class="text-xs text-muted">{{bytes.toLocaleString()}} bytes · schema {{state.schemaVersion}} · {{hasLocalEdits?'Draft not applied':'Matches workspace'}}</div></div><div class="flex gap-2"><UButton color="neutral" variant="subtle" @click="sync">Reload</UButton><UButton color="neutral" variant="subtle" @click="download">Download</UButton><UButton :disabled="!validation.ok" @click="apply">Validate & apply</UButton></div></div>
    <UAlert v-if="sourceChanged" color="warning" variant="subtle" title="Workspace changed" description="Your JSON draft has been preserved. Reload or explicitly apply it to replace the newer workspace."/>
    <UAlert v-if="!validation.ok" color="error" variant="subtle" title="Cannot apply definition" :description="issues.slice(0,5).map(issue=>`${issue.path||'JSON'}: ${issue.message}`).join(' · ')"/>
    <UAlert v-else-if="issues.length" color="warning" variant="subtle" :title="`${issues.length} validation notices`" :description="issues.slice(0,3).map(issue=>`${issue.path||'State'}: ${issue.message}`).join(' · ')"/>
    <UAlert v-else color="success" variant="subtle" title="Structure is valid" description="Nested structure, references and character recipes pass validation. Runtime behavior still requires evals."/>
    <textarea v-model="draft" class="voxel-font min-h-[620px] w-full resize-y rounded-xl border border-default bg-elevated p-4 text-xs leading-5 outline-none focus:ring-2 focus:ring-primary" spellcheck="false" aria-label="Agent Definition Model JSON"/>
  </div>
</template>
