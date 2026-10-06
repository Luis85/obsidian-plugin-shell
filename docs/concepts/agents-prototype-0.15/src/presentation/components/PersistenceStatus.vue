<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAgentsStore } from '../stores/agents'
const store = useAgentsStore()
const open = ref(false)
const errors = computed(() => store.diagnostics.filter(issue => issue.severity === 'error'))
const label = computed(() => store.recoveryRequired ? 'Storage recovery needed' : ({
  loading: 'Loading', ready: 'Browser session', unsaved: 'Unsaved changes', saving: 'Saving…', saved: 'Saved in browser', error: 'Not saved'
}[store.persistenceStatus]))
const exportSession = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(store.state, null, 2)], {type:'application/json'}))
  const link = document.createElement('a')
  link.href = url; link.download = 'agents-workspace-recovery.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
const save = () => {
  if (store.recoveryRequired && !window.confirm('Replace stored browser data with this in-memory session? Export your session first. The previous stored data could not be loaded.')) return
  void store.saveNow(store.recoveryRequired)
}
</script>
<template>
  <div class="persistence-control">
    <button class="app-status-pill" :class="{'persistence-problem':errors.length||store.recoveryRequired}" :aria-expanded="open" aria-controls="persistence-diagnostics" @click="open=!open">
      <span aria-live="polite">{{label}}</span><span v-if="errors.length"> · {{errors.length}}</span><span aria-hidden="true">⌄</span>
    </button>
    <section v-if="open" id="persistence-diagnostics" class="persistence-panel" aria-label="Workspace persistence and diagnostics">
      <header><strong>Persistence & diagnostics</strong><button aria-label="Close diagnostics" @click="open=false">×</button></header>
      <p>This prototype saves in this browser, not in your Obsidian Vault.</p>
      <p v-if="store.recoveryRequired" role="alert">Stored data could not be loaded. Autosave is blocked to avoid overwriting it. Review or export this session before replacing stored data.</p>
      <p v-else-if="store.dirty" role="status">Changes are still in memory.</p>
      <label class="persistence-autosave"><input v-model="store.state.settings.autoSave" type="checkbox"/> Autosave changes</label>
      <div class="persistence-actions"><button :disabled="store.persistenceStatus==='saving'" @click="save">{{store.recoveryRequired?'Replace stored data…':'Save now'}}</button><button @click="exportSession">Export session JSON</button></div>
      <p v-if="!store.diagnostics.length">No diagnostics.</p>
      <div class="persistence-issues" :role="errors.length?'alert':'status'">
        <article v-for="(issue,index) in store.diagnostics" :key="`${issue.code}:${issue.path}:${index}`" :data-severity="issue.severity">
          <b>{{issue.severity}} · {{issue.code}}</b><code v-if="issue.path">{{issue.path}}</code><span>{{issue.message}}</span>
        </article>
      </div>
    </section>
  </div>
</template>
