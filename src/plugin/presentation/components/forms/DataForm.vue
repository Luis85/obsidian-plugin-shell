<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import DataFormFields from './DataFormFields.vue';
import { useDataForm, type DataFormProps } from '../../composables/use-data-form';
import type { DataFormValues } from '../../../domain/forms/model';
const props = defineProps<DataFormProps>();
const emit = defineEmits<{ submit: [value: DataFormValues] }>();
const model = useDataForm(props, emit);
const { form } = model;
</script>

<template>
  <form ref="form" class="shell-form shell-data-form" :aria-labelledby="`${model.uid}-title`" :data-form="props.definition.id" novalidate @submit.prevent="model.submit">
    <div class="shell-data-form-heading"><h2 :id="`${model.uid}-title`">{{ props.definition.title }}</h2><p v-if="props.definition.description" class="shell-hint">{{ props.definition.description }}</p></div>
    <fieldset class="shell-data-form-group" :disabled="props.disabled">
      <DataFormFields :nodes="model.nodes.value" :model="model" />
    </fieldset>
    <p v-if="model.issues.value.length" role="alert" class="shell-error">{{ model.t('form.invalid') }}</p>
    <div class="shell-actions">
      <UButton type="submit" icon="i-lucide-check" :disabled="props.disabled">{{ model.submitText.value }}</UButton>
      <UButton type="button" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="props.disabled" @click="model.reset">{{ model.t('form.reset') }}</UButton>
    </div>
  </form>
</template>
