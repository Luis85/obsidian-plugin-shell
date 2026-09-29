<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import { useWorkspace } from './use-workspace.ts';
const model = useWorkspace();
const root = model.root;
import './workspace.css';
</script>
<template>
  <section class="jl-workspace" aria-label="Journey Lens project workspace" :data-journey-mode="model.native?'native':'preview'">
    <div class="jl-filebar"><label>Project file <input v-model="model.path.value" aria-label="Project file" :disabled="model.busy.value||model.importOpen.value||model.recoveryOpen.value" /></label>
      <UButton :disabled="model.busy.value" @click="model.openFile">Open file</UButton>
      <UButton variant="outline" color="neutral" :disabled="model.busy.value" @click="model.beginImport(true)">Create from generated definition</UButton>
      <UButton variant="outline" color="neutral" :disabled="model.busy.value" @click="model.beginImport(false)">Import project JSON</UButton>
      <UButton variant="ghost" color="neutral" :disabled="model.busy.value" @click="model.beginRecovery">Review recovery</UButton>
    </div>
    <p role="status" class="jl-file-status">{{ model.message.value }}</p><p v-if="model.error.value" role="alert" class="jm-error">{{ model.error.value }}</p>
    <section v-if="model.importOpen.value" class="jl-review" aria-label="Review project import">
      <h3>Review project import</h3><p>Imported JSON is data, not executable code. All project sections are validated and preserved. The destination’s parent folder must already exist.</p>
      <label>Choose project JSON <input type="file" accept=".json,.companion,application/json" :disabled="model.busy.value" @change="model.readImport(($event.target as HTMLInputElement).files?.[0])" /></label>
      <label>Project JSON <textarea v-model="model.importText.value" :disabled="model.busy.value" @input="model.invalidateReview" rows="5" /></label>
      <label>Import mode <select v-model="model.importMode.value" :disabled="model.busy.value" @change="model.invalidateReview"><option value="create">Create a new file</option><option value="replace" :disabled="!model.canReplace.value">Replace the opened project</option></select></label>
      <UButton :disabled="model.busy.value" @click="model.reviewImport">Validate and review</UButton>
      <p v-if="model.reviewed.value">{{ model.summary.value }}</p><label v-if="model.reviewed.value"><input v-model="model.confirmed.value" type="checkbox" :disabled="model.busy.value" /> I approve this complete project write</label>
      <div class="jm-actions"><UButton :disabled="!model.reviewed.value||!model.confirmed.value||model.busy.value" @click="model.applyImport">Apply project import</UButton><UButton variant="ghost" color="neutral" :disabled="model.busy.value" @click="model.cancelImport">Cancel import</UButton></div>
    </section>
    <section v-if="model.recoveryOpen.value" class="jl-review" aria-label="Project recovery">
      <h3>Project recovery</h3><p>Download the current draft first. Reload reads and validates the actual saved file, discards the local editor draft and history, and explicitly resolves an uncertain save. It never repairs or overwrites invalid stored data. Restoring a recovery replaces this leaf’s unsaved draft; download it first.</p>
      <UButton variant="outline" color="neutral" :disabled="!model.loaded.value||model.busy.value" @click="model.exportRecovery">Download current draft recovery</UButton>
      <label>Restore matching draft recovery <input type="file" accept=".json,application/json" :disabled="!model.loaded.value||model.busy.value" @change="model.restoreRecovery(($event.target as HTMLInputElement).files?.[0])" /></label>
      <label><input v-model="model.recoveryConfirmed.value" type="checkbox" :disabled="model.busy.value" /> Discard this editor’s unsaved draft and use the saved file</label>
      <div class="jm-actions"><UButton :disabled="!model.recoveryConfirmed.value||model.busy.value" @click="model.reloadStored">Reload saved file</UButton><UButton variant="ghost" color="neutral" :disabled="model.busy.value" @click="model.recoveryOpen.value=false">Cancel recovery</UButton></div>
    </section>
    <div ref="root" v-show="model.loaded.value" class="jl-editor-host"></div>
  </section>
</template>
