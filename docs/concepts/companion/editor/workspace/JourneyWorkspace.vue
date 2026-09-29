<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import { useWorkspace } from './use-workspace.ts';
import './workspace.css';
const model = useWorkspace();
const root = model.root;
</script>
<template>
  <section class="jl-workspace" aria-label="Journey Lens project workspace" :aria-busy="model.working.value" :data-journey-mode="model.native?'native':'preview'" @keydown.esc="model.escapeReview">
    <div class="jl-filebar">
      <label>Project file <input v-model="model.path.value" aria-label="Project file" :disabled="model.working.value||model.importOpen.value||model.recoveryOpen.value" spellcheck="false" autocomplete="off" /></label>
      <UButton :loading="model.busy.value&&!model.importOpen.value&&!model.recoveryOpen.value" :disabled="model.working.value||model.importOpen.value||model.recoveryOpen.value" @click="model.openFile">Open file</UButton>
      <UButton variant="outline" color="neutral" :disabled="model.working.value||model.importOpen.value||model.recoveryOpen.value" @click="model.beginImport(true)">Create from generated definition</UButton>
      <UButton variant="outline" color="neutral" :disabled="model.working.value||model.importOpen.value||model.recoveryOpen.value" @click="model.beginImport(false)">Import project JSON</UButton>
      <UButton variant="ghost" color="neutral" :disabled="!model.loaded.value||model.working.value" @click="model.exportSaved">Export saved project</UButton>
      <UButton variant="ghost" color="neutral" :disabled="model.working.value||model.recoveryOpen.value" @click="model.beginRecovery">Review recovery</UButton>
    </div>
    <div class="jl-file-context">
      <p v-if="model.activePath.value" class="jl-active-file">Active file: <strong>{{ model.activePath.value }}</strong><span v-if="model.path.value!==model.activePath.value"> · The entered path has not been opened.</span></p>
      <p v-else class="jl-active-file">No project file is open. Opening a path never creates or replaces a file.</p>
      <p role="status" class="jl-file-status" aria-live="polite">{{ model.readingImport.value?'Reading the selected file…':model.busy.value?'Working with the selected project…':model.message.value }}</p>
    </div>
    <p v-if="model.error.value" role="alert" class="jm-error">{{ model.error.value }}</p>
    <section v-if="model.importOpen.value" class="jl-review" aria-label="Review project import">
      <h3 tabindex="-1" data-jl-review-title>Review project import</h3>
      <p>Imported JSON is data, not executable code. All project sections are validated and preserved. The destination’s parent folder must already exist.</p>
      <p class="jl-review-path">Destination: <strong>{{ model.path.value }}</strong></p>
      <label>Choose project JSON <input type="file" accept=".json,.companion,application/json" :disabled="model.working.value" @change="model.readImport(($event.target as HTMLInputElement).files?.[0])" /></label>
      <label>Project JSON <textarea v-model="model.importText.value" :disabled="model.working.value" @input="model.invalidateReview" rows="5" spellcheck="false" /></label>
      <label>Import mode <select v-model="model.importMode.value" :disabled="model.working.value" @change="model.invalidateReview"><option value="create">Create a new file</option><option value="replace" :disabled="!model.canReplace.value">Replace the opened project</option></select></label>
      <UButton :disabled="model.working.value||model.readingImport.value" @click="model.reviewImport">Validate and review</UButton>
      <p v-if="model.reviewed.value">{{ model.summary.value }}</p>
      <label v-if="model.reviewed.value" class="jl-confirm"><input v-model="model.confirmed.value" type="checkbox" :disabled="model.working.value" /> I approve this complete project write</label>
      <div class="jm-actions"><UButton :loading="model.busy.value" :disabled="!model.reviewed.value||!model.confirmed.value||model.working.value||model.readingImport.value" @click="model.applyImport">Apply project import</UButton><UButton variant="ghost" color="neutral" :disabled="model.working.value" @click="model.cancelImport">Cancel import</UButton></div>
    </section>
    <section v-if="model.recoveryOpen.value" class="jl-review" aria-label="Project recovery">
      <h3 tabindex="-1" data-jl-review-title>Project recovery</h3>
      <p class="jl-review-path">Read saved file: <strong>{{ model.recoveryPath.value }}</strong></p>
      <p>Download the current draft first. Reload validates the saved file and replaces this view’s draft and undo history. It never repairs or overwrites invalid stored data.</p>
      <UButton variant="outline" color="neutral" :disabled="!model.loaded.value||model.working.value" @click="model.exportRecovery">Download current draft recovery</UButton>
      <p>Restore a recovery only to its matching saved design. Restoring replaces this view’s unsaved draft; download it first.</p>
      <label>Restore matching draft recovery <input type="file" accept=".json,application/json" :disabled="!model.loaded.value||model.working.value" @change="model.restoreRecovery(($event.target as HTMLInputElement).files?.[0])" /></label>
      <label class="jl-confirm"><input v-model="model.recoveryConfirmed.value" type="checkbox" :disabled="model.working.value" /> Discard this editor’s unsaved draft and use the saved file</label>
      <div class="jm-actions"><UButton :loading="model.busy.value" :disabled="!model.recoveryConfirmed.value||model.working.value" @click="model.reloadStored">Reload saved file</UButton><UButton variant="ghost" color="neutral" :disabled="model.working.value" @click="model.cancelRecovery">Cancel recovery</UButton></div>
    </section>
    <div ref="root" v-show="model.loaded.value" :inert="model.busy.value||model.importOpen.value||model.recoveryOpen.value" class="jl-editor-host"></div>
  </section>
</template>
