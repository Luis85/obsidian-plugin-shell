<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import { useTaskRepository } from '../../composables/use-task-repository';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const { uid, notes, selected, error, busy, loaded, confirming, message, draft, form, edit, reload, save, remove } = useTaskRepository();
</script>
<template>
  <section class="shell-repository" :aria-labelledby="`${uid}-repository`" :aria-busy="busy" data-testid="task-repository">
    <div class="shell-section-heading"><h2 :id="`${uid}-repository`">{{ t('repo.title') }}</h2><UButton color="neutral" variant="outline" :loading="busy" @click="reload">{{ t('repo.reload') }}</UButton></div>
    <p class="shell-hint">{{ t('repo.help') }}</p>
    <p v-if="!loaded" class="shell-empty-text">{{ t('repo.initial') }}</p>
    <p v-else-if="!notes.length" class="shell-empty-text">{{ t('repo.empty') }}</p>
    <ul v-else class="shell-note-list">
      <li v-for="note in notes" :key="note.path"><div><strong>{{ note.values.title }}</strong><small>{{ t(`repo.${note.values.status}`) }} · {{ note.path }}</small></div><UButton color="neutral" variant="outline" :disabled="busy" :aria-label="t('repo.editNamed', { title: note.values.title })" @click="edit(note)">{{ t('repo.edit') }}</UButton></li>
    </ul>
    <p v-if="error" :id="`${uid}-error`" class="shell-error" role="alert">{{ t(error.key) }} <span v-if="error.code === 'stale'">{{ t('repo.stale') }}</span></p>
    <p v-if="message" class="shell-created" role="status">{{ t(message) }}</p>
    <form v-if="selected" ref="form" class="shell-form shell-note-editor" @submit.prevent="save">
      <h3>{{ t('repo.editing', { title: selected.values.title }) }}</h3>
      <code>{{ selected.path }}</code>
      <fieldset :disabled="busy || error?.effect === 'uncertain'">
        <div class="shell-field"><label :for="`${uid}-edit-title`">{{ t('repo.editTitle') }}</label><UInput :id="`${uid}-edit-title`" v-model="draft.title" name="edit-title" :aria-invalid="error?.field === 'title'" :aria-describedby="error?.field === 'title' ? `${uid}-error` : undefined" /></div>
        <div class="shell-field"><label :for="`${uid}-edit-status`">{{ t('repo.status') }}</label><select :id="`${uid}-edit-status`" v-model="draft.status" name="edit-status"><option value="todo">{{ t('repo.todo') }}</option><option value="doing">{{ t('repo.doing') }}</option><option value="done">{{ t('repo.done') }}</option></select></div>
        <div class="shell-field"><label :for="`${uid}-edit-due`">{{ t('repo.editDue') }}</label><UInput :id="`${uid}-edit-due`" v-model="draft.due" type="date" name="edit-due" :aria-invalid="error?.field === 'due'" :aria-describedby="error?.field === 'due' ? `${uid}-error` : undefined" /></div>
        <div class="shell-field"><label :for="`${uid}-edit-tags`">{{ t('repo.editTags') }}</label><UInput :id="`${uid}-edit-tags`" v-model="draft.tags" name="edit-tags" :aria-invalid="error?.field === 'tags'" :aria-describedby="error?.field === 'tags' ? `${uid}-error` : undefined" /></div>
        <div class="shell-actions"><UButton type="submit">{{ t('repo.save') }}</UButton><UButton color="error" variant="outline" @click="confirming = true">{{ t('repo.delete') }}</UButton></div>
        <div v-if="confirming" class="shell-trash-confirm"><p>{{ t('repo.confirm', { title: selected.values.title }) }}</p><div class="shell-actions"><UButton color="error" @click="remove">{{ t('repo.confirmDelete') }}</UButton><UButton color="neutral" variant="ghost" @click="confirming = false">{{ t('repo.cancel') }}</UButton></div></div>
      </fieldset>
    </form>
  </section>
</template>
