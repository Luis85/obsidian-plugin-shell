<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useItems } from '../../stores/items';
const model = useItems();
const uid = useId();
const { t } = useI18n();
</script>
<template>
  <section class="shell-repository" :aria-labelledby="`${uid}-items`" :aria-busy="model.pending || model.loading" data-testid="items-repository">
    <div class="shell-section-heading"><h2 :id="`${uid}-items`">{{ t('items.title') }}</h2><UButton color="neutral" variant="outline" :disabled="model.pending || model.blocked" :loading="model.loading" @click="model.reload">{{ t('items.reload') }}</UButton></div>
    <p class="shell-hint">{{ t('items.help') }}</p>
    <p v-if="model.error" :id="`${uid}-error`" class="shell-error" role="alert">{{ t(model.error.key) }} <span v-if="model.error.code === 'stale'">{{ t('items.stale') }}</span></p>
    <p v-if="model.pending" role="status">{{ t('items.pending') }}</p>
    <p v-else-if="model.message" class="shell-created" role="status">{{ t(model.message) }}</p>
    <form class="shell-form" @submit.prevent="model.create">
      <div class="shell-field"><label :for="`${uid}-new-label`">{{ t('items.newLabel') }}</label><UInput :id="`${uid}-new-label`" v-model="model.createDraft" name="item-label" :disabled="model.pending || model.blocked" :aria-invalid="model.errorTarget === 'create' && model.error?.field === 'label'" :aria-describedby="`${uid}-hint ${model.error ? `${uid}-error` : ''}`" /><small :id="`${uid}-hint`">{{ t('items.labelHint') }}</small></div>
      <UButton type="submit" :disabled="model.pending || model.blocked">{{ t('items.create') }}</UButton>
    </form>
    <p v-if="!model.loaded && !model.error" class="shell-empty-text">{{ t('items.loading') }}</p>
    <p v-else-if="model.loaded && !model.items.length" class="shell-empty-text">{{ t('items.empty') }}</p>
    <ul v-else class="shell-note-list">
      <li v-for="item in model.items" :key="item.id"><div><strong>{{ item.values.label }}</strong></div><UButton color="neutral" variant="outline" :disabled="model.pending || model.blocked" :aria-label="t('items.editNamed', { label: item.values.label })" @click="model.edit(item)">{{ t('items.edit') }}</UButton></li>
    </ul>
    <form v-if="model.selected" class="shell-form shell-note-editor" @submit.prevent="model.rename">
      <h3>{{ t('items.editing', { label: model.selected.values.label }) }}</h3>
      <div class="shell-field"><label :for="`${uid}-rename-label`">{{ t('items.renameLabel') }}</label><UInput :id="`${uid}-rename-label`" v-model="model.renameDraft" name="item-rename" :disabled="model.pending || model.blocked" :aria-invalid="model.errorTarget === 'rename' && model.error?.field === 'label'" :aria-describedby="model.error ? `${uid}-error` : `${uid}-hint`" /></div>
      <div class="shell-actions"><UButton type="submit" :disabled="model.pending || model.blocked">{{ t('items.rename') }}</UButton><UButton color="error" variant="outline" :disabled="model.pending || model.blocked" @click="model.remove">{{ t('items.delete') }}</UButton></div>
    </form>
  </section>
</template>

